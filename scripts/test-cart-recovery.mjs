import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const realRequire = createRequire(import.meta.url),
  database = new DatabaseSync(':memory:');
database.exec(
  `CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE abandoned_carts(id TEXT PRIMARY KEY,sessionId TEXT UNIQUE,customerId TEXT,email TEXT,cartJson TEXT,subtotal INTEGER,status TEXT,recoveryToken TEXT,source TEXT,campaign TEXT,lastActivityAt TEXT,createdAt TEXT,updatedAt TEXT,firstReminderAt TEXT,secondReminderAt TEXT);CREATE TABLE online_orders(id TEXT,email TEXT,createdAt TEXT);CREATE TABLE email_deliveries(id TEXT,kind TEXT,recipient TEXT,status TEXT,createdAt TEXT,providerId TEXT NOT NULL DEFAULT '');CREATE TABLE marketing_automation_log(id TEXT,kind TEXT,entityId TEXT,recipient TEXT,status TEXT,detail TEXT,createdAt TEXT);CREATE TABLE variants(id TEXT,productId TEXT,color TEXT,size TEXT,price INTEGER,onlinePrice INTEGER);CREATE TABLE products(id TEXT,name TEXT,active INTEGER);CREATE TABLE online_product_profiles(productId TEXT,slug TEXT,published INTEGER);INSERT INTO products VALUES ('p','Remera real',1);INSERT INTO variants VALUES ('v','p','Negro','M',10000,12000);INSERT INTO online_product_profiles VALUES ('p','remera',1);`,
);
const sent = [];
let fail = false;
const query = {
  id: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  one: async (sql, ...args) => database.prepare(sql).get(...args) ?? null,
  rows: async (sql, ...args) => database.prepare(sql).all(...args),
  statement: (sql, ...args) => ({
    first: async () => database.prepare(sql).get(...args) ?? null,
    run: async () => database.prepare(sql).run(...args),
    sql,
    args,
  }),
  auditStatement: () => ({ run: async () => {}, audit: true }),
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
const testModule = { exports: {} };
const source = ts.transpileModule(
  readFileSync('lib/cart-recovery.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const require = (p) =>
  p === 'cloudflare:workers'
    ? { env: { SITE_ORIGIN: 'https://www.fraguan.com' } }
    : p === '@/db/queries'
      ? query
      : p === './auth'
        ? { AppError: Error, requirePermission: () => {} }
        : p === './online-store'
          ? {
              currentStoreCustomer: async () => null,
              requireVerifiedCheckoutEmail: async (req, email, token) => {
                if (token !== 'verified') throw Error('verify');
              },
            }
          : p === './email-template'
            ? { escapeHtml: (x) => String(x).replaceAll('<', '&lt;') }
            : p === './email'
              ? {
                  emailConfiguration: () => ({ configured: true }),
                  sendMarketingEmail: async (input) => {
                    sent.push(input);
                    database
                      .prepare(
                        'INSERT INTO email_deliveries(id,kind,recipient,status,createdAt) VALUES (?,?,?,?,?)',
                      )
                      .run(
                        crypto.randomUUID(),
                        input.kind,
                        input.to,
                        fail ? 'failed' : 'sent',
                        new Date().toISOString(),
                      );
                    return { sent: !fail };
                  },
                }
              : realRequire(p);
// Trusted local source and an in-memory database. No real emails or system data.
// oxlint-disable-next-line typescript/no-implied-eval
new Function('require', 'module', 'exports', source)(
  require,
  testModule,
  testModule.exports,
);
const api = testModule.exports,
  request = new Request('https://www.fraguan.com/api/store-recovery');
const input = {
  sessionId: crypto.randomUUID(),
  consent: true,
  email: 'preview@example.invalid',
  emailVerificationToken: 'verified',
  items: [{ variantId: 'v', quantity: 2 }],
};
await assert.rejects(
  api.captureCartRecovery(request, { ...input, emailVerificationToken: '' }),
);
await api.captureCartRecovery(request, input);
let cart = database.prepare('SELECT * FROM abandoned_carts').get();
assert.equal(cart.subtotal, 24000);
assert.equal(JSON.parse(cart.cartJson)[0].price, 12000);
const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
database.prepare('UPDATE abandoned_carts SET lastActivityAt=?').run(ago(3));
assert.equal((await api.runCartRecovery()).sent, 1);
assert.ok(sent[0].content.includes('No recibir más recordatorios'));
assert.equal((await api.runCartRecovery()).sent, 0);
database
  .prepare('UPDATE abandoned_carts SET lastActivityAt=?,firstReminderAt=?')
  .run(ago(26), ago(23));
assert.equal((await api.runCartRecovery()).sent, 1);
assert.equal((await api.runCartRecovery()).sent, 0);
await api.stopCartRecovery(cart.recoveryToken);
assert.equal(
  database.prepare('SELECT email FROM abandoned_carts').get().email,
  '',
);
assert.equal((await api.runCartRecovery()).sent, 0);
await api.saveRecoveryConfiguration(
  {},
  { enabled: false, firstHours: 2, secondHours: 24, secondEnabled: true },
);
assert.equal((await api.runCartRecovery()).paused, true);
await assert.rejects(
  api.saveRecoveryConfiguration(
    {},
    { enabled: true, firstHours: 24, secondHours: 2, secondEnabled: true },
  ),
);
await api.saveRecoveryConfiguration(
  {},
  { enabled: true, firstHours: 2, secondHours: 24, secondEnabled: true },
);
database
  .prepare("INSERT INTO settings VALUES ('cart-recovery-lock',?)")
  .run(new Date(Date.now() + 60000).toISOString());
assert.equal((await api.runCartRecovery()).locked, true);
database.exec(
  "DELETE FROM settings WHERE key='cart-recovery-lock';DELETE FROM abandoned_carts;DELETE FROM email_deliveries;",
);
await api.captureCartRecovery(request, {
  ...input,
  sessionId: crypto.randomUUID(),
});
database.prepare('UPDATE abandoned_carts SET lastActivityAt=?').run(ago(3));
cart = database.prepare('SELECT * FROM abandoned_carts').get();
database
  .prepare('INSERT INTO online_orders VALUES (?,?,?)')
  .run('o', input.email, new Date().toISOString());
assert.equal((await api.runCartRecovery()).sent, 0);
database.exec('DELETE FROM online_orders;');
database
  .prepare('DELETE FROM settings WHERE key=?')
  .run('cart-recovery-consent:' + cart.id);
assert.equal((await api.runCartRecovery()).sent, 0);
database
  .prepare('INSERT INTO settings VALUES (?,?)')
  .run('cart-recovery-consent:' + cart.id, cart.email);
fail = true;
assert.equal((await api.runCartRecovery()).failed, 1);
assert.equal(
  database.prepare('SELECT firstReminderAt FROM abandoned_carts').get()
    .firstReminderAt,
  null,
);
fail = false;
await api.saveRecoveryConfiguration(
  {},
  {
    enabled: true,
    firstHours: 2,
    secondHours: 24,
    secondEnabled: true,
    dailyReminderLimit: 0,
    monthlyReminderLimit: 900,
  },
);
assert.equal((await api.runCartRecovery()).sent, 0);
await api.saveRecoveryConfiguration(
  {},
  { enabled: true, firstHours: 2, secondHours: 24, secondEnabled: true },
);
for (let i = 0; i < 80; i++)
  database
    .prepare('INSERT INTO email_deliveries(id,kind,recipient,status,createdAt) VALUES (?,?,?,?,?)')
    .run(
      crypto.randomUUID(),
      'order_paid',
      'preview@example.invalid',
      'sent',
      new Date().toISOString(),
    );
assert.equal((await api.runCartRecovery()).sent, 0);
assert.equal((await api.recoveryEmailUsage()).day, 80);
database.exec('DELETE FROM email_deliveries');
await api.captureCartRecovery(request, {
  ...input,
  sessionId: cart.sessionId,
  items: [],
});
assert.equal((await api.runCartRecovery()).sent, 0);
assert.equal(
  database.prepare('SELECT email FROM abandoned_carts').get().email,
  '',
);
console.log(
  'PASS: verified opt-in, real prices, 2h/24h, suppression after order/opt-out, pause, lease, duplicate prevention and provider failure. Isolated database; no emails sent.',
);
