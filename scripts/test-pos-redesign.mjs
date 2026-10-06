import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';

// Execute the real pricing, validation and permission modules with an isolated,
// read-only database fixture. Never connect to the project's databases.
const require = createRequire(import.meta.url);
const cache = new Map();
let promotions = [];
let variantPrice = 10000;
let previousSale = null;
let lookupFails = false;
let commitAttempts = 0;
const database = {
  id: () => 'test-sale',
  statement: (...args) => args,
  auditStatement: (...args) => args,
  db: () => ({
    batch: async () => {
      commitAttempts++;
      throw new Error('Simulated lost database response');
    },
  }),
  now: () => '2026-10-06T15:00:00.000Z',
  one: async (sql) => {
    if (sql.includes('FROM variants'))
      return {
        id: 'variant',
        name: 'Prenda de prueba',
        color: 'Negro',
        size: 'M',
        price: variantPrice,
        cost: 3000,
        stock: 3,
        category: 'Remeras',
        brand: 'FRAGUAN',
      };
    if (sql.includes('FROM payment_methods'))
      return {
        id: 'cash',
        name: 'Efectivo',
        surchargeBps: 0,
        commissionBps: 0,
        days: 0,
        installments: 1,
      };
    if (sql.includes('FROM settings')) return { value: '7' };
    if (sql.includes('FROM sales WHERE idempotencyKey')) {
      if (lookupFails) throw new Error('Simulated lookup outage');
      return previousSale;
    }
    if (sql.includes('FROM cash_sessions')) return { id: 'test-session' };
    if (sql.includes('FROM sales s LEFT JOIN customers'))
      return {
        id: 'existing-sale',
        sellerId: 'seller-test',
        total: 10000,
        status: 'partially_refunded',
        createdAt: '2026-10-06T15:00:00Z',
      };
    throw new Error('Unexpected database read: ' + sql);
  },
  rows: async (sql, ...args) => {
    if (sql.includes('FROM promotions')) return promotions;
    if (sql.includes('FROM sale_items WHERE'))
      return [{ id: 'item', quantity: 2, refunded: 1 }];
    if (sql.includes('FROM payments p JOIN payment_methods'))
      return [{ name: 'Efectivo', amount: 10000 }];
    if (sql.includes('FROM refunds WHERE'))
      return [{ id: 'refund', amount: 2500, method: 'original' }];
    assert.equal(
      args[0],
      'seller-test',
      'Summary must filter by actor, not requested user',
    );
    if (sql.includes('FROM sales s LEFT'))
      return [
        {
          subtotal: 12000,
          discount: 2500,
          total: 10000,
          units: 2,
          createdAt: '2026-10-06T15:00:00Z',
        },
      ];
    if (sql.includes('FROM refunds r'))
      return [{ amount: 2500, createdAt: '2026-10-06T16:00:00Z' }];
    return [];
  },
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule.exports);
  const source = readFileSync(resolve(file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  function dependency(name) {
    if (name === '@/db/queries') return database;
    if (name === '@/app/chatgpt-auth') return {};
    if (name === './business-date') return { argentinaDay: () => '2026-10-06' };
    if (name.startsWith('./')) return load('lib/' + name.slice(2) + '.ts');
    return require(name);
  }
  // eslint-disable-next-line typescript/no-implied-eval -- Trusted repository TypeScript executed against isolated fixtures.
  new Function('require', 'module', 'exports', compiled)(
    dependency,
    compiledModule,
    compiledModule.exports,
  );
  cache.set(file, compiledModule.exports);
  return compiledModule.exports;
}
const { priceCart, quote, confirmSale, saleDetail } = load('lib/sales.ts');
const { posDay, posPeriod, promotionStatus } = load('lib/pos-display.ts');
const { posOverview } = load('lib/pos-overview.ts');
const admin = { id: 'seller-test', role: 'ADMIN' };
const seller = { id: 'seller-test', role: 'VENDEDOR' };
const input = {
  items: [{ variantId: 'variant', quantity: 1 }],
  customerId: null,
  promotionId: null,
  methodIds: ['cash'],
};
assert.equal((await priceCart(input, admin)).base, 10000);
assert.equal(
  (await priceCart({ ...input, manualDiscountMinor: 123 }, admin)).base,
  9877,
);
await assert.rejects(
  priceCart({ ...input, manualDiscountMinor: 123 }, seller),
  { status: 403 },
);
await assert.rejects(
  priceCart(
    { ...input, manualDiscountMinor: 123 },
    { ...admin, denied: ['promotions'] },
  ),
  { status: 403 },
);
await assert.rejects(
  priceCart({ ...input, manualDiscountMinor: 10000 }, admin),
  { status: 400 },
);
await assert.rejects(priceCart({ ...input, manualDiscountMinor: -1 }, admin));
promotions = [
  {
    id: 'automatic',
    name: 'Beneficio',
    percent: 10,
    methodId: null,
    startsAt: '2026-10-01',
    endsAt: '2026-10-31',
    active: 1,
    ruleJson: '',
  },
];
assert.equal(
  (await priceCart({ ...input, autoPromotions: true }, admin)).base,
  9000,
);
assert.equal(
  (
    await priceCart(
      { ...input, autoPromotions: true, excludedPromotionIds: ['automatic'] },
      admin,
    )
  ).base,
  10000,
);
await assert.rejects(
  priceCart({ ...input, autoPromotions: true, couponCode: 'INVALID' }, admin),
  { status: 403 },
);
promotions.push({
  id: 'coupon',
  name: 'Cupón',
  percent: 5,
  methodId: null,
  startsAt: '2026-10-01',
  endsAt: '2026-10-31',
  active: 1,
  ruleJson: JSON.stringify({
    kind: 'percentage',
    percentBps: 500,
    conditions: { couponCodes: ['REAL'] },
  }),
});
const coupon = await priceCart({ ...input, couponCode: 'real' }, admin);
assert.equal(coupon.base, 9500);
assert.equal(coupon.appliedDiscounts[0].promotionId, 'coupon');
const checkout = await quote(
  {
    items: input.items,
    customerId: null,
    promotionId: null,
    manualDiscountMinor: 123,
    payments: [{ methodId: 'cash', baseMinor: 9877, receivedMinor: 10000 }],
  },
  false,
  admin,
);
assert.equal(checkout.total, 9877);
assert.equal(checkout.payments[0].change, 123);
await assert.rejects(
  quote(
    {
      items: input.items,
      customerId: null,
      promotionId: null,
      payments: [{ methodId: 'cash', baseMinor: 10000, receivedMinor: 9999 }],
    },
    false,
    admin,
  ),
  { status: 400 },
);
const summary = await posOverview(admin, {
  from: '2026-10-05',
  to: '2026-10-06',
});
assert.equal(summary.net, 7500);
assert.equal(summary.units, 2);
assert.equal(summary.trend.length, 2);
assert.equal(
  summary.trend.reduce((total, day) => total + day.amount, 0),
  summary.gross,
);
assert.equal(
  summary.merchandise - summary.discounts + summary.surcharges,
  summary.gross,
);
assert.equal(summary.surcharges, 500);
assert.equal(
  summary.trend.reduce((total, day) => total + day.returned, 0),
  summary.returned,
);
await assert.rejects(
  posOverview(admin, { from: '2026-10-07', to: '2026-10-07' }),
  { status: 400 },
);
await assert.rejects(
  posOverview(admin, { from: '2026-06-01', to: '2026-10-06' }),
  { status: 400 },
);
await assert.rejects(
  posOverview(seller, { from: '2026-09-29', to: '2026-10-06' }),
  { status: 403 },
);
await assert.rejects(
  posOverview(
    { ...admin, role: 'STOCK' },
    { from: '2026-10-06', to: '2026-10-06' },
  ),
  { status: 403 },
);
await assert.rejects(
  priceCart({ ...input, methodIds: ['debit', 'debit'] }, admin),
  { status: 400 },
);
variantPrice = 20000;
const freshPricing = await priceCart(
  { ...input, manualDiscountBps: 1000 },
  admin,
);
assert.equal(freshPricing.subtotal, 20000);
assert.equal(freshPricing.base, 18000);
assert.equal(freshPricing.items[0].price, 20000);
await assert.rejects(priceCart({ ...input, manualDiscountBps: 1000 }, seller), {
  status: 403,
});
await assert.rejects(
  priceCart(
    { ...input, manualDiscountBps: 1000, manualDiscountMinor: 10 },
    admin,
  ),
  { status: 400 },
);
variantPrice = 10000;
const payload = {
  items: input.items,
  customerId: null,
  promotionId: null,
  payments: [{ methodId: 'cash', baseMinor: 10000, receivedMinor: 10000 }],
  expectedTotalMinor: 9000,
  idempotencyKey: '0196050d-62de-7000-8000-000000000001',
};
await assert.rejects(
  confirmSale(admin, payload),
  (error) =>
    error.status === 409 && error.headers['X-Sale-Not-Committed'] === '1',
);
assert.equal(
  commitAttempts,
  0,
  'Changed reviewed totals must not reach a commit',
);
const originalPayload = { ...payload, expectedTotalMinor: 10000 };
lookupFails = true;
await assert.rejects(
  confirmSale(admin, originalPayload),
  (error) => !error.headers?.['X-Sale-Not-Committed'],
);
lookupFails = false;
const { saleInput } = load('lib/validation.ts');
const parsed = saleInput.parse(originalPayload);
const requestHash = Buffer.from(
  await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(parsed)),
  ),
).toString('hex');
previousSale = { id: 'existing-sale', sellerId: admin.id, requestHash };
const recovered = await confirmSale(admin, originalPayload);
assert.equal(recovered.id, 'existing-sale');
assert.equal(recovered.returned, 2500);
assert.equal(recovered.remaining, 7500);
assert.equal(
  commitAttempts,
  0,
  'Retrying a committed key only reads the original receipt',
);
await assert.rejects(
  confirmSale(admin, {
    ...originalPayload,
    payments: [{ ...originalPayload.payments[0], receivedMinor: 20000 }],
  }),
  (error) => error.status === 409 && !error.headers?.['X-Sale-Not-Committed'],
);
previousSale = null;
await assert.rejects(
  confirmSale(admin, originalPayload),
  (error) => !error.headers?.['X-Sale-Not-Committed'],
);
assert.equal(
  commitAttempts,
  1,
  'An uncertain commit must not be presented as safely editable',
);
assert.equal((await saleDetail(admin, 'existing-sale')).items[0].refunded, 1);
const beforeMidnight = Date.parse('2026-10-07T02:59:59Z');
const afterMidnight = Date.parse('2026-10-07T03:00:00Z');
assert.equal(posDay(beforeMidnight), '2026-10-06');
assert.equal(posDay(afterMidnight), '2026-10-07');
assert.equal(posPeriod('hoy', afterMidnight).from, '2026-10-07');
assert.equal(posPeriod('ayer', afterMidnight).to, '2026-10-06');
assert.equal(posPeriod('7', afterMidnight).from, '2026-10-01');
assert.equal(
  promotionStatus(
    { active: 1, startsAt: '2026-10-01', endsAt: '2026-10-05' },
    '2026-10-06',
  ),
  'Vencida',
);
assert.equal(
  promotionStatus(
    { active: 1, startsAt: '2026-10-07', endsAt: '2026-10-10' },
    '2026-10-06',
  ),
  'Programada',
);
assert.equal(
  promotionStatus(
    { active: 1, startsAt: '2026-10-06', endsAt: '2026-10-06' },
    '2026-10-06',
  ),
  'Vigente',
);
assert.equal(
  promotionStatus(
    { active: 0, startsAt: '2026-10-01', endsAt: '2026-10-05' },
    '2026-10-06',
  ),
  'Pausada',
);
console.log(
  'POS: gross breakdown, refunds, split validation, current prices, permissions, idempotent recovery and midnight periods passed. Isolated fixtures; no real database writes.',
);
