import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};
async function request(path, body) {
  const response = await fetch(origin + '/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
function sql(command) {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.local.jsonc',
      '--command',
      command,
    ],
    { stdio: 'pipe' },
  );
}

const session = await request('session');
assert.equal(session.status, 200);
assert.equal(session.body.user.id, 'local_seedy');

for (const resource of [
  'cash-flow',
  'financial-calendar',
  'customer-intelligence',
  'replenishment',
]) {
  const result = await request(resource);
  assert.equal(
    result.status,
    200,
    `${resource}: ${JSON.stringify(result.body)}`,
  );
}
const replenishment = await request('replenishment');
assert(!JSON.stringify(replenishment.body).includes('cost'));
assert(!JSON.stringify(replenishment.body).includes('image'));

const products = (await request('products')).body;
const variants = products.filter((item) => item.stock >= 4).slice(0, 2);
assert.equal(
  variants.length,
  2,
  'Se necesitan dos variantes con stock de prueba.',
);
const variant = variants[0];
const supplier = (await request('suppliers')).body[0];

const promotion = await request('promotions', {
  name: `2x1 integración ${crypto.randomUUID().slice(0, 8)}`,
  kind: 'two_for_one',
  methodId: null,
  startsAt: '2020-01-01',
  endsAt: '2099-12-31',
  category: variant.category,
  brand: null,
  couponCode: null,
  customerLevel: null,
  birthday: false,
  birthdayDays: 0,
  priority: 10,
  exclusive: true,
  groupBy: 'line',
});
assert.equal(promotion.status, 201, JSON.stringify(promotion.body));

const customer = await request('customers', {
  name: 'Cliente',
  surname: 'Integración avanzada',
  phone: `11${Date.now()}`,
});
assert.equal(customer.status, 201);
const pricing = await request('pricing', {
  items: [{ variantId: variant.id, quantity: 2 }],
  customerId: customer.body.id,
  promotionId: null,
  promotionIds: [promotion.body.id],
  methodIds: ['cash'],
});
assert.equal(pricing.status, 200, JSON.stringify(pricing.body));
assert.equal(pricing.body.discount, variant.price);
assert.equal(pricing.body.base, variant.price);

const promotedSale = await request('sales', {
  items: [{ variantId: variant.id, quantity: 2 }],
  customerId: customer.body.id,
  promotionId: null,
  promotionIds: [promotion.body.id],
  payments: [
    {
      methodId: 'cash',
      baseMinor: pricing.body.base,
      receivedMinor: pricing.body.base,
    },
  ],
  idempotencyKey: crypto.randomUUID(),
});
assert.equal(promotedSale.status, 201, JSON.stringify(promotedSale.body));
assert.equal(promotedSale.body.discount, variant.price);
const saleItem = promotedSale.body.items[0];

const authorization = await request('refund-authorizations', {
  saleId: promotedSale.body.id,
  maxAmount: promotedSale.body.total,
});
assert.equal(authorization.status, 201);
try {
  sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
  for (const denied of [
    'cash-flow',
    'financial-calendar',
    'customer-intelligence',
    'replenishment',
    'customer-credits',
  ])
    assert.equal((await request(denied)).status, 403, denied);
  const sellerCatalog = await request('catalog');
  assert.equal(sellerCatalog.status, 200);
  assert(!JSON.stringify(sellerCatalog.body).includes('cost'));
  const partialRefund = await request('refunds', {
    saleId: promotedSale.body.id,
    reason: 'Cambio parcial autorizado',
    method: 'credit',
    items: [{ saleItemId: saleItem.id, quantity: 1 }],
    authorizationToken: authorization.body.token,
  });
  assert.equal(partialRefund.status, 200, JSON.stringify(partialRefund.body));
  assert.equal(partialRefund.body.status, 'partially_refunded');
  assert(partialRefund.body.creditIssued > 0);
  const repeated = await request('refunds', {
    saleId: promotedSale.body.id,
    reason: 'Intento de reutilizar autorización',
    method: 'credit',
    items: [{ saleItemId: saleItem.id, quantity: 1 }],
    authorizationToken: authorization.body.token,
  });
  assert.equal(repeated.status, 403);
} finally {
  sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
}

