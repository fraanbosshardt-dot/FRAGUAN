import { env } from 'cloudflare:workers';
import {
  auditStatement,
  db,
  id,
  now,
  one,
  rows,
  statement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';

type EmailJob = {
  id: string;
  dedupKey: string;
  orderId: string;
  recipient: string;
  subject: string;
  html: string;
  kind: string;
  attempts: number;
  firstAttemptAt: string | null;
};
export async function enqueueOrderEmail(input: {
  to: string;
  subject: string;
  html: string;
  kind: string;
  orderId: string;
  idempotencyKey: string;
}) {
  await statement(
    `INSERT INTO order_email_outbox(id,dedupKey,orderId,recipient,subject,html,kind,nextAttemptAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupKey) DO NOTHING`,
    id(),
    input.idempotencyKey,
    input.orderId,
    input.to,
    input.subject,
    input.html,
    input.kind,
    now(),
    now(),
    now(),
  ).run();
}
export async function runOrderEmailQueue(limit = 10) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM)
    return { processed: 0, configured: false };
  const due = await rows<{ id: string }>(
    `SELECT id FROM order_email_outbox WHERE status IN ('pending','retry') AND nextAttemptAt<=? AND (lockedUntil IS NULL OR lockedUntil<=?) ORDER BY createdAt LIMIT ?`,
    now(),
    now(),
    Math.min(20, Math.max(1, limit)),
  );
  let processed = 0;
  for (const candidate of due) {
    const lockedUntil = new Date(Date.now() + 120000).toISOString();
    const job = await statement(
      `UPDATE order_email_outbox SET lockedUntil=?,firstAttemptAt=COALESCE(firstAttemptAt,?),attempts=attempts+1 WHERE id=? AND status IN ('pending','retry') AND (lockedUntil IS NULL OR lockedUntil<=?) RETURNING *`,
      lockedUntil,
      now(),
      candidate.id,
      now(),
    ).first<EmailJob>();
    if (!job) continue;
    if (Date.now() - Date.parse(job.firstAttemptAt || now()) > 23 * 3600000) {
      await statement(
        `UPDATE order_email_outbox SET status='review',lockedUntil=NULL,error='Revisar aceptación en Resend antes de volver a enviar.',updatedAt=? WHERE id=?`,
        now(),
        job.id,
      ).run();
      continue;
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': job.dedupKey,
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [job.recipient],
          subject: job.subject,
          html: job.html,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retry = response.status === 429 || response.status >= 500;
        await statement(
          `UPDATE order_email_outbox SET status=?,error=?,nextAttemptAt=?,lockedUntil=NULL,updatedAt=? WHERE id=?`,
          retry ? 'retry' : 'failed',
          `Resend HTTP ${response.status}`,
          new Date(
            Date.now() +
              Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
          ).toISOString(),
          now(),
          job.id,
        ).run();
        continue;
      }
      if (typeof data.id !== 'string' || !data.id)
        throw new Error('Respuesta de Resend sin identificador.');
      const event = await one<{ type: string }>(
        `SELECT type FROM resend_webhook_events WHERE providerId=? ORDER BY CASE WHEN type IN ('email.bounced','email.complained') THEN 0 WHEN type='email.delivered' THEN 1 ELSE 2 END,occurredAt DESC LIMIT 1`,
        data.id,
      );
      const status =
        event?.type === 'email.bounced'
          ? 'bounced'
          : event?.type === 'email.complained'
            ? 'complained'
            : event?.type === 'email.delivered'
              ? 'delivered'
              : event?.type === 'email.failed'
                ? 'failed'
                : event?.type === 'email.delivery_delayed'
                  ? 'delayed'
                  : 'sent';
      await db().batch([
        statement(
          `UPDATE order_email_outbox SET status=?,providerId=?,error='',lockedUntil=NULL,updatedAt=? WHERE id=?`,
          status,
          data.id,
          now(),
          job.id,
        ),
        statement(
          `INSERT INTO email_deliveries(id,kind,recipient,orderId,providerId,status,createdAt) VALUES (?,?,?,?,?,?,?)`,
          job.id,
          job.kind,
          job.recipient,
          job.orderId,
          data.id,
          status,
          now(),
        ),
      ]);
      processed++;
    } catch {
      // A timeout or failed local recording can follow acceptance. Retry only with the same key, within Resend's window.
      await statement(
        `UPDATE order_email_outbox SET status='retry',error='Respuesta incierta; se reintenta con la misma clave.',nextAttemptAt=?,lockedUntil=NULL,updatedAt=? WHERE id=?`,
        new Date(Date.now() + 300000).toISOString(),
        now(),
        job.id,
      ).run();
    }
  }
  return { processed, configured: true };
}
export async function orderEmailOverview(actor: Actor) {
  requirePermission(actor, 'communications');
  return {
    webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET),
    jobs: await rows(
      `SELECT e.id,e.orderId,o.orderNumber,e.kind,e.subject,e.recipient,e.status,e.attempts,e.error,e.createdAt,e.updatedAt FROM order_email_outbox e LEFT JOIN online_orders o ON o.id=e.orderId ORDER BY e.createdAt DESC LIMIT 100`,
    ),
  };
}
export async function resendWebhook(req: Request) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    throw new AppError(503, 'Falta configurar el webhook de Resend.');
  const messageId = req.headers.get('svix-id') || '',
    timestamp = req.headers.get('svix-timestamp') || '',
    signature = req.headers.get('svix-signature') || '';
  if (
    !messageId ||
    messageId.length > 200 ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    throw new AppError(401, 'Firma de Resend inválida.');
  const body = await req.text();
  if (new TextEncoder().encode(body).length > 65536)
    throw new AppError(413, 'Evento demasiado grande.');
  let verified = false;
  try {
    const raw = atob(secret.replace(/^whsec_/, ''));
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    for (const part of signature.split(' ')) {
      if (!part.startsWith('v1,')) continue;
      const bytes = Uint8Array.from(atob(part.slice(3)), (c) =>
        c.charCodeAt(0),
      );
      if (
        await crypto.subtle.verify(
          'HMAC',
          key,
          bytes,
          new TextEncoder().encode(`${messageId}.${timestamp}.${body}`),
        )
      )
        verified = true;
    }
  } catch {
    verified = false;
  }
  if (!verified) throw new AppError(401, 'Firma de Resend inválida.');
  const event = JSON.parse(body);
  const statuses: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.delivery_delayed': 'delayed',
    'email.failed': 'failed',
  };
  const status = statuses[event.type];
  if (
    !status ||
    typeof event.data?.email_id !== 'string' ||
    event.data.email_id.length > 200
  )
    return { ok: true, ignored: true };
  const occurred = Date.parse(event.created_at);
  if (!Number.isFinite(occurred))
    throw new AppError(400, 'Fecha de evento inválida.');
  await db().batch([
    statement(
      `INSERT INTO resend_webhook_events(id,providerId,type,occurredAt,receivedAt) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      messageId,
      event.data.email_id,
      event.type,
      new Date(occurred).toISOString(),
      now(),
    ),
    statement(
      `UPDATE order_email_outbox SET status=?,updatedAt=? WHERE providerId=? AND (status NOT IN ('bounced','complained') OR ? IN ('bounced','complained')) AND (status<>'delivered' OR ? IN ('bounced','complained','delivered')) AND (status<>'failed' OR ?<>'delayed')`,
      status,
      now(),
      event.data.email_id,
      status,
      status,
      status,
    ),
    statement(
      `UPDATE email_deliveries SET status=? WHERE providerId=? AND (status NOT IN ('bounced','complained') OR ? IN ('bounced','complained')) AND (status<>'delivered' OR ? IN ('bounced','complained','delivered')) AND (status<>'failed' OR ?<>'delayed')`,
      status,
      event.data.email_id,
      status,
      status,
      status,
    ),
  ]);
  return { ok: true };
}

export async function orderEmailWrite(actor: Actor, raw: any) {
  requirePermission(actor, 'communications');
  if (raw.action === 'process') return runOrderEmailQueue();
  if (
    raw.action !== 'retry' ||
    typeof raw.id !== 'string' ||
    raw.confirmedNotAccepted !== true
  )
    throw new AppError(
      400,
      'Confirmá primero en Resend que el email no fue aceptado.',
    );
  const job = await one<any>(
    `SELECT * FROM order_email_outbox WHERE id=?`,
    raw.id,
  );
  if (!job || !['failed', 'review'].includes(job.status) || job.providerId)
    throw new AppError(400, 'Este aviso no admite un nuevo envío.');
  await db().batch([
    statement(
      `UPDATE order_email_outbox SET status='pending',dedupKey=?,firstAttemptAt=NULL,attempts=0,nextAttemptAt=?,error='',updatedAt=? WHERE id=? AND status IN ('failed','review') AND providerId=''`,
      id(),
      now(),
      now(),
      job.id,
    ),
    auditStatement(
      actor.id,
      'Autorizar reintento de email no aceptado',
      job.id,
      null,
      { orderId: job.orderId },
    ),
  ]);
  return { ok: true };
}
