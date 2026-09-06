import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, actor } from './tests-cashback-regressions.mjs';

test('report boundaries include the entire Argentina day across UTC midnight', async (t) => {
  const f = fixture(t),
    sale = await f.sell(1),
    { getBusinessReport } = f.load('lib/reporting.ts');
  for (const [timestamp, expected] of [
    ['2026-09-05T02:59:59.999Z', 0],
    ['2026-09-05T03:00:00.000Z', 10000],
    ['2026-09-06T02:59:59.999Z', 10000],
    ['2026-09-06T03:00:00.000Z', 0],
  ]) {
    f.database
      .prepare('UPDATE sales SET createdAt=? WHERE id=?')
      .run(timestamp, sale.id);
    assert.equal(
      (await getBusinessReport(actor, { from: '2026-09-05', to: '2026-09-05' }))
        .current.revenueMinor,
      expected,
      timestamp,
    );
  }
});

test('seller commission estimates use net sales after refunds', async (t) => {
  const f = fixture(t),
    { configureSellerCommission, sellerCommissions } = f.load(
      'lib/seller-commissions.ts',
    );
  await configureSellerCommission(actor, { id: 'admin', rate: 5 });
  const sale = await f.sell(4);
  await f.refund(sale, 1);
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
  const report = await sellerCommissions(actor, day, day);
  assert.equal(report.sellers[0].revenue, 30000);
  assert.equal(report.sellers[0].estimatedCommission, 1500);
  await assert.rejects(
    () =>
      configureSellerCommission(
        { ...actor, role: 'GERENTE' },
        { id: 'admin', rate: 10 },
      ),
    /Acceso denegado/,
  );
});

test('supplier history reports retained units and current inventory without fabricated purchases', async (t) => {
  const f = fixture(t);
  f.database.exec(
    "INSERT INTO suppliers(id,name,phone,email,terms) VALUES ('supplier','Proveedor','','',''); UPDATE products SET supplierId='supplier' WHERE id='product'",
  );
  const sale = await f.sell(4);
  await f.refund(sale, 1);
  const result = await f
    .load('lib/supplier-history.ts')
    .supplierHistory(actor, 'supplier');
  assert.equal(result.sales.units, 3);
  assert.equal(result.sales.revenueMinor, 30000);
  assert.equal(result.stock.units, 97);
  assert.equal(result.orders.length, 0);
});

test('birthday suggestions are generated from customer dates and never sent', async (t) => {
  const f = fixture(t),
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());
  f.database
    .prepare("UPDATE customers SET birthday=? WHERE id='customer'")
    .run(`1990-${today.slice(5)}`);
  const service = f.load('lib/communications.ts');
  const drafts = await service.communicationSuggestions(actor);
  assert.equal(drafts.drafts.length, 1);
  assert.equal(drafts.drafts[0].kind, 'Cumpleaños');
  await assert.rejects(
    () => service.communicationSuggestions({ ...actor, role: 'VENDEDOR' }),
    /Acceso denegado/,
  );
});

test('linked cheque replaces the payable in projections and settles it exactly once', async (t) => {
  const f = fixture(t),
    { bankingWrite } = f.load('lib/banking.ts'),
    { consolidatedCashFlow } = f.load('lib/consolidated-cashflow.ts');
  const account = await bankingWrite(actor, {
    action: 'account',
    name: 'Cuenta',
    bank: 'Banco',
    alias: 'test',
    opening: 50000,
  });
  f.database.exec(
    "INSERT INTO payables(id,description,amount,dueAt,kind) VALUES ('payable','Proveedor',10000,'2026-01-02','Proveedor')",
  );
  const check = await bankingWrite(actor, {
    action: 'check',
    number: 'linked',
    bank: 'Banco',
    type: 'echeq',
    direction: 'issued',
    party: 'Proveedor',
    amount: 10000,
    issuedAt: '2026-01-01',
    dueAt: '2026-01-02',
    accountId: account.id,
    payableId: 'payable',
  });
  const before = await consolidatedCashFlow();
  assert.equal(before.pendingPayables.totalMinor, 10000);
  assert.equal(before.horizons['30'].projectedKnownFundsMinor, 40000);
  assert.throws(
    () =>
      f.database.exec("UPDATE payables SET status='paid' WHERE id='payable'"),
    /settle_check_first/,
  );
  await bankingWrite(actor, {
    action: 'transition',
    id: check.id,
    status: 'cleared',
    reason: 'Débito confirmado',
  });
  assert.equal(
    f.database.prepare("SELECT status FROM payables WHERE id='payable'").get()
      .status,
    'paid',
  );
  const after = await consolidatedCashFlow();
  assert.equal(after.pendingPayables.totalMinor, 0);
  assert.equal(after.currentRecordedBank.amountMinor, 40000);
  assert.equal(after.horizons['30'].projectedKnownFundsMinor, 40000);
});

