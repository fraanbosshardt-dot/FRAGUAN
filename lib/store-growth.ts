import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { Actor, AppError, requirePermission } from './auth';
import { currentStoreCustomer } from './online-store';
import { db, id, now, one, rows, statement } from '@/db/queries';
import { sendMarketingEmail } from './email';

const trackedEvents = [
  'page_view',
  'view_item',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'coupon_applied',
  'order_created',
  'purchase',
] as const;

const eventInput = z.object({
  sessionId: z.uuid(),
  event: z.enum(trackedEvents),
  path: z.string().trim().max(300).default(''),
  productId: z.string().trim().max(100).optional(),
  variantId: z.string().trim().max(100).optional(),
  orderId: z.uuid().optional(),
  value: z.number().int().min(0).max(1_000_000_000).default(0),
  source: z.string().trim().max(100).default(''),
  medium: z.string().trim().max(100).default(''),
  campaign: z.string().trim().max(160).default(''),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  email: z.union([z.email().trim().toLowerCase().max(200), z.literal('')]).default(''),
  cart: z.array(z.object({
    variantId: z.string().min(1).max(100),
    productName: z.string().min(1).max(160),
    slug: z.string().min(1).max(160),
    color: z.string().max(100),
    size: z.string().max(60),
    price: z.number().int().min(0),
    quantity: z.number().int().min(1).max(20),
  }).strict()).max(30).optional(),
}).strict();

