import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentReceiptProps } from './lib/store-payment-receipt.ts';

const order = {
  id: 'receipt-test',
  orderNumber: 1054,
  paymentStatus: 'paid',
  paymentMethod: 'transfer',
  subtotal: 15990050,
  discount: 1599005,
  shipping: 250050,
  total: 14641095,
  items: [
    {
      productName: 'Camisa Oxford',
      color: 'Blanco',
      size: 'M',
      unitPrice: 15990050,
      quantity: 1,
    },
  ],
};
test('receipt uses persisted order amounts, cents and quantities', () => {
  const receipt = paymentReceiptProps(order);
  assert.equal(receipt.status, 'approved');
  assert.equal(receipt.pedido, 1054);
  assert.equal(receipt.subtotal, 159900.5);
  assert.equal(receipt.descuento, 15990.05);
  assert.equal(receipt.envio, 2500.5);
  assert.equal(receipt.total, 146410.95);
  assert.deepEqual(receipt.items[0], {
    nombre: 'Camisa Oxford',
    variante: 'Blanco',
    talle: 'M',
    precio: 159900.5,
    cantidad: 1,
  });
});
test('a reported transfer is processing, never approved', () => {
  assert.equal(
    paymentReceiptProps({ ...order, paymentStatus: 'reported' }, true).status,
    'processing',
  );
  assert.equal(
    paymentReceiptProps({ ...order, paymentStatus: 'pending' }),
    null,
  );
});
test('failed, refunded or cancelled payments never show an approved receipt', () => {
  for (const paymentStatus of ['failed', 'refunded'])
    assert.equal(paymentReceiptProps({ ...order, paymentStatus }, true), null);
  assert.equal(
    paymentReceiptProps({ ...order, status: 'cancelled' }, true),
    null,
  );
});