const creditBeforeUse = await request(
  `customer-credit-balance?customerId=${customer.body.id}`,
);
assert(creditBeforeUse.body.balance > 0);
const creditAmount = creditBeforeUse.body.balance;
assert(creditAmount < variant.price);
const creditSale = await request('sales', {
  items: [{ variantId: variant.id, quantity: 1 }],
  customerId: customer.body.id,
  promotionId: null,
  promotionIds: [],
  payments: [
    { methodId: 'store_credit', baseMinor: creditAmount },
    {
      methodId: 'cash',
      baseMinor: variant.price - creditAmount,
      receivedMinor: variant.price - creditAmount,
    },
  ],
  idempotencyKey: crypto.randomUUID(),
});
assert.equal(creditSale.status, 201, JSON.stringify(creditSale.body));
assert.equal(
  (await request(`customer-credit-balance?customerId=${customer.body.id}`)).body
    .balance,
  0,
);
const restoredCredit = await request('refunds', {
  saleId: creditSale.body.id,
  reason: 'Restaurar pago con saldo a favor',
  method: 'original',
});
assert.equal(restoredCredit.status, 200, JSON.stringify(restoredCredit.body));
assert.equal(restoredCredit.body.creditIssued, creditAmount);

const purchaseKey = crypto.randomUUID();
const purchase = await request('purchases', {
  supplierId: supplier.id,
  dueAt: '2026-11-15',
  items: [
    {
      variantId: variants[0].id,
      quantity: 2,
      cost: variants[0].cost,
      discount: 0,
    },
    {
      variantId: variants[1].id,
      quantity: 1,
      cost: variants[1].cost,
      discount: 0,
    },
  ],
  discount: 100,
  tax: 200,
  shipping: 300,
  paymentMethod: 'cuenta_corriente',
  supplierReference: `TEST-${Date.now()}`,
  notes: 'Orden avanzada de integración',
  idempotencyKey: purchaseKey,
});
assert.equal(purchase.status, 201, JSON.stringify(purchase.body));
const purchaseRetry = await request('purchases', {
  supplierId: supplier.id,
  dueAt: '2026-11-15',
  items: [
    {
      variantId: variants[0].id,
      quantity: 2,
      cost: variants[0].cost,
      discount: 0,
    },
    {
      variantId: variants[1].id,
      quantity: 1,
      cost: variants[1].cost,
      discount: 0,
    },
  ],
  discount: 100,
  tax: 200,
  shipping: 300,
  paymentMethod: 'cuenta_corriente',
  supplierReference: purchase.body.supplierReference,
  notes: 'Orden avanzada de integración',
  idempotencyKey: purchaseKey,
});
assert.equal(purchaseRetry.status, 201);
assert.equal(purchaseRetry.body.id, purchase.body.id);

assert.equal(
  (
    await request('purchase-transitions', {
      purchaseId: purchase.body.id,
      action: 'send',
    })
  ).body.status,
  'sent',
);
const confirmedPurchase = await request('purchase-transitions', {
  purchaseId: purchase.body.id,
  action: 'confirm',
});
assert.equal(confirmedPurchase.body.status, 'confirmed');
const firstLine = confirmedPurchase.body.items[0];
const stockBeforeReceipt = (await request('products')).body.find(
  (item) => item.id === firstLine.variantId,
).stock;
const firstReceiptBody = {
  purchaseId: purchase.body.id,
  items: [{ purchaseItemId: firstLine.id, quantity: 1 }],
  notes: 'Primera entrega parcial',
  idempotencyKey: crypto.randomUUID(),
};
const firstReceipt = await request('purchase-receipts', firstReceiptBody);
assert.equal(firstReceipt.status, 200, JSON.stringify(firstReceipt.body));
assert.equal(firstReceipt.body.status, 'partially_received');
assert.equal(
  (await request('products')).body.find(
    (item) => item.id === firstLine.variantId,
  ).stock,
  stockBeforeReceipt + 1,
);
const receiptRetry = await request('purchase-receipts', firstReceiptBody);
assert.equal(receiptRetry.status, 200);
assert.equal(
  (await request('products')).body.find(
    (item) => item.id === firstLine.variantId,
  ).stock,
  stockBeforeReceipt + 1,
);
const remainingItems = firstReceipt.body.items
  .filter((item) => item.quantity > item.received)
  .map((item) => ({
    purchaseItemId: item.id,
    quantity: item.quantity - item.received,
  }));
const finalReceipt = await request('purchase-receipts', {
  purchaseId: purchase.body.id,
  items: remainingItems,
  notes: 'Entrega final',
  idempotencyKey: crypto.randomUUID(),
});
assert.equal(finalReceipt.status, 200, JSON.stringify(finalReceipt.body));
assert.equal(finalReceipt.body.status, 'received');
const purchasePayables = (await request('payables')).body.filter(
  (payable) => payable.purchaseId === purchase.body.id,
);
assert.equal(purchasePayables.length, 1);

console.log(
  'PASS: advanced promotions, server pricing, seller authorization, partial credits, credit reuse, protected analytics, multi-line purchases and partial receipts.',
);
