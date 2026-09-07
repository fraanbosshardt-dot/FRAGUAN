import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actor, fixture } from './tests-cashback-regressions.mjs';

test('online checkout reserves stock, identifies transfers and becomes one connected sale', async (t) => {
  const f = fixture(t);
  f.database.exec(`
    INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-prueba','Una camisa lista para todos los días.','Descripción completa de la camisa para comprar online.','Regular','Camisas','2026-01-01T12:00:00Z');
    UPDATE variants SET onlinePrice=12500 WHERE id='variant';
    INSERT INTO payment_methods(id,name) VALUES ('transfer','Transferencia'),('credit','Tarjeta');
  `);
  const store = f.load('lib/online-store.ts');
  const request = new Request('http://localhost/api/store-checkout', {
    headers: { Origin: 'http://localhost' },
  });
  const accessToken = crypto.randomUUID();
  const order = await store.createOnlineOrder(request, {
    items: [{ variantId: 'variant', quantity: 2 }],
    email: 'comprador@example.com',
    customerName: 'Cliente Online',
    phone: '1122334455',
    paymentMethod: 'transfer',
    shippingMethod: 'correo-argentino-home',
    postalCode: '1000',
    address: 'Calle 123',
    city: 'Buenos Aires',
    province: 'CABA',
    notes: '',
    idempotencyKey: crypto.randomUUID(),
    accessToken,
  });
  assert.equal(order.subtotal, 25000);
  assert.equal(order.discount, 2500);
  assert.match(order.transferReference, /^FRG-1001-/);
  assert.equal(
    f.database
      .prepare(
        "SELECT SUM(quantity) AS quantity FROM stock_reservations WHERE status='active'",
      )
      .get().quantity,
    2,
  );
  const reported = await store.reportTransfer(request, {
    orderId: order.id,
    accessToken,
    transactionId: 'BANK-778899',
  });
  assert.equal(reported.paymentStatus, 'reported');
  await store.onlineOrderWrite(actor, {
    action: 'mark-paid',
    orderId: order.id,
    paymentReference: 'BANK-778899',
  });
  assert.equal(
    f.database.prepare("SELECT stock FROM variants WHERE id='variant'").get()
      .stock,
    98,
  );
  assert.deepEqual(
    {
      ...f.database
        .prepare(
          'SELECT channel,onlineOrderId,total FROM sales WHERE onlineOrderId=?',
        )
        .get(order.id),
    },
    { channel: 'online', onlineOrderId: order.id, total: order.total },
  );
  assert.deepEqual(
    {
      ...f.database
        .prepare("SELECT price,onlinePrice FROM variants WHERE id='variant'")
        .get(),
    },
    { price: 10000, onlinePrice: 12500 },
  );
  assert.equal(
    f.database
      .prepare(
        'SELECT price FROM sale_items WHERE saleId=(SELECT id FROM sales WHERE onlineOrderId=?)',
      )
      .get(order.id).price,
    12500,
  );
  assert.equal(
    f.database
      .prepare('SELECT status FROM stock_reservations WHERE orderId=?')
      .get(order.id).status,
    'consumed',
  );
  await assert.rejects(
    () => store.listOnlineOrders({ ...actor, role: 'VENDEDOR' }),
    /Acceso denegado/,
  );
});

test('online reservation guard prevents overselling across simultaneous orders', async (t) => {
  const f = fixture(t);
  f.database
    .exec(`UPDATE variants SET stock=30 WHERE id='variant'; UPDATE variant_location_stock SET quantity=30 WHERE variantId='variant';
    INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-prueba','Una camisa lista para todos los días.','Descripción completa de la camisa para comprar online.','Regular','Camisas','2026-01-01T12:00:00Z')`);
  const store = f.load('lib/online-store.ts');
  const request = new Request('http://localhost/api/store-checkout');
  const input = (quantity) => ({
    items: [{ variantId: 'variant', quantity }],
    email: 'cliente@example.com',
    customerName: 'Cliente Online',
    phone: '1122334455',
    paymentMethod: 'card',
    shippingMethod: 'pickup',
    postalCode: '1000',
    address: 'Retiro en local',
    city: 'Buenos Aires',
    province: 'CABA',
    notes: '',
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  });
  await store.createOnlineOrder(request, input(20));
  await assert.rejects(
    () => store.createOnlineOrder(request, input(11)),
    /stock/i,
  );
  assert.equal(
    f.database
      .prepare(
        "SELECT SUM(quantity) AS quantity FROM stock_reservations WHERE status='active'",
      )
      .get().quantity,
    20,
  );
});

