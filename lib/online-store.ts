import { z } from 'zod';
import { env } from 'cloudflare:workers';
import {
  db,
  id,
  now,
  one,
  rows,
  statement,
  auditStatement,
} from '@/db/queries';
import { Actor, AppError, requirePermission } from './auth';
import {
  calculateLoyaltyLevel,
  readCustomerIntelligenceConfig,
} from './customer-intelligence';

const SESSION_COOKIE = 'fraguan_customer';
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
async function sha256(value: string) {
  return bytesToBase64(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: 210_000,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}
function cookieValue(req: Request, name: string) {
  const source = req.headers.get('cookie') ?? '';
  for (const pair of source.split(';')) {
    const [key, ...value] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}
export function customerCookie(
  token: string,
  secure: boolean,
  maxAge = 30 * 86400,
) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

type StoreCustomer = {
  accountId: string;
  customerId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  points: number;
};
export async function currentStoreCustomer(req: Request) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  return one<StoreCustomer>(
    `SELECT a.id AS accountId,a.customerId,a.email,c.name,c.surname,c.phone,c.points
       FROM customer_sessions s JOIN customer_accounts a ON a.id=s.accountId
       JOIN customers c ON c.id=a.customerId
      WHERE s.tokenHash=? AND s.expiresAt>? AND c.active=1`,
    await sha256(token),
    now(),
  );
}

async function ensureOnlineProfiles() {
  await statement(
    `INSERT OR IGNORE INTO online_product_profiles
      (productId,slug,shortDescription,description,material,care,fit,section,featured,published,sortOrder,updatedAt)
     SELECT p.id,'producto-'||lower(substr(replace(p.id,'-',''),1,16)),
            'Una prenda versátil para usar todos los días.',
            'Diseñada para combinar fácil, sentirse cómoda y acompañarte durante todo el día.',
            'Consultar composición en la etiqueta.','Seguir las indicaciones de la etiqueta interior.',
            'Regular',p.category,0,p.active,100,?
       FROM products p LEFT JOIN online_product_profiles profile ON profile.productId=p.id
      WHERE profile.productId IS NULL`,
    now(),
  ).run();
}

export async function storeCatalog(query = '', section = '') {
  await ensureOnlineProfiles();
  const q = `%${query.slice(0, 100)}%`;
  const products = await rows<Record<string, any>>(
    `SELECT p.id,p.name,p.category,p.brand,profile.slug,profile.shortDescription,
            profile.description,profile.material,profile.care,profile.fit,profile.section,
            profile.featured,profile.sortOrder,v.id AS variantId,v.sku,v.barcode,v.color,v.size,v.price,
            MAX(0,v.stock-COALESCE((SELECT SUM(r.quantity) FROM stock_reservations r
              WHERE r.variantId=v.id AND r.status='active' AND r.expiresAt>?),0)) AS available
       FROM online_product_profiles profile JOIN products p ON p.id=profile.productId
       JOIN variants v ON v.productId=p.id
      WHERE profile.published=1 AND p.active=1
        AND (?='' OR (?='Nuevos' AND profile.featured=1) OR profile.section=? OR p.category=?)
        AND (?='%%' OR p.name LIKE ? OR p.category LIKE ? OR p.brand LIKE ? OR v.color LIKE ? OR v.sku LIKE ?)
      ORDER BY profile.featured DESC,profile.sortOrder,p.name,v.color,v.size`,
    now(),
    section,
    section,
    section,
    section,
    q,
    q,
    q,
    q,
    q,
    q,
  );
  const grouped = new Map<string, Record<string, any>>();
  for (const row of products) {
    if (!grouped.has(row.id))
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        category: row.category,
        brand: row.brand,
        slug: row.slug,
        shortDescription: row.shortDescription,
        description: row.description,
        material: row.material,
        care: row.care,
        fit: row.fit,
        section: row.section,
        featured: Boolean(row.featured),
        price: row.price,
        variants: [],
      });
    const product = grouped.get(row.id)!;
    product.price = Math.min(product.price, row.price);
    product.variants.push({
      id: row.variantId,
      sku: row.sku,
      barcode: row.barcode,
      color: row.color,
      size: row.size,
      price: row.price,
      stock: row.available,
    });
  }
  const sections = await rows<{ name: string; products: number }>(
    `SELECT profile.section AS name,COUNT(DISTINCT profile.productId) AS products
       FROM online_product_profiles profile JOIN products p ON p.id=profile.productId
      WHERE profile.published=1 AND p.active=1 GROUP BY profile.section ORDER BY MIN(profile.sortOrder)`,
  );
  return { products: [...grouped.values()], sections };
}

export async function storeProduct(slug: string) {
  const catalog = await storeCatalog();
  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) throw new AppError(404, 'Producto no encontrado.');
  const related = catalog.products
    .filter(
      (item) => item.id !== product.id && item.category === product.category,
    )
    .slice(0, 4);
  return { product, related };
}

