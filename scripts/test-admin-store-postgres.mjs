import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
const realRequire = createRequire(import.meta.url);
const { PGlite } = await import(
  pathToFileURL(
    resolve(
      'outputs/pg-stock-tests/node_modules/@electric-sql/pglite/dist/index.js',
    ),
  ).href
);
const database = new PGlite();
const queries = { exports: {} };
new Function(
  'require',
  'module',
  'exports',
  ts.transpileModule(readFileSync('db/queries.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(
  (p) =>
    p === 'cloudflare:workers'
      ? { env: {} }
      : p === 'pg'
        ? { types: { setTypeParser() {} }, Pool: class {} }
        : realRequire(p),
  queries,
  queries.exports,
);
const sql = queries.exports.postgresSql;
await database.exec(
  `CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('owner');CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT,active INTEGER);INSERT INTO products VALUES('p','Remera',1);CREATE TABLE variants(id TEXT PRIMARY KEY,"productId" TEXT,color TEXT,size TEXT,"onlinePrice" INTEGER,price INTEGER,"updatedAt" TEXT);INSERT INTO variants VALUES('v','p','Negro','L',NULL,10000,'original');CREATE TABLE online_product_profiles("productId" TEXT,published INTEGER);INSERT INTO online_product_profiles VALUES('p',1);CREATE TABLE online_orders(id TEXT PRIMARY KEY);CREATE TABLE email_deliveries(id TEXT PRIMARY KEY,kind TEXT,recipient TEXT,"orderId" TEXT,"providerId" TEXT,status TEXT,"createdAt" TEXT);`,
);
await database.exec(
  readFileSync('drizzle-postgres/0007_order_emails_campaigns.sql', 'utf8'),
);
let tx;
const query = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  one: async (s, ...args) =>
    (await (tx || database).query(sql(s), args)).rows[0] || null,
  rows: async (s, ...args) => (await (tx || database).query(sql(s), args)).rows,
  statement: (s, ...args) => ({
    run: async () => (tx || database).query(sql(s), args),
    first: async () =>
      (await (tx || database).query(sql(s), args)).rows[0] || null,
  }),
  auditStatement: () => ({ audit: true }),
  db: () => ({
    batch: async (commands) =>
      database.transaction(async (transaction) => {
        tx = transaction;
        try {
          for (const c of commands) if (!c.audit) await c.run();
        } finally {
          tx = null;
        }
      }),
  }),
};
function load(file) {
  const m = { exports: {} };
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (p) =>
      p === '@/db/queries'
        ? query
        : p === './auth'
          ? { requirePermission() {}, can: () => true, AppError: Error }
          : realRequire(p),
    m,
    m.exports,
  );
  return m.exports;
}
const campaigns = load('lib/store-price-campaigns.ts'),
  images = load('lib/product-images.ts'),
  actor = { id: 'owner' };
const config = {
  name: 'Prueba Postgres',
  discount: 20,
  startsAt: new Date(Date.now() - 60000).toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
  variantIds: ['v'],
  referencePrices: { v: 10000 },
};
await campaigns.campaignWrite(actor, { action: 'create', config });
await campaigns.runPriceCampaigns();
assert.equal(
  (await query.one('SELECT onlinePrice FROM variants')).onlinePrice,
  8000,
);
const campaign = await query.one('SELECT id FROM store_price_campaigns');
await campaigns.campaignWrite(actor, { action: 'restore', id: campaign.id });
assert.equal(
  (await query.one('SELECT onlinePrice FROM variants')).onlinePrice,
  null,
);
await campaigns.campaignWrite(actor, { action: 'create', config });
await campaigns.runPriceCampaigns();
await database.exec(
  `UPDATE variants SET "onlinePrice"=9500,"updatedAt"='manual'`,
);
const next = await query.one(
  "SELECT id FROM store_price_campaigns WHERE status='active'",
);
await campaigns.campaignWrite(actor, { action: 'restore', id: next.id });
assert.equal(
  (await query.one('SELECT onlinePrice FROM variants')).onlinePrice,
  9500,
);
await images.saveProductImage(actor, {
  productId: 'p',
  mime: 'image/png',
  alt: 'Prueba',
  base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64'),
});
assert.ok((await images.productImage(actor, 'p')).image.url);
await database.close();
console.log(
  'PASS: production PostgreSQL migration and real query conversion; campaign activation/restoration/manual protection and image storage. Isolated WASM database.',
);
