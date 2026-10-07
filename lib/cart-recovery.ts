import { z } from 'zod';
import { env } from 'cloudflare:workers';
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
import {
  currentStoreCustomer,
  requireVerifiedCheckoutEmail,
} from './online-store';
import { emailConfiguration, sendMarketingEmail } from './email';
import { escapeHtml } from './email-template';

const configSchema = z
  .object({
    enabled: z.boolean(),
    firstHours: z.number().int().min(1).max(72),
    secondHours: z.number().int().min(2).max(168),
    secondEnabled: z.boolean(),
    dailyReminderLimit: z.number().int().min(0).max(10000).default(30),
    monthlyReminderLimit: z.number().int().min(0).max(1000000).default(900),
    freePlanGuard: z.boolean().default(true),
  })
  .strict()
  .refine(
    (x) => x.secondHours > x.firstHours,
    'El segundo aviso debe ser posterior al primero.',
  );
export async function recoveryConfiguration() {
  const saved = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'cart-recovery-config',
  );
  if (!saved)
    return {
      enabled: true,
      firstHours: 2,
      secondHours: 24,
      secondEnabled: true,
      dailyReminderLimit: 30,
      monthlyReminderLimit: 900,
      freePlanGuard: true,
    };
  return configSchema.parse(JSON.parse(saved.value));
}

// Local accepted-delivery counts, not Resend's account-wide billing meter.
export async function recoveryEmailUsage() {
  const current = new Date();
  const day = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ),
  ).toISOString();
  const month = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1),
  ).toISOString();
  const count = async (since: string, reminders: boolean) =>
    Number(
      (
        await one<{ total: number }>(
          `SELECT COUNT(*) AS total FROM email_deliveries WHERE status='sent' AND createdAt>=?${reminders ? " AND (kind LIKE 'cart_reminder_1:%' OR kind LIKE 'cart_reminder_2:%')" : ''}`,
          since,
        )
      )?.total ?? 0,
    );
  return {
    day: await count(day, false),
    month: await count(month, false),
    remindersDay: await count(day, true),
    remindersMonth: await count(month, true),
  };
}
export async function saveRecoveryConfiguration(actor: Actor, raw: unknown) {
  requirePermission(actor, 'marketing');
  const value = configSchema.parse(raw);
  await db().batch([
    statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'cart-recovery-config',
      JSON.stringify(value),
    ),
    auditStatement(
      actor.id,
      'Configurar recuperación de carrito',
      'cart-recovery-config',
      await recoveryConfiguration(),
      value,
    ),
  ]);
  return value;
}