export async function trackStoreEvent(req: Request, raw: unknown) {
  const input = eventInput.parse(raw);
  const customer = await currentStoreCustomer(req);
  const recent = await one<{ total: number }>(
    'SELECT COUNT(*) AS total FROM store_events WHERE sessionId=? AND createdAt>=?',
    input.sessionId,
    new Date(Date.now() - 60_000).toISOString(),
  );
  if (Number(recent?.total ?? 0) > 120) throw new AppError(429, 'Esperá un momento.');
  const createdAt = now();
  await statement(
    `INSERT INTO store_events(id,sessionId,customerId,event,path,productId,variantId,orderId,value,source,medium,campaign,metadata,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id(), input.sessionId, customer?.customerId ?? null, input.event, input.path,
    input.productId ?? null, input.variantId ?? null, input.orderId ?? null,
    input.value, input.source, input.medium, input.campaign,
    JSON.stringify(input.metadata).slice(0, 2000), createdAt,
  ).run();
  if (input.cart) {
    const effectiveEmail = customer?.marketingConsent ? customer.email : input.email;
    const subtotal = input.cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const existing = await one<{ id: string; recoveryToken: string }>(
      'SELECT id,recoveryToken FROM abandoned_carts WHERE sessionId=?', input.sessionId,
    );
    if (!input.cart.length) {
      if (existing) await statement("UPDATE abandoned_carts SET status='empty',cartJson='[]',subtotal=0,updatedAt=? WHERE id=?", createdAt, existing.id).run();
    } else if (existing) {
      await statement(
        `UPDATE abandoned_carts SET customerId=?,email=?,cartJson=?,subtotal=?,status='active',source=?,campaign=?,lastActivityAt=?,updatedAt=? WHERE id=?`,
        customer?.customerId ?? null, effectiveEmail, JSON.stringify(input.cart), subtotal,
        input.source, input.campaign, createdAt, createdAt, existing.id,
      ).run();
    } else {
      await statement(
        `INSERT INTO abandoned_carts(id,sessionId,customerId,email,cartJson,subtotal,status,recoveryToken,source,campaign,lastActivityAt,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,'active',?,?,?,?,?,?)`,
        id(), input.sessionId, customer?.customerId ?? null, effectiveEmail,
        JSON.stringify(input.cart), subtotal, crypto.randomUUID() + crypto.randomUUID(),
        input.source, input.campaign, createdAt, createdAt, createdAt,
      ).run();
    }
  }
  if (input.event === 'purchase' && input.orderId) {
    await statement(
      "UPDATE abandoned_carts SET status='recovered',recoveredAt=?,updatedAt=? WHERE sessionId=?",
      createdAt, createdAt, input.sessionId,
    ).run();
  }
  return { ok: true };
}

export async function recoverCart(token: string) {
  const cart = await one<Record<string, any>>(
    "SELECT cartJson,subtotal,status FROM abandoned_carts WHERE recoveryToken=? AND status IN ('active','recovered')",
    token.slice(0, 160),
  );
  if (!cart) throw new AppError(404, 'Este enlace de recuperación ya no está disponible.');
  return { cart: JSON.parse(cart.cartJson), subtotal: cart.subtotal };
}

export async function requestBackInStock(req: Request, raw: unknown) {
  const input = z.object({ variantId: z.string().min(1).max(100), email: z.email().trim().toLowerCase().max(200) }).strict().parse(raw);
  const variant = await one('SELECT id FROM variants WHERE id=? AND stock<=0', input.variantId);
  if (!variant) throw new AppError(409, 'Esta variante ya tiene stock disponible.');
  const existing = await one<{ id: string }>('SELECT id FROM back_in_stock_requests WHERE variantId=? AND email=?', input.variantId, input.email);
  if (existing) {
    await statement("UPDATE back_in_stock_requests SET status='waiting',notifiedAt=NULL WHERE id=?", existing.id).run();
  } else {
    await statement("INSERT INTO back_in_stock_requests(id,variantId,email,status,source,createdAt) VALUES (?,?,?,'waiting','product',?)", id(), input.variantId, input.email, now()).run();
  }
  return { ok: true };
}

export async function publicProductReviews(productId: string) {
  const summary = await one<{ average: number; total: number }>(
    "SELECT COALESCE(AVG(rating),0) AS average,COUNT(*) AS total FROM product_reviews WHERE productId=? AND status='published'",
    productId,
  );
  const reviews = await rows(
    "SELECT id,displayName,rating,title,body,verified,createdAt FROM product_reviews WHERE productId=? AND status='published' ORDER BY verified DESC,createdAt DESC LIMIT 50",
    productId,
  );
  return { average: Number(summary?.average ?? 0), total: Number(summary?.total ?? 0), reviews };
}

export async function submitProductReview(req: Request, raw: unknown) {
  const input = z.object({
    productId: z.string().min(1).max(100),
    orderId: z.union([z.uuid(), z.literal('')]).default(''),
    email: z.email().trim().toLowerCase().max(200),
    displayName: z.string().trim().min(2).max(80),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(100).default(''),
    body: z.string().trim().min(10).max(1000),
  }).strict().parse(raw);
  const customer = await currentStoreCustomer(req);
  let verified = 0;
  if (input.orderId) {
    const purchase = await one(
      `SELECT o.id FROM online_orders o JOIN online_order_items oi ON oi.orderId=o.id
       JOIN variants v ON v.id=oi.variantId WHERE o.id=? AND lower(o.email)=? AND v.productId=? AND o.paymentStatus='paid'`,
      input.orderId, input.email, input.productId,
    );
    verified = purchase ? 1 : 0;
  }
  await statement(
    `INSERT INTO product_reviews(id,productId,customerId,orderId,email,displayName,rating,title,body,status,verified,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
    id(), input.productId, customer?.customerId ?? null, input.orderId || null,
    input.email, input.displayName, input.rating, input.title, input.body,
    verified, now(), now(),
  ).run();
  return { ok: true, status: 'pending' };
}

export async function storeGrowthDashboard(actor: Actor) {
  requirePermission(actor, 'marketing');
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [events, sources, products, carts, reviews, waits, automations] = await Promise.all([
    rows<{ event: string; total: number; sessions: number }>(
      'SELECT event,COUNT(*) AS total,COUNT(DISTINCT sessionId) AS sessions FROM store_events WHERE createdAt>=? GROUP BY event', since,
    ),
    rows('SELECT COALESCE(NULLIF(source,\'\'),\'Directo\') AS source,COALESCE(NULLIF(campaign,\'\'),\'Sin campaña\') AS campaign,COUNT(DISTINCT sessionId) AS sessions,SUM(CASE WHEN event=\'purchase\' THEN value ELSE 0 END) AS revenue FROM store_events WHERE createdAt>=? GROUP BY source,campaign ORDER BY revenue DESC,sessions DESC LIMIT 20', since),
    rows('SELECT p.name,COUNT(*) AS views,SUM(CASE WHEN e.event=\'add_to_cart\' THEN 1 ELSE 0 END) AS adds FROM store_events e JOIN products p ON p.id=e.productId WHERE e.createdAt>=? AND e.event IN (\'view_item\',\'add_to_cart\') GROUP BY p.id ORDER BY views DESC LIMIT 15', since),
    rows("SELECT id,email,subtotal,status,source,campaign,lastActivityAt,firstReminderAt,secondReminderAt FROM abandoned_carts WHERE status='active' ORDER BY lastActivityAt DESC LIMIT 100"),
    rows("SELECT r.id,p.name AS product,r.displayName,r.rating,r.title,r.body,r.verified,r.status,r.createdAt FROM product_reviews r JOIN products p ON p.id=r.productId ORDER BY r.createdAt DESC LIMIT 100"),
    rows("SELECT b.id,p.name AS product,v.color,v.size,b.email,b.status,b.createdAt FROM back_in_stock_requests b JOIN variants v ON v.id=b.variantId JOIN products p ON p.id=v.productId ORDER BY b.createdAt DESC LIMIT 100"),
    rows('SELECT kind,recipient,status,detail,createdAt FROM marketing_automation_log ORDER BY createdAt DESC LIMIT 100'),
  ]);
  const counts = Object.fromEntries(events.map((row) => [row.event, Number(row.sessions)]));
  return {
    periodDays: 30,
    funnel: {
      visitors: counts.page_view ?? 0,
      productViews: counts.view_item ?? 0,
      addToCart: counts.add_to_cart ?? 0,
      checkout: counts.begin_checkout ?? 0,
      purchases: counts.purchase ?? 0,
    }, sources, products, carts, reviews, waits, automations,
    configured: Boolean(env.RESEND_API_KEY && env.RESEND_FROM),
  };
}

export async function moderateReview(actor: Actor, raw: unknown) {
  requirePermission(actor, 'marketing');
  const input = z.object({ reviewId: z.string().min(1), status: z.enum(['published','rejected']) }).strict().parse(raw);
  await statement('UPDATE product_reviews SET status=?,updatedAt=? WHERE id=?', input.status, now(), input.reviewId).run();
  return storeGrowthDashboard(actor);
}

export async function runMarketingAutomations(actor: Actor) {
  requirePermission(actor, 'marketing');
  const origin = (env.SITE_ORIGIN || 'https://fraguan.com').replace(/\/$/, '');
  const threshold1 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const threshold2 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const carts = await rows<Record<string, any>>(
    `SELECT * FROM abandoned_carts WHERE status='active' AND email<>'' AND
      ((firstReminderAt IS NULL AND lastActivityAt<=?) OR (firstReminderAt IS NOT NULL AND secondReminderAt IS NULL AND lastActivityAt<=?))
      ORDER BY lastActivityAt LIMIT 100`, threshold1, threshold2,
  );
  let sent = 0;
  for (const cart of carts) {
    const second = Boolean(cart.firstReminderAt);
    const kind = second ? 'cart_reminder_2' : 'cart_reminder_1';
    const result = await sendMarketingEmail({
      to: cart.email,
      subject: second ? 'TU SELECCIÓN SIGUE ESPERANDO.' : 'GUARDAMOS TU SELECCIÓN.',
      title: second ? '¿LO SEGUIMOS?' : 'TU CARRITO SIGUE ACÁ.',
      preheader: 'Retomá tu compra FRAGUAN.',
      content: `<p>Guardamos las prendas que elegiste. El stock puede cambiar hasta que completes el pedido.</p>`,
      action: { label: 'RETOMAR COMPRA', url: `${origin}/recuperar-carrito/${cart.recoveryToken}` },
      kind,
      entityId: cart.id,
    });
    if (result.sent) {
      await db().batch([
        statement(`UPDATE abandoned_carts SET ${second ? 'secondReminderAt' : 'firstReminderAt'}=?,updatedAt=? WHERE id=?`, now(), now(), cart.id),
        statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), kind, cart.id, cart.email, 'sent', now()),
      ]);
      sent++;
    }
  }
  const waits = await rows<Record<string, any>>(
    `SELECT b.id,b.email,p.name,profile.slug,v.color,v.size FROM back_in_stock_requests b
     JOIN variants v ON v.id=b.variantId JOIN products p ON p.id=v.productId
     JOIN online_product_profiles profile ON profile.productId=p.id
     WHERE b.status='waiting' AND v.stock>0 AND profile.published=1 LIMIT 100`,
  );
  for (const wait of waits) {
    const result = await sendMarketingEmail({
      to: wait.email, subject: `${wait.name.toUpperCase()} VOLVIÓ.`, title: 'VOLVIÓ TU TALLE.',
      preheader: `${wait.name} ya tiene stock.`,
      content: `<p>${wait.name} · ${wait.color} · talle ${wait.size} vuelve a estar disponible.</p>`,
      action: { label: 'VER PRODUCTO', url: `${origin}/producto/${wait.slug}` },
      kind: 'back_in_stock', entityId: wait.id,
    });
    if (result.sent) {
      await statement("UPDATE back_in_stock_requests SET status='notified',notifiedAt=? WHERE id=?", now(), wait.id).run();
      sent++;
    }
    if (result.sent) await statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), 'back_in_stock', wait.id, wait.email, 'sent', now()).run();
  }
  const postPurchase = await rows<Record<string, any>>(
    `SELECT o.id,o.email,o.customerName,o.orderNumber,COALESCE((SELECT p.category FROM online_order_items oi JOIN variants v ON v.id=oi.variantId JOIN products p ON p.id=v.productId WHERE oi.orderId=o.id LIMIT 1),'Colección') AS category FROM online_orders o
     LEFT JOIN marketing_automation_log l ON l.kind='post_purchase' AND l.entityId=o.id
     LEFT JOIN customer_accounts a ON a.customerId=o.customerId
     WHERE o.paymentStatus='paid' AND o.paidAt<=? AND l.id IS NULL AND (o.customerId IS NULL OR a.marketingConsent=1) LIMIT 100`,
    new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  for (const order of postPurchase) {
    const result = await sendMarketingEmail({
      to: order.email, subject: '¿CÓMO TE QUEDÓ?', title: 'CONTANOS TU EXPERIENCIA.',
      preheader: `Pedido #${order.orderNumber}`,
      content: `<p>Esperamos que ya estés disfrutando tu pedido #${order.orderNumber}. Tu opinión ayuda a otros a elegir talle y calce con más seguridad. También preparamos piezas que combinan con tu compra.</p>`,
      action: { label: 'COMPLETAR EL LOOK', url: `${origin}/?utm_source=email&utm_medium=automation&utm_campaign=post_purchase` }, kind: 'post_purchase', entityId: order.id,
    });
    if (result.sent) await statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), 'post_purchase', order.id, order.email, 'sent', now()).run();
    if (result.sent) sent++;
  }
  const winback = await rows<Record<string, any>>(
    `SELECT c.id,c.email,c.name,MAX(s.createdAt) AS lastPurchaseAt FROM customers c
     JOIN customer_accounts a ON a.customerId=c.id AND a.marketingConsent=1
     JOIN sales s ON s.customerId=c.id
     LEFT JOIN marketing_automation_log l ON l.kind='winback' AND l.entityId=c.id
     WHERE c.email<>'' AND l.id IS NULL GROUP BY c.id HAVING MAX(s.createdAt)<=? LIMIT 100`,
    new Date(Date.now() - 120 * 86400000).toISOString(),
  );
  for (const customer of winback) {
    const result = await sendMarketingEmail({
      to: customer.email, subject: 'HAY ALGO NUEVO PARA VOS.', title: 'VOLVÉ A FRAGUAN.',
      preheader: 'Nuevos ingresos y stock actualizado.',
      content: `<p>La colección cambió desde tu última visita. Entrá para ver nuevos ingresos y disponibilidad por talle.</p>`,
      action: { label: 'VER LO NUEVO', url: `${origin}/coleccion/nuevos?utm_source=email&utm_medium=automation&utm_campaign=winback` }, kind: 'winback', entityId: customer.id,
    });
    if (result.sent) await statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), 'winback', customer.id, customer.email, 'sent', now()).run();
    if (result.sent) sent++;
  }
  const nurture = await rows<Record<string, any>>(
    `SELECT n.id,n.email,n.name FROM newsletter_subscribers n
     LEFT JOIN marketing_automation_log l ON l.kind='newsletter_nurture' AND l.entityId=n.id
     WHERE n.status='active' AND n.createdAt<=? AND l.id IS NULL LIMIT 100`,
    new Date(Date.now() - 3 * 86400000).toISOString(),
  );
  for (const subscriber of nurture) {
    const result = await sendMarketingEmail({
      to: subscriber.email, subject: 'ELEGIR MEJOR, SIN VUELTAS.', title: 'EMPEZÁ POR TU ESTILO.',
      preheader: 'Talles, stock y beneficios en un solo lugar.',
      content: '<p>Explorá la colección por categoría, guardá favoritos y usá el asistente de talle. Tu cuenta reúne tus compras, preferencias y beneficios.</p>',
      action: { label: 'EXPLORAR COLECCIÓN', url: `${origin}/?utm_source=email&utm_medium=automation&utm_campaign=welcome` },
      kind: 'newsletter_nurture', entityId: subscriber.id,
    });
    if (result.sent) await statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), 'newsletter_nurture', subscriber.id, subscriber.email, 'sent', now()).run();
    if (result.sent) sent++;
  }
  const browse = await rows<Record<string, any>>(
    `SELECT e.customerId||':'||e.productId AS entityId,a.email,p.name,profile.slug,MAX(e.createdAt) AS viewedAt
     FROM store_events e JOIN customer_accounts a ON a.customerId=e.customerId AND a.marketingConsent=1
     JOIN products p ON p.id=e.productId JOIN online_product_profiles profile ON profile.productId=p.id
     LEFT JOIN marketing_automation_log l ON l.kind='browse_reminder' AND l.entityId=e.customerId||':'||e.productId
     WHERE e.event='view_item' AND e.createdAt<=? AND l.id IS NULL
       AND NOT EXISTS(SELECT 1 FROM store_events later WHERE later.customerId=e.customerId AND later.productId=e.productId AND later.event IN ('add_to_cart','purchase') AND later.createdAt>=e.createdAt)
     GROUP BY e.customerId,e.productId LIMIT 100`,
    new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  );
  for (const view of browse) {
    const result = await sendMarketingEmail({
      to: view.email, subject: `${String(view.name).toUpperCase()} SIGUE ACÁ.`, title: '¿QUERÉS VOLVER A MIRARLA?',
      preheader: 'Consultá talle, color y stock actualizado.',
      content: `<p>Volvé a revisar ${String(view.name).replace(/[<>&]/g, '')}. La disponibilidad se actualiza con el mismo stock del local.</p>`,
      action: { label: 'VER PRODUCTO', url: `${origin}/producto/${view.slug}?utm_source=email&utm_medium=automation&utm_campaign=browse` },
      kind: 'browse_reminder', entityId: view.entityId,
    });
    if (result.sent) await statement("INSERT OR IGNORE INTO marketing_automation_log(id,kind,entityId,recipient,status,detail,createdAt) VALUES (?,?,?,?,?,'',?)", id(), 'browse_reminder', view.entityId, view.email, 'sent', now()).run();
    if (result.sent) sent++;
  }
  return { ...(await storeGrowthDashboard(actor)), processed: carts.length + waits.length + postPurchase.length + winback.length + nurture.length + browse.length, sent };
}
