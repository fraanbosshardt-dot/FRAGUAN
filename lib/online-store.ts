import {storeInstallments} from './store-installments';
import { onlinePaymentAmounts } from './online-payment-terms';
import { verifyOrderEmailToken } from './order-email-link';
import { z } from 'zod';
import { allocateDocumentNumber } from './document-numbers';
import { ownsStoreOrder, onlineReservationMinutes } from './store-order-access';
import { FREE_SHIPPING_MINIMUM_MINOR } from './store-shipping-policy';
import { storeApiOrigin, publicStoreData } from './store-api';
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
import {
  sendAccountWelcome,
  sendEmailVerificationCode,
  sendOrderEmails,
  sendReturnRequestEmails,
} from './email';
import {
  evaluateCommercialRules,
  type CommercialPromotion,
} from './commercial-rules';
import { argentinaDay } from './business-date';
import type { StoreCatalog, StoreProduct } from './store-client';
import {
  publicDocument,
  publicLine,
  publicMultiline,
  publicOptionalLine,
  publicPhone,
} from './public-validation';
import { verifyGoogleIdToken } from './google-token';

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

function constantTimeEqual(received: string, expected: string) {
  let difference = received.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1)
    difference |=
      (received.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  return difference === 0;
}

function base64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decodeBase64Url(value: string) {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isLocalRequest(req: Request) {
  const hostname = new URL(req.url).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function emailVerificationSecret(req: Request) {
  const configured = env.STORE_EMAIL_VERIFICATION_SECRET?.trim();
  if (configured) return configured;
  if (isLocalRequest(req)) return 'fraguan-local-email-verification-only';
  throw new AppError(
    503,
    'La verificación de email todavía no está configurada.',
  );
}

async function signEmailPayload(req: Request, encodedPayload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(emailVerificationSecret(req)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)),
    ),
  );
}

async function createSignedEmailToken(
  req: Request,
  payload: Record<string, unknown>,
) {
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await signEmailPayload(req, encoded)}`;
}

async function readSignedEmailToken(req: Request, token: string) {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra)
    throw new AppError(400, 'El código de verificación no es válido.');
  const expected = await signEmailPayload(req, encoded);
  if (signature.length !== expected.length) {
    throw new AppError(400, 'El código de verificación no es válido.');
  }
  let difference = 0;
  for (let index = 0; index < signature.length; index += 1)
    difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  if (difference !== 0)
    throw new AppError(400, 'El código de verificación no es válido.');
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));
  } catch {
    throw new AppError(400, 'El código de verificación no es válido.');
  }
}

const verificationEmail = z.email().trim().toLowerCase().max(120);
const emailChallengePayload = z
  .object({
    kind: z.literal('email_challenge'),
    email: verificationEmail,
    nonce: z.string().min(10).max(100),
    codeHash: z.string().min(20).max(100),
    expiresAt: z.number().int(),
  })
  .strict();
const verifiedEmailPayload = z
  .object({
    kind: z.literal('email_verified'),
    email: verificationEmail,
    expiresAt: z.number().int(),
  })
  .strict();

export async function storeEmailVerification(req: Request, raw: unknown) {
  const input = z
    .discriminatedUnion('action', [
      z
        .object({ action: z.literal('request'), email: verificationEmail })
        .strict(),
      z
        .object({
          action: z.literal('verify'),
          email: verificationEmail,
          challenge: z.string().min(40).max(2000),
          code: z.string().regex(/^\d{6}$/),
        })
        .strict(),
    ])
    .parse(raw);

  if (input.action === 'request') {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(random[0] % 1_000_000).padStart(6, '0');
    const nonce = randomToken(16);
    const challenge = await createSignedEmailToken(req, {
      kind: 'email_challenge',
      email: input.email,
      nonce,
      codeHash: await sha256(`${input.email}:${nonce}:${code}`),
      expiresAt: Date.now() + 10 * 60_000,
    });
    const delivery = await sendEmailVerificationCode(input.email, code, nonce);
    if (!delivery.sent && !isLocalRequest(req))
      throw new AppError(
        503,
        'No pudimos enviar el código. Intentá nuevamente.',
      );
    return {
      challenge,
      expiresInSeconds: 600,
      ...(isLocalRequest(req) && !delivery.sent ? { devCode: code } : {}),
    };
  }

  const payload = emailChallengePayload.parse(
    await readSignedEmailToken(req, input.challenge),
  );
  if (payload.expiresAt < Date.now())
    throw new AppError(400, 'El código venció. Solicitá uno nuevo.');
  if (payload.email !== input.email)
    throw new AppError(400, 'El código corresponde a otro email.');
  const codeHash = await sha256(
    `${input.email}:${payload.nonce}:${input.code}`,
  );
  if (codeHash !== payload.codeHash)
    throw new AppError(400, 'El código ingresado no es correcto.');
  return {
    verificationToken: await createSignedEmailToken(req, {
      kind: 'email_verified',
      email: input.email,
      expiresAt: Date.now() + 30 * 60_000,
    }),
  };
}

export async function requireVerifiedCheckoutEmail(
  req: Request,
  email: string,
  token: string,
) {
  if (!token) throw new AppError(400, 'Verificá tu email para continuar.');
  const payload = verifiedEmailPayload.parse(
    await readSignedEmailToken(req, token),
  );
  if (payload.expiresAt < Date.now() || payload.email !== email)
    throw new AppError(400, 'Volvé a verificar tu email para continuar.');
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
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Priority=High${secure ? '; Secure' : ''}`;
}