test('customer account connects an online order with Club cashback and history', async (t) => {
  const f = fixture(t, { rate: 100 });
  f.database.exec(`
    INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-club','Una camisa lista para todos los días.','Descripción completa de la camisa para comprar online.','Regular','Camisas','2026-01-01T12:00:00Z');
    INSERT INTO payment_methods(id,name) VALUES ('transfer','Transferencia'),('credit','Tarjeta');
  `);
  const store = f.load('lib/online-store.ts');
  const registration = await store.storeAccountWrite(
    new Request('http://localhost/api/store-account'),
    {
      action: 'register',
      email: 'socio@example.com',
      password: 'clave-segura-123',
      name: 'Socio',
      surname: 'Fraguan',
      phone: '1122334455',
      marketingConsent: true,
    },
  );
  const request = new Request('http://localhost/api/store-checkout', {
    headers: { cookie: registration.cookie.split(';')[0] },
  });
  const order = await store.createOnlineOrder(request, {
    items: [{ variantId: 'variant', quantity: 1 }],
    email: 'otro@example.com',
    customerName: 'Otro Nombre',
    phone: '1199999999',
    paymentMethod: 'transfer',
    shippingMethod: 'pickup',
    postalCode: '1000',
    address: 'Retiro en local',
    city: 'Buenos Aires',
    province: 'CABA',
    notes: '',
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  });
  await store.confirmOnlinePayment(actor, order.id, 'BANK-CLUB-1');
  const account = await store.storeAccount(request);
  assert.equal(account.orders[0].id, order.id);
  assert.equal(account.cashback, 90);
  assert.equal(
    f.database
      .prepare('SELECT email FROM customers WHERE id=?')
      .get(order.customerId).email,
    'socio@example.com',
  );
});

test('signed-provider callback reconciles a transfer once by reference and amount', async (t) => {
  const f = fixture(t);
  f.database.exec(`
    INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-webhook','Una camisa lista para todos los días.','Descripción completa de la camisa para comprar online.','Regular','Camisas','2026-01-01T12:00:00Z');
    INSERT INTO payment_methods(id,name) VALUES ('transfer','Transferencia'),('credit','Tarjeta');
    INSERT INTO settings(key,value) VALUES ('owner','test@example.test');
  `);
  const store = f.load('lib/online-store.ts');
  const order = await store.createOnlineOrder(new Request('http://localhost'), {
    items: [{ variantId: 'variant', quantity: 1 }],
    email: 'pago@example.com',
    customerName: 'Pago Automático',
    phone: '1122334455',
    paymentMethod: 'transfer',
    shippingMethod: 'pickup',
    postalCode: '1000',
    address: 'Retiro en local',
    city: 'Buenos Aires',
    province: 'CABA',
    notes: '',
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  });
  const callback = {
    provider: 'bank',
    eventId: 'bank:evt-1',
    reference: order.transferReference,
    status: 'accredited',
    amount: order.total,
    payload: { safe: true },
  };
  assert.equal(
    (await store.confirmOnlinePaymentWebhook(callback)).paymentStatus,
    'paid',
  );
  assert.equal(
    (await store.confirmOnlinePaymentWebhook(callback)).duplicate,
    true,
  );
  assert.equal(
    f.database
      .prepare('SELECT COUNT(*) AS total FROM sales WHERE onlineOrderId=?')
      .get(order.id).total,
    1,
  );
});