async function correoToken() {
  const base = env.CORREO_API_URL;
  const user = env.CORREO_API_USER;
  const password = env.CORREO_API_PASSWORD;
  if (!base || !user || !password) return null;
  const response = await fetch(`${base.replace(/\/$/, '')}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${user}:${password}`)}` },
  });
  if (!response.ok)
    throw new Error('Correo Argentino no pudo autenticar la cuenta.');
  const result: any = await response.json();
  if (!result.token) throw new Error('Correo Argentino no devolvió un token.');
  return result.token as string;
}

const provinceCodes: Record<string, string> = {
  salta: 'A',
  'buenos aires': 'B',
  'provincia de buenos aires': 'B',
  caba: 'C',
  'ciudad autonoma de buenos aires': 'C',
  'capital federal': 'C',
  'san luis': 'D',
  'entre rios': 'E',
  'entre ríos': 'E',
  'la rioja': 'F',
  'santiago del estero': 'G',
  chaco: 'H',
  'san juan': 'J',
  catamarca: 'K',
  'la pampa': 'L',
  mendoza: 'M',
  misiones: 'N',
  formosa: 'P',
  neuquen: 'Q',
  neuquén: 'Q',
  'rio negro': 'R',
  'río negro': 'R',
  'santa fe': 'S',
  tucuman: 'T',
  tucumán: 'T',
  chubut: 'U',
  'tierra del fuego': 'V',
  corrientes: 'W',
  cordoba: 'X',
  córdoba: 'X',
  jujuy: 'Y',
  'santa cruz': 'Z',
};

async function importCorreoOrder(orderId: string, actorId: string) {
  const token = await correoToken();
  if (!token || !env.CORREO_CUSTOMER_ID || !env.CORREO_API_URL)
    return { configured: false };
  if (
    await one(
      'SELECT id FROM online_order_events WHERE orderId=? AND kind=?',
      orderId,
      'shipping_imported',
    )
  )
    return { configured: true, duplicate: true };
  const order = await one<Record<string, any>>(
    'SELECT * FROM online_orders WHERE id=?',
    orderId,
  );
  if (!order || order.shippingMethod !== 'correo-argentino-home')
    return { configured: true, skipped: true };
  const item = await one<{ units: number }>(
    'SELECT COALESCE(SUM(quantity),1) AS units FROM online_order_items WHERE orderId=?',
    orderId,
  );
  const match = String(order.address).match(/^(.*?)(\d+)(.*)$/);
  const provinceCode =
    provinceCodes[String(order.province).trim().toLowerCase()];
  if (!match || !provinceCode) {
    await statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
      id(),
      orderId,
      'shipping_import_failed',
      'Revisar calle, altura o provincia',
      actorId,
      now(),
    ).run();
    return { configured: true, imported: false };
  }
  const units = Number(item?.units ?? 1);
  const response = await fetch(
    `${env.CORREO_API_URL.replace(/\/$/, '')}/shipping/import`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: env.CORREO_CUSTOMER_ID,
        extOrderId: order.id,
        orderNumber: String(order.orderNumber),
        recipient: {
          name: order.customerName,
          phone: order.phone,
          cellPhone: order.phone,
          email: order.email,
        },
        shipping: {
          deliveryType: 'D',
          agency: null,
          address: {
            streetName: match[1].trim(),
            streetNumber: match[2],
            floor: '',
            apartment: match[3].trim().slice(0, 3),
            city: order.city,
            provinceCode,
            postalCode: order.postalCode,
          },
          weight: Math.min(25000, Math.max(500, units * 350)),
          declaredValue: Number(order.total) / 100,
          height: 12,
          length: 40,
          width: 30,
        },
      }),
    },
  );
  const result: any = await response.json().catch(() => ({}));
  const success = response.ok;
  await statement(
    'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
    id(),
    orderId,
    success ? 'shipping_imported' : 'shipping_import_failed',
    success
      ? 'Envío importado automáticamente a MiCorreo'
      : String(result.message ?? 'MiCorreo rechazó el envío').slice(0, 300),
    actorId,
    now(),
  ).run();
  return { configured: true, imported: success };
}

export async function shippingQuote(
  postalCode: string,
  subtotal: number,
  method: string,
  units = 1,
) {
  const code = postalCode.replace(/\D/g, '');
  if (code.length !== 4)
    throw new AppError(400, 'Ingresá un código postal argentino válido.');
  if (method === 'pickup')
    return {
      method,
      name: 'Retiro en el local',
      amount: 0,
      days: 'Disponible al confirmar',
    };
  const token = await correoToken();
  if (token && env.CORREO_CUSTOMER_ID && env.CORREO_ORIGIN_POSTAL_CODE) {
    const response = await fetch(
      `${env.CORREO_API_URL!.replace(/\/$/, '')}/rates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: env.CORREO_CUSTOMER_ID,
          postalCodeOrigin: env.CORREO_ORIGIN_POSTAL_CODE,
          postalCodeDestination: code,
          deliveredType: 'D',
          dimensions: {
            weight: Math.min(25000, Math.max(500, units * 350)),
            height: 12,
            width: 30,
            length: 40,
          },
        }),
      },
    );
    if (!response.ok)
      throw new AppError(
        503,
        'No pudimos cotizar Correo Argentino en este momento.',
      );
    const result: any = await response.json();
    const rate =
      result.rates?.find((item: any) => item.deliveredType === 'D') ??
      result.rates?.[0];
    if (!rate)
      throw new AppError(
        503,
        'Correo Argentino no devolvió una tarifa para ese destino.',
      );
    return {
      method: 'correo-argentino-home',
      name: `Correo Argentino · ${rate.productName || 'domicilio'}`,
      amount: subtotal >= 18000000 ? 0 : Math.round(Number(rate.price) * 100),
      days: 'Plazo informado al despachar',
      estimated: false,
      validTo: result.validTo,
    };
  }
  const zone = Number(code.slice(0, 1));
  const base = zone === 1 ? 690000 : zone <= 5 ? 890000 : 1090000;
  return {
    method: 'correo-argentino-home',
    name: 'Correo Argentino · domicilio',
    amount: subtotal >= 18000000 ? 0 : base,
    days: zone === 1 ? '2 a 4 días hábiles' : '3 a 7 días hábiles',
    estimated: true,
  };
}