export async function captureCartRecovery(req: Request, raw: unknown) {
  const input = z
    .object({
      sessionId: z.uuid(),
      consent: z.boolean(),
      email: z
        .union([z.email().trim().toLowerCase(), z.literal('')])
        .default(''),
      emailVerificationToken: z.string().max(2000).default(''),
      items: z
        .array(
          z
            .object({
              variantId: z.string().min(1).max(100),
              quantity: z.number().int().min(1).max(20),
            })
            .strict(),
        )
        .max(30)
        .default([]),
    })
    .strict()
    .parse(raw);
  const existing = await one<{
    id: string;
    status: string;
    recoveryToken: string;
  }>(
    'SELECT id,status,recoveryToken FROM abandoned_carts WHERE sessionId=?',
    input.sessionId,
  );
  if (!input.consent || !input.items.length) {
    if (existing)
      await db().batch([
        statement(
          "UPDATE abandoned_carts SET email='',updatedAt=? WHERE id=?",
          now(),
          existing.id,
        ),
        statement(
          'DELETE FROM settings WHERE key=?',
          'cart-recovery-consent:' + existing.id,
        ),
      ]);
    return { ok: true, consent: false };
  }
  const customer = await currentStoreCustomer(req);
  const email = customer?.email ?? input.email;
  if (!customer)
    await requireVerifiedCheckoutEmail(
      req,
      email,
      input.emailVerificationToken,
    );
  if (!input.items.length) return { ok: true, consent: false };
  if (new Set(input.items.map((x) => x.variantId)).size !== input.items.length)
    throw new AppError(400, 'Revisá las prendas del carrito.');
  const cart = [];
  for (const item of input.items) {
    const variant = await one<{
      productName: string;
      slug: string;
      color: string;
      size: string;
      price: number;
    }>(
      `SELECT p.name AS productName,profile.slug,v.color,v.size,COALESCE(v.onlinePrice,v.price) AS price FROM variants v JOIN products p ON p.id=v.productId JOIN online_product_profiles profile ON profile.productId=p.id WHERE v.id=? AND p.active=1 AND profile.published=1`,
      item.variantId,
    );
    if (!variant)
      throw new AppError(
        409,
        'Una prenda ya no está disponible. Revisá tu carrito.',
      );
    cart.push({ ...variant, ...item });
  }
  const key = existing?.id ?? id(),
    timestamp = now();
  // A newly created order must never be reactivated by a late browser request.
  if (existing && ['converted', 'recovered'].includes(existing.status))
    return { ok: true, consent: false };
  await db().batch([
    statement(
      `INSERT INTO abandoned_carts(id,sessionId,customerId,email,cartJson,subtotal,status,recoveryToken,source,campaign,lastActivityAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,'active',?,'','',?,?,?) ON CONFLICT(sessionId) DO UPDATE SET email=excluded.email,customerId=excluded.customerId,cartJson=excluded.cartJson,subtotal=excluded.subtotal,status=CASE WHEN abandoned_carts.status IN ('converted','recovered') THEN abandoned_carts.status ELSE 'active' END,lastActivityAt=excluded.lastActivityAt,updatedAt=excluded.updatedAt`,
      key,
      input.sessionId,
      customer?.customerId ?? null,
      email,
      JSON.stringify(cart),
      cart.reduce((s, x) => s + x.price * x.quantity, 0),
      existing?.recoveryToken ?? crypto.randomUUID() + crypto.randomUUID(),
      timestamp,
      timestamp,
      timestamp,
    ),
    statement(
      "INSERT INTO settings(key,value) SELECT 'cart-recovery-consent:'||id,? FROM abandoned_carts WHERE sessionId=? ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      email,
      input.sessionId,
    ),
    statement(
      "INSERT INTO settings(key,value) SELECT 'cart-recovery-consent-at:'||id,? FROM abandoned_carts WHERE sessionId=? ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      timestamp,
      input.sessionId,
    ),
  ]);
  return { ok: true, consent: true };
}

export async function stopCartRecovery(token: string) {
  if (!/^[a-f0-9-]{72}$/.test(token))
    throw new AppError(404, 'Enlace no encontrado.');
  const cart = await one<{ id: string }>(
    'SELECT id FROM abandoned_carts WHERE recoveryToken=?',
    token,
  );
  if (!cart) throw new AppError(404, 'Enlace no encontrado.');
  await db().batch([
    statement(
      "UPDATE abandoned_carts SET email='',updatedAt=? WHERE id=?",
      now(),
      cart.id,
    ),
    statement(
      'DELETE FROM settings WHERE key=?',
      'cart-recovery-consent:' + cart.id,
    ),
  ]);
  return { ok: true };
}

