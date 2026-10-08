import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url),
  database = new DatabaseSync(':memory:');
database.exec(
  `CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('owner'); CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT,active INTEGER); INSERT INTO products VALUES('p','Remera',1); CREATE TABLE variants(id TEXT PRIMARY KEY,productId TEXT,color TEXT,size TEXT,onlinePrice INTEGER,price INTEGER,updatedAt TEXT); INSERT INTO variants VALUES('v','p','Negro','M',NULL,10000,'original'); CREATE TABLE online_product_profiles(productId TEXT,published INTEGER); INSERT INTO online_product_profiles VALUES('p',1); CREATE TABLE online_orders(id TEXT PRIMARY KEY); INSERT INTO online_orders VALUES('o'); CREATE TABLE email_deliveries(id TEXT PRIMARY KEY,kind TEXT,recipient TEXT,orderId TEXT,providerId TEXT,status TEXT,createdAt TEXT);`,
);
database.exec(readFileSync('drizzle/0026_order_emails_campaigns.sql', 'utf8'));
database.exec(readFileSync('drizzle/0027_independent_prices.sql', 'utf8'));
const query = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  one: async (sql, ...args) => database.prepare(sql).get(...args) ?? null,
  rows: async (sql, ...args) => database.prepare(sql).all(...args),
  statement: (sql, ...args) => ({
    run: async () => database.prepare(sql).run(...args),
    first: async () => database.prepare(sql).get(...args) ?? null,
  }),
  auditStatement: () => ({ audit: true }),
  db: () => ({
    batch: async (commands) => {
      database.exec('BEGIN');
      try {
        for (const c of commands) if (!c.audit) await c.run();
        database.exec('COMMIT');
      } catch (e) {
        database.exec('ROLLBACK');
        throw e;
      }
    },
  }),
};
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const env = {
  RESEND_API_KEY: 'test-only',
  RESEND_FROM: 'test@example.invalid',
  STORE_EMAIL_VERIFICATION_SECRET: 'a'.repeat(64),
  RESEND_WEBHOOK_SECRET:
    'whsec_' + Buffer.from('isolated-webhook-secret').toString('base64'),
};
const calls = [];
let mode = 'success';
const fakeFetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  calls.push(options);
  if (mode === 'timeout') throw Error('timeout');
  return {
    ok: mode === 'success',
    status: mode === 'success' ? 200 : 429,
    json: async () => ({ id: 'provider-' + calls.length }),
  };
};
function load(path) {
  const m = { exports: {} };
  new Function(
    'require',
    'module',
    'exports',
    'fetch',
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (p) =>
      p === '@/db/queries'
        ? query
        : p === 'cloudflare:workers'
          ? { env }
          : p === './auth'
            ? {
                AppError,
                requirePermission: () => {},
                can: (a) => a.role === 'ADMIN',
              }
            : require(p),
    m,
    m.exports,
    fakeFetch,
  );
  return m.exports;
}
const actor = { id: 'owner', role: 'ADMIN' },
  campaigns = load('lib/store-price-campaigns.ts'),
  images = load('lib/product-images.ts'),
  emails = load('lib/order-email-outbox.ts'),
  links = load('lib/order-email-link.ts');
const config = {
  name: 'Prueba aislada',
  discount: 20,
  startsAt: new Date(Date.now() - 60000).toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
  variantIds: ['v'],
};
assert.equal(
  (await campaigns.campaignPreview(actor, config)).items[0].campaignPrice,
  8000,
);
await campaigns.campaignWrite(actor, { action: 'create', config });
assert.equal(
  database.prepare('SELECT onlinePrice FROM variants').get().onlinePrice,
  10000,
);
await campaigns.runPriceCampaigns();
assert.equal(
  database.prepare('SELECT onlinePrice,price FROM variants').get().onlinePrice,
  8000,
);
assert.equal(database.prepare('SELECT price FROM variants').get().price, 10000);
let c = database.prepare('SELECT id FROM store_price_campaigns').get().id;
database.exec("UPDATE variants SET price=11000,updatedAt='local-only-change'");
await campaigns.campaignWrite(actor, { action: 'restore', id: c });
assert.equal(database.prepare('SELECT price FROM variants').get().price,11000);
assert.equal(
  database.prepare('SELECT onlinePrice FROM variants').get().onlinePrice,
  10000,
);
await campaigns.campaignWrite(actor, { action: 'restore', id: c });
assert.equal(
  database.prepare('SELECT onlinePrice FROM variants').get().onlinePrice,
  10000,
);
await campaigns.campaignWrite(actor, { action: 'create', config });
await campaigns.runPriceCampaigns();
c = database
  .prepare("SELECT id FROM store_price_campaigns WHERE status='active'")
  .get().id;
database.exec("UPDATE variants SET onlinePrice=9000,updatedAt='manual-change'");
await campaigns.campaignWrite(actor, { action: 'restore', id: c });
assert.equal(
  database.prepare('SELECT onlinePrice FROM variants').get().onlinePrice,
  9000,
);
assert.equal(
  database
    .prepare('SELECT status FROM store_price_campaign_items WHERE campaignId=?')
    .get(c).status,
  'skipped',
);
await assert.rejects(
  campaigns.campaignWrite(actor, {
    action: 'create',
    config: { ...config, discount: 100 },
  }),
);
const photo = {
  productId: 'p',
  mime: 'image/png',
  alt: 'Remera',
  base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64'),
};
await assert.rejects(
  images.saveProductImage({ role: 'VENDEDOR' }, photo),
  (e) => e.status === 403,
);
await assert.rejects(
  images.saveProductImage(actor, {
    ...photo,
    base64: Buffer.from('<svg/>').toString('base64'),
  }),
);
const first = await images.saveProductImage(actor, photo),
  second = await images.saveProductImage(actor, photo);