async function createMercadoPagoPreference(order: Record<string, any>) {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return null;
  const origin = env.SITE_ORIGIN?.replace(/\/$/, '');
  const publicOrigin = origin && /^https:\/\//i.test(origin) ? origin : null;
  const body: Record<string, any> = {
    items: [
      {
        id: order.id,
        title: `Pedido FRAGUAN #${order.orderNumber}`,
        currency_id: 'ARS',
        quantity: 1,
        unit_price: Number(order.total) / 100,
      },
    ],
    payer: { email: order.email, name: order.customerName },
    external_reference: order.transferReference,
    statement_descriptor: 'FRAGUAN',
    expires: true,
    expiration_date_to: order.expiresAt,
  };
  if (publicOrigin) {
    body.notification_url = `${publicOrigin}/api/webhooks/mercadopago`;
    body.back_urls = {
      success: `${publicOrigin}/cuenta`,
      pending: `${publicOrigin}/cuenta`,
      failure: `${publicOrigin}/checkout`,
    };
    body.auto_return = 'approved';
  }
  const response = await fetch(
    'https://api.mercadopago.com/checkout/preferences',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `fraguan-${order.id}`,
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new AppError(
      503,
      'No pudimos iniciar el pago con tarjeta. El stock sigue reservado.',
    );
  const result: any = await response.json();
  if (!result.id || !result.init_point)
    throw new AppError(503, 'Mercado Pago no devolvió el enlace de pago.');
  await statement(
    'UPDATE online_orders SET paymentReference=?,updatedAt=? WHERE id=?',
    result.id,
    now(),
    order.id,
  ).run();
  return String(result.init_point);
}

const accountInput = z
  .object({
    action: z.enum(['register', 'login', 'logout']),
    email: z.email().trim().toLowerCase().max(200).optional(),
    password: z.string().min(8).max(128).optional(),
    name: z.string().trim().min(2).max(80).optional(),
    surname: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(6).max(40).optional(),
    marketingConsent: z.boolean().optional(),
  })
  .strict();

export async function storeAccountWrite(req: Request, raw: unknown) {
  const input = accountInput.parse(raw);
  if (input.action === 'logout') {
    const token = cookieValue(req, SESSION_COOKIE);
    if (token)
      await statement(
        'DELETE FROM customer_sessions WHERE tokenHash=?',
        await sha256(token),
      ).run();
    return {
      data: { ok: true },
      cookie: customerCookie('', new URL(req.url).protocol === 'https:', 0),
    };
  }
  if (!input.email || !input.password)
    throw new AppError(400, 'Completá email y contraseña.');
  let account: {
    id: string;
    customerId: string;
    passwordHash: string;
    passwordSalt: string;
  } | null;
  if (input.action === 'register') {
    if (!input.name || !input.surname || !input.phone)
      throw new AppError(400, 'Completá tus datos personales.');
    if (
      await one('SELECT id FROM customer_accounts WHERE email=?', input.email)
    )
      throw new AppError(409, 'Ya existe una cuenta con ese email.');
    const customerId = id(),
      accountId = id(),
      salt = randomToken(18),
      createdAt = now();
    await db().batch([
      statement(
        'INSERT INTO customers(id,name,surname,phone,email,whatsapp,createdAt) VALUES (?,?,?,?,?,?,?)',
        customerId,
        input.name,
        input.surname,
        input.phone,
        input.email,
        input.phone,
        createdAt,
      ),
      statement(
        'INSERT INTO customer_accounts(id,customerId,email,passwordHash,passwordSalt,marketingConsent,createdAt,lastLoginAt) VALUES (?,?,?,?,?,?,?,?)',
        accountId,
        customerId,
        input.email,
        await passwordHash(input.password, salt),
        salt,
        input.marketingConsent ? 1 : 0,
        createdAt,
        createdAt,
      ),
    ]);
    account = {
      id: accountId,
      customerId,
      passwordHash: '',
      passwordSalt: salt,
    };
  } else {
    account = await one(
      'SELECT id,customerId,passwordHash,passwordSalt FROM customer_accounts WHERE email=?',
      input.email,
    );
    if (
      !account ||
      (await passwordHash(input.password, account.passwordSalt)) !==
        account.passwordHash
    )
      throw new AppError(401, 'Email o contraseña incorrectos.');
    await statement(
      'UPDATE customer_accounts SET lastLoginAt=? WHERE id=?',
      now(),
      account.id,
    ).run();
  }
  const token = randomToken(),
    expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await statement(
    'INSERT INTO customer_sessions(id,accountId,tokenHash,expiresAt,createdAt) VALUES (?,?,?,?,?)',
    id(),
    account.id,
    await sha256(token),
    expiresAt,
    now(),
  ).run();
  const customer = await one(
    'SELECT name,surname,phone,points FROM customers WHERE id=?',
    account.customerId,
  );
  return {
    data: { account: { email: input.email, ...customer } },
    cookie: customerCookie(token, new URL(req.url).protocol === 'https:'),
  };
}

export async function storeAccount(req: Request) {
  const customer = await currentStoreCustomer(req);
  if (!customer) return { customer: null, orders: [], cashback: 0 };
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const [orders, cashback, activity, config] = await Promise.all([
    rows(
      `SELECT id,orderNumber,status,paymentStatus,fulfillmentStatus,total,trackingNumber,createdAt
         FROM online_orders WHERE customerId=? ORDER BY createdAt DESC LIMIT 50`,
      customer.customerId,
    ),
    one<{ balance: number }>(
      "SELECT COALESCE(SUM(balance),0) AS balance FROM customer_cashback WHERE customerId=? AND status='active' AND balance>0 AND (expiresAt IS NULL OR expiresAt>?)",
      customer.customerId,
      now(),
    ),
    one<Record<string, any>>(
      `SELECT MIN(s.createdAt) AS firstPurchaseAt,MAX(s.createdAt) AS lastPurchaseAt,
              COUNT(s.id) AS purchaseCount,COALESCE(SUM(s.total-COALESCE(refunds.amount,0)),0) AS lifetimeSpendMinor,
              COUNT(CASE WHEN s.createdAt>=? THEN 1 END) AS recentPurchases,
              COALESCE(SUM(CASE WHEN s.createdAt>=? THEN s.total-COALESCE(refunds.amount,0) ELSE 0 END),0) AS recentSpend
         FROM sales s LEFT JOIN (SELECT saleId,SUM(amount) AS amount FROM refunds GROUP BY saleId) refunds ON refunds.saleId=s.id
        WHERE s.customerId=?`,
      cutoff,
      cutoff,
      customer.customerId,
    ),
    readCustomerIntelligenceConfig(),
  ]);
  const level = calculateLoyaltyLevel(
    {
      createdAt: now(),
      firstPurchaseAt: activity?.firstPurchaseAt ?? null,
      lastPurchaseAt: activity?.lastPurchaseAt ?? null,
      purchaseCount: Number(activity?.purchaseCount ?? 0),
      lifetimeSpendMinor: Number(activity?.lifetimeSpendMinor ?? 0),
      purchasesInSegmentWindow: Number(activity?.recentPurchases ?? 0),
      spendInSegmentWindowMinor: Number(activity?.recentSpend ?? 0),
      purchasesInLoyaltyWindow: Number(activity?.recentPurchases ?? 0),
      spendInLoyaltyWindowMinor: Number(activity?.recentSpend ?? 0),
      points: customer.points,
    },
    config,
  );
  return {
    customer: { ...customer, level },
    orders,
    cashback: Number(cashback?.balance ?? 0),
  };
}

const checkoutInput = z
  .object({
    items: z
      .array(
        z
          .object({
            variantId: z.string().min(1).max(100),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    email: z.email().trim().toLowerCase().max(200),
    customerName: z.string().trim().min(3).max(160),
    phone: z.string().trim().min(6).max(40),
    paymentMethod: z.enum(['transfer', 'card']),
    shippingMethod: z.enum(['correo-argentino-home', 'pickup']),
    postalCode: z.string().trim().min(4).max(10),
    address: z.string().trim().min(4).max(240),
    city: z.string().trim().min(2).max(100),
    province: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(500).default(''),
    idempotencyKey: z.uuid(),
    accessToken: z.uuid(),
  })
  .strict();

export async function createOnlineOrder(req: Request, raw: unknown) {
  const input = checkoutInput.parse(raw);
  const existing = await one(
    'SELECT * FROM online_orders WHERE id=?',
    input.idempotencyKey,
  );
  if (existing) {
    if ((existing as any).accessTokenHash !== (await sha256(input.accessToken)))
      throw new AppError(403, 'Acceso denegado.');
    const detail = await onlineOrderDetail(String((existing as any).id));
    const paymentUrl =
      detail.paymentMethod === 'card'
        ? await createMercadoPagoPreference(detail)
        : null;
    return { ...detail, accessToken: input.accessToken, paymentUrl };
  }
  if (
    new Set(input.items.map((item) => item.variantId)).size !==
    input.items.length
  )
    throw new AppError(400, 'Agrupá las cantidades de cada talle y color.');
  const customer = await currentStoreCustomer(req);
  const effectiveEmail = customer?.email ?? input.email;
  const effectiveName = customer
    ? `${customer.name} ${customer.surname}`
    : input.customerName;
  const effectivePhone = customer?.phone ?? input.phone;
  const lines: Record<string, any>[] = [];
  let subtotal = 0;
  for (const item of input.items) {
    const variant = await one<Record<string, any>>(
      `SELECT v.id,v.sku,v.color,v.size,v.price,p.name,v.stock-COALESCE((SELECT SUM(r.quantity)
         FROM stock_reservations r WHERE r.variantId=v.id AND r.status='active' AND r.expiresAt>?),0) AS available
         FROM variants v JOIN products p ON p.id=v.productId JOIN online_product_profiles profile ON profile.productId=p.id
        WHERE v.id=? AND p.active=1 AND profile.published=1`,
      now(),
      item.variantId,
    );
    if (!variant || Number(variant.available) < item.quantity)
      throw new AppError(
        409,
        'Una variante cambió de stock. Revisá el carrito.',
      );
    lines.push({ ...variant, quantity: item.quantity });
    subtotal += Number(variant.price) * item.quantity;
  }
  const discount =
    input.paymentMethod === 'transfer' ? Math.floor(subtotal * 0.1) : 0;
  const shipping = await shippingQuote(
    input.postalCode,
    subtotal - discount,
    input.shippingMethod,
    lines.reduce((sum, line) => sum + line.quantity, 0),
  );
  const total = subtotal - discount + shipping.amount;
  const orderNumber = Number(
    (
      await one<{ next: number }>(
        'SELECT COALESCE(MAX(orderNumber),1000)+1 AS next FROM online_orders',
      )
    )?.next ?? 1001,
  );
  const orderId = input.idempotencyKey,
    createdAt = now();
  const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
  const transferReference = `FRG-${orderNumber}-${randomToken(3).toUpperCase()}`;
  const commands = [
    statement(
      "UPDATE stock_reservations SET status='expired' WHERE status='active' AND expiresAt<=?",
      createdAt,
    ),
    statement(
      `INSERT INTO online_orders(id,orderNumber,customerId,email,customerName,phone,status,paymentStatus,paymentMethod,fulfillmentStatus,subtotal,discount,shipping,total,shippingMethod,postalCode,address,city,province,notes,accessTokenHash,transferReference,expiresAt,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,'awaiting_payment','pending',?,'unfulfilled',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      orderId,
      orderNumber,
      customer?.customerId ?? null,
      effectiveEmail,
      effectiveName,
      effectivePhone,
      input.paymentMethod,
      subtotal,
      discount,
      shipping.amount,
      total,
      input.shippingMethod,
      input.postalCode,
      input.address,
      input.city,
      input.province,
      input.notes,
      await sha256(input.accessToken),
      transferReference,
      expiresAt,
      createdAt,
      createdAt,
    ),
    statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,createdAt) VALUES (?,?,?,?,?)',
      id(),
      orderId,
      'created',
      'Pedido creado y stock reservado',
      createdAt,
    ),
  ];
  for (const line of lines) {
    commands.push(
      statement(
        'INSERT INTO online_order_items(id,orderId,variantId,productName,sku,color,size,quantity,unitPrice,lineTotal) VALUES (?,?,?,?,?,?,?,?,?,?)',
        id(),
        orderId,
        line.id,
        line.name,
        line.sku,
        line.color,
        line.size,
        line.quantity,
        line.price,
        line.price * line.quantity,
      ),
      statement(
        "INSERT INTO stock_reservations(id,orderId,variantId,quantity,status,expiresAt,createdAt) VALUES (?,?,?,?,'active',?,?)",
        id(),
        orderId,
        line.id,
        line.quantity,
        expiresAt,
        createdAt,
      ),
    );
  }
  try {
    await db().batch(commands);
  } catch (cause) {
    if (
      cause instanceof Error &&
      /online_stock_unavailable/i.test(cause.message)
    )
      throw new AppError(
        409,
        'El stock cambió mientras confirmabas. Revisá el carrito.',
      );
    throw cause;
  }
  const detail = await onlineOrderDetail(orderId);
  const paymentUrl =
    input.paymentMethod === 'card'
      ? await createMercadoPagoPreference(detail)
      : null;
  return { ...detail, accessToken: input.accessToken, paymentUrl };
}

export async function onlineOrderDetail(
  orderId: string,
): Promise<Record<string, any>> {
  const order = await one<Record<string, any>>(
    `SELECT id,orderNumber,customerId,email,customerName,phone,status,paymentStatus,paymentMethod,
            fulfillmentStatus,subtotal,discount,shipping,total,shippingMethod,postalCode,address,city,
            province,notes,transferReference,paymentReference,trackingNumber,expiresAt,paidAt,createdAt,updatedAt
       FROM online_orders WHERE id=?`,
    orderId,
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  const items = await rows(
    `SELECT oi.productName,oi.sku,oi.color,oi.size,oi.quantity,oi.unitPrice,oi.lineTotal,
            COALESCE((SELECT l.name||CASE WHEN l.detail<>'' THEN ' · '||l.detail ELSE '' END
              FROM variant_location_stock vls JOIN stock_locations l ON l.id=vls.locationId
             WHERE vls.variantId=oi.variantId AND vls.quantity>0 ORDER BY l.priority,l.name LIMIT 1),'Sin ubicación') AS location
       FROM online_order_items oi WHERE oi.orderId=?`,
    orderId,
  );
  return { ...order, items };
}

export async function publicOnlineOrder(
  req: Request,
  orderId: string,
  accessToken: string,
) {
  const customer = await currentStoreCustomer(req);
  const order = await one<{
    customerId: string | null;
    accessTokenHash: string;
  }>(
    'SELECT customerId,accessTokenHash FROM online_orders WHERE id=?',
    orderId,
  );
  if (
    !order ||
    (customer?.customerId !== order.customerId &&
      order.accessTokenHash !== (await sha256(accessToken)))
  )
    throw new AppError(403, 'Acceso denegado.');
  return onlineOrderDetail(orderId);
}

export async function reportTransfer(req: Request, raw: unknown) {
  const input = z
    .object({
      orderId: z.uuid(),
      accessToken: z.uuid(),
      transactionId: z.string().trim().min(4).max(120),
    })
    .strict()
    .parse(raw);
  await publicOnlineOrder(req, input.orderId, input.accessToken);
  const order = await one<{ paymentStatus: string }>(
    'SELECT paymentStatus FROM online_orders WHERE id=? AND paymentMethod=?',
    input.orderId,
    'transfer',
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  if (order.paymentStatus === 'paid') return onlineOrderDetail(input.orderId);
  await db().batch([
    statement(
      "UPDATE online_orders SET paymentStatus='reported',paymentReference=?,updatedAt=? WHERE id=?",
      input.transactionId,
      now(),
      input.orderId,
    ),
    statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,createdAt) VALUES (?,?,?,?,?)',
      id(),
      input.orderId,
      'transfer_reported',
      input.transactionId,
      now(),
    ),
  ]);
  return onlineOrderDetail(input.orderId);
}

export async function listOnlineOrders(actor: Actor, orderId = '') {
  requirePermission(actor, 'online-orders');
  if (orderId) {
    const detail = await onlineOrderDetail(orderId);
    return {
      ...detail,
      events: await rows(
        'SELECT kind,detail,actorId,createdAt FROM online_order_events WHERE orderId=? ORDER BY createdAt',
        orderId,
      ),
    };
  }
  return rows(
    `SELECT id,orderNumber,customerName,email,status,paymentStatus,paymentMethod,fulfillmentStatus,total,
            transferReference,paymentReference,shippingMethod,trackingNumber,expiresAt,createdAt
       FROM online_orders ORDER BY createdAt DESC LIMIT 300`,
  );
}

export async function listOnlineCatalog(actor: Actor) {
  requirePermission(actor, 'products');
  await ensureOnlineProfiles();
  return rows(
    `SELECT p.id,p.name,p.category,profile.slug,profile.section,profile.shortDescription,
            profile.description,profile.material,profile.care,profile.fit,profile.featured,
            profile.published,profile.sortOrder,MIN(v.price) AS price,SUM(v.stock) AS stock,
            COUNT(v.id) AS variants
       FROM products p JOIN online_product_profiles profile ON profile.productId=p.id
       JOIN variants v ON v.productId=p.id
      GROUP BY p.id ORDER BY profile.sortOrder,p.name`,
  );
}

export async function onlineCatalogWrite(actor: Actor, raw: unknown) {
  requirePermission(actor, 'products');
  const input = z
    .object({
      productId: z.string().min(1).max(100),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(120)
        .regex(/^[a-z0-9-]+$/),
      shortDescription: z.string().trim().min(10).max(180),
      description: z.string().trim().min(20).max(1200),
      material: z.string().trim().max(300),
      care: z.string().trim().max(300),
      fit: z.string().trim().min(2).max(80),
      section: z.string().trim().min(2).max(80),
      featured: z.boolean(),
      published: z.boolean(),
      sortOrder: z.number().int().min(0).max(100000),
    })
    .strict()
    .parse(raw);
  const before = await one(
    'SELECT * FROM online_product_profiles WHERE productId=?',
    input.productId,
  );
  if (!before) throw new AppError(404, 'Producto online no encontrado.');
  try {
    await db().batch([
      statement(
        `UPDATE online_product_profiles SET slug=?,shortDescription=?,description=?,material=?,care=?,fit=?,section=?,featured=?,published=?,sortOrder=?,updatedAt=? WHERE productId=?`,
        input.slug,
        input.shortDescription,
        input.description,
        input.material,
        input.care,
        input.fit,
        input.section,
        input.featured ? 1 : 0,
        input.published ? 1 : 0,
        input.sortOrder,
        now(),
        input.productId,
      ),
      auditStatement(
        actor.id,
        'Actualizar publicación online',
        input.productId,
        before,
        input,
      ),
    ]);
  } catch (cause) {
    if (cause instanceof Error && /UNIQUE/i.test(cause.message))
      throw new AppError(409, 'Ese enlace ya está usado por otro producto.');
    throw cause;
  }
  return listOnlineCatalog(actor);
}

export async function confirmOnlinePayment(
  actor: Actor,
  orderId: string,
  paymentReference: string,
) {
  const order = await one<Record<string, any>>(
    'SELECT * FROM online_orders WHERE id=?',
    orderId,
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  if (order.paymentStatus === 'paid') return onlineOrderDetail(orderId);
  if (Date.parse(order.expiresAt) <= Date.now())
    throw new AppError(
      409,
      'La reserva venció. Revisá el stock antes de cobrar.',
    );
  const items = await rows<Record<string, any>>(
    'SELECT * FROM online_order_items WHERE orderId=?',
    orderId,
  );
  const saleId = id(),
    timestamp = now();
  const commands = [
    statement(
      `INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,status,idempotencyKey,requestHash,couponCode,channel,onlineOrderId,createdAt)
       VALUES (?,(SELECT COALESCE(MAX(ticket),0)+1 FROM sales),?,?,?,?,?,'confirmed',?,?,'','online',?,?)`,
      saleId,
      actor.id,
      order.customerId,
      order.subtotal,
      order.discount,
      order.total,
      `online:${orderId}`,
      'online-order',
      orderId,
      timestamp,
    ),
    statement(
      'INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference) VALUES (?,?,?,?,?,?,?,?)',
      id(),
      saleId,
      order.paymentMethod === 'transfer' ? 'transfer' : 'credit',
      order.total,
      0,
      order.total,
      timestamp,
      paymentReference,
    ),
    statement(
      'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,NULL,?,?,?,?,?,?)',
      id(),
      'Venta online',
      order.total,
      order.paymentMethod === 'transfer' ? 'transfer' : 'credit',
      saleId,
      actor.id,
      timestamp,
    ),
  ];
  for (const item of items)
    commands.push(
      statement(
        'INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost) SELECT ?,?,v.id,p.name,v.color,v.size,?,v.price,v.cost FROM variants v JOIN products p ON p.id=v.productId WHERE v.id=?',
        id(),
        saleId,
        item.quantity,
        item.variantId,
      ),
    );
  commands.push(
    statement(
      "UPDATE stock_reservations SET status='consumed' WHERE orderId=?",
      orderId,
    ),
    statement(
      "UPDATE online_orders SET status='paid',paymentStatus='paid',paymentReference=?,paidAt=?,updatedAt=? WHERE id=?",
      paymentReference,
      timestamp,
      timestamp,
      orderId,
    ),
    statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
      id(),
      orderId,
      'payment_confirmed',
      paymentReference,
      actor.id,
      timestamp,
    ),
    auditStatement(actor.id, 'Pago online confirmado', orderId, null, {
      saleId,
      total: order.total,
    }),
  );
  if (order.customerId) {
    const points = Math.floor(order.total / 100000);
    const [loyaltyConfig, activity] = await Promise.all([
      readCustomerIntelligenceConfig(),
      one<Record<string, any>>(
        `SELECT c.points,c.createdAt,MIN(s.createdAt) AS firstPurchaseAt,MAX(s.createdAt) AS lastPurchaseAt,
                COUNT(s.id) AS purchaseCount,COALESCE(SUM(s.total),0) AS lifetimeSpendMinor
           FROM customers c LEFT JOIN sales s ON s.customerId=c.id WHERE c.id=? GROUP BY c.id`,
        order.customerId,
      ),
    ]);
    const level = calculateLoyaltyLevel(
      {
        createdAt: activity?.createdAt ?? timestamp,
        firstPurchaseAt: activity?.firstPurchaseAt ?? null,
        lastPurchaseAt: activity?.lastPurchaseAt ?? null,
        purchaseCount: Number(activity?.purchaseCount ?? 0),
        lifetimeSpendMinor: Number(activity?.lifetimeSpendMinor ?? 0),
        purchasesInSegmentWindow: Number(activity?.purchaseCount ?? 0),
        spendInSegmentWindowMinor: Number(activity?.lifetimeSpendMinor ?? 0),
        purchasesInLoyaltyWindow: Number(activity?.purchaseCount ?? 0),
        spendInLoyaltyWindowMinor: Number(activity?.lifetimeSpendMinor ?? 0),
        points: Number(activity?.points ?? 0),
      },
      loyaltyConfig,
    );
    const cashback = Math.floor(
      ((Number(order.subtotal) - Number(order.discount)) *
        loyaltyConfig.loyalty.cashbackBps[level]) /
        10000,
    );
    commands.push(
      statement(
        'UPDATE customers SET points=points+? WHERE id=?',
        points,
        order.customerId,
      ),
      statement(
        'INSERT INTO loyalty_transactions(id,customerId,points,reason,reference,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        order.customerId,
        points,
        'Compra online',
        saleId,
        timestamp,
      ),
    );
    if (cashback > 0)
      commands.push(
        statement(
          'INSERT INTO customer_cashback(id,customerId,saleId,amount,balance,expiresAt,createdAt) VALUES (?,?,?,?,?,?,?)',
          id(),
          order.customerId,
          saleId,
          cashback,
          cashback,
          new Date(
            Date.now() + loyaltyConfig.loyalty.cashbackExpiryDays * 86400000,
          ).toISOString(),
          timestamp,
        ),
      );
  }
  await db().batch(commands);
  await importCorreoOrder(orderId, actor.id).catch(async (cause) => {
    await statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
      id(),
      orderId,
      'shipping_import_failed',
      String(cause instanceof Error ? cause.message : cause).slice(0, 300),
      actor.id,
      now(),
    ).run();
  });
  return onlineOrderDetail(orderId);
}

export async function confirmOnlinePaymentWebhook(input: {
  provider: string;
  eventId: string;
  reference: string;
  status: string;
  amount: number;
  payload: unknown;
}) {
  const previous = await one(
    'SELECT id FROM online_payment_events WHERE providerEventId=?',
    input.eventId,
  );
  if (previous) return { ok: true, duplicate: true };
  if (!['approved', 'paid', 'accredited'].includes(input.status.toLowerCase()))
    return { ok: true, ignored: true };
  const order = await one<Record<string, any>>(
    'SELECT id,total FROM online_orders WHERE transferReference=? OR paymentReference=?',
    input.reference,
    input.reference,
  );
  if (!order)
    throw new AppError(404, 'No existe un pedido para esa referencia.');
  if (Number(order.total) !== input.amount)
    throw new AppError(409, 'El importe recibido no coincide con el pedido.');
  const owner = await one<Actor>(
    `SELECT u.id,u.email,u.name,u.role,u.active FROM settings s JOIN users u ON lower(u.email)=lower(s.value)
      WHERE s.key='owner'`,
  );
  if (!owner)
    throw new AppError(409, 'No se encontró al responsable del negocio.');
  const detail: any = await confirmOnlinePayment(
    owner,
    String(order.id),
    input.reference,
  );
  await statement(
    'INSERT INTO online_payment_events(id,provider,providerEventId,orderId,status,amount,payload,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    id(),
    input.provider,
    input.eventId,
    order.id,
    input.status,
    input.amount,
    JSON.stringify(input.payload).slice(0, 10000),
    now(),
  ).run();
  return { ok: true, orderId: detail.id, paymentStatus: detail.paymentStatus };
}

export async function onlineOrderWrite(actor: Actor, raw: unknown) {
  requirePermission(actor, 'online-orders');
  const input = z
    .discriminatedUnion('action', [
      z
        .object({
          action: z.literal('mark-paid'),
          orderId: z.uuid(),
          paymentReference: z.string().trim().min(3).max(120),
        })
        .strict(),
      z.object({ action: z.literal('prepare'), orderId: z.uuid() }).strict(),
      z
        .object({
          action: z.literal('ship'),
          orderId: z.uuid(),
          trackingNumber: z.string().trim().min(4).max(120),
        })
        .strict(),
      z
        .object({
          action: z.literal('cancel'),
          orderId: z.uuid(),
          reason: z.string().trim().min(4).max(200),
        })
        .strict(),
    ])
    .parse(raw);
  if (input.action === 'mark-paid')
    return confirmOnlinePayment(actor, input.orderId, input.paymentReference);
  const order = await one<Record<string, any>>(
    'SELECT * FROM online_orders WHERE id=?',
    input.orderId,
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  const timestamp = now();
  if (input.action === 'prepare') {
    if (order.paymentStatus !== 'paid')
      throw new AppError(409, 'Confirmá el pago antes de preparar.');
    await db().batch([
      statement(
        "UPDATE online_orders SET status='preparing',fulfillmentStatus='preparing',updatedAt=? WHERE id=?",
        timestamp,
        input.orderId,
      ),
      statement(
        'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        input.orderId,
        'preparing',
        'Preparación iniciada',
        actor.id,
        timestamp,
      ),
    ]);
    await importCorreoOrder(input.orderId, actor.id).catch(() => undefined);
  } else if (input.action === 'ship') {
    if (order.paymentStatus !== 'paid')
      throw new AppError(409, 'Confirmá el pago antes de despachar.');
    await db().batch([
      statement(
        "UPDATE online_orders SET status='shipped',fulfillmentStatus='shipped',trackingNumber=?,updatedAt=? WHERE id=?",
        input.trackingNumber,
        timestamp,
        input.orderId,
      ),
      statement(
        'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        input.orderId,
        'shipped',
        input.trackingNumber,
        actor.id,
        timestamp,
      ),
    ]);
  } else {
    if (order.paymentStatus === 'paid')
      throw new AppError(
        409,
        'Un pedido pagado requiere devolución, no cancelación.',
      );
    await db().batch([
      statement(
        "UPDATE online_orders SET status='cancelled',fulfillmentStatus='cancelled',updatedAt=? WHERE id=?",
        timestamp,
        input.orderId,
      ),
      statement(
        "UPDATE stock_reservations SET status='cancelled' WHERE orderId=?",
        input.orderId,
      ),
      statement(
        'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
        id(),
        input.orderId,
        'cancelled',
        input.reason,
        actor.id,
        timestamp,
      ),
    ]);
  }
  return listOnlineOrders(actor, input.orderId);
}