type StoreCustomer = {
  accountId: string;
  customerId: string;
  email: string;
  emailVerified: number;
  name: string;
  surname: string;
  phone: string;
  points: number;
  marketingConsent: number;
};
export async function currentStoreCustomer(req: Request) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  return one<StoreCustomer>(
    `SELECT a.id AS accountId,a.customerId,a.email,a.emailVerified,a.marketingConsent,c.name,c.surname,c.phone,c.points
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

export async function storeCatalog(
  query = '',
  section = '',
): Promise<StoreCatalog> {
  if (storeApiOrigin())
    return publicStoreData<StoreCatalog>('store-catalog', {
      q: query,
      section,
    });
  await ensureOnlineProfiles();
  const q = `%${query.slice(0, 100)}%`;
  const products = await rows<Record<string, any>>(
    `SELECT p.id,p.name,p.category,p.brand,profile.slug,profile.shortDescription,
            profile.description,profile.material,profile.care,profile.fit,profile.section,
            profile.featured,profile.sortOrder,v.id AS variantId,v.sku,v.barcode,v.color,v.size,
            COALESCE(v.onlinePrice,v.price) AS price,
            (SELECT i.referencePrice FROM store_price_campaign_items i JOIN store_price_campaigns campaign ON campaign.id=i.campaignId WHERE i.variantId=v.id AND i.status='active' AND campaign.status='active' AND campaign.endsAt>? AND v.onlinePrice=i.campaignPrice LIMIT 1) AS compareAtPrice,
            (SELECT image.id FROM product_images image WHERE image.productId=p.id AND image.active=1 LIMIT 1) AS imageId,
            MAX(0,v.stock-COALESCE((SELECT SUM(r.quantity) FROM stock_reservations r
              WHERE r.variantId=v.id AND r.status='active' AND r.expiresAt>?),0)) AS available
       FROM online_product_profiles profile JOIN products p ON p.id=profile.productId
       JOIN variants v ON v.productId=p.id
      WHERE profile.published=1 AND p.active=1
        AND (?='' OR (?='Nuevos' AND profile.featured=1) OR profile.section=? OR p.category=?)
        AND (?='%%' OR p.name LIKE ? OR p.category LIKE ? OR p.brand LIKE ? OR v.color LIKE ? OR v.sku LIKE ?)
      ORDER BY profile.featured DESC,profile.sortOrder,p.name,v.color,v.size`,
    now(),
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
  const installments=await storeInstallments();
  const grouped = new Map<string, StoreProduct>();
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
        interestFreeInstallments: installments.enabled && (!installments.productIds.length || installments.productIds.includes(row.id)) ? installments.installments : undefined,
        financingCft: installments.cft,
        imageUrl: row.imageId ? `/api/store-image?id=${row.imageId}` : undefined,
        imageAlt: row.name,
        compareAtPrice: row.compareAtPrice || undefined,
        price: row.price,
        variants: [],
      });
    const product = grouped.get(row.id)!;
    if (row.price < product.price) product.compareAtPrice = row.compareAtPrice || undefined;
    product.price = Math.min(product.price, row.price);
    product.variants.push({
      id: row.variantId,
      sku: row.sku,
      barcode: row.barcode,
      color: row.color,
      size: row.size,
      price: row.price,
      stock: row.available,
      compareAtPrice: row.compareAtPrice || undefined,
    });
  }
  const sections = await rows<{ name: string; products: number }>(
    `SELECT profile.section AS name,COUNT(DISTINCT profile.productId) AS products
       FROM online_product_profiles profile JOIN products p ON p.id=profile.productId
      WHERE profile.published=1 AND p.active=1 GROUP BY profile.section ORDER BY MIN(profile.sortOrder)`,
  );
  return { products: [...grouped.values()], sections };
}

export async function storeProduct(
  slug: string,
): Promise<{ product: StoreProduct; related: StoreProduct[] }> {
  if (storeApiOrigin()) return publicStoreData('store-product', { slug });
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
    signal: AbortSignal.timeout(8000),
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

const argentinaProvince = z.enum([
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]);

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
      signal: AbortSignal.timeout(10000),
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
        signal: AbortSignal.timeout(8000),
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
      amount:
        subtotal >= FREE_SHIPPING_MINIMUM_MINOR
          ? 0
          : Math.round(Number(rate.price) * 100),
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
    amount: subtotal >= FREE_SHIPPING_MINIMUM_MINOR ? 0 : base,
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
      success: `${publicOrigin}/gracias/${order.id}`,
      pending: `${publicOrigin}/gracias/${order.id}`,
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
      signal: AbortSignal.timeout(10000),
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
    action: z.enum(['register', 'login', 'google', 'logout', 'update']),
    email: z.email().trim().toLowerCase().max(200).optional(),
    password: z.string().min(8).max(128).optional(),
    name: publicLine(2, 80).optional(),
    surname: publicLine(2, 80).optional(),
    phone: publicPhone.optional(),
    marketingConsent: z.boolean().optional(),
    country: z.literal('Argentina').optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional(),
    address: publicLine(4, 100).optional(),
    addressExtra: publicOptionalLine(50).optional(),
    city: publicLine(2, 60).optional(),
    province: argentinaProvince.optional(),
    credential: z.string().min(100).max(10000).optional(),
  })
  .strict();

async function verifyGoogleCredential(credential: string) {
  if (!env.GOOGLE_CLIENT_ID)
    throw new AppError(503, 'Google Login todavía no está configurado.');
  const profile = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
  if (!profile)
    throw new AppError(401, 'No pudimos validar tu cuenta de Google.');
  return { ...profile, surname: profile.surname || 'FRAGUAN' };
}

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
  if (input.action === 'update') {
    const customer = await currentStoreCustomer(req);
    if (!customer)
      throw new AppError(401, 'Iniciá sesión para actualizar tus datos.');
    if (
      !input.name ||
      !input.surname ||
      !input.phone ||
      !input.country ||
      !input.postalCode ||
      !input.address ||
      !input.city ||
      !input.province
    )
      throw new AppError(400, 'Completá tus datos personales y de envío.');
    const updatedAt = now();
    const primaryAddress = await one<{ id: string }>(
      'SELECT id FROM customer_addresses WHERE customerId=? ORDER BY isDefault DESC,createdAt ASC LIMIT 1',
      customer.customerId,
    );
    const addressCommand = primaryAddress
      ? statement(
          `UPDATE customer_addresses SET label='Casa',recipient=?,phone=?,postalCode=?,address=?,addressExtra=?,city=?,province=?,country=?,isDefault=1,updatedAt=? WHERE id=?`,
          `${input.name} ${input.surname}`,
          input.phone,
          input.postalCode,
          input.address,
          input.addressExtra ?? '',
          input.city,
          input.province,
          input.country,
          updatedAt,
          primaryAddress.id,
        )
      : statement(
          `INSERT INTO customer_addresses(id,customerId,label,recipient,phone,postalCode,address,addressExtra,city,province,country,isDefault,createdAt,updatedAt)
           VALUES (?,?,'Casa',?,?,?,?,?,?,?,?,1,?,?)`,
          id(),
          customer.customerId,
          `${input.name} ${input.surname}`,
          input.phone,
          input.postalCode,
          input.address,
          input.addressExtra ?? '',
          input.city,
          input.province,
          input.country,
          updatedAt,
          updatedAt,
        );
    await db().batch([
      statement(
        'UPDATE customers SET name=?,surname=?,phone=?,locality=?,updatedAt=? WHERE id=?',
        input.name,
        input.surname,
        input.phone,
        input.city,
        updatedAt,
        customer.customerId,
      ),
      statement(
        'UPDATE customer_accounts SET marketingConsent=? WHERE id=?',
        input.marketingConsent ? 1 : 0,
        customer.accountId,
      ),
      statement(
        'UPDATE customer_addresses SET isDefault=0,updatedAt=? WHERE customerId=?',
        updatedAt,
        customer.customerId,
      ),
      addressCommand,
    ]);
    return { data: { ok: true }, cookie: null };
  }
  if (
    (input.action === 'register' || input.action === 'login') &&
    !isLocalRequest(req) &&
    (env as unknown as Record<string, string | undefined>)
      .STORE_PASSWORD_AUTH_ENABLED !== 'true'
  )
    throw new AppError(
      503,
      'El acceso por email está deshabilitado. Ingresá con Google.',
    );
  let newAccount = false;
  let loginEmail = input.email;
  let account: {
    id: string;
    customerId: string;
    passwordHash: string;
    passwordSalt: string;
  } | null;
  if (input.action === 'google') {
    if (!input.credential)
      throw new AppError(400, 'Falta la credencial de Google.');
    const profile = await verifyGoogleCredential(input.credential);
    loginEmail = profile.email;
    account = await one(
      'SELECT id,customerId,passwordHash,passwordSalt FROM customer_accounts WHERE googleSub=? OR email=?',
      profile.sub,
      profile.email,
    );
    if (account) {
      const collision = await one<{ googleSub: string | null }>(
        'SELECT googleSub FROM customer_accounts WHERE id=?',
        account.id,
      );
      if (collision?.googleSub && collision.googleSub !== profile.sub)
        throw new AppError(
          409,
          'Ese email ya está vinculado con otra cuenta de Google.',
        );
      await statement(
        "UPDATE customer_accounts SET googleSub=?,authProvider='google',emailVerified=1,lastLoginAt=? WHERE id=?",
        profile.sub,
        now(),
        account.id,
      ).run();
    } else {
      const customerId = id(),
        accountId = id(),
        createdAt = now();
      await db().batch([
        statement(
          'INSERT INTO customers(id,name,surname,phone,email,whatsapp,createdAt) VALUES (?,?,?,?,?,?,?)',
          customerId,
          profile.name,
          profile.surname,
          '',
          profile.email,
          '',
          createdAt,
        ),
        statement(
          "INSERT INTO customer_accounts(id,customerId,email,passwordHash,passwordSalt,emailVerified,marketingConsent,authProvider,googleSub,createdAt,lastLoginAt) VALUES (?,?,?,?,?,1,0,'google',?,?,?)",
          accountId,
          customerId,
          profile.email,
          '',
          '',
          profile.sub,
          createdAt,
          createdAt,
        ),
      ]);
      newAccount = true;
      account = {
        id: accountId,
        customerId,
        passwordHash: '',
        passwordSalt: '',
      };
    }
  } else if (input.action === 'register') {
    if (!input.email || !input.password)
      throw new AppError(400, 'Completá email y contraseña.');
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
    newAccount = true;
    account = {
      id: accountId,
      customerId,
      passwordHash: '',
      passwordSalt: salt,
    };
  } else {
    if (!input.email || !input.password)
      throw new AppError(400, 'Completá email y contraseña.');
    account = await one(
      'SELECT id,customerId,passwordHash,passwordSalt FROM customer_accounts WHERE email=?',
      input.email,
    );
    const receivedHash = await passwordHash(
      input.password,
      account?.passwordSalt || 'fraguan-nonexistent-account-timing-salt',
    );
    if (!account || !constantTimeEqual(receivedHash, account.passwordHash))
      throw new AppError(401, 'Email o contraseña incorrectos.');
    await statement(
      'UPDATE customer_accounts SET lastLoginAt=? WHERE id=?',
      now(),
      account.id,
    ).run();
  }
  const token = randomToken(),
    expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await db().batch([
    statement('DELETE FROM customer_sessions WHERE expiresAt<=?', now()),
    statement(
      'INSERT INTO customer_sessions(id,accountId,tokenHash,expiresAt,createdAt) VALUES (?,?,?,?,?)',
      id(),
      account.id,
      await sha256(token),
      expiresAt,
      now(),
    ),
  ]);
  if (newAccount) await sendAccountWelcome(account.id).catch(() => undefined);
  const customer = await one(
    'SELECT name,surname,phone,points FROM customers WHERE id=?',
    account.customerId,
  );
  return {
    data: { account: { email: loginEmail, ...customer } },
    cookie: customerCookie(token, new URL(req.url).protocol === 'https:'),
  };
}

export async function storeAccount(req: Request) {
  // This public OAuth client ID is safe to expose; tokens and secrets stay server-side.
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const customer = await currentStoreCustomer(req);
  if (!customer)
    return {
      customer: null,
      orders: [],
      addresses: [],
      benefits: [],
      googleClientId,
    };
  if (new URL(req.url).searchParams.get('summary') === '1')
    return { customer, googleClientId };
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const [orders, addresses, activity, config] = await Promise.all([
    rows(
      `SELECT id,orderNumber,status,paymentStatus,fulfillmentStatus,total,trackingNumber,createdAt
         FROM online_orders WHERE customerId=? OR
           (customerId IS NULL AND LOWER(TRIM(email))=? AND ?=1)
         ORDER BY createdAt DESC LIMIT 50`,
      customer.customerId,
      customer.email.trim().toLowerCase(),
      Number(customer.emailVerified),
    ),
    rows(
      'SELECT id,label,recipient,phone,postalCode,address,addressExtra,city,province,country,isDefault FROM customer_addresses WHERE customerId=? ORDER BY isDefault DESC,createdAt DESC',
      customer.customerId,
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
    googleClientId,
    customer: {
      ...customer,
      level,
      marketingConsent: Boolean(customer.marketingConsent),
    },
    orders,
    addresses,
    benefits: config.loyalty.benefits[level] ?? [],
  };
}

const returnRequestInput = z
  .object({
    orderNumber: z.coerce.number().int().min(1000).max(999999999),
    email: z.email().trim().toLowerCase().max(200),
    phone: publicOptionalLine(25),
    kind: z.enum(['withdrawal', 'exchange', 'return']),
    reason: publicLine(3, 160),
    detail: publicMultiline(600),
  })
  .strict();

export async function createOnlineReturnRequest(raw: unknown) {
  const input = returnRequestInput.parse(raw);
  const order = await one<Record<string, any>>(
    'SELECT id,orderNumber,email,customerName FROM online_orders WHERE orderNumber=? AND lower(email)=?',
    input.orderNumber,
    input.email,
  );
  if (!order)
    throw new AppError(404, 'No encontramos un pedido con ese número y email.');
  const duplicate = await one<{ code: string }>(
    `SELECT code FROM online_return_requests
      WHERE orderId=? AND kind=? AND reason=? AND createdAt>=?
      ORDER BY createdAt DESC LIMIT 1`,
    order.id,
    input.kind,
    input.reason,
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  if (duplicate)
    return {
      ok: true,
      code: duplicate.code,
      orderNumber: order.orderNumber,
      status: 'received',
    };
  const requestId = id();
  const prefix =
    input.kind === 'withdrawal'
      ? 'ARR'
      : input.kind === 'exchange'
        ? 'CAM'
        : 'DEV';
  const code = `${prefix}-${input.orderNumber}-${randomToken(4).toUpperCase()}`;
  const createdAt = now();
  await db().batch([
    statement(
      `INSERT INTO online_return_requests(id,code,orderId,orderNumber,email,customerName,phone,kind,reason,detail,status,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,'received',?,?)`,
      requestId,
      code,
      order.id,
      order.orderNumber,
      order.email,
      order.customerName,
      input.phone,
      input.kind,
      input.reason,
      input.detail,
      createdAt,
      createdAt,
    ),
    statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,createdAt) VALUES (?,?,?,?,?)',
      id(),
      order.id,
      'return_requested',
      `${code} · ${input.reason}`,
      createdAt,
    ),
  ]);
  await sendReturnRequestEmails(requestId).catch(() => undefined);
  return { ok: true, code, orderNumber: order.orderNumber, status: 'received' };
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
    email: verificationEmail,
    emailVerificationToken: z.string().max(2000).default(''),
    customerName: publicLine(3, 80),
    phone: publicPhone,
    document: publicDocument.default(''),
    paymentMethod: z.enum(['transfer', 'card']),
    shippingMethod: z.enum(['correo-argentino-home', 'pickup']),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/),
    address: publicLine(4, 100),
    addressExtra: publicOptionalLine(50),
    city: publicLine(2, 60),
    province: argentinaProvince,
    country: z.literal('Argentina').default('Argentina'),
    notes: publicMultiline(240),
    idempotencyKey: z.uuid(),
    accessToken: z.uuid(),
    couponCode: z.string().trim().toUpperCase().max(30).default(''),
    attribution: z
      .object({
        source: publicOptionalLine(100),
        medium: publicOptionalLine(100),
        campaign: publicOptionalLine(160),
      })
      .strict()
      .default({ source: '', medium: '', campaign: '' }),
    sessionId: z.union([z.uuid(), z.literal('')]).default(''),
    saveAddress: z.boolean().default(false),
  })
  .strict();

type CheckoutPricingInput = Pick<
  z.infer<typeof checkoutInput>,
  'items' | 'couponCode' | 'paymentMethod' | 'shippingMethod' | 'postalCode'
>;

async function calculateOnlineCheckout(input: CheckoutPricingInput) {
  if (
    new Set(input.items.map((item) => item.variantId)).size !==
    input.items.length
  )
    throw new AppError(400, 'Agrupá las cantidades de cada talle y color.');
  const lines: Record<string, any>[] = [];
  let subtotal = 0;
  for (const item of input.items) {
    const variant = await one<Record<string, any>>(
      `SELECT v.id,v.sku,v.color,v.size,COALESCE(v.onlinePrice,v.price) AS price,p.id AS productId,p.name,p.category,p.brand,v.stock-COALESCE((SELECT SUM(r.quantity)
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
    const unitPrice = Number(variant.price);
    const lineTotal = unitPrice * item.quantity;
    if (
      !Number.isSafeInteger(unitPrice) ||
      unitPrice <= 0 ||
      !Number.isSafeInteger(lineTotal)
    )
      throw new AppError(
        409,
        'El precio online debe revisarse antes de vender.',
      );
    lines.push({ ...variant, quantity: item.quantity });
    subtotal += lineTotal;
  }
  const coupon = await onlineCouponDiscount(
    lines,
    input.couponCode,
    input.paymentMethod,
  );
  const transferDiscount =
    input.paymentMethod === 'transfer' ? Math.floor(subtotal * 0.1) : 0;
  const discount = Math.min(subtotal, transferDiscount + coupon.discount);
  const shipping = await shippingQuote(
    input.postalCode,
    subtotal - discount,
    input.shippingMethod,
    lines.reduce((sum, line) => sum + Number(line.quantity), 0),
  );
  const total = subtotal - discount + shipping.amount;
  if (
    ![
      subtotal,
      coupon.discount,
      transferDiscount,
      discount,
      shipping.amount,
      total,
    ].every((amount) => Number.isSafeInteger(amount) && amount >= 0) ||
    total <= 0
  )
    throw new AppError(400, 'El importe del pedido no es válido.');
  return {
    lines,
    subtotal,
    coupon,
    transferDiscount,
    discount,
    shipping,
    total,
  };
}

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
  const { lines, subtotal, discount, shipping, total } =
    await calculateOnlineCheckout(input);
  const customer = await currentStoreCustomer(req);
  if (!customer)
    await requireVerifiedCheckoutEmail(
      req,
      input.email,
      input.emailVerificationToken,
    );
  const effectiveEmail = customer?.email ?? input.email;
  const effectiveName = customer
    ? `${customer.name} ${customer.surname}`
    : input.customerName;
  const effectivePhone = customer?.phone || input.phone;
  const orderId = input.idempotencyKey,
    createdAt = now();
  const reservationMinutes = onlineReservationMinutes(input.paymentMethod);
  const expiresAt = new Date(
    Date.now() + reservationMinutes * 60000,
  ).toISOString();
  const transferSuffix = randomToken(3).toUpperCase();
  const commands = [
    allocateDocumentNumber('online_order'),
    statement(
      "UPDATE stock_reservations SET status='expired' WHERE status='active' AND expiresAt<=?",
      createdAt,
    ),
    statement(
      `INSERT INTO online_orders(id,orderNumber,customerId,email,customerName,phone,document,status,paymentStatus,paymentMethod,fulfillmentStatus,subtotal,discount,shipping,total,shippingMethod,postalCode,address,addressExtra,city,province,country,notes,couponCode,attributionJson,accessTokenHash,transferReference,expiresAt,createdAt,updatedAt)
       VALUES (?,(SELECT value FROM document_counters WHERE name='online_order'),?,?,?,?,?,'awaiting_payment','pending',?,'unfulfilled',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      orderId,
      customer?.customerId ?? null,
      effectiveEmail,
      effectiveName,
      effectivePhone,
      input.document,
      input.paymentMethod,
      subtotal,
      discount,
      shipping.amount,
      total,
      input.shippingMethod,
      input.postalCode,
      input.address,
      input.addressExtra,
      input.city,
      input.province,
      input.country,
      input.notes,
      input.couponCode,
      JSON.stringify({ ...input.attribution, sessionId: input.sessionId }),
      await sha256(input.accessToken),
      transferSuffix,
      expiresAt,
      createdAt,
      createdAt,
    ),
    statement(
      "UPDATE online_orders SET transferReference='FRG-' || orderNumber || '-' || transferReference WHERE id=?",
      orderId,
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
  if (customer && input.saveAddress && input.shippingMethod !== 'pickup') {
    commands.push(
      statement(
        `INSERT INTO customer_addresses(id,customerId,label,recipient,phone,postalCode,address,addressExtra,city,province,country,isDefault,createdAt,updatedAt)
       SELECT ?,?,'Casa',?,?,?,?,?,?,?,?,CASE WHEN NOT EXISTS(SELECT 1 FROM customer_addresses WHERE customerId=?) THEN 1 ELSE 0 END,?,?
       WHERE NOT EXISTS(SELECT 1 FROM customer_addresses WHERE customerId=? AND postalCode=? AND address=? AND addressExtra=?)`,
        id(),
        customer.customerId,
        effectiveName,
        effectivePhone,
        input.postalCode,
        input.address,
        input.addressExtra,
        input.city,
        input.province,
        input.country,
        customer.customerId,
        createdAt,
        createdAt,
        customer.customerId,
        input.postalCode,
        input.address,
        input.addressExtra,
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
  await sendOrderEmails(orderId, 'created').catch(() => undefined);
  if (input.sessionId) {
    await db().batch([
      statement(
        "UPDATE abandoned_carts SET status='converted',recoveredAt=?,updatedAt=? WHERE sessionId=?",
        createdAt,
        createdAt,
        input.sessionId,
      ),
      statement(
        `INSERT INTO store_events(id,sessionId,customerId,event,path,orderId,value,source,medium,campaign,metadata,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        id(),
        input.sessionId,
        customer?.customerId ?? null,
        'order_created',
        '/checkout',
        orderId,
        total,
        input.attribution.source,
        input.attribution.medium,
        input.attribution.campaign,
        JSON.stringify({ couponCode: input.couponCode }),
        createdAt,
      ),
    ]);
  }
  return { ...detail, accessToken: input.accessToken, paymentUrl };
}

