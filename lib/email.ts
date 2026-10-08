import { orderEmailLink } from './order-email-link';
import { enqueueOrderEmail, runOrderEmailQueue } from './order-email-outbox';
import {
  emailFrame,
  escapeHtml,
  orderEmail,
  orderEmailTitles,
  verificationEmail,
} from './email-template';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { Actor, AppError, requirePermission } from './auth';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';

export function emailConfiguration(
  channel: 'orders' | 'marketing' | 'verification' = 'orders',
) {
  const from =
    (channel === 'verification'
      ? env.RESEND_VERIFICATION_FROM || 'FRAGUAN <noreply@fraguan.com>'
      : channel === 'marketing'
        ? env.RESEND_MARKETING_FROM
        : env.RESEND_FROM
    )?.trim() ?? '';
  return { from, configured: Boolean(env.RESEND_API_KEY?.trim() && from) };
}

async function deliver(input: {
  channel?: 'orders' | 'marketing' | 'verification';
  to: string;
  subject: string;
  html: string;
  kind: string;
  orderId?: string;
  campaignId?: string;
  idempotencyKey: string;
}) {
  const deliveryId = id(),
    createdAt = now();
  const configuration = emailConfiguration(input.channel);
  if (!configuration.configured) return { sent: false, configured: false };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: configuration.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        String(result.message ?? `Resend respondió ${response.status}`),
      );
    await statement(
      "INSERT INTO email_deliveries(id,kind,recipient,orderId,campaignId,providerId,status,createdAt) VALUES (?,?,?,?,?,?, 'sent',?)",
      deliveryId,
      input.kind,
      input.to,
      input.orderId ?? null,
      input.campaignId ?? null,
      String(result.id ?? ''),
      createdAt,
    ).run();
    return { sent: true, configured: true };
  } catch (cause) {
    await statement(
      "INSERT INTO email_deliveries(id,kind,recipient,orderId,campaignId,status,error,createdAt) VALUES (?,?,?,?,?,'failed',?,?)",
      deliveryId,
      input.kind,
      input.to,
      input.orderId ?? null,
      input.campaignId ?? null,
      String(cause instanceof Error ? cause.message : cause).slice(0, 500),
      createdAt,
    ).run();
    return { sent: false, configured: true };
  }
}

export async function sendMarketingEmail(input: {
  to: string;
  subject: string;
  title: string;
  preheader: string;
  content: string;
  action?: { label: string; url: string };
  kind: string;
  entityId: string;
}) {
  return deliver({
    channel: 'marketing',
    to: input.to,
    subject: input.subject,
    html: emailFrame(input.title, input.preheader, input.content, input.action),
    kind: input.kind,
    idempotencyKey: `marketing-${input.kind}-${input.entityId}`,
  });
}

export async function sendEmailVerificationCode(
  email: string,
  code: string,
  nonce: string,
) {
  return deliver({
    channel: 'verification',
    to: email,
    subject: `${code} es tu código FRAGUAN`,
    html: verificationEmail(code),
    kind: 'email_verification',
    idempotencyKey: `email-verification-${nonce}`,
  });
}

export async function sendOrderEmails(
  orderId: string,
  event:
    | 'created'
    | 'paid'
    | 'preparing'
    | 'ready_pickup'
    | 'shipped'
    | 'delivered',
) {
  const order = await one<Record<string, any>>(
    'SELECT * FROM online_orders WHERE id=?',
    orderId,
  );
  if (!order) return;
  const titles = orderEmailTitles;
  const items = await rows<{
    productName: string;
    color: string;
    size: string;
    quantity: number;
    lineTotal: number;
  }>(
    'SELECT productName,color,size,quantity,lineTotal FROM online_order_items WHERE orderId=? ORDER BY id',
    orderId,
  );
  const html = orderEmail(
    { ...order, trackingUrl: await orderEmailLink(orderId) } as Parameters<typeof orderEmail>[0],
    items,
    event,
  );
  await enqueueOrderEmail({
    to: order.email,
    subject: `${titles[event]} Pedido #${order.orderNumber}`,
    html,
    kind: `order_${event}`,
    orderId,
    idempotencyKey: `order-${orderId}-${event}-customer`,
  });
  if (event === 'created' && env.RESEND_ORDER_TO)
    await enqueueOrderEmail({
      to: env.RESEND_ORDER_TO,
      subject: `Nuevo pedido FRAGUAN #${order.orderNumber}`,
      html: emailFrame(
        'NUEVO PEDIDO ONLINE.',
        order.customerName,
        `<p><strong>${escapeHtml(order.customerName)}</strong> · ${escapeHtml(order.email)}</p><p>Total: <strong>$${(Number(order.total) / 100).toLocaleString('es-AR')}</strong></p><p>Referencia: <strong>${escapeHtml(order.transferReference)}</strong></p>`,
      ),
      kind: 'order_internal',
      orderId,
      idempotencyKey: `order-${orderId}-internal`,
    });
  await runOrderEmailQueue(2);
}