assert.notEqual(first.image.id, second.image.id);
assert.equal(
  database
    .prepare('SELECT COUNT(*) AS n FROM product_images WHERE active=1')
    .get().n,
  1,
);
const response = await images.publicProductImage(second.image.id);
assert.equal(response.headers.get('Content-Type'), 'image/png');
assert.match(response.headers.get('Cache-Control'), /immutable/);
assert.equal((await response.arrayBuffer()).byteLength, 9);
const originalBytes = Buffer.alloc(2_000_000, 71);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(originalBytes);
const fullQuality = await images.saveProductImage(actor, {
  ...photo, base64: originalBytes.toString('base64'),
});
const fullQualityResponse = await images.publicProductImage(fullQuality.image.id);
assert.deepEqual(Buffer.from(await fullQualityResponse.arrayBuffer()), originalBytes);
await assert.rejects(images.saveProductImage(actor, {
  ...photo, base64: Buffer.alloc(3_000_001).toString('base64'),
}));
const link = await links.orderEmailLink('o'),
  token = new URL(link).hash.slice('#email-token='.length);
assert.equal(await links.verifyOrderEmailToken('o', token), true);
assert.equal(await links.verifyOrderEmailToken('other', token), false);
assert.equal(
  await links.verifyOrderEmailToken('o', token.replace('el1.', 'el1.1')),
  false,
);
assert.equal(new URL(link).search, '');
const input = {
  to: 'test@example.invalid',
  subject: 'Prueba',
  html: '<p>Prueba</p>',
  kind: 'order_created',
  orderId: 'o',
  idempotencyKey: 'unique-test',
};
await emails.enqueueOrderEmail(input);
await emails.enqueueOrderEmail(input);
assert.equal(
  database.prepare('SELECT COUNT(*) AS n FROM order_email_outbox').get().n,
  1,
);
mode = 'timeout';
await emails.runOrderEmailQueue();
assert.equal(
  database.prepare('SELECT status FROM order_email_outbox').get().status,
  'retry',
);
database.exec("UPDATE order_email_outbox SET nextAttemptAt='2000-01-01'");
mode = 'success';
await emails.runOrderEmailQueue();
assert.equal(
  calls[0].headers['Idempotency-Key'],
  calls[1].headers['Idempotency-Key'],
);
assert.equal(
  database.prepare('SELECT status FROM order_email_outbox').get().status,
  'sent',
);
async function event(type, signatureValid = true) {
  const body = JSON.stringify({
      type,
      created_at: new Date().toISOString(),
      data: { email_id: 'provider-2' },
    }),
    messageId = crypto.randomUUID(),
    timestamp = String(Math.floor(Date.now() / 1000)),
    key = await crypto.subtle.importKey(
      'raw',
      Buffer.from('isolated-webhook-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ),
    sig = Buffer.from(
      await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${messageId}.${timestamp}.${body}`),
      ),
    ).toString('base64');
  return emails.resendWebhook(
    new Request('https://example.invalid', {
      method: 'POST',
      body,
      headers: {
        'svix-id': messageId,
        'svix-timestamp': timestamp,
        'svix-signature': 'v1,' + (signatureValid ? sig : 'wrong'),
      },
    }),
  );
}
await assert.rejects(event('email.delivered', false), (e) => e.status === 401);
await event('email.delivered');
assert.equal(
  database.prepare('SELECT status FROM order_email_outbox').get().status,
  'delivered',
);
await event('email.delivery_delayed');
assert.equal(
  database.prepare('SELECT status FROM order_email_outbox').get().status,
  'delivered',
);
await event('email.bounced');
await event('email.delivered');
assert.equal(
  database.prepare('SELECT status FROM order_email_outbox').get().status,
  'bounced',
);
await emails.enqueueOrderEmail({ ...input, idempotencyKey: 'expired-window' });
database.exec(
  "UPDATE order_email_outbox SET firstAttemptAt='2000-01-01' WHERE dedupKey='expired-window'",
);
await emails.runOrderEmailQueue();
assert.equal(
  database
    .prepare(
      "SELECT status FROM order_email_outbox WHERE dedupKey='expired-window'",
    )
    .get().status,
  'review',
);
console.log(
  'PASS: campaign preview/schedule/restore/manual protection; image authorization/validation/cache; private tracking links; durable queue/dedup/retries/webhook signatures and terminal states. No network or production data.',
);

const installments = load('lib/store-installments.ts');
assert.equal((await installments.storeInstallments()).enabled, false);
await assert.rejects(
  installments.saveInstallments(actor, {
    enabled: true,
    installments: 3,
    productIds: [],
    providerConfirmed: false,
  }),
);
await installments.saveInstallments(actor, {
  enabled: false,
  installments: 6,
  cft: 0,
  productIds: ['p'],
  providerConfirmed: false,
});
assert.equal((await installments.storeInstallments()).enabled, false);
console.log(
  'PASS: cuotas ocultas de inicio, configuración guardada y activación requiere confirmación del proveedor.',
);