test('inventory drafts validate variants, allow edits and freeze on approval', async (t) => {
  const f = fixture(t),
    { adminWrite, adminAction } = f.load('lib/admin.ts'),
    { inventoryDetail, editInventory } = f.load('lib/inventory.ts');
  await assert.rejects(
    () =>
      adminWrite('inventory', actor, {
        items: [{ variantId: 'missing', counted: 5 }],
      }),
    /Variante no encontrada/,
  );
  assert.equal(
    f.database.prepare('SELECT COUNT(*) AS n FROM inventory_counts').get().n,
    0,
  );
  const count = await adminWrite('inventory', actor, {
    items: [{ variantId: 'variant', counted: 98 }],
  });
  const detail = await inventoryDetail(actor, count.id);
  assert.equal(detail.items[0].difference, -2);
  await editInventory(actor, {
    id: count.id,
    items: [{ id: detail.items[0].id, counted: 99 }],
  });
  assert.equal(
    f.database.prepare("SELECT stock FROM variants WHERE id='variant'").get()
      .stock,
    100,
  );
  await adminAction(actor, { action: 'approve-count', id: count.id });
  assert.throws(
    () =>
      f.database
        .prepare('UPDATE inventory_count_items SET counted=0 WHERE countId=?')
        .run(count.id),
    /inventory_already_approved/,
  );
  assert.throws(
    () =>
      f.database
        .prepare('DELETE FROM inventory_count_items WHERE countId=?')
        .run(count.id),
    /inventory_already_approved/,
  );
  assert.throws(
    () =>
      f.database
        .prepare(
          'INSERT INTO inventory_count_items(id,countId,variantId,expected,counted) VALUES (?,?,?,?,?)',
        )
        .run('extra', count.id, 'variant', 99, 0),
    /inventory_already_approved/,
  );
  assert.equal(
    f.database.prepare("SELECT stock FROM variants WHERE id='variant'").get()
      .stock,
    99,
  );
  await assert.rejects(
    () =>
      editInventory(actor, {
        id: count.id,
        items: [{ id: detail.items[0].id, counted: 90 }],
      }),
    /aprobado/,
  );
});

