import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './tests-cashback-regressions.mjs';

const seller = {
  id: 'seller',
  email: 'seller@example.test',
  name: 'Vendedor',
  role: 'VENDEDOR',
  active: 1,
};

function seedOrder(database, overrides = {}) {
  const orderId = overrides.id ?? crypto.randomUUID();
  database
    .prepare(
      `INSERT INTO online_orders(
        id,orderNumber,customerId,email,customerName,phone,status,paymentStatus,paymentMethod,
        fulfillmentStatus,subtotal,discount,shipping,total,shippingMethod,postalCode,address,city,
        province,notes,accessTokenHash,transferReference,paymentReference,trackingNumber,expiresAt,
        paidAt,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      orderId,
      overrides.orderNumber ?? 1001,
      'customer',
      'cliente@example.test',
      'Cliente Prueba',
      '1100000000',
      overrides.status ?? 'paid',
      overrides.paymentStatus ?? 'paid',
      'transfer',
      overrides.fulfillmentStatus ?? 'unfulfilled',
      10000,
      1000,
      0,
      9000,
      overrides.shippingMethod ?? 'pickup',
      '1000',
      'Retiro en tienda',
      'Buenos Aires',
      'CABA',
      '',
      'hash',
      `TR-${orderId}`,
      `bank-${orderId}`,
      '',
      '2026-12-31T12:00:00Z',
      '2026-09-08T12:00:00Z',
      '2026-09-08T12:00:00Z',
      '2026-09-08T12:00:00Z',
    );
  database
    .prepare(
      `INSERT INTO online_order_items(id,orderId,variantId,productName,sku,color,size,quantity,unitPrice,lineTotal)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(crypto.randomUUID(), orderId, 'variant', 'Camisa', 'TEST', 'Azul', 'L', 1, 10000, 10000);
  return orderId;
}

test('la API POS entrega solo los datos operativos mínimos', async (t) => {
  const { database, load } = fixture(t);
  database.prepare("INSERT INTO users(id,email,name,role,active) VALUES (?,?,?,?,1)").run(
    seller.id,
    seller.email,
    seller.name,
    seller.role,
  );
  const orderId = seedOrder(database);
  seedOrder(database, {
    id: crypto.randomUUID(),
    orderNumber: 1002,
    status: 'awaiting_payment',
    paymentStatus: 'pending',
  });
  const service = load('lib/online-store.ts');
  const list = await service.listPosOnlineOrders(seller);
  assert.equal(list.length, 1);
  const detail = await service.listPosOnlineOrders(seller, orderId);
  for (const hidden of [
    'email',
    'total',
    'subtotal',
    'discount',
    'paymentMethod',
    'paymentReference',
    'transferReference',
    'couponCode',
    'attributionJson',
  ]) assert.equal(hidden in detail, false, `${hidden} no debe salir en la API POS`);
  assert.equal('unitPrice' in detail.items[0], false);
  assert.equal('lineTotal' in detail.items[0], false);
  assert.equal('cost' in detail.items[0], false);
  await assert.rejects(() => service.listOnlineOrders(seller), /Acceso denegado/);
});

test('el vendedor prepara, marca listo y entrega un retiro pago', async (t) => {
  const { database, load } = fixture(t);
  database.prepare("INSERT INTO users(id,email,name,role,active) VALUES (?,?,?,?,1)").run(
    seller.id,
    seller.email,
    seller.name,
    seller.role,
  );
  const orderId = seedOrder(database);
  const service = load('lib/online-store.ts');
  let detail = await service.posOnlineOrderWrite(seller, { action: 'prepare', orderId });
  assert.equal(detail.fulfillmentStatus, 'preparing');
  detail = await service.posOnlineOrderWrite(seller, { action: 'ready-pickup', orderId });
  assert.equal(detail.fulfillmentStatus, 'ready_pickup');
  detail = await service.posOnlineOrderWrite(seller, { action: 'deliver', orderId });
  assert.equal(detail.fulfillmentStatus, 'delivered');
  assert.equal(detail.status, 'completed');
  const events = database
    .prepare('SELECT kind,actorId FROM online_order_events WHERE orderId=? ORDER BY createdAt,rowid')
    .all(orderId);
  assert.deepEqual(
    events.map((event) => event.kind),
    ['preparing', 'ready_pickup', 'delivered'],
  );
  assert.ok(events.every((event) => event.actorId === seller.id));
});

test('el POS bloquea saltos de estado y acciones sobre envíos', async (t) => {
  const { database, load } = fixture(t);
  database.prepare("INSERT INTO users(id,email,name,role,active) VALUES (?,?,?,?,1)").run(
    seller.id,
    seller.email,
    seller.name,
    seller.role,
  );
  const orderId = seedOrder(database, { shippingMethod: 'correo-argentino-home' });
  const service = load('lib/online-store.ts');
  await assert.rejects(
    () => service.posOnlineOrderWrite(seller, { action: 'deliver', orderId }),
    /Solo se puede entregar/,
  );
  await service.posOnlineOrderWrite(seller, { action: 'prepare', orderId });
  await assert.rejects(
    () => service.posOnlineOrderWrite(seller, { action: 'ready-pickup', orderId }),
    /solamente a retiros/,
  );
});