async function onlineCouponDiscount(
  lines: Record<string, any>[],
  couponCode: string,
  paymentMethod: 'transfer' | 'card',
) {
  if (!couponCode) return { discount: 0, appliedDiscounts: [] as any[] };
  const promotionRows = await rows<Record<string, any>>(
    'SELECT id,name,percent,methodId,startsAt,endsAt,active,ruleJson FROM promotions WHERE active=1 AND startsAt<=? AND endsAt>=?',
    argentinaDay(),
    argentinaDay(),
  );
  const normalized = couponCode.toLocaleLowerCase('es-AR');
  const promotions: CommercialPromotion[] = promotionRows.flatMap((row) => {
    let rule: Record<string, any> = {};
    try {
      rule = row.ruleJson ? JSON.parse(row.ruleJson) : {};
    } catch {
      return [];
    }
    const coupons: string[] = rule.conditions?.couponCodes ?? [];
    if (!coupons.some((code) => code.toLocaleLowerCase('es-AR') === normalized))
      return [];
    return [
      {
        id: row.id,
        name: row.name,
        authorized: true,
        active: true,
        kind: rule.kind ?? 'percentage',
        percentBps: rule.percentBps ?? row.percent * 100,
        amountCents: rule.amountCents,
        scope: rule.scope,
        priority: rule.priority ?? 0,
        exclusive: Boolean(rule.exclusive),
        conditions: {
          ...rule.conditions,
          paymentMethodIds: row.methodId
            ? [row.methodId]
            : rule.conditions?.paymentMethodIds,
          schedule: {
            startsAt: `${row.startsAt}T00:00:00-03:00`,
            endsAt: `${row.endsAt}T23:59:59-03:00`,
            timeZoneOffsetMinutes: -180,
          },
        },
      } as CommercialPromotion,
    ];
  });
  const result = evaluateCommercialRules({
    items: lines.map((line) => ({
      id: line.id,
      category: line.category,
      brand: line.brand,
      unitPriceCents: Number(line.price),
      quantity: Number(line.quantity),
    })),
    promotions,
    context: {
      evaluatedAt: now(),
      timeZoneOffsetMinutes: -180,
      paymentMethodIds: [paymentMethod === 'transfer' ? 'transfer' : 'credit'],
      couponCode,
    },
  });
  if (!result.appliedDiscounts.length)
    throw new AppError(403, 'El cupón no es válido para esta compra.');
  return {
    discount: result.discountTotalCents,
    appliedDiscounts: result.appliedDiscounts,
  };
}