test('cheques post bank money once and reject invalid transitions', async (t) => {
  const f = fixture(t),
    { bankingWrite, banking } = f.load('lib/banking.ts');
  const account = await bankingWrite(actor, {
    action: 'account',
    name: 'Cuenta test',
    bank: 'Banco',
    alias: 'test',
    opening: 50000,
  });
  const check = await bankingWrite(actor, {
    action: 'check',
    accountId: account.id,
    number: '123',
    bank: 'Banco',
    type: 'echeq',
    direction: 'received',
    party: 'Cliente',
    amount: 10000,
    issuedAt: '2026-01-01',
    dueAt: '2026-01-02',
  });
  assert.equal((await banking(actor)).accounts[0].balance, 50000);
  await assert.rejects(() =>
    bankingWrite(actor, {
      action: 'transition',
      id: check.id,
      status: 'cleared',
      reason: 'Prueba',
    }),
  );
  await bankingWrite(actor, {
    action: 'transition',
    id: check.id,
    status: 'deposited',
    reason: 'Prueba',
  });
  await bankingWrite(actor, {
    action: 'transition',
    id: check.id,
    status: 'cleared',
    reason: 'Prueba',
  });
  assert.equal((await banking(actor)).accounts[0].balance, 60000);
  await assert.rejects(() =>
    bankingWrite(actor, {
      action: 'transition',
      id: check.id,
      status: 'cleared',
      reason: 'Prueba',
    }),
  );
  assert.equal((await banking(actor)).accounts[0].balance, 60000);
});
test('bank entries are idempotent and reconciliation validates amount and date', async (t) => {
  const f = fixture(t),
    { bankingWrite, banking } = f.load('lib/banking.ts');
  const a = await bankingWrite(actor, {
    action: 'account',
    name: 'Cuenta test',
    bank: 'Banco',
    alias: 'test',
    opening: 0,
  });
  const input = {
    action: 'entry',
    accountId: a.id,
    direction: 'in',
    amount: 10000,
    description: 'Transferencia',
    occurredAt: '2026-02-01',
    reference: crypto.randomUUID(),
  };
  await bankingWrite(actor, input);
  await bankingWrite(actor, input);
  assert.equal((await banking(actor)).accounts[0].balance, 10000);
  await assert.rejects(() => bankingWrite(actor, { ...input, amount: 20000 }));
  const entry = (await banking(actor)).entries[0];
  await assert.rejects(() =>
    bankingWrite(actor, {
      action: 'reconcile',
      id: entry.id,
      amount: 5000,
      occurredAt: input.occurredAt,
      statementReference: 'bank-1',
    }),
  );
  await bankingWrite(actor, {
    action: 'reconcile',
    id: entry.id,
    amount: 10000,
    occurredAt: input.occurredAt,
    statementReference: 'bank-1',
  });
  assert((await banking(actor)).entries[0].reconciledAt);
});
test('redemptions reserve points once, cancellation restores them once and delivery is final', async (t) => {
  const f = fixture(t),
    { clubRewardWrite } = f.load('lib/club-rewards.ts');
  f.database.exec("UPDATE customers SET points=100 WHERE id='customer'");
  const reward = await clubRewardWrite(actor, {
    action: 'reward',
    name: 'Arreglo de prenda',
    description: 'Un ajuste de largo',
    points: 40,
  });
  const request = {
    action: 'redeem',
    customerId: 'customer',
    rewardId: reward.id,
    idempotencyKey: crypto.randomUUID(),
  };
  const redemption = await clubRewardWrite(actor, request);
  await clubRewardWrite(actor, request);
  const balance = () =>
    f.database.prepare("SELECT points FROM customers WHERE id='customer'").get()
      .points;
  assert.equal(balance(), 60);
  await clubRewardWrite(actor, { action: 'cancel', id: redemption.id });
  assert.equal(balance(), 100);
  await assert.rejects(() =>
    clubRewardWrite(actor, { action: 'cancel', id: redemption.id }),
  );
  assert.equal(balance(), 100);
  const second = await clubRewardWrite(actor, {
    ...request,
    idempotencyKey: crypto.randomUUID(),
  });
  await clubRewardWrite(actor, { action: 'deliver', id: second.id });
  await assert.rejects(() =>
    clubRewardWrite(actor, { action: 'cancel', id: second.id }),
  );
  assert.equal(balance(), 60);
  const sum = f.database
    .prepare(
      "SELECT SUM(points) AS points FROM loyalty_transactions WHERE customerId='customer'",
    )
    .get().points;
  assert.equal(sum, -40);
});
test('database guard prevents overspending points and rolls back batch', async (t) => {
  const f = fixture(t),
    { clubRewardWrite } = f.load('lib/club-rewards.ts');
  f.database.exec("UPDATE customers SET points=10 WHERE id='customer'");
  const reward = await clubRewardWrite(actor, {
    action: 'reward',
    name: 'Beneficio',
    description: 'Prueba de saldo',
    points: 20,
  });
  await assert.rejects(() =>
    clubRewardWrite(actor, {
      action: 'redeem',
      customerId: 'customer',
      rewardId: reward.id,
      idempotencyKey: crypto.randomUUID(),
    }),
  );
  assert.throws(
    () =>
      f.database
        .prepare(
          'INSERT INTO club_redemptions(id,customerId,rewardId,points,rewardName,idempotencyKey,actorId,createdAt) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(
          'invalid',
          'customer',
          reward.id,
          20,
          'Beneficio',
          'key',
          'admin',
          new Date().toISOString(),
        ),
    /insufficient_points/,
  );
  assert.equal(
    f.database.prepare('SELECT COUNT(*) AS n FROM club_redemptions').get().n,
    0,
  );
});
test('seller cannot use administration and user overrides never add powers', async (t) => {
  const f = fixture(t),
    seller = { ...actor, role: 'VENDEDOR' };
  const { can } = f.load('lib/auth.ts');
  assert.equal(can({ ...seller, denied: [] }, 'reports'), false);
  assert.equal(
    can({ ...actor, role: 'GERENTE', denied: ['reports'] }, 'reports'),
    false,
  );
  await assert.rejects(
    () => f.load('lib/banking.ts').banking(seller),
    /Acceso denegado/,
  );
  await assert.rejects(
    () => f.load('lib/club-rewards.ts').clubRewards(seller),
    /Acceso denegado/,
  );
  await assert.rejects(
    () => f.load('lib/access-control.ts').listAccess(seller),
    /Acceso denegado/,
  );
  await assert.rejects(
    () => f.load('lib/global-search.ts').globalSearch(seller, 'Camisa'),
    /Acceso denegado/,
  );
  const results = await f
    .load('lib/global-search.ts')
    .globalSearch(actor, 'Camisa');
  assert(results.some((r) => r.title === 'Camisa'));
  const none = await f
    .load('lib/global-search.ts')
    .globalSearch(
      { ...actor, role: 'GERENTE', denied: ['products', 'stock'] },
      'Camisa',
    );
  assert.equal(none.length, 0);
});

