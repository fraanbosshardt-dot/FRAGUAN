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
const database = {
  now: () => '2026-10-06T15:00:00.000Z',
  one: async (sql) => {
    if (sql.includes('FROM variants'))
      return {
        id: 'variant',
        name: 'Prenda de prueba',
        color: 'Negro',
        size: 'M',
        price: 10000,
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
    throw new Error('Unexpected database read: ' + sql);
  },
  rows: async (sql, ...args) => {
    if (sql.includes('FROM promotions')) return promotions;
    assert.equal(
      args[0],
      'seller-test',
      'Summary must filter by actor, not requested user',
    );
    if (sql.includes('FROM sales s LEFT'))
      return [{ total: 10000, units: 2, createdAt: '2026-10-06T15:00:00Z' }];
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
const { priceCart, quote } = load('lib/sales.ts');
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
  summary.net,
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
console.log(
  'POS: pricing, coupons, permissions, cash change, own-sales scope and date limits passed. No database writes.',
);
