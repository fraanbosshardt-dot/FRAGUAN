import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actor, fixture } from './tests-cashback-regressions.mjs';

function publish(f) {
  f.database.exec(`
    INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-growth','Camisa lista para combinar.','Descripción completa para la tienda online.','Regular','Camisas','2026-01-01T12:00:00Z');
    INSERT INTO payment_methods(id,name) VALUES ('transfer','Transferencia'),('credit','Tarjeta');
  `);
}

test('store funnel records consented activity and restores a persisted cart', async (t) => {
  const f = fixture(t); publish(f);
  const growth = f.load('lib/store-growth.ts');
  const sessionId = crypto.randomUUID();
  await growth.trackStoreEvent(new Request('http://localhost'), {
    sessionId, event: 'begin_checkout', path: '/checkout', value: 10000,
    source: 'newsletter', medium: 'email', campaign: 'drop-01', email: 'cliente@example.com',
    cart: [{ variantId: 'variant', productName: 'Camisa', slug: 'camisa-growth', color: 'Azul', size: 'M', price: 10000, quantity: 1 }],
    metadata: {},
  });
  const saved = f.database.prepare('SELECT recoveryToken FROM abandoned_carts WHERE sessionId=?').get(sessionId);
  const restored = await growth.recoverCart(saved.recoveryToken);
  assert.equal(restored.cart[0].variantId, 'variant');
  const dashboard = await growth.storeGrowthDashboard(actor);
  assert.equal(dashboard.funnel.checkout, 1);
  assert.equal(dashboard.sources[0].campaign, 'drop-01');
  await assert.rejects(() => growth.storeGrowthDashboard({ ...actor, role: 'VENDEDOR' }), /Acceso denegado/);
});

test('online coupon uses online prices and is preserved in the connected sale', async (t) => {
  const f = fixture(t); publish(f);
  f.database.exec(`
    UPDATE variants SET onlinePrice=20000 WHERE id='variant';
    INSERT INTO promotions(id,name,percent,startsAt,endsAt,active,ruleJson)
    VALUES ('online-coupon','BIENVENIDA',15,'2026-01-01','2030-01-01',1,
    '{"kind":"percentage","percentBps":1500,"conditions":{"couponCodes":["HOLA15"]}}');
  `);
  const store = f.load('lib/online-store.ts');
  const sessionId = crypto.randomUUID();
  const quote = await store.quoteOnlineCoupon({ items: [{ variantId: 'variant', quantity: 1 }], couponCode: 'HOLA15', paymentMethod: 'card' });
  assert.equal(quote.discount, 3000);
  const order = await store.createOnlineOrder(new Request('http://localhost'), {
    items: [{ variantId: 'variant', quantity: 1 }], email: 'cupon@example.com', customerName: 'Cliente Cupón', phone: '1122334455',
    paymentMethod: 'card', shippingMethod: 'pickup', postalCode: '1000', address: 'Retiro en local', city: 'Buenos Aires', province: 'CABA',
    notes: '', couponCode: 'HOLA15', attribution: { source: 'newsletter', medium: 'email', campaign: 'coupon-test' }, sessionId,
    idempotencyKey: crypto.randomUUID(), accessToken: crypto.randomUUID(),
  });
  assert.equal(order.discount, 3000);
  await store.confirmOnlinePayment(actor, order.id, 'MP-1');
  assert.equal(f.database.prepare('SELECT couponCode FROM sales WHERE onlineOrderId=?').get(order.id).couponCode, 'HOLA15');
  assert.equal(f.database.prepare("SELECT COUNT(*) AS total FROM store_events WHERE orderId=? AND event='purchase'").get(order.id).total, 1);
});

test('reviews remain private until an authorized moderation action', async (t) => {
  const f = fixture(t); publish(f);
  const growth = f.load('lib/store-growth.ts');
  await growth.submitProductReview(new Request('http://localhost'), {
    productId: 'product', orderId: '', email: 'opinion@example.com', displayName: 'Fran', rating: 5,
    title: 'Muy buena', body: 'El talle coincide y la tela se siente muy bien.',
  });
  assert.equal((await growth.publicProductReviews('product')).total, 0);
  const reviewId = f.database.prepare('SELECT id FROM product_reviews').get().id;
  await growth.moderateReview(actor, { reviewId, status: 'published' });
  assert.equal((await growth.publicProductReviews('product')).total, 1);
});