test('purchase delivery conditions persist with totals and reject invalid dates', async (t) => {
  const f = fixture(t);
  f.database.exec(
    "INSERT INTO suppliers(id,name,phone,email,terms) VALUES ('delivery-supplier','Proveedor','','','')",
  );
  const service = f.load('lib/purchase-operations.ts');
  const variant = f.database
    .prepare('SELECT id FROM variants LIMIT 1')
    .get().id;
  const input = {
    supplierId: 'delivery-supplier',
    dueAt: '2026-10-01',
    expectedAt: '2026-09-20',
    carrier: 'Transporte local',
    trackingReference: 'GUIA-1',
    deliveryAddress: 'Depósito FRAGUAN',
    paymentTerms: 'Pago a 30 días',
    tax: 2100,
    shipping: 1000,
    items: [{ variantId: variant, quantity: 2, cost: 5000 }],
  };
  const order = await service.createPurchaseOrder(actor, input);
  assert.equal(order.total, 13100);
  assert.equal(order.carrier, input.carrier);
  assert.equal(order.expectedAt, input.expectedAt);
  assert.equal(order.paymentTerms, input.paymentTerms);
  await service.transitionPurchaseOrder(actor, {
    purchaseId: order.id,
    action: 'send',
  });
  await service.transitionPurchaseOrder(actor, {
    purchaseId: order.id,
    action: 'confirm',
  });
  const payable = f.database
    .prepare('SELECT id FROM payables WHERE purchaseId=?')
    .get(order.id);
  await f.load('lib/admin.ts').adminAction(actor, {
    action: 'pay-payable',
    id: payable.id,
    methodId: 'cash',
  });
  const prepaid = await service.getPurchaseOrder(actor, order.id);
  assert.equal(prepaid.paymentStatus, 'paid');
  assert.equal(prepaid.completionStatus, 'confirmed');
  await service.receivePurchaseOrder(actor, {
    purchaseId: order.id,
    items: [{ purchaseItemId: order.items[0].id, quantity: 2 }],
    idempotencyKey: crypto.randomUUID(),
  });
  const complete = await service.getPurchaseOrder(actor, order.id);
  assert.equal(complete.completionStatus, 'paid');
  assert.equal(complete.status, 'received');
  await assert.rejects(() =>
    service.createPurchaseOrder(actor, { ...input, expectedAt: '2026-02-30' }),
  );
});

