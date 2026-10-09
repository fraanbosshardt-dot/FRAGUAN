import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, actor } from './tests-cashback-regressions.mjs';

test('web checkout stores its own commission and date without changing Point or duplicating payments', async (t) => {
  const f = fixture(t);
  f.database.exec(`INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,updatedAt)
    VALUES ('product','camisa-comisiones','Una camisa para todos los días.','Descripción real de la camisa.','Regular','Camisas','2026-01-01T12:00:00Z');
    INSERT INTO payment_methods(id,name,commissionBps,days,destination) VALUES ('credit','Crédito',440,10,'Mercado Pago'),('transfer','Transferencia',0,0,'Mercado Pago');`);
  const store = f.load('lib/online-store.ts');
  const input = { items: [{ variantId: 'variant', quantity: 1 }], email: 'test@example.test',
    customerName: 'Cliente Prueba', phone: '1122334455', paymentMethod: 'card', shippingMethod: 'pickup',
    postalCode: '1000', address: 'Retiro en local', city: 'Buenos Aires', province: 'CABA', notes: '',
    idempotencyKey: crypto.randomUUID(), accessToken: crypto.randomUUID() };
  const order = await store.createOnlineOrder(new Request('http://localhost'), input);
  await store.confirmOnlinePayment(actor, order.id, 'TEST-PAYMENT');
  const payment = f.database.prepare('SELECT p.* FROM payments p JOIN sales s ON s.id=p.saleId WHERE s.onlineOrderId=?').get(order.id);
  assert.equal(payment.methodId, 'online-mp');
  assert.equal(payment.commission, Math.round(order.total * 339 / 10000));
  assert.equal(payment.net, order.total - payment.commission);
  const paid = f.database.prepare('SELECT paidAt FROM online_orders WHERE id=?').get(order.id);
  assert.equal(Date.parse(payment.dueAt) - Date.parse(paid.paidAt), 18 * 86400000);
  f.database.exec("UPDATE payment_methods SET commissionBps=300,days=10 WHERE id='online-mp'");
  await store.confirmOnlinePayment(actor, order.id, 'TEST-PAYMENT');
  assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM payments WHERE saleId=?').get(payment.saleId).n, 1);
  assert.equal(f.database.prepare('SELECT commission FROM payments WHERE id=?').get(payment.id).commission, payment.commission);
  assert.equal(f.database.prepare("SELECT commissionBps FROM payment_methods WHERE id='credit'").get().commissionBps, 440);
});