export async function quoteOnlineCoupon(raw: unknown) {
  const input = z
    .object({
      items: checkoutInput.shape.items,
      couponCode: checkoutInput.shape.couponCode,
      paymentMethod: checkoutInput.shape.paymentMethod,
    })
    .strict()
    .parse(raw);
  const lines: Record<string, any>[] = [];
  for (const item of input.items) {
    const line = await one<Record<string, any>>(
      `SELECT v.id,COALESCE(v.onlinePrice,v.price) AS price,p.category,p.brand FROM variants v JOIN products p ON p.id=v.productId JOIN online_product_profiles profile ON profile.productId=p.id WHERE v.id=? AND p.active=1 AND profile.published=1`,
      item.variantId,
    );
    if (!line) throw new AppError(404, 'Producto no disponible.');
    lines.push({ ...line, quantity: item.quantity });
  }
  return onlineCouponDiscount(lines, input.couponCode, input.paymentMethod);
}

export async function quoteOnlineCheckout(raw: unknown) {
  const input = z
    .object({
      items: checkoutInput.shape.items,
      couponCode: checkoutInput.shape.couponCode,
      paymentMethod: checkoutInput.shape.paymentMethod,
      shippingMethod: checkoutInput.shape.shippingMethod,
      postalCode: checkoutInput.shape.postalCode,
    })
    .strict()
    .parse(raw);
  const { subtotal, transferDiscount, coupon, discount, shipping, total } =
    await calculateOnlineCheckout(input);
  return {
    subtotal,
    transferDiscount,
    couponDiscount: coupon.discount,
    discount,
    shipping,
    total,
    appliedDiscounts: coupon.appliedDiscounts,
  };
}

