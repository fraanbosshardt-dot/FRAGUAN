import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, actor } from './scripts/shared-stock-fixture.mjs';

async function checkout(f) {
  const timestamp = new Date().toISOString();
  const hash = Buffer.from(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('test-session'),
    ),
  ).toString('base64');
  f.database
    .prepare(
      "INSERT INTO customers(id,name,surname,phone,email,createdAt) VALUES ('buyer','Cliente','Prueba','3515555555','buyer@example.invalid',?)",
    )
    .run(timestamp);
  f.database
    .prepare(
      "INSERT INTO customer_accounts(id,customerId,email,passwordHash,passwordSalt,createdAt) VALUES ('account','buyer','buyer@example.invalid','','',?)",
    )
    .run(timestamp);
  f.database
    .prepare(
      "INSERT INTO customer_sessions(id,accountId,tokenHash,expiresAt,createdAt) VALUES ('customer-session','account',?,?,?)",
    )
    .run(hash, new Date(Date.now() + 3600000).toISOString(), timestamp);
  f.database
    .prepare(
      "INSERT INTO online_product_profiles(productId,slug,updatedAt) VALUES ('product','camisa',?)",
    )
    .run(timestamp);
  const req = new Request('https://example.invalid/api/store-orders', {
    headers: { cookie: 'fraguan_customer=test-session' },
  });
  const input = () => ({
    items: [{ variantId: 'variant', quantity: 1 }],
    email: 'buyer@example.invalid',
    customerName: 'Cliente Prueba',
    phone: '3515555555',
    paymentMethod: 'transfer',
    shippingMethod: 'pickup',
    postalCode: '2661',
    address: 'Local Isla Verde',
    addressExtra: '',
    city: 'Isla Verde',
    province: 'Córdoba',
    notes: '',
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  });
  return {
    create: (data) =>
      f.load('lib/online-store.ts').createOnlineOrder(req, data),
    input,
  };
}

test('pedidos distintos y reintento mantienen número y referencia reales', async (t) => {
  const f = fixture(t),
    c = await checkout(f),
    firstInput = c.input();
  const first = await c.create(firstInput),
    second = await c.create(c.input());
  assert.equal(first.orderNumber, 1001);
  assert.equal(first.items[0].variantId, 'variant');
  assert.equal(second.orderNumber, 1002);
  assert.match(first.transferReference, /^FRG-1001-[A-Z0-9]+$/);
  const retry = await c.create(firstInput);
  assert.equal(retry.orderNumber, 1001);
  assert.equal(retry.transferReference, first.transferReference);
  assert.equal(
    f.database
      .prepare("SELECT value FROM document_counters WHERE name='online_order'")
      .get().value,
    1002,
  );
});

test('POS y confirmación online comparten numeración; importaciones se conservan', async (t) => {
  const f = fixture(t),
    c = await checkout(f),
    order = await c.create(c.input());
  await f.sell(1);
  await f
    .load('lib/online-store.ts')
    .confirmOnlinePayment(actor, order.id, 'proof');
  assert.deepEqual(
    f.database
      .prepare('SELECT ticket FROM sales ORDER BY ticket')
      .all()
      .map((r) => r.ticket),
    [1, 2],
  );
  f.database.exec('UPDATE sales SET ticket=250 WHERE ticket=2');
  await f.sell(1);
  assert.equal(
    f.database.prepare('SELECT MAX(ticket) AS ticket FROM sales').get().ticket,
    251,
  );
});

test('fallo al guardar revierte el contador; próximo pedido reutiliza número no emitido', async (t) => {
  const f = fixture(t),
    c = await checkout(f);
  f.database.exec(
    "CREATE TRIGGER forced_number_failure BEFORE INSERT ON online_order_items BEGIN SELECT RAISE(ABORT,'test rollback'); END;",
  );
  await assert.rejects(c.create(c.input()), /test rollback/);
  assert.equal(
    f.database
      .prepare("SELECT value FROM document_counters WHERE name='online_order'")
      .get().value,
    1000,
  );
  assert.equal(
    f.database.prepare('SELECT COUNT(*) AS count FROM online_orders').get()
      .count,
    0,
  );
  f.database.exec('DROP TRIGGER forced_number_failure');
  assert.equal((await c.create(c.input())).orderNumber, 1001);
});
