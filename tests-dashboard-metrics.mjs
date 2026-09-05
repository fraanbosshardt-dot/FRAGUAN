import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (
  nodeMajor === 22 &&
  !process.execArgv.includes('--experimental-strip-types')
) {
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(import.meta.url)],
    { stdio: 'inherit' },
  );
  process.exit(0);
}

const { compareDashboardPeriod, dashboardSql } =
  await import('./lib/dashboard-metrics.ts');

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    sellerId TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE refunds (saleId TEXT NOT NULL, amount INTEGER NOT NULL);
  CREATE TABLE sale_items (
    saleId TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    refunded INTEGER NOT NULL,
    price INTEGER NOT NULL,
    cost INTEGER NOT NULL
  );
  CREATE TABLE payments (
    saleId TEXT NOT NULL,
    methodId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    commission INTEGER NOT NULL
  );
  CREATE TABLE payment_methods (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE expenses (amount INTEGER NOT NULL);
  CREATE TABLE variants (
    stock INTEGER NOT NULL,
    cost INTEGER NOT NULL,
    price INTEGER NOT NULL,
    minimum INTEGER NOT NULL
  );

  INSERT INTO users VALUES ('ana', 'Ana'), ('beto', 'Beto');
  INSERT INTO payment_methods VALUES ('cash', 'Efectivo'), ('card', 'Tarjeta');
  INSERT INTO expenses VALUES (100), (250);
  INSERT INTO variants VALUES (5, 100, 200, 3), (2, 300, 500, 2);
`);

function addSale({
  id,
  sellerId,
  total,
  status,
  createdAt,
  items,
  payments,
  refunds = [],
}) {
  database
    .prepare('INSERT INTO sales VALUES (?, ?, ?, ?, ?)')
    .run(id, sellerId, total, status, createdAt);
  const itemStatement = database.prepare(
    'INSERT INTO sale_items VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const item of items)
    itemStatement.run(
      id,
      item.name,
      item.quantity,
      item.refunded ?? 0,
      item.price,
      item.cost,
    );
  const paymentStatement = database.prepare(
    'INSERT INTO payments VALUES (?, ?, ?, ?)',
  );
  for (const payment of payments)
    paymentStatement.run(
      id,
      payment.methodId,
      payment.amount,
      payment.commission ?? 0,
    );
  const refundStatement = database.prepare('INSERT INTO refunds VALUES (?, ?)');
  for (const amount of refunds) refundStatement.run(id, amount);
}

addSale({
  id: 'today-cash',
  sellerId: 'ana',
  total: 10_000,
  status: 'confirmed',
  createdAt: '2026-09-04T13:00:00.000Z',
  items: [{ name: 'Oxford', quantity: 2, price: 5_000, cost: 2_000 }],
  payments: [
    { methodId: 'cash', amount: 6_000 },
    { methodId: 'card', amount: 4_000, commission: 400 },
  ],
});
addSale({
  id: 'today-partial',
  sellerId: 'beto',
  total: 12_000,
  status: 'partially_refunded',
  createdAt: '2026-09-04T14:00:00.000Z',
  items: [
    { name: 'Jean', quantity: 2, price: 4_000, cost: 1_000 },
    {
      name: 'Cinturón devuelto',
      quantity: 1,
      refunded: 1,
      price: 4_000,
      cost: 500,
    },
  ],
  payments: [{ methodId: 'card', amount: 12_000, commission: 1_200 }],
  refunds: [1_500, 2_500],
});
addSale({
  id: 'today-refunded',
  sellerId: 'ana',
  total: 7_000,
  status: 'refunded',
  createdAt: '2026-09-04T14:30:00.000Z',
  items: [
    {
      name: 'Venta anulada',
      quantity: 1,
      refunded: 1,
      price: 7_000,
      cost: 2_000,
    },
  ],
  payments: [{ methodId: 'card', amount: 7_000, commission: 700 }],
  refunds: [7_000],
});

for (const sale of [
  {
    id: 'sep-2',
    sellerId: 'ana',
    total: 6_000,
    createdAt: '2026-09-02T16:00:00.000Z',
    name: 'Oxford',
    price: 8_000,
    cost: 2_500,
  },
  {
    id: 'sep-3',
    sellerId: 'beto',
    total: 4_000,
    createdAt: '2026-09-03T16:00:00.000Z',
    name: 'Remera',
    cost: 1_500,
  },
  {
    id: 'aug-2',
    sellerId: 'ana',
    total: 5_000,
    createdAt: '2026-08-02T16:00:00.000Z',
    name: 'Campera',
    cost: 1_500,
  },
  {
    id: 'aug-4',
    sellerId: 'beto',
    total: 3_000,
    createdAt: '2026-08-04T16:00:00.000Z',
    name: 'Gorra',
    cost: 900,
  },
  {
    id: 'aug-5',
    sellerId: 'beto',
    total: 9_000,
    createdAt: '2026-08-05T16:00:00.000Z',
    name: 'Buzo',
    cost: 3_000,
  },
  {
    id: 'jul-10',
    sellerId: 'ana',
    total: 2_000,
    createdAt: '2026-07-10T16:00:00.000Z',
    name: 'Medias',
    cost: 800,
  },
])
  addSale({
    ...sale,
    status: 'confirmed',
    items: [
      {
        name: sale.name,
        quantity: 1,
        price: sale.price ?? sale.total,
        cost: sale.cost,
      },
    ],
    payments: [{ methodId: 'cash', amount: sale.total }],
  });

addSale({
  id: 'draft',
  sellerId: 'ana',
  total: 99_000,
  status: 'draft',
  createdAt: '2026-09-04T15:00:00.000Z',
  items: [{ name: 'Borrador', quantity: 10, price: 9_900, cost: 1 }],
  payments: [{ methodId: 'cash', amount: 99_000 }],
});

const asOf = '2026-09-04T15:00:00.000Z';
const one = (sql, ...values) => ({
  ...database.prepare(sql).get(...values),
});
const all = (sql, ...values) =>
  database
    .prepare(sql)
    .all(...values)
    .map((row) => ({ ...row }));

const total = one(dashboardSql.total);
assert.deepEqual(total, { revenue: 47_000, tickets: 8, average: 5_875 });
assert.deepEqual(one(dashboardSql.month, asOf, asOf), {
  revenue: 28_000,
  tickets: 4,
  average: 7_000,
});
const today = one(dashboardSql.today, asOf);
const previousDay = one(dashboardSql.previousDay, asOf);
assert.deepEqual(today, { revenue: 18_000, tickets: 2, average: 9_000 });
assert.deepEqual(previousDay, {
  revenue: 4_000,
  tickets: 1,
  average: 4_000,
});
const previousMonth = one(dashboardSql.previousMonth, asOf, asOf, asOf, asOf);
assert.deepEqual(
  previousMonth,
  { revenue: 8_000, tickets: 2, average: 4_000 },
  'The prior-month comparison covers the same available calendar days.',
);

assert.deepEqual(one(dashboardSql.costs), { cost: 16_200, units: 10 });
assert.deepEqual(one(dashboardSql.fees), { fees: 1_200 });
assert.deepEqual(one(dashboardSql.expenses), { total: 350 });
assert.deepEqual(one(dashboardSql.inventory), {
  units: 7,
  capital: 1_100,
  potential: 2_000,
  low: 1,
});

const trend = all(dashboardSql.trend);
assert.deepEqual(trend[0], { date: '2026-09-04', total: 18_000 });
assert(!JSON.stringify(trend).includes('99000'));
const best = all(dashboardSql.best);
assert.deepEqual(best[0], { name: 'Oxford', units: 3, total: 16_000 });
assert(!best.some((item) => item.name === 'Cinturón devuelto'));
assert(!best.some((item) => item.name === 'Venta anulada'));
assert.deepEqual(all(dashboardSql.byPayment), [
  { name: 'Efectivo', total: 35_000 },
  { name: 'Tarjeta', total: 12_000 },
]);
assert.deepEqual(all(dashboardSql.sellers), [
  { name: 'Beto', tickets: 4, total: 24_000 },
  { name: 'Ana', tickets: 4, total: 23_000 },
]);

assert.deepEqual(compareDashboardPeriod(today, previousDay), {
  revenue: {
    current: 18_000,
    previous: 4_000,
    change: 14_000,
    changeBps: 35_000,
  },
  tickets: { current: 2, previous: 1, change: 1, changeBps: 10_000 },
  average: {
    current: 9_000,
    previous: 4_000,
    change: 5_000,
    changeBps: 12_500,
  },
});
assert.equal(
  compareDashboardPeriod({ revenue: 100 }, { revenue: 0 }).revenue.changeBps,
  null,
  'Growth from a zero base cannot be expressed as a percentage.',
);

database.close();
console.log(
  'PASS: dashboard nets partial refunds across totals, periods, costs, fees, products, payment methods and sellers, with Argentina-local comparisons.',
);