export async function sendReturnRequestEmails(requestId: string) {
  const request = await one<Record<string, any>>(
    'SELECT * FROM online_return_requests WHERE id=?',
    requestId,
  );
  if (!request) return;
  const kind =
    request.kind === 'withdrawal'
      ? 'arrepentimiento'
      : request.kind === 'exchange'
        ? 'cambio'
        : 'devolución';
  await deliver({
    to: request.email,
    subject: `RECIBIMOS TU SOLICITUD ${request.code}`,
    html: emailFrame(
      'SOLICITUD RECIBIDA.',
      `Código ${request.code}`,
      `<p>Hola ${escapeHtml(request.customerName)},</p><p>Registramos tu solicitud de ${kind} para el pedido <strong>#${request.orderNumber}</strong>.</p><p>Código de identificación: <strong>${escapeHtml(request.code)}</strong>.</p><p>Atención al Cliente continuará la gestión por este mismo email.</p>`,
    ),
    kind: 'return_request_customer',
    orderId: request.orderId,
    idempotencyKey: `return-${requestId}-customer`,
  });
  if (env.RESEND_ORDER_TO)
    await deliver({
      to: env.RESEND_ORDER_TO,
      subject: `Solicitud de ${kind} ${request.code}`,
      html: emailFrame(
        'NUEVA SOLICITUD.',
        `Pedido #${request.orderNumber}`,
        `<p><strong>${escapeHtml(request.customerName)}</strong> · ${escapeHtml(request.email)}</p><p>${escapeHtml(request.reason)}</p><p>${escapeHtml(request.detail)}</p>`,
      ),
      kind: 'return_request_internal',
      orderId: request.orderId,
      idempotencyKey: `return-${requestId}-internal`,
    });
}

const subscriberInput = z
  .object({
    email: z.email().trim().toLowerCase().max(200),
    name: z.string().trim().max(100).default(''),
    source: z.string().trim().max(80).default('storefront'),
  })
  .strict();
export async function subscribeNewsletter(raw: unknown) {
  const input = subscriberInput.parse(raw),
    timestamp = now();
  const existing = await one<{ id: string }>(
    'SELECT id FROM newsletter_subscribers WHERE email=?',
    input.email,
  );
  if (existing) {
    await statement(
      "UPDATE newsletter_subscribers SET name=?,status='active',source=?,updatedAt=?,unsubscribedAt=NULL WHERE id=?",
      input.name,
      input.source,
      timestamp,
      existing.id,
    ).run();
    return { ok: true, subscribed: true };
  }
  const subscriberId = id(),
    token = crypto.randomUUID() + crypto.randomUUID();
  await statement(
    'INSERT INTO newsletter_subscribers(id,email,name,status,source,unsubscribeToken,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)',
    subscriberId,
    input.email,
    input.name,
    'active',
    input.source,
    token,
    timestamp,
    timestamp,
  ).run();
  const origin = env.SITE_ORIGIN?.replace(/\/$/, '') ?? '';
  await deliver({
    channel: 'marketing',
    to: input.email,
    subject: 'NOVEDADES DE FRAGUAN.',
    html: emailFrame(
      'BIENVENIDO A LAS NOVEDADES.',
      'Acceso a novedades y drops.',
      '<p>Te suscribiste para recibir novedades y nuevos ingresos de FRAGUAN.</p>' +
        (origin
          ? `<p><a href="${escapeHtml(origin)}/api/store-newsletter?unsubscribe=${encodeURIComponent(token)}">Dejar de recibir novedades</a></p>`
          : ''),
      origin ? { label: 'VER LA COLECCIÓN', url: origin } : undefined,
    ),
    kind: 'newsletter_welcome',
    idempotencyKey: `newsletter-welcome-${subscriberId}`,
  });
  return { ok: true, subscribed: true };
}