test('promotion reporting preserves discounts and nets returned revenue', async (t) => {
  const f = fixture(t);
  f.database.exec(
    "INSERT INTO promotions(id,name,percent,startsAt,endsAt) VALUES ('promo','Diez por ciento',10,'2020-01-01','2099-12-31')",
  );
  const sale = await f.load('lib/sales.ts').confirmSale(actor, {
    items: [{ variantId: 'variant', quantity: 2 }],
    customerId: 'customer',
    promotionId: 'promo',
    payments: [{ methodId: 'cash', baseMinor: 18000, receivedMinor: 18000 }],
    idempotencyKey: crypto.randomUUID(),
  });
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
  const report = () =>
    f.load('lib/reporting.ts').getBusinessReport(actor, { from: day, to: day });
  assert.equal((await report()).breakdowns.promotions[0].revenueMinor, 18000);
  await f.refund(sale, 1);
  const result = (await report()).breakdowns.promotions[0];
  assert.equal(result.revenueMinor, 9000);
  assert.equal(result.grantedDiscountMinor, 2000);
  assert.equal(result.grossProfitMinor, 5000);
  await f.refund(sale, 1);
  assert.equal((await report()).breakdowns.promotions.length, 0);
});

test('custom installment methods calculate net amounts and pause without changing history', async (t) => {
  const f = fixture(t),
    configuration = f.load('lib/configuration.ts');
  const method = await configuration.createMethod(actor, {
    name: 'Crédito seis cuotas',
    surchargeBps: 2000,
    commissionBps: 650,
    days: 30,
    installments: 6,
  });
  const sale = await f.load('lib/sales.ts').confirmSale(actor, {
    items: [{ variantId: 'variant', quantity: 1 }],
    customerId: null,
    promotionId: null,
    payments: [{ methodId: method.id, baseMinor: 10000 }],
    idempotencyKey: crypto.randomUUID(),
  });
  const payment = f.database
    .prepare('SELECT amount,commission,net FROM payments WHERE saleId=?')
    .get(sale.id);
  assert.equal(payment.amount, 12000);
  assert.equal(payment.commission, 780);
  assert.equal(payment.net, 11220);
  await configuration.setMethodActive(actor, { id: method.id, active: false });
  await assert.rejects(
    () =>
      f.load('lib/sales.ts').confirmSale(actor, {
        items: [{ variantId: 'variant', quantity: 1 }],
        customerId: null,
        promotionId: null,
        payments: [{ methodId: method.id, baseMinor: 10000 }],
        idempotencyKey: crypto.randomUUID(),
      }),
    /no disponible/,
  );
  assert.equal(
    f.database.prepare('SELECT net FROM payments WHERE saleId=?').get(sale.id)
      .net,
    11220,
  );
  await configuration.setMethodActive(actor, { id: method.id, active: true });
  await assert.rejects(
    () =>
      configuration.createMethod(
        { ...actor, role: 'VENDEDOR' },
        { name: 'Falso' },
      ),
    /denegado/,
  );
  await assert.rejects(
    () => configuration.setMethodActive(actor, { id: 'cash', active: false }),
    /conservarse/,
  );
});

