import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, actor } from './scripts/shared-stock-fixture.mjs';

function order(database, quantity, { reserve = true, expired = false } = {}) {
  const id = crypto.randomUUID(),
    timestamp = new Date().toISOString();
  const expires = new Date(
    Date.now() + (expired ? -1 : 1) * 3600000,
  ).toISOString();
  database
    .prepare(
      `INSERT INTO online_orders(id,orderNumber,email,customerName,phone,paymentMethod,subtotal,total,shippingMethod,postalCode,address,city,province,accessTokenHash,transferReference,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,'transfer',?,?,'pickup','1000','Local','Ciudad','Provincia','hash',?,?,?,?)`,
    )
    .run(
      id,
      1000 +
        database.prepare('SELECT COUNT(*) AS total FROM online_orders').get()
          .total,
      'test@example.invalid',
      'Prueba',
      '1100000000',
      quantity * 10000,
      quantity * 10000,
      id,
      expires,
      timestamp,
      timestamp,
    );
  database
    .prepare(
      'INSERT INTO online_order_items(id,orderId,variantId,productName,sku,color,size,quantity,unitPrice,lineTotal) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      crypto.randomUUID(),
      id,
      'variant',
      'Camisa',
      'TEST',
      'Azul',
      'L',
      quantity,
      10000,
      quantity * 10000,
    );
  if (reserve) reservation(database, id, quantity, expires);
  return id;
}
function reservation(
  database,
  id,
  quantity,
  expires = new Date(Date.now() + 3600000).toISOString(),
) {
  database
    .prepare(
      'INSERT INTO stock_reservations(id,orderId,variantId,quantity,expiresAt,createdAt) VALUES (?,?,?,?,?,?)',
    )
    .run(
      crypto.randomUUID(),
      id,
      'variant',
      quantity,
      expires,
      new Date().toISOString(),
    );
}
const stock = (database) =>
  database.prepare("SELECT stock FROM variants WHERE id='variant'").get().stock;

test('POS respeta otras reservas; pedido online consume exclusivamente la propia', async (t) => {
  const f = fixture(t),
    id = order(f.database, 98);
  await assert.rejects(f.sell(3), /stock disponible/);
  await f.sell(2);
  assert.equal(stock(f.database), 98);
  await f
    .load('lib/online-store.ts')
    .confirmOnlinePayment(actor, id, 'payment-' + id);
  assert.equal(stock(f.database), 0);
  assert.equal(
    f.database
      .prepare('SELECT status FROM stock_reservations WHERE orderId=?')
      .get(id).status,
    'consumed',
  );
});
test('dos pedidos mantienen sus unidades protegidas mientras se cobra en POS y online', async (t) => {
  const f = fixture(t),
    a = order(f.database, 40),
    b = order(f.database, 30),
    online = f.load('lib/online-store.ts');
  await f.sell(30);
  await online.confirmOnlinePayment(actor, a, 'payment-' + a);
  assert.equal(stock(f.database), 30);
  await assert.rejects(f.sell(1), /stock disponible/);
  await online.confirmOnlinePayment(actor, b, 'payment-' + b);
  assert.equal(stock(f.database), 0);
});
test('reservas vencidas o canceladas liberan disponibilidad, pero no se pueden acreditar', async (t) => {
  const f = fixture(t),
    id = order(f.database, 100, { expired: true });
  await assert.rejects(
    f
      .load('lib/online-store.ts')
      .confirmOnlinePayment(actor, id, 'payment-' + id),
    /venció/,
  );
  await f.sell(100);
  assert.equal(stock(f.database), 0);
});
test('una reserva creada después de cotizar aborta toda la venta POS', async (t) => {
  const f = fixture(t),
    id = order(f.database, 100, { reserve: false });
  const binding = f.load('db/queries.ts').db(),
    batch = binding.batch.bind(binding);
  binding.batch = async (commands) => {
    binding.batch = batch;
    reservation(f.database, id, 100);
    return batch(commands);
  };
  await assert.rejects(f.sell(1), (error) => {
    assert.match(error.message, /quedó reservado online/);
    assert.equal(error.headers?.['X-Sale-Not-Committed'], '1');
    return true;
  });
  assert.equal(stock(f.database), 100);
  for (const table of [
    'sales',
    'sale_items',
    'payments',
    'cash_movements',
    'stock_movements',
  ])
    assert.equal(
      f.database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total,
      0,
      table,
    );
});
test('dos cobros simultáneos no venden más unidades que las disponibles', async (t) => {
  const f = fixture(t);
  const results = await Promise.allSettled([f.sell(70), f.sell(70)]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(results.filter((x) => x.status === 'rejected').length, 1);
  assert.equal(stock(f.database), 30);
  assert.equal(
    f.database.prepare('SELECT COUNT(*) AS total FROM sales').get().total,
    1,
  );
});
test('cancelar una reserva devuelve sus unidades al POS', async (t) => {
  const f = fixture(t),
    id = order(f.database, 100);
  f.database
    .prepare("UPDATE stock_reservations SET status='cancelled' WHERE orderId=?")
    .run(id);
  await assert.rejects(
    f
      .load('lib/online-store.ts')
      .confirmOnlinePayment(actor, id, 'payment-' + id),
    /ya no está activa/,
  );
  await f.sell(100);
  assert.equal(stock(f.database), 0);
});
