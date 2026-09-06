import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};

async function request(path, body, extraHeaders = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...headers, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { error: raw };
  }
  return {
    status: response.status,
    body: parsed,
    cacheControl: response.headers.get('cache-control'),
  };
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

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizedKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const forbiddenSellerKey =
  /(^|_)(cost|costo|margin|margen|markup|profit|ganancia|profitability|rentabilidad|commission|comision|image|imagen|photo|foto|picture|thumbnail)(_|$)/;

function assertSellerSafe(label, value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSellerSafe(label, item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(
      forbiddenSellerKey.test(normalizedKey(key)),
      false,
      `${label} expuso el campo interno ${path}.${key}`,
    );
    assertSellerSafe(label, nested, `${path}.${key}`);
  }
}

function assertExactKeys(label, value, expected) {
  assert(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(
    Object.keys(value).sort((a, b) => a.localeCompare(b)),
    [...expected].sort((a, b) => a.localeCompare(b)),
    `${label}: cambió el contrato de campos`,
  );
}

function assertNoStore(label, response) {
  assert.match(
    response.cacheControl ?? '',
    /(?:^|,)\s*(?:private|no-store)(?:\s|,|$)/,
    `${label}: la respuesta autenticada debe impedir caché pública`,
  );
}

async function expectDenied(path, body, extraHeaders) {
  const response = await request(path, body, extraHeaders);
  assert.equal(
    response.status,
    403,
    `${path} debe estar denegado para VENDEDOR: ${JSON.stringify(response.body)}`,
  );
  assert.equal(response.body.error, 'Acceso denegado.', path);
  assertNoStore(path, response);
  return response;
}

const initialSession = await request('session');
assert.equal(initialSession.status, 200, JSON.stringify(initialSession.body));
assert.equal(
  initialSession.body.user.id,
  'local_seedy',
  'Este contrato se ejecuta únicamente contra la base demo local.',
);
assert(
  ['ADMIN', 'GERENTE'].includes(initialSession.body.user.role),
  'La identidad demo debe comenzar con acceso administrativo para preparar la prueba.',
);

const originalRole = initialSession.body.user.role;
const allSalesAsAdmin = await request('sales');
assert.equal(allSalesAsAdmin.status, 200, JSON.stringify(allSalesAsAdmin.body));
const anotherSellerSale = allSalesAsAdmin.body.find(
  (sale) => sale.sellerName !== initialSession.body.user.name,
);
assert(
  anotherSellerSale,
  'La base demo necesita al menos una venta de otro vendedor.',
);

let createdCustomerId = null;
sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");

try {
  const session = await request('session');
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.equal(session.body.user.role, 'VENDEDOR');
  assert.deepEqual(
    [...session.body.permissions].sort((a, b) => a.localeCompare(b)),
    ['customers', 'pos'],
  );
  assertSellerSafe('session', session.body);
  assertNoStore('session', session);

  const catalog = await request('catalog');
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
  assert(catalog.body.length > 0, 'El catálogo demo no puede estar vacío.');
  for (const variant of catalog.body)
    assertExactKeys('catalog', variant, [
      'id',
      'productId',
      'name',
      'category',
      'brand',
      'sku',
      'barcode',
      'color',
      'size',
      'price',
      'stock',
    ]);
  assertSellerSafe('catalog', catalog.body);
  assertNoStore('catalog', catalog);

  const methods = await request('methods');
  assert.equal(methods.status, 200, JSON.stringify(methods.body));
  assert(methods.body.length > 0, 'Deben existir medios de pago activos.');
  for (const method of methods.body)
    assertExactKeys('methods', method, [
      'id',
      'name',
      'surchargeBps',
      'installments',
    ]);
  assertSellerSafe('methods', methods.body);

  const offers = await request('offers');
  assert.equal(offers.status, 200, JSON.stringify(offers.body));
  for (const offer of offers.body)
    assertExactKeys('offers', offer, [
      'id',
      'name',
      'percent',
      'methodId',
      'kind',
      'exclusive',
    ]);
  assertSellerSafe('offers', offers.body);

  const emptyCustomerEnumeration = await request('customers');
  assert.equal(emptyCustomerEnumeration.status, 200);
  assert.deepEqual(
    emptyCustomerEnumeration.body,
    [],
    'VENDEDOR no debe poder enumerar toda la cartera de clientes.',
  );

  const customerPhone = `11${Date.now()}`;
  const createdCustomer = await request('customers', {
    name: 'Contrato',
    surname: `Vendedor ${crypto.randomUUID().slice(0, 8)}`,
    phone: customerPhone,
  });
  assert.equal(
    createdCustomer.status,
    201,
    JSON.stringify(createdCustomer.body),
  );
  createdCustomerId = createdCustomer.body.id;
  assertExactKeys('customers POST', createdCustomer.body, [
    'id',
    'name',
    'surname',
    'phone',
  ]);
  assertSellerSafe('customers POST', createdCustomer.body);

  const customerSearch = await request(
    `customers?q=${encodeURIComponent(customerPhone)}`,
  );
  assert.equal(customerSearch.status, 200, JSON.stringify(customerSearch.body));
  assert.equal(customerSearch.body.length, 1);
  for (const customer of customerSearch.body)
    assertExactKeys('customers GET', customer, [
      'id',
      'name',
      'surname',
      'phone',
    ]);
  assertSellerSafe('customers GET', customerSearch.body);

  const credit = await request(
    `customer-credit-balance?customerId=${encodeURIComponent(createdCustomerId)}`,
  );
  assert.equal(credit.status, 200, JSON.stringify(credit.body));
  assertExactKeys('customer-credit-balance', credit.body, [
    'balance',
    'cashbackBalance',
  ]);
  assertSellerSafe('customer-credit-balance', credit.body);

  const sellableVariant = catalog.body.find((variant) => variant.stock > 0);
  assert(sellableVariant, 'Se necesita una variante con stock para cotizar.');
  const pricingPayload = {
    items: [{ variantId: sellableVariant.id, quantity: 1 }],
    customerId: createdCustomerId,
    promotionId: null,
    promotionIds: [],
    methodIds: ['cash'],
  };
  const pricing = await request('pricing', pricingPayload);
  assert.equal(pricing.status, 200, JSON.stringify(pricing.body));
  assertExactKeys('pricing', pricing.body, [
    'subtotal',
    'discount',
    'base',
    'appliedDiscounts',
  ]);
  for (const discount of pricing.body.appliedDiscounts)
    assertExactKeys('pricing.appliedDiscounts', discount, [
      'promotionId',
      'name',
      'kind',
      'amount',
    ]);
  assertSellerSafe('pricing', pricing.body);

  const quote = await request('quote', {
    items: pricingPayload.items,
    customerId: createdCustomerId,
    promotionId: null,
    promotionIds: [],
    payments: [
      {
        methodId: 'cash',
        baseMinor: pricing.body.base,
        receivedMinor: pricing.body.base,
      },
    ],
  });
  assert.equal(quote.status, 200, JSON.stringify(quote.body));
  assertExactKeys('quote', quote.body, [
    'subtotal',
    'discount',
    'base',
    'total',
    'appliedDiscounts',
    'payments',
  ]);
  for (const payment of quote.body.payments)
    assertExactKeys('quote.payments', payment, [
      'methodId',
      'name',
      'amount',
      'installments',
      'change',
    ]);
  assertSellerSafe('quote', quote.body);

  const ownSales = await request('sales');
  assert.equal(ownSales.status, 200, JSON.stringify(ownSales.body));
  assert(
    ownSales.body.length > 0,
    'VENDEDOR debe poder consultar ventas propias recientes.',
  );
  for (const sale of ownSales.body)
    assertExactKeys('own sales', sale, [
      'id',
      'ticket',
      'total',
      'createdAt',
      'status',
    ]);
  assertSellerSafe('own sales', ownSales.body);

  const attemptedSellerFilter = await request('sales?sellerId=seller-demo');
  assert.equal(attemptedSellerFilter.status, 200);
  assert.deepEqual(
    attemptedSellerFilter.body.map((sale) => sale.id),
    ownSales.body.map((sale) => sale.id),
    'Un parámetro sellerId no debe ampliar las ventas propias.',
  );

  const ownConfirmedSale = ownSales.body.find(
    (sale) => sale.status === 'confirmed',
  );
  assert(
    ownConfirmedSale,
    'Se necesita una venta propia confirmada en la demo.',
  );
  const ownSaleDetail = await request(
    `sales?id=${encodeURIComponent(ownConfirmedSale.id)}`,
  );
  assert.equal(ownSaleDetail.status, 200, JSON.stringify(ownSaleDetail.body));
  assert.equal(ownSaleDetail.body.sellerId, session.body.user.id);
  assertExactKeys('own sale detail', ownSaleDetail.body, [
    'id',
    'ticket',
    'sellerId',
    'createdAt',
    'subtotal',
    'discount',
    'total',
    'status',
    'customerName',
    'customerSurname',
    'sellerName',
    'items',
    'payments',
  ]);
  for (const item of ownSaleDetail.body.items)
    assertExactKeys('own sale detail items', item, [
      'id',
      'variantId',
      'name',
      'color',
      'size',
      'quantity',
      'price',
      'refunded',
    ]);
  for (const payment of ownSaleDetail.body.payments)
    assertExactKeys('own sale detail payments', payment, [
      'amount',
      'reference',
      'name',
    ]);
  assertSellerSafe('own sale detail', ownSaleDetail.body);

  await expectDenied(`sales?id=${encodeURIComponent(anotherSellerSale.id)}`);

  const unauthorizedRefund = await request('refunds', {
    saleId: ownSaleDetail.body.id,
    reason: 'Devolución sin autorización gerencial',
    method: 'original',
    items: [
      {
        saleItemId: ownSaleDetail.body.items[0].id,
        quantity: 1,
      },
    ],
  });
  assert.equal(
    unauthorizedRefund.status,
    403,
    JSON.stringify(unauthorizedRefund.body),
  );
  assert.match(unauthorizedRefund.body.error, /requiere autorización/i);

  for (const resource of [
    'dashboard',
    'products',
    'stock',
    'stock-movements',
    'replenishment',
    'suppliers',
    'purchases',
    'expenses',
    'withdrawals',
    'payables',
    'cash',
    'cash-flow',
    'financial-calendar',
    'financial-plans',
    'promotions',
    'reports',
    'insights',
    'customer-intelligence',
    'customer-cashback',
    'banking',
    'club-rewards',
    'access',
    'global-search',
    'communications',
    'seller-commissions',
    'supplier-history',
    'customer-credits',
    'inventory',
    'users',
    'audit',
    'settings',
  ])
    await expectDenied(resource);

  await expectDenied('dashboard', undefined, {
    'X-Role': 'ADMIN',
    'X-User-Role': 'ADMIN',
  });

  for (const [resource, body] of [
    ['products', {}],
    ['stock', {}],
    ['suppliers', {}],
    ['purchases', {}],
    ['purchase-transitions', {}],
    ['purchase-receipts', {}],
    ['expenses', {}],
    ['withdrawals', {}],
    ['payables', {}],
    ['promotions', {}],
    ['users', {}],
    ['inventory', {}],
    ['create-method', {}],
    ['set-method-active', { id: 'debit', active: false }],
    ['recurring-expenses', {}],
    ['installment-obligations', {}],
    ['materialize-financial', {}],
    ['toggle-recurring', {}],
    [
      'refund-authorizations',
      { saleId: ownSaleDetail.body.id, maxAmount: ownSaleDetail.body.total },
    ],
    [
      'actions',
      {
        action: 'set-price',
        id: sellableVariant.id,
        amount: sellableVariant.price,
        cost: 1,
      },
    ],
    [
      'configure-method',
      {
        id: 'cash',
        name: 'Efectivo',
        surchargeBps: 0,
        commissionBps: 0,
        days: 0,
        installments: 1,
      },
    ],
    [
      'variants',
      {
        productId: sellableVariant.productId,
        sku: 'NO-AUTORIZADO',
        barcode: 'NO-AUTORIZADO',
        color: 'Negro',
        size: 'M',
        price: sellableVariant.price,
        cost: 1,
        stock: 0,
        minimum: 0,
      },
    ],
  ])
    await expectDenied(resource, body);
} finally {
  sql(
    `UPDATE users SET role=${sqlLiteral(originalRole)} WHERE id='local_seedy'`,
  );
  if (createdCustomerId) {
    sql(
      `DELETE FROM audit_log WHERE entityId=${sqlLiteral(createdCustomerId)}`,
    );
    sql(`DELETE FROM customers WHERE id=${sqlLiteral(createdCustomerId)}`);
  }
}

const restoredSession = await request('session');
assert.equal(restoredSession.status, 200, JSON.stringify(restoredSession.body));
assert.equal(restoredSession.body.user.role, originalRole);

console.log(
  'PASS: VENDEDOR solo recibe datos comerciales, consulta ventas propias y tiene denegados recursos administrativos y financieros.',
);