test('JSON body limits enforce actual bytes even without content length', async (t) => {
  const f = fixture(t),
    { readJsonBody, protectWrite } = f.load('lib/auth.ts');
  const request = (body) =>
    new Request('http://localhost:3000/api/sales', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body,
    });
  assert.equal(
    (await readJsonBody(request('{"name":"Camisa Ñ"}'))).name,
    'Camisa Ñ',
  );
  await assert.rejects(
    () => readJsonBody(request('{')),
    (error) => error.status === 400,
  );
  await assert.rejects(
    () => readJsonBody(request(JSON.stringify({ value: 'x'.repeat(100001) }))),
    (error) => error.status === 413,
  );
  assert.throws(
    () =>
      protectWrite(
        new Request('http://localhost:3000/api/sales', {
          method: 'POST',
          headers: {
            origin: 'https://foreign.test',
            'content-type': 'application/json',
          },
        }),
      ),
    (error) => error.status === 403,
  );
});

test('a promotion remains usable until midnight in Argentina, not midnight UTC', async (t) => {
  for (const [timestamp, allowed] of [
    ['2026-09-06T02:59:59Z', true],
    ['2026-09-06T03:00:00Z', false],
  ]) {
    const f = fixture(t, { timestamp });
    f.database.exec(
      "INSERT INTO promotions(id,name,percent,startsAt,endsAt) VALUES ('last-day','Último día',10,'2026-09-05','2026-09-05')",
    );
    const quote = () =>
      f.load('lib/sales.ts').quote({
        items: [{ variantId: 'variant', quantity: 1 }],
        customerId: null,
        promotionId: 'last-day',
        payments: [{ methodId: 'cash', baseMinor: 9000, receivedMinor: 9000 }],
      });
    if (allowed) assert.equal((await quote()).total, 9000);
    else await assert.rejects(quote, /vencida/);
  }
});

test('supplier fulfillment separates late open orders and on-time completed orders', async (t) => {
  const f = fixture(t, { timestamp: '2026-09-06T15:00:00Z' });
  f.database.exec(
    "INSERT INTO suppliers(id,name,phone,email,terms) VALUES ('fulfillment','Proveedor','','','')",
  );
  const insert = f.database.prepare(
    "INSERT INTO purchases(id,supplierId,status,total,createdAt,dueAt,actorId,expectedAt,receivedAt) VALUES (?,'fulfillment',?,100,'2026-09-01T12:00:00Z','2026-10-01','admin',?,?)",
  );
  insert.run('on-time', 'received', '2026-09-05', '2026-09-06T02:59:59Z');
  insert.run('late', 'received', '2026-09-05', '2026-09-06T03:00:00Z');
  insert.run('overdue', 'confirmed', '2026-09-05', null);
  insert.run('unscheduled', 'received', null, '2026-09-05T12:00:00Z');
  const result = await f
    .load('lib/supplier-history.ts')
    .supplierHistory(actor, 'fulfillment');
  assert.equal(result.fulfillment.scheduled, 3);
  assert.equal(result.fulfillment.completed, 2);
  assert.equal(result.fulfillment.onTime, 1);
  assert.equal(result.fulfillment.overdue, 1);
});

test('manual stock adjustments preserve observations and exact before/after values', async (t) => {
  const f = fixture(t),
    { adminWrite } = f.load('lib/admin.ts');
  await adminWrite('stock', actor, {
    variantId: 'variant',
    quantity: -3,
    reason: 'Prenda dañada',
    notes: 'Costura abierta detectada durante el control',
  });
  const movement = f.database
    .prepare(
      "SELECT quantity,before,after,reason,notes FROM stock_movements WHERE variantId='variant' ORDER BY rowid DESC LIMIT 1",
    )
    .get();
  assert.equal(movement.quantity, -3);
  assert.equal(movement.before, 100);
  assert.equal(movement.after, 97);
  assert.equal(movement.reason, 'Prenda dañada');
  assert.match(movement.notes, /Costura abierta/);
  assert.equal(
    f.database.prepare("SELECT stock FROM variants WHERE id='variant'").get()
      .stock,
    97,
  );
});