export async function onlineOrderDetail(
  orderId: string,
): Promise<Record<string, any>> {
  const order = await one<Record<string, any>>(
    `SELECT id,orderNumber,customerId,email,customerName,phone,document,status,paymentStatus,paymentMethod,
            fulfillmentStatus,subtotal,discount,shipping,total,shippingMethod,postalCode,address,city,couponCode,attributionJson,
            addressExtra,province,notes,transferReference,paymentReference,trackingNumber,expiresAt,paidAt,createdAt,updatedAt
       FROM online_orders WHERE id=?`,
    orderId,
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  const [items, returnRequests] = await Promise.all([
    rows(
      `SELECT oi.variantId,oi.productName,oi.sku,oi.color,oi.size,oi.quantity,oi.unitPrice,oi.lineTotal,
            COALESCE((SELECT l.name||CASE WHEN l.detail<>'' THEN ' · '||l.detail ELSE '' END
              FROM variant_location_stock vls JOIN stock_locations l ON l.id=vls.locationId
             WHERE vls.variantId=oi.variantId AND vls.quantity>0 ORDER BY l.priority,l.name LIMIT 1),'Sin ubicación') AS location
       FROM online_order_items oi WHERE oi.orderId=?`,
      orderId,
    ),
    rows(
      'SELECT code,kind,reason,detail,status,createdAt FROM online_return_requests WHERE orderId=? ORDER BY createdAt DESC',
      orderId,
    ),
  ]);
  return { ...order, items, returnRequests };
}

export async function publicOnlineOrder(
  req: Request,
  orderId: string,
  accessToken: string,
  allowEmailLink = true,
) {
  const customer = await currentStoreCustomer(req);
  const order = await one<{
    customerId: string | null;
    email: string;
    accessTokenHash: string;
  }>(
    'SELECT customerId,email,accessTokenHash FROM online_orders WHERE id=?',
    orderId,
  );
  if (
    !order ||
    (!ownsStoreOrder(customer, order) &&
      order.accessTokenHash !== (await sha256(accessToken)) &&
      !(allowEmailLink && await verifyOrderEmailToken(orderId, accessToken)))
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
  await publicOnlineOrder(req, input.orderId, input.accessToken, false);
  const order = await one<{ paymentStatus: string }>(
    'SELECT paymentStatus FROM online_orders WHERE id=? AND paymentMethod=?',
    input.orderId,
    'transfer',
  );
  if (!order) throw new AppError(404, 'Pedido no encontrado.');
  if (order.paymentStatus === 'paid') return onlineOrderDetail(input.orderId);
  try {
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
  } catch (cause) {
    if (/UNIQUE/i.test(String((cause as any)?.message ?? cause)))
      throw new AppError(
        409,
        'Ese comprobante ya fue informado en otro pedido.',
      );
    throw cause;
  }
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

/** Operational online-order queue for POS users. Its response intentionally omits
 * prices, totals, email, payment references and marketing attribution. */
export async function listPosOnlineOrders(actor: Actor, orderId = '') {
  requirePermission(actor, 'pos-online-orders');
  if (orderId) {
    const order = await one<Record<string, any>>(
      `SELECT id,orderNumber,customerName,phone,status,paymentStatus,fulfillmentStatus,
              shippingMethod,trackingNumber,createdAt,updatedAt
         FROM online_orders WHERE id=? AND paymentStatus='paid' AND status<>'cancelled'`,
      orderId,
    );
    if (!order) throw new AppError(404, 'Pedido operativo no encontrado.');
    const items = await rows(
      `SELECT oi.productName,oi.sku,oi.color,oi.size,oi.quantity,
              COALESCE((SELECT l.name||CASE WHEN l.detail<>'' THEN ' · '||l.detail ELSE '' END
                FROM variant_location_stock vls JOIN stock_locations l ON l.id=vls.locationId
               WHERE vls.variantId=oi.variantId AND vls.quantity>0 ORDER BY l.priority,l.name LIMIT 1),'Sin ubicación') AS location
         FROM online_order_items oi WHERE oi.orderId=?`,
      orderId,
    );
    return { ...order, items };
  }
  return rows(
    `SELECT id,orderNumber,customerName,phone,status,paymentStatus,fulfillmentStatus,
            shippingMethod,trackingNumber,createdAt,updatedAt
       FROM online_orders
      WHERE paymentStatus='paid' AND status<>'cancelled'
      ORDER BY CASE fulfillmentStatus WHEN 'unfulfilled' THEN 0 WHEN 'preparing' THEN 1
               WHEN 'ready_pickup' THEN 2 WHEN 'shipped' THEN 3 ELSE 4 END, createdAt DESC
      LIMIT 100`,
  );
}

export async function posOnlineOrderWrite(actor: Actor, raw: unknown) {
  requirePermission(actor, 'pos-online-orders');
  const input = z
    .object({
      action: z.enum(['prepare', 'ready-pickup', 'deliver']),
      orderId: z.uuid(),
    })
    .strict()
    .parse(raw);
  const order = await one<Record<string, any>>(
    `SELECT id,paymentStatus,status,fulfillmentStatus,shippingMethod
       FROM online_orders WHERE id=?`,
    input.orderId,
  );
  if (!order || order.status === 'cancelled')
    throw new AppError(404, 'Pedido operativo no encontrado.');
  if (order.paymentStatus !== 'paid')
    throw new AppError(409, 'El pedido todavía no tiene el pago confirmado.');
  const timestamp = now();
  let nextStatus = order.status;
  let nextFulfillment = order.fulfillmentStatus;
  let kind = '';
  let detail = '';
  let emailEvent: 'preparing' | 'ready_pickup' | 'delivered';
  if (input.action === 'prepare') {
    if (order.fulfillmentStatus !== 'unfulfilled')
      throw new AppError(409, 'El pedido ya inició su preparación.');
    nextStatus = 'preparing';
    nextFulfillment = 'preparing';
    kind = 'preparing';
    detail = 'Preparación iniciada desde POS';
    emailEvent = 'preparing';
  } else if (input.action === 'ready-pickup') {
    if (order.shippingMethod !== 'pickup')
      throw new AppError(
        409,
        'Esta acción corresponde solamente a retiros en el local.',
      );
    if (order.fulfillmentStatus !== 'preparing')
      throw new AppError(409, 'Primero iniciá la preparación del pedido.');
    nextStatus = 'ready_pickup';
    nextFulfillment = 'ready_pickup';
    kind = 'ready_pickup';
    detail = 'Listo para retirar, marcado desde POS';
    emailEvent = 'ready_pickup';
  } else {
    if (
      order.shippingMethod !== 'pickup' ||
      order.fulfillmentStatus !== 'ready_pickup'
    )
      throw new AppError(
        409,
        'Solo se puede entregar un retiro que ya esté listo.',
      );
    nextStatus = 'completed';
    nextFulfillment = 'delivered';
    kind = 'delivered';
    detail = 'Entregado al cliente desde POS';
    emailEvent = 'delivered';
  }
  await db().batch([
    statement(
      'UPDATE online_orders SET status=?,fulfillmentStatus=?,updatedAt=? WHERE id=?',
      nextStatus,
      nextFulfillment,
      timestamp,
      input.orderId,
    ),
    statement(
      'INSERT INTO online_order_events(id,orderId,kind,detail,actorId,createdAt) VALUES (?,?,?,?,?,?)',
      id(),
      input.orderId,
      kind,
      detail,
      actor.id,
      timestamp,
    ),
  ]);
  if (emailEvent === 'preparing')
    await importCorreoOrder(input.orderId, actor.id).catch(() => undefined);
  await sendOrderEmails(input.orderId, emailEvent).catch(() => undefined);
  return listPosOnlineOrders(actor, input.orderId);
}

export async function listOnlineCatalog(actor: Actor) {
  requirePermission(actor, 'products');
  await ensureOnlineProfiles();
  return rows(
    `SELECT p.id,p.name,p.category,profile.slug,profile.section,profile.shortDescription,
            profile.description,profile.material,profile.care,profile.fit,profile.featured,
            profile.published,profile.sortOrder,MIN(v.price) AS localPrice,
            MIN(COALESCE(v.onlinePrice,v.price)) AS onlinePrice,
            SUM(CASE WHEN v.onlinePrice IS NULL THEN 1 ELSE 0 END) AS inheritedVariants,
            SUM(v.stock) AS stock,COUNT(v.id) AS variants
       FROM products p JOIN online_product_profiles profile ON profile.productId=p.id
       JOIN variants v ON v.productId=p.id
      GROUP BY p.id,profile.productId ORDER BY profile.sortOrder,p.name`,
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
      onlinePrice: z.number().int().positive(),
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
      statement(
        'UPDATE variants SET onlinePrice=?,updatedAt=? WHERE productId=?',
        input.onlinePrice,
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
  if (order.status === 'cancelled' || order.fulfillmentStatus === 'cancelled')
    throw new AppError(409, 'Un pedido cancelado no puede acreditarse.');
  if (!Number.isSafeInteger(Number(order.total)) || Number(order.total) <= 0)
    throw new AppError(409, 'El total guardado del pedido no es válido.');
  if (Date.parse(order.expiresAt) <= Date.now())
    throw new AppError(
      409,
      'La reserva venció. Revisá el stock antes de cobrar.',
    );
  const items = await rows<Record<string, any>>(
    'SELECT * FROM online_order_items WHERE orderId=?',
    orderId,
  );
  const activeReservations = await one<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM online_order_items oi
       JOIN stock_reservations r ON r.orderId=oi.orderId AND r.variantId=oi.variantId
      WHERE oi.orderId=? AND r.status='active' AND r.quantity=oi.quantity AND r.expiresAt>?`,
    orderId,
    now(),
  );
  if (!items.length || Number(activeReservations?.total ?? 0) !== items.length)
    throw new AppError(
      409,
      'La reserva de stock ya no está activa. Revisá el pedido antes de cobrar.',
    );
  const saleId = id(),
    timestamp = now();
  const paymentMethodId = order.paymentMethod === 'transfer' ? 'transfer' : 'online-mp';
  const terms = await one<{ commissionBps: number; days: number; destination: string }>(
    'SELECT commissionBps,days,destination FROM payment_methods WHERE id=?',
    paymentMethodId,
  );
  if (!terms) throw new AppError(503, 'Falta configurar el medio de cobro online.');
  const amounts = onlinePaymentAmounts(Number(order.total), terms, timestamp);
  const commands = [
    allocateDocumentNumber('sale'),
    statement(
      `INSERT INTO sales(id,ticket,sellerId,customerId,subtotal,discount,total,status,idempotencyKey,requestHash,couponCode,channel,onlineOrderId,createdAt)
       VALUES (?,(SELECT value FROM document_counters WHERE name='sale'),?,?,?,?,?,'confirmed',?,?,?,'online',?,?)`,
      saleId,
      actor.id,
      order.customerId,
      order.subtotal,
      order.discount,
      order.total,
      `online:${orderId}`,
      'online-order',
      order.couponCode || '',
      orderId,
      timestamp,
    ),
    statement(
      'INSERT INTO payments(id,saleId,methodId,amount,commission,net,dueAt,reference,destination) VALUES (?,?,?,?,?,?,?,?,?)',
      id(),
      saleId,
      paymentMethodId,
      order.total,
      amounts.commission,
      amounts.net,
      amounts.dueAt,
      paymentReference,
      terms.destination,
    ),
    statement(
      'INSERT INTO cash_movements(id,sessionId,kind,amount,methodId,reference,actorId,createdAt) VALUES (?,NULL,?,?,?,?,?,?)',
      id(),
      'Venta online',
      order.total,
      paymentMethodId,
      saleId,
      actor.id,
      timestamp,
    ),
  ];
  for (const item of items)
    commands.push(
      statement(
        'INSERT INTO sale_items(id,saleId,variantId,name,color,size,quantity,price,cost) SELECT ?,?,v.id,p.name,v.color,v.size,?,?,v.cost FROM variants v JOIN products p ON p.id=v.productId WHERE v.id=?',
        id(),
        saleId,
        item.quantity,
        item.unitPrice,
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
  try {
    await db().batch(commands);
  } catch (cause) {
    if (/UNIQUE/i.test(String((cause as any)?.message ?? cause)))
      throw new AppError(
        409,
        'La referencia de pago ya fue utilizada o el pedido ya fue acreditado.',
      );
    if (
      /insufficient_stock|online_stock_unavailable/i.test(
        String((cause as Error)?.message ?? cause),
      )
    )
      throw new AppError(
        409,
        'La reserva o el stock cambió. Revisá el pedido antes de confirmar el pago. No se guardó la venta.',
      );
    throw cause;
  }
  try {
    const attribution = JSON.parse(order.attributionJson || '{}');
    if (attribution.sessionId)
      await statement(
        `INSERT INTO store_events(id,sessionId,customerId,event,path,orderId,value,source,medium,campaign,metadata,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        id(),
        attribution.sessionId,
        order.customerId,
        'purchase',
        '/checkout',
        orderId,
        order.total,
        attribution.source || '',
        attribution.medium || '',
        attribution.campaign || '',
        JSON.stringify({ couponCode: order.couponCode || '', saleId }),
        timestamp,
      ).run();
  } catch {
    // La venta queda confirmada aunque la atribución histórica sea inválida.
  }
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
  await sendOrderEmails(orderId, 'paid').catch(() => undefined);
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
  const expectedMethod = input.provider === 'mercadopago' ? 'card' : 'transfer';
  const matches = await rows<Record<string, any>>(
    `SELECT id,total,paymentMethod FROM online_orders
      WHERE transferReference=? OR paymentReference=?`,
    input.reference,
    input.reference,
  );
  if (!matches.length)
    throw new AppError(404, 'No existe un pedido para esa referencia.');
  const methodMatches = matches.filter(
    (candidate) => candidate.paymentMethod === expectedMethod,
  );
  if (!methodMatches.length)
    throw new AppError(
      409,
      'El proveedor no corresponde al medio de pago del pedido.',
    );
  if (methodMatches.length !== 1)
    throw new AppError(
      409,
      'La referencia coincide con más de un pedido y requiere revisión.',
    );
  const order = methodMatches[0];
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
          confirmedAmount: z.number().int().positive(),
        })
        .strict(),
      z.object({ action: z.literal('prepare'), orderId: z.uuid() }).strict(),
      z
        .object({ action: z.literal('ready-pickup'), orderId: z.uuid() })
        .strict(),
      z.object({ action: z.literal('deliver'), orderId: z.uuid() }).strict(),
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
  if (input.action === 'mark-paid') {
    const pending = await one<{ paymentMethod: string; total: number }>(
      'SELECT paymentMethod,total FROM online_orders WHERE id=?',
      input.orderId,
    );
    if (!pending) throw new AppError(404, 'Pedido no encontrado.');
    if (pending.paymentMethod !== 'transfer')
      throw new AppError(
        409,
        'Los pagos con tarjeta se confirman desde Mercado Pago.',
      );
    if (Number(pending.total) !== input.confirmedAmount)
      throw new AppError(
        409,
        'El importe acreditado no coincide con el total del pedido.',
      );
    return confirmOnlinePayment(actor, input.orderId, input.paymentReference);
  }
  if (input.action === 'ready-pickup' || input.action === 'deliver')
    return posOnlineOrderWrite(actor, input);
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
    await sendOrderEmails(input.orderId, 'preparing').catch(() => undefined);
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
    await sendOrderEmails(input.orderId, 'shipped').catch(() => undefined);
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