export async function runCartRecovery() {
  const config = await recoveryConfiguration();
  if (!config.enabled || !emailConfiguration('marketing').configured)
    return { sent: 0, failed: 0, processed: 0, paused: true };
  const timestamp = now(),
    lease = new Date(Date.now() + 8 * 60_000).toISOString();
  const claimed = await statement(
    `INSERT INTO settings(key,value) VALUES ('cart-recovery-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE settings.value<? RETURNING key`,
    lease,
    timestamp,
  ).first();
  if (!claimed) return { sent: 0, failed: 0, processed: 0, locked: true };
  let sent = 0,
    failed = 0,
    processed = 0;
  try {
    const carts = await rows<Record<string, any>>(
      `SELECT c.* FROM abandoned_carts c JOIN settings consent ON consent.key='cart-recovery-consent:'||c.id AND consent.value=c.email WHERE c.status='active' AND c.email<>'' AND c.lastActivityAt>=? AND ((c.firstReminderAt IS NULL AND c.lastActivityAt<=?) OR (?=1 AND c.firstReminderAt IS NOT NULL AND c.secondReminderAt IS NULL AND c.lastActivityAt<=? AND c.firstReminderAt<=?)) AND NOT EXISTS(SELECT 1 FROM online_orders o WHERE lower(o.email)=lower(c.email) AND o.createdAt>=c.createdAt) ORDER BY c.lastActivityAt LIMIT 20`,
      new Date(Date.now() - 7 * 86400000).toISOString(),
      new Date(Date.now() - config.firstHours * 3600000).toISOString(),
      config.secondEnabled ? 1 : 0,
      new Date(Date.now() - config.secondHours * 3600000).toISOString(),
      new Date(
        Date.now() - (config.secondHours - config.firstHours) * 3600000,
      ).toISOString(),
    );
    for (const cart of carts) {
      const usage = await recoveryEmailUsage();
      // Reserve at least 20 daily / 600 monthly slots for priority emails.
      if (
        (config.freePlanGuard && (usage.day >= 80 || usage.month >= 2400)) ||
        usage.remindersDay >= config.dailyReminderLimit ||
        usage.remindersMonth >= config.monthlyReminderLimit
      )
        break;
      try {
        const second = Boolean(cart.firstReminderAt),
          kind = second ? 'cart_reminder_2' : 'cart_reminder_1';
        // Recheck immediately before send; also suppress accepted deliveries after a partial write failure.
        const eligible = await one(
          `SELECT c.id FROM abandoned_carts c JOIN settings s ON s.key='cart-recovery-consent:'||c.id AND s.value=c.email WHERE c.id=? AND c.status='active' AND NOT EXISTS(SELECT 1 FROM online_orders o WHERE lower(o.email)=lower(c.email) AND o.createdAt>=c.createdAt) AND NOT EXISTS(SELECT 1 FROM email_deliveries d WHERE d.kind=? AND d.status='sent' AND d.recipient=c.email )`,
          cart.id,
          kind + ':' + cart.id,
        );
        if (!eligible) continue;
        const origin = (env.SITE_ORIGIN || 'https://www.fraguan.com').replace(
          /\/$/,
          '',
        );
        const items = z
          .array(
            z.object({
              productName: z.string(),
              color: z.string(),
              size: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .parse(JSON.parse(cart.cartJson));
        const content = `<p>${second ? '¿Querés retomar tu selección?' : 'Tu selección quedó guardada.'} Podés volver a revisar tus prendas y terminar la compra cuando quieras.</p><table role="presentation" width="100%">${items.map((x) => `<tr><td style="padding:12px 0;border-bottom:1px solid #cdc0a8"><strong>${escapeHtml(x.productName)}</strong><br>${escapeHtml(x.color)} · Talle ${escapeHtml(x.size)} · Cantidad ${x.quantity}</td></tr>`).join('')}</table><p>El precio y el stock se verifican nuevamente al retomar la compra. Este email no reserva prendas ni concede descuentos.</p><p style="font-size:12px"><a href="${origin}/api/store-recovery?unsubscribe=${encodeURIComponent(cart.recoveryToken)}">No recibir más recordatorios de esta selección</a></p>`;
        const outcome = await sendMarketingEmail({
          to: cart.email,
          subject: second ? '¿RETOMAMOS TU COMPRA?' : 'TU SELECCIÓN SIGUE ACÁ.',
          title: second ? 'MENOS VUELTAS. MÁS VOS.' : 'TU CARRITO TE ESPERA.',
          preheader: 'Retomá tu selección en FRAGUAN.',
          content,
          action: {
            label: 'Retomar mi compra',
            url: `${origin}/recuperar-carrito/${cart.recoveryToken}?utm_source=email&utm_medium=automation&utm_campaign=${kind}`,
          },
          kind: kind + ':' + cart.id,
          entityId: cart.id,
        });
        processed++;
        await db().batch([
          ...(outcome.sent
            ? [
                statement(
                  `UPDATE abandoned_carts SET ${second ? 'secondReminderAt' : 'firstReminderAt'}=?,updatedAt=? WHERE id=?`,
                  now(),
                  now(),
                  cart.id,
                ),
              ]
            : []),
          statement(
            'INSERT INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,?,?)',
            id(),
            kind,
            cart.id,
            cart.email,
            outcome.sent ? 'sent' : 'failed',
            outcome.sent
              ? 'Aceptado por Resend'
              : 'Revisar el registro de emails',
            now(),
          ),
        ]);
        if (outcome.sent) sent++;
        else failed++;
      } catch {
        failed++;
        // A malformed cart must not prevent the next customer's reminder.
      }
    }
    await statement(
      'INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'cart-recovery-last-run',
      JSON.stringify({ at: now(), sent, failed, processed }),
    ).run();
    return { sent, failed, processed };
  } finally {
    await statement(
      "DELETE FROM settings WHERE key='cart-recovery-lock' AND value=?",
      lease,
    ).run();
  }
}
