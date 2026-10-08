import {
  recoveryConfiguration,
  recoveryEmailUsage,
  runCartRecovery,
} from './cart-recovery';
import { z } from 'zod';
import { storeApiOrigin, publicStoreData } from './store-api';
import { Actor, AppError, requirePermission } from './auth';
import { currentStoreCustomer } from './online-store';
import { db, id, now, one, rows, statement } from '@/db/queries';
import { emailConfiguration } from './email';
import {
  publicLine,
  publicMultiline,
  publicOptionalLine,
} from './public-validation';

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
] as const;

const eventInput = z
  .object({
    sessionId: z.uuid(),
    event: z.enum(trackedEvents),
    path: publicOptionalLine(300),
    productId: z.string().trim().max(100).optional(),
    variantId: z.string().trim().max(100).optional(),
    orderId: z.uuid().optional(),
    value: z.number().int().min(0).max(1_000_000_000).default(0),
    source: publicOptionalLine(100),
    medium: publicOptionalLine(100),
    campaign: publicOptionalLine(160),
    metadata: z
      .record(
        z.string().max(50),
        z.union([z.string().max(300), z.number(), z.boolean(), z.null()]),
      )
      .refine((value) => Object.keys(value).length <= 20, 'Demasiados datos.')
      .default({}),
    email: z
      .union([z.email().trim().toLowerCase().max(200), z.literal('')])
      .default(''),
    cart: z
      .array(
        z
          .object({
            variantId: z.string().min(1).max(100),
            productName: publicLine(1, 160),
            slug: publicLine(1, 160),
            color: publicLine(0, 100),
            size: publicLine(0, 60),
            price: z.number().int().min(0),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict();

export async function trackStoreEvent(req: Request, raw: unknown) {
  const input = eventInput.parse(raw);
  const customer = await currentStoreCustomer(req);
  const recent = await one<{ total: number }>(
    'SELECT COUNT(*) AS total FROM store_events WHERE sessionId=? AND createdAt>=?',
    input.sessionId,
    new Date(Date.now() - 60_000).toISOString(),
  );
  if (Number(recent?.total ?? 0) > 120)
    throw new AppError(429, 'Esperá un momento.');
  const createdAt = now();
  await statement(
    `INSERT INTO store_events(id,sessionId,customerId,event,path,productId,variantId,orderId,value,source,medium,campaign,metadata,createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id(),
    input.sessionId,
    customer?.customerId ?? null,
    input.event,
    input.path,
    input.productId ?? null,
    input.variantId ?? null,
    input.orderId ?? null,
    input.value,
    input.source,
    input.medium,
    input.campaign,
    JSON.stringify(input.metadata).slice(0, 2000),
    createdAt,
  ).run();
  if (input.cart) {
    const subtotal = input.cart.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    const existing = await one<{ id: string; recoveryToken: string }>(
      'SELECT id,recoveryToken,status FROM abandoned_carts WHERE sessionId=?',
      input.sessionId,
    );
    const savedConsent = existing
      ? await one(
          'SELECT key FROM settings WHERE key=?',
          'cart-recovery-consent:' + existing.id,
        )
      : null;
    if (savedConsent && !input.cart.length && existing) {
      await db().batch([
        statement(
          "UPDATE abandoned_carts SET email='',status='empty',cartJson='[]',subtotal=0,updatedAt=? WHERE id=?",
          createdAt,
          existing.id,
        ),
        statement(
          'DELETE FROM settings WHERE key=?',
          'cart-recovery-consent:' + existing.id,
        ),
      ]);
      return { ok: true };
    }
    if (
      savedConsent ||
      (existing &&
        ['converted', 'recovered'].includes((existing as any).status))
    )
      return { ok: true };
    const effectiveEmail = '';
    if (!input.cart.length) {
      if (existing)
        await statement(
          "UPDATE abandoned_carts SET status='empty',cartJson='[]',subtotal=0,updatedAt=? WHERE id=?",
          createdAt,
          existing.id,
        ).run();
    } else if (existing) {
      await statement(
        `UPDATE abandoned_carts SET customerId=?,email=?,cartJson=?,subtotal=?,status='active',source=?,campaign=?,lastActivityAt=?,updatedAt=? WHERE id=?`,
        customer?.customerId ?? null,
        effectiveEmail,
        JSON.stringify(input.cart),
        subtotal,
        input.source,
        input.campaign,
        createdAt,
        createdAt,
        existing.id,
      ).run();
    } else {
      await statement(
        `INSERT INTO abandoned_carts(id,sessionId,customerId,email,cartJson,subtotal,status,recoveryToken,source,campaign,lastActivityAt,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,'active',?,?,?,?,?,?)`,
        id(),
        input.sessionId,
        customer?.customerId ?? null,
        effectiveEmail,
        JSON.stringify(input.cart),
        subtotal,
        crypto.randomUUID() + crypto.randomUUID(),
        input.source,
        input.campaign,
        createdAt,
        createdAt,
        createdAt,
      ).run();
    }
  }
  return { ok: true };
}

export async function recoverCart(token: string) {
  const saved = await one<Record<string, any>>(
    "SELECT cartJson,subtotal,status FROM abandoned_carts WHERE recoveryToken=? AND status='active' AND lastActivityAt>=?",
    token.slice(0, 160),
    new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  if (!saved)
    throw new AppError(
      404,
      'Este enlace de recuperación ya no está disponible.',
    );
  const cart: Record<string, any>[] = [];
  for (const line of JSON.parse(saved.cartJson)) {
    const variant = await one<Record<string, any>>(
      `SELECT v.id AS variantId,v.sku,v.barcode,v.color,v.size,COALESCE(v.onlinePrice,v.price) AS price,p.id AS productId,p.name AS productName,profile.slug,MAX(0,v.stock-COALESCE((SELECT SUM(r.quantity) FROM stock_reservations r WHERE r.variantId=v.id AND r.status='active' AND r.expiresAt>?),0)) AS stock FROM variants v JOIN products p ON p.id=v.productId JOIN online_product_profiles profile ON profile.productId=p.id WHERE v.id=? AND p.active=1 AND profile.published=1`,
      now(),
      line.variantId,
    );
    if (variant && variant.stock > 0)
      cart.push({
        ...variant,
        quantity: Math.min(Number(line.quantity), Number(variant.stock), 20),
      });
  }
  if (!cart.length)
    throw new AppError(409, 'Estas prendas ya no tienen stock disponible.');
  return {
    cart,
    subtotal: cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
  };
}

export async function requestBackInStock(req: Request, raw: unknown) {
  const input = z
    .object({
      variantId: z.string().min(1).max(100),
      email: z.email().trim().toLowerCase().max(200),
    })
    .strict()
    .parse(raw);
  const variant = await one(
    'SELECT id FROM variants WHERE id=? AND stock<=0',
    input.variantId,
  );
  if (!variant)
    throw new AppError(409, 'Esta variante ya tiene stock disponible.');
  const existing = await one<{ id: string }>(
    'SELECT id FROM back_in_stock_requests WHERE variantId=? AND email=?',
    input.variantId,
    input.email,
  );
  if (existing) {
    await statement(
      "UPDATE back_in_stock_requests SET status='waiting',notifiedAt=NULL WHERE id=?",
      existing.id,
    ).run();
  } else {
    await statement(
      "INSERT INTO back_in_stock_requests(id,variantId,email,status,source,createdAt) VALUES (?,?,?,'waiting','product',?)",
      id(),
      input.variantId,
      input.email,
      now(),
    ).run();
  }
  return { ok: true };
}

export async function publicProductReviews(productId: string) {
  if (storeApiOrigin())
    return publicStoreData<{
      average: number;
      total: number;
      reviews: Record<string, unknown>[];
    }>('store-reviews', { productId });
  const summary = await one<{ average: number; total: number }>(
    "SELECT COALESCE(AVG(rating),0) AS average,COUNT(*) AS total FROM product_reviews WHERE productId=? AND status='published'",
    productId,
  );
  const reviews = await rows(
    "SELECT id,displayName,rating,title,body,verified,createdAt FROM product_reviews WHERE productId=? AND status='published' ORDER BY verified DESC,createdAt DESC LIMIT 50",
    productId,
  );
  return {
    average: Number(summary?.average ?? 0),
    total: Number(summary?.total ?? 0),
    reviews,
  };
}

export async function submitProductReview(req: Request, raw: unknown) {
  const input = z
    .object({
      productId: z.string().min(1).max(100),
      orderId: z.union([z.uuid(), z.literal('')]).default(''),
      email: z.email().trim().toLowerCase().max(200),
      displayName: publicLine(2, 80),
      rating: z.number().int().min(1).max(5),
      title: publicOptionalLine(100),
      body: publicMultiline(600).refine(
        (value) => value.length >= 10,
        'La reseña es demasiado corta.',
      ),
    })
    .strict()
    .parse(raw);
  const customer = await currentStoreCustomer(req);
  let verified = 0;
  if (input.orderId) {
    const purchase = await one(
      `SELECT o.id FROM online_orders o JOIN online_order_items oi ON oi.orderId=o.id
       JOIN variants v ON v.id=oi.variantId WHERE o.id=? AND lower(o.email)=? AND v.productId=? AND o.paymentStatus='paid'`,
      input.orderId,
      input.email,
      input.productId,
    );
    verified = purchase ? 1 : 0;
  }
  await statement(
    `INSERT INTO product_reviews(id,productId,customerId,orderId,email,displayName,rating,title,body,status,verified,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
    id(),
    input.productId,
    customer?.customerId ?? null,
    input.orderId || null,
    input.email,
    input.displayName,
    input.rating,
    input.title,
    input.body,
    verified,
    now(),
    now(),
  ).run();
  return { ok: true, status: 'pending' };
}

export async function storeGrowthDashboard(actor: Actor) {
  requirePermission(actor, 'marketing');
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [
    events,
    sources,
    products,
    carts,
    reviews,
    waits,
    automations,
    orders,
  ] = await Promise.all([
    rows<{ event: string; total: number; sessions: number }>(
      'SELECT event,COUNT(*) AS total,COUNT(DISTINCT sessionId) AS sessions FROM store_events WHERE createdAt>=? GROUP BY event',
      since,
    ),
    rows(
      "SELECT COALESCE(NULLIF(source,''),'Directo') AS source,COALESCE(NULLIF(campaign,''),'Sin campaña') AS campaign,COUNT(DISTINCT sessionId) AS sessions,SUM(CASE WHEN event='purchase' THEN value ELSE 0 END) AS revenue FROM store_events WHERE createdAt>=? GROUP BY source,campaign ORDER BY revenue DESC,sessions DESC LIMIT 20",
      since,
    ),
    rows(
      "SELECT p.name,SUM(CASE WHEN e.event='view_item' THEN 1 ELSE 0 END) AS views,SUM(CASE WHEN e.event='add_to_cart' THEN 1 ELSE 0 END) AS adds FROM store_events e JOIN products p ON p.id=e.productId WHERE e.createdAt>=? AND e.event IN ('view_item','add_to_cart') GROUP BY p.id ORDER BY views DESC LIMIT 15",
      since,
    ),
    rows(
      "SELECT id,email,subtotal,status,source,campaign,lastActivityAt,firstReminderAt,secondReminderAt FROM abandoned_carts WHERE status='active' ORDER BY lastActivityAt DESC LIMIT 100",
    ),
    rows(
      'SELECT r.id,p.name AS product,r.displayName,r.rating,r.title,r.body,r.verified,r.status,r.createdAt FROM product_reviews r JOIN products p ON p.id=r.productId ORDER BY r.createdAt DESC LIMIT 100',
    ),
    rows(
      'SELECT b.id,p.name AS product,v.color,v.size,b.email,b.status,b.createdAt FROM back_in_stock_requests b JOIN variants v ON v.id=b.variantId JOIN products p ON p.id=v.productId ORDER BY b.createdAt DESC LIMIT 100',
    ),
    rows(
      'SELECT kind,recipient,status,detail,createdAt FROM marketing_automation_log ORDER BY createdAt DESC LIMIT 100',
    ),
    rows<{
      id: string;
      paymentStatus: string;
      status: string;
      total: number;
      attributionJson: string;
      createdAt: string;
      paidAt: string;
    }>(
      'SELECT id,paymentStatus,status,total,attributionJson,createdAt,paidAt FROM online_orders WHERE createdAt>=? OR paidAt>=?',
      since,
      since,
    ),
  ]);
  const counts = Object.fromEntries(
    events.map((row) => [row.event, Number(row.sessions)]),
  );
  const createdOrders = orders.filter((order) => order.createdAt >= since);
  const paidOrders = orders.filter(
    (order) =>
      order.paymentStatus === 'paid' &&
      order.status !== 'cancelled' &&
      order.paidAt >= since,
  );
  const channelSales = new Map<
    string,
    { orders: number; paidOrders: number; revenue: number }
  >();
  for (const order of orders) {
    let attribution: {
      source?: string;
      campaign?: string;
      sessionId?: string;
    } = {};
    try {
      attribution = JSON.parse(order.attributionJson || '{}');
    } catch {
      /* Legacy order without attribution. */
    }
    const source = attribution.sessionId
      ? attribution.source || 'Directo'
      : 'Sin atribución';
    const campaign = attribution.campaign || 'Sin campaña';
    const key = JSON.stringify([source, campaign]);
    const row = channelSales.get(key) || {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
    };
    if (order.createdAt >= since) row.orders++;
    if (paidOrders.includes(order)) {
      row.paidOrders++;
      row.revenue += Number(order.total);
    }
    channelSales.set(key, row);
  }
  const channels: {
    source: string;
    campaign: string;
    sessions: number;
    orders: number;
    paidOrders: number;
    revenue: number;
  }[] = sources.map((row) => ({
    source: String(row.source),
    campaign: String(row.campaign),
    sessions: Number(row.sessions),
    ...(channelSales.get(JSON.stringify([row.source, row.campaign])) || {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
    }),
  }));
  for (const [key, sales] of channelSales) {
    const [source, campaign] = JSON.parse(key);
    if (
      !channels.some(
        (row) => row.source === source && row.campaign === campaign,
      )
    )
      channels.push({ source, campaign, sessions: 0, ...sales });
  }
  return {
    periodDays: 30,
    funnel: {
      visitors: counts.page_view ?? 0,
      productViews: counts.view_item ?? 0,
      addToCart: counts.add_to_cart ?? 0,
      checkout: counts.begin_checkout ?? 0,
      purchases: counts.purchase ?? 0,
      orders: counts.order_created ?? 0,
    },
    commerce: {
      createdOrders: createdOrders.length,
      paidOrders: paidOrders.length,
      pendingOrders: createdOrders.filter(
        (order) =>
          order.status !== 'cancelled' && order.paymentStatus !== 'paid',
      ).length,
      revenue: paidOrders.reduce(
        (total, order) => total + Number(order.total),
        0,
      ),
    },
    sources: channels.sort((a, b) => Number(b.revenue) - Number(a.revenue)),
    products,
    carts,
    reviews,
    waits,
    automations,
    configured: emailConfiguration('marketing').configured,
    recovery: await recoveryConfiguration(),
    emailUsage: await recoveryEmailUsage(),
    recoveryLastRun: await one<{ value: string }>(
      'SELECT value FROM settings WHERE key=?',
      'cart-recovery-last-run',
    ).then((row) => (row ? JSON.parse(row.value) : null)),
    scheduler:
      'Cada 5 minutos en Railway; tiempos mínimos desde la última actividad.',
  };
}

export async function moderateReview(actor: Actor, raw: unknown) {
  requirePermission(actor, 'marketing');
  const input = z
    .object({
      reviewId: z.string().min(1),
      status: z.enum(['published', 'rejected']),
    })
    .strict()
    .parse(raw);
  await statement(
    'UPDATE product_reviews SET status=?,updatedAt=? WHERE id=?',
    input.status,
    now(),
    input.reviewId,
  ).run();
  return storeGrowthDashboard(actor);
}

export async function runMarketingAutomations(actor: Actor) {
  requirePermission(actor, 'marketing');
  const result = await runCartRecovery();
  return { ...(await storeGrowthDashboard(actor)), ...result };
}