export async function unsubscribeNewsletter(token: string) {
  const subscriber = await one<{ id: string }>(
    'SELECT id FROM newsletter_subscribers WHERE unsubscribeToken=?',
    token,
  );
  if (!subscriber) throw new AppError(404, 'Enlace inválido.');
  await statement(
    "UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribedAt=?,updatedAt=? WHERE id=?",
    now(),
    now(),
    subscriber.id,
  ).run();
  return { ok: true, unsubscribed: true };
}

export async function newsletterOverview(actor: Actor) {
  requirePermission(actor, 'communications');
  const [subscribers, campaigns] = await Promise.all([
    rows(
      'SELECT id,email,name,status,source,createdAt,unsubscribedAt FROM newsletter_subscribers ORDER BY createdAt DESC LIMIT 1000',
    ),
    rows(
      'SELECT id,subject,status,recipientCount,sentCount,failedCount,createdAt,sentAt FROM newsletter_campaigns ORDER BY createdAt DESC LIMIT 100',
    ),
  ]);
  return {
    configured: emailConfiguration('marketing').configured,
    ordersConfigured: emailConfiguration('orders').configured,
    ordersFrom: emailConfiguration('orders').from,
    marketingFrom: emailConfiguration('marketing').from,
    testRecipient: env.RESEND_ORDER_TO ?? '',
    subscribers,
    campaigns,
  };
}

export async function sendNewsletterCampaign(actor: Actor, raw: unknown) {
  requirePermission(actor, 'communications');
  const input = z
    .object({
      subject: z.string().trim().min(4).max(150),
      preheader: z.string().trim().max(180).default(''),
      content: z.string().trim().min(20).max(5000),
      ctaLabel: z.string().trim().max(60).default(''),
      ctaUrl: z.union([z.url(), z.literal('')]).default(''),
    })
    .strict()
    .parse(raw);
  if (!emailConfiguration('marketing').configured)
    throw new AppError(409, 'Configurá Resend antes de enviar una campaña.');
  const subscribers = await rows<{
    id: string;
    email: string;
    name: string;
    unsubscribeToken: string;
  }>(
    "SELECT id,email,name,unsubscribeToken FROM newsletter_subscribers WHERE status='active' ORDER BY createdAt LIMIT 1000",
  );
  if (!subscribers.length)
    throw new AppError(409, 'No hay suscriptores activos.');
  const campaignId = id(),
    timestamp = now();
  await db().batch([
    statement(
      "INSERT INTO newsletter_campaigns(id,subject,preheader,content,ctaLabel,ctaUrl,status,recipientCount,createdBy,createdAt) VALUES (?,?,?,?,?,?,'sending',?,?,?)",
      campaignId,
      input.subject,
      input.preheader,
      input.content,
      input.ctaLabel,
      input.ctaUrl,
      subscribers.length,
      actor.id,
      timestamp,
    ),
    auditStatement(actor.id, 'Enviar newsletter', campaignId, null, {
      subject: input.subject,
      recipients: subscribers.length,
    }),
  ]);
  let sent = 0,
    failed = 0;
  for (let index = 0; index < subscribers.length; index += 10) {
    const outcomes = await Promise.all(
      subscribers.slice(index, index + 10).map(async (subscriber) => {
        const origin = env.SITE_ORIGIN?.replace(/\/$/, '') ?? '';
        const unsubscribe = origin
          ? `${origin}/api/store-newsletter?unsubscribe=${encodeURIComponent(subscriber.unsubscribeToken)}`
          : '';
        const paragraphs = input.content
          .split(/\n+/)
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join('');
        const footer = unsubscribe
          ? `<p style="margin-top:30px;font-size:12px;color:#6d675e"><a href="${escapeHtml(unsubscribe)}">Dejar de recibir estos emails</a></p>`
          : '';
        return deliver({
          channel: 'marketing',
          to: subscriber.email,
          subject: input.subject,
          html: emailFrame(
            input.subject,
            input.preheader,
            paragraphs + footer,
            input.ctaLabel && input.ctaUrl
              ? { label: input.ctaLabel, url: input.ctaUrl }
              : undefined,
          ),
          kind: 'newsletter_campaign',
          campaignId,
          idempotencyKey: `campaign-${campaignId}-${subscriber.id}`,
        });
      }),
    );
    sent += outcomes.filter((result) => result.sent).length;
    failed += outcomes.filter((result) => !result.sent).length;
  }
  await statement(
    'UPDATE newsletter_campaigns SET status=?,sentCount=?,failedCount=?,sentAt=? WHERE id=?',
    failed ? 'completed_with_errors' : 'sent',
    sent,
    failed,
    now(),
    campaignId,
  ).run();
  return newsletterOverview(actor);
}

