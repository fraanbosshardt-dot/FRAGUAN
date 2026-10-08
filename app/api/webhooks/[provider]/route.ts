import { resendWebhook } from '@/lib/order-email-outbox';
import { env } from 'cloudflare:workers';
import { forwardStoreApi } from '@/lib/store-api';
import { z } from 'zod';
import {
  AppError,
  fail,
  readJsonBody,
  reply,
  requireJsonRequest,
} from '@/lib/auth';
import { confirmOnlinePaymentWebhook } from '@/lib/online-store';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function secureEqual(received: string, expected: string) {
  let difference = received.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1)
    difference |=
      (received.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  return difference === 0;
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
  const timestamp = Number(parts.ts);
  const timestampMs = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 10 * 60_000
  )
    throw new AppError(401, 'Firma de Mercado Pago vencida.');
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
  if (!secureEqual(parts.v1, expected))
    throw new AppError(401, 'Firma de Mercado Pago inválida.');
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
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw new AppError(502, 'No pudimos verificar el pago en Mercado Pago.');
  const payment: any = await response.json();
  if (payment.currency_id !== 'ARS')
    throw new AppError(409, 'La moneda informada por Mercado Pago no es ARS.');
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
    const forwarded = await forwardStoreApi(req);
    if (forwarded) return forwarded;
    requireJsonRequest(req, 65536);
    enforceRateLimit(req, 'payment-webhook', 300, 60_000);
    const provider = (await params).provider.slice(0, 30).toLowerCase();
    if (!/^[a-z0-9_-]{2,30}$/.test(provider))
      throw new AppError(404, 'Proveedor de pago inválido.');
    if (provider === 'resend') return reply(await resendWebhook(req));
    const raw = await readJsonBody(req, 65536);
    if (provider === 'mercadopago')
      return reply(await mercadoPagoEvent(req, raw));
    const secret = env.ONLINE_PAYMENT_WEBHOOK_SECRET;
    if (
      !secret ||
      !secureEqual(req.headers.get('x-fraguan-webhook-secret') ?? '', secret)
    )
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
