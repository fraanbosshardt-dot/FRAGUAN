import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { AppError, fail, reply } from '@/lib/auth';
import { confirmOnlinePaymentWebhook } from '@/lib/online-store';

export const dynamic = 'force-dynamic';

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyMercadoPago(req: Request, dataId: string) {
  const secret = env.MERCADO_PAGO_WEBHOOK_SECRET;
  const signature = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  if (!secret || !signature || !requestId)
    throw new AppError(401, 'Firma de Mercado Pago inválida.');
  const parts = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('=')),
  );
  if (!parts.ts || !parts.v1)
    throw new AppError(401, 'Firma de Mercado Pago inválida.');
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)),
  );
  if (expected.length !== parts.v1.length)
    throw new AppError(401, 'Firma de Mercado Pago inválida.');
  let difference = 0;
  for (let index = 0; index < expected.length; index++)
    difference |= expected.charCodeAt(index) ^ parts.v1.charCodeAt(index);
  if (difference) throw new AppError(401, 'Firma de Mercado Pago inválida.');
}

async function mercadoPagoEvent(req: Request, raw: any) {
  const paymentId = String(
    new URL(req.url).searchParams.get('data.id') ?? raw?.data?.id ?? '',
  );
  if (!paymentId) throw new AppError(400, 'Falta el identificador del pago.');
  await verifyMercadoPago(req, paymentId);
  if (!env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new AppError(503, 'Mercado Pago no está configurado.');
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` },
    },
  );
  if (!response.ok)
    throw new AppError(502, 'No pudimos verificar el pago en Mercado Pago.');
  const payment: any = await response.json();
  return confirmOnlinePaymentWebhook({
    provider: 'mercadopago',
    eventId: `mercadopago:${String(raw?.id ?? paymentId)}:${String(payment.status)}`,
    reference: String(payment.external_reference ?? ''),
    status: String(payment.status ?? ''),
    amount: Math.round(Number(payment.transaction_amount) * 100),
    payload: { notification: raw, payment },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const provider = (await params).provider.slice(0, 50).toLowerCase();
    const raw = await req.json();
    if (provider === 'mercadopago')
      return reply(await mercadoPagoEvent(req, raw));
    const secret = env.ONLINE_PAYMENT_WEBHOOK_SECRET;
    if (!secret || req.headers.get('x-fraguan-webhook-secret') !== secret)
      throw new AppError(401, 'Firma de webhook inválida.');
    const event = z
      .looseObject({
        eventId: z.string().min(3).max(200),
        reference: z.string().min(3).max(200),
        status: z.string().min(2).max(40),
        amountMinor: z.number().int().positive(),
      })
      .parse(raw);
    return reply(
      await confirmOnlinePaymentWebhook({
        provider,
        eventId: `${provider}:${event.eventId}`,
        reference: event.reference,
        status: event.status,
        amount: event.amountMinor,
        payload: raw,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
