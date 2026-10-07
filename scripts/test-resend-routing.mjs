import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const realRequire = createRequire(import.meta.url);
const env = {
  RESEND_API_KEY: 'isolated-test-key',
  RESEND_FROM: 'FRAGUAN <pedidos@fraguan.com>',
  RESEND_MARKETING_FROM: 'FRAGUAN <hola@fraguan.com>',
  SITE_ORIGIN: 'https://www.fraguan.com',
};
const sent = [],
  writes = [];
let fail = false;
const query = {
  id: () => 'isolated-id',
  now: () => '2026-10-07T15:00:00Z',
  one: async (sql) =>
    sql.includes('online_orders')
      ? {
          orderNumber: 1,
          total: 10000,
          paymentMethod: 'transfer',
          customerName: 'Ana',
          email: 'test@example.invalid',
          transferReference: 'order-test',
        }
      : sql.includes('customer_accounts')
        ? { email: 'test@example.invalid', name: 'Ana' }
        : null,
  rows: async (sql) =>
    sql.includes('unsubscribeToken')
      ? [
          {
            id: 'subscriber-test',
            email: 'test@example.invalid',
            unsubscribeToken: 'token-test',
          },
        ]
      : [],
  statement: (sql, ...params) => ({
    run: async () => {
      writes.push({ sql, params });
    },
  }),
  auditStatement: () => ({ run: async () => {} }),
  db: () => ({ batch: async () => {} }),
};
const m = { exports: {} };
const source = ts.transpileModule(readFileSync('lib/email.ts', 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const require = (p) =>
  p === 'cloudflare:workers'
    ? { env }
    : p === '@/db/queries'
      ? query
      : p === './auth'
        ? { requirePermission: () => {}, AppError: Error }
        : realRequire(p);
const fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails');
  sent.push(JSON.parse(options.body));
  return {
    ok: !fail,
    status: fail ? 429 : 200,
    json: async () =>
      fail ? { message: 'rate limited' } : { id: 'provider-test' },
  };
};
// Trusted repository source; isolated test only. No external requests.
// oxlint-disable-next-line typescript/no-implied-eval
new Function('require', 'module', 'exports', 'fetch', source)(
  require,
  m,
  m.exports,
  fetch,
);
const api = m.exports;
await api.sendOrderEmails('order-test', 'created');
assert.equal(sent.at(-1).from, env.RESEND_FROM);
await api.sendEmailVerificationCode('test@example.invalid', '123456', 'nonce');
assert.equal(sent.at(-1).from, env.RESEND_FROM);
await api.sendMarketingEmail({
  to: 'test@example.invalid',
  subject: 'Novedades',
  title: 'Novedades',
  preheader: 'Novedades',
  content: '<p>Hola</p>',
  kind: 'test',
  entityId: 'test',
});
assert.equal(sent.at(-1).from, env.RESEND_MARKETING_FROM);
await api.sendAccountWelcome('account-test');
assert.equal(sent.at(-1).from, env.RESEND_MARKETING_FROM);
assert.ok(!sent.at(-1).html.includes('beneficios del Club'));
await api.subscribeNewsletter({ email: 'test@example.invalid', name: 'Ana' });
assert.equal(sent.at(-1).from, env.RESEND_MARKETING_FROM);
assert.ok(sent.at(-1).html.includes('unsubscribe='));
await api.sendNewsletterCampaign(
  { id: 'owner' },
  {
    subject: 'Novedades FRAGUAN',
    content: 'Conocé las novedades de nuestra tienda.',
  },
);
assert.equal(sent.at(-1).from, env.RESEND_MARKETING_FROM);
assert.ok(sent.at(-1).html.includes('unsubscribe='));
const before = sent.length;
delete env.RESEND_MARKETING_FROM;
assert.equal(api.emailConfiguration('marketing').configured, false);
await api.sendAccountWelcome('account-test');
assert.equal(sent.length, before);
assert.equal(api.emailConfiguration().configured, true);
fail = true;
env.RESEND_MARKETING_FROM = 'FRAGUAN <hola@fraguan.com>';
const outcome = await api.sendAccountWelcome('account-test');
assert.equal(outcome.sent, false);
assert.ok(writes.at(-1).sql.includes('failed'));
console.log(
  'PASS: remitentes separados, bienvenida, newsletter con baja, configuración incompleta sin mezclar remitentes y errores de Resend registrados.',
);

fail=false;env.RESEND_ORDER_TO='test@example.invalid';
await api.sendEmailTest({id:'owner'},{action:'test',channel:'orders',requestKey:crypto.randomUUID()});
assert.equal(sent.at(-1).from,env.RESEND_FROM);assert.equal(sent.at(-1).to[0],env.RESEND_ORDER_TO);
await api.sendEmailTest({id:'owner'},{action:'test',channel:'marketing',requestKey:crypto.randomUUID()});
assert.equal(sent.at(-1).from,env.RESEND_MARKETING_FROM);
await assert.rejects(()=>api.sendEmailTest({id:'owner'},{action:'test',channel:'orders',requestKey:crypto.randomUUID(),to:'other@example.invalid'}));
console.log('PASS: prueba interna por canal, sin destinatarios arbitrarios.');