export async function sendAccountWelcome(accountId: string) {
  const account = await one<{ email: string; name: string }>(
    'SELECT a.email,c.name FROM customer_accounts a JOIN customers c ON c.id=a.customerId WHERE a.id=?',
    accountId,
  );
  if (!account) return;
  const origin = env.SITE_ORIGIN?.replace(/\/$/, '') ?? '';
  return deliver({
    channel: 'marketing',
    to: account.email,
    subject: 'BIENVENIDO A FRAGUAN.',
    html: emailFrame(
      'BIENVENIDO A FRAGUAN.',
      'Bienvenido a FRAGUAN.',
      `<p>Hola ${escapeHtml(account.name)},</p><p>Tu cuenta ya está lista. Gracias por sumarte a FRAGUAN: menos vueltas, más vos.</p><p>En Mi FRAGUAN podés consultar tus pedidos, guardar tus prendas favoritas y completar tus datos para tu próxima compra.</p>`,
      origin ? { label: 'VER MI CUENTA', url: origin + '/cuenta' } : undefined,
    ),
    kind: 'account_welcome',
    idempotencyKey: 'account-welcome-' + accountId,
  });
}

export async function sendEmailTest(actor: Actor, raw: unknown) {
  requirePermission(actor, 'communications');
  const input = z
    .object({
      action: z.literal('test'),
      channel: z.enum(['orders', 'marketing', 'verification']),
      requestKey: z.uuid(),
    })
    .strict()
    .parse(raw);
  const recipient = z.email().safeParse(env.RESEND_ORDER_TO);
  if (!recipient.success)
    throw new AppError(
      409,
      'Configurá el email interno de pedidos antes de probar.',
    );
  if (!emailConfiguration(input.channel).configured)
    throw new AppError(
      409,
      'Falta configurar la API key o el remitente de Resend.',
    );
  const result = await deliver({
    channel: input.channel,
    to: recipient.data,
    subject: 'PRUEBA DE EMAIL — FRAGUAN',
    html:
      input.channel === 'verification'
        ? verificationEmail('123456')
        : emailFrame(
            'EMAIL DE PRUEBA.',
            'Verificación de la conexión de FRAGUAN con Resend.',
            '<p>Esta es una prueba de la conexión de la tienda FRAGUAN con Resend. No corresponde a una compra ni concede beneficios.</p>',
          ),
    kind: 'integration_test_' + input.channel,
    idempotencyKey: 'email-test-' + input.requestKey,
  });
  await auditStatement(
    actor.id,
    'Probar email Resend',
    input.requestKey,
    null,
    { channel: input.channel, recipient: recipient.data, sent: result.sent },
  ).run();
  if (!result.sent)
    throw new AppError(
      502,
      'Resend no aceptó la prueba. Revisá el dominio y la API key.',
    );
  return { ok: true, recipient: recipient.data, channel: input.channel };
}
