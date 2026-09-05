import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};
const suffix = Date.now().toString(36);
let customerId = '';
let saleId = '';

async function request(path, body) {
  const response = await fetch(`${origin}/api/${path}`, {
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

try {
  assert.equal((await request('session')).body.user.id, 'local_seedy');
  const methods = await request('methods');
  assert.equal(methods.status, 200);
  assert(methods.body.some((method) => method.id === 'cashback'));
  const cash = await request('cash');
  if (!cash.body.session || cash.body.session.closedAt) {
    const opened = await request('actions', { action: 'open-cash', amount: 0 });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
  }

  const customer = await request('customers', {
    name: 'Cliente',
    surname: `Cashback ${suffix}`,
    phone: `11${suffix
      .replace(/[^0-9]/g, '')
      .slice(-8)
      .padStart(8, '0')}`,
  });
  assert.equal(customer.status, 201, JSON.stringify(customer.body));
  customerId = customer.body.id;
  const config = await request('customer-intelligence-config', {
    loyalty: {
      cashbackBps: { FRAGUAN: 100, Silver: 100, Gold: 100, Black: 100 },
    },
  });
  assert.equal(config.status, 200, JSON.stringify(config.body));

  const variant = (await request('catalog')).body.find((row) => row.stock > 1);
  assert(variant);
  const before = await request(
    `customer-credit-balance?customerId=${encodeURIComponent(customerId)}`,
  );
  assert.equal(before.status, 200);
  const expectedCashback = Math.floor(variant.price / 100);
  const sale = await request('sales', {
    items: [{ variantId: variant.id, quantity: 1 }],
    customerId,
    promotionId: null,
    payments: [
      {
        methodId: 'cash',
        baseMinor: variant.price,
        receivedMinor: variant.price,
      },
    ],
    idempotencyKey: crypto.randomUUID(),
  });
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  saleId = sale.body.id;
  const afterSale = await request(
    `customer-credit-balance?customerId=${encodeURIComponent(customerId)}`,
  );
  assert.equal(afterSale.body.cashbackBalance, expectedCashback);
  const cashbackQuote = await request('quote', {
    items: [{ variantId: variant.id, quantity: 1 }],
    customerId,
    promotionId: null,
    payments: [
      { methodId: 'cashback', baseMinor: expectedCashback },
      {
        methodId: 'cash',
        baseMinor: variant.price - expectedCashback,
        receivedMinor: variant.price - expectedCashback,
      },
    ],
  });
  assert.equal(cashbackQuote.status, 200, JSON.stringify(cashbackQuote.body));
  const ledger = await request(`customer-cashback?customerId=${customerId}`);
  assert.equal(ledger.status, 200);
  assert.equal(ledger.body[0].balance, expectedCashback);

  const refund = await request('refunds', {
    saleId,
    reason: 'Restaurar fixture de cashback',
  });
  assert.equal(refund.status, 200, JSON.stringify(refund.body));
  const afterRefund = await request(
    `customer-credit-balance?customerId=${encodeURIComponent(customerId)}`,
  );
  assert.equal(afterRefund.body.cashbackBalance, 0);

  sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
  try {
    assert.equal(
      (await request(`customer-cashback?customerId=${customerId}`)).status,
      403,
    );
  } finally {
    sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
  }
  console.log(
    'PASS: cashback se acredita según el Club, aparece en el saldo comercial y se revierte con una devolución.',
  );
} finally {
  sql(`
    DELETE FROM cashback_usages WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM customer_cashback WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM refund_items WHERE refundId IN (SELECT id FROM refunds WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}'));
    DELETE FROM stock_movements WHERE reference IN (SELECT id FROM refunds WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}')) OR reference IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM cash_movements WHERE reference IN (SELECT id FROM refunds WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}')) OR reference IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM loyalty_transactions WHERE customerId='${customerId}';
    DELETE FROM refunds WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM payments WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM sale_discounts WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM sale_items WHERE saleId IN (SELECT id FROM sales WHERE customerId='${customerId}');
    DELETE FROM sales WHERE customerId='${customerId}';
    DELETE FROM customers WHERE id='${customerId}';
    DELETE FROM settings WHERE key='customerIntelligence';
    UPDATE users SET role='ADMIN' WHERE id='local_seedy';
  `);
}
