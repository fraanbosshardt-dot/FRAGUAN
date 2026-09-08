import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const origin = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  Origin: origin,
  'Content-Type': 'application/json',
};

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

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMonthsAnchored(date, months) {
  const source = new Date(`${date}T12:00:00.000Z`);
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
}).format(new Date());
const firstDueOn = addDays(today, 10);
const lastDueOn = addMonthsAnchored(firstDueOn, 2);
const obligationDescription = `Obligación prueba ${crypto.randomUUID().slice(0, 8)}`;
let recurringId = '';
let obligationId = '';

try {
  const pin = await fetch(origin + '/api/admin-pin', { method: 'POST', headers, body: JSON.stringify({ pin: '197313' }) });
  assert.equal(pin.status, 200);
  headers.Cookie += '; ' + pin.headers.get('set-cookie').split(';', 1)[0];
  const recurring = await request('recurring-expenses', {
    description: `Servicio recurrente prueba ${crypto.randomUUID().slice(0, 8)}`,
    category: 'Servicios',
    amount: 12345,
    frequency: 'monthly',
    interval: 1,
    startsOn: firstDueOn,
    endsOn: lastDueOn,
    supplierId: null,
    methodId: 'transfer',
  });
  assert.equal(recurring.status, 201, JSON.stringify(recurring.body));
  recurringId = recurring.body.id;

  const calendarBefore = await request('financial-calendar?days=180');
  assert.equal(calendarBefore.status, 200, JSON.stringify(calendarBefore.body));
  assert.equal(
    calendarBefore.body.entries.filter((entry) =>
      entry.reference.startsWith(`recurring:${recurringId}:`),
    ).length,
    3,
  );

  const materialized = await request('materialize-financial', {
    throughOn: lastDueOn,
  });
  assert.equal(materialized.status, 200, JSON.stringify(materialized.body));
  const calendarAfter = await request('financial-calendar?days=180');
  assert.equal(
    calendarAfter.body.entries.filter((entry) =>
      entry.reference.startsWith(`recurring:${recurringId}:`),
    ).length,
    3,
    'Materializar de nuevo no debe duplicar vencimientos.',
  );

  const paused = await request('toggle-recurring', { id: recurringId });
  assert.equal(paused.status, 200, JSON.stringify(paused.body));
  assert.equal(paused.body.active, 0);

  const obligation = await request('installment-obligations', {
    description: obligationDescription,
    supplierId: null,
    total: 10000,
    installmentCount: 3,
    firstDueOn,
    intervalMonths: 1,
    kind: 'Cuota',
  });
  assert.equal(obligation.status, 201, JSON.stringify(obligation.body));
  obligationId = obligation.body.id;
  assert.equal(obligation.body.installments, 3);

  const obligationPayables = (await request('payables')).body.filter(
    (payable) =>
      payable.description.startsWith(`${obligationDescription} · cuota `),
  );
  assert.equal(obligationPayables.length, 3);
  assert.deepEqual(
    obligationPayables.map((payable) => payable.amount).sort((a, b) => b - a),
    [3334, 3333, 3333],
  );

  const cash = await request('cash');
  if (!cash.body.session || cash.body.session.closedAt) {
    const opened = await request('actions', { action: 'open-cash', amount: 0 });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
  }
  for (const payable of obligationPayables) {
    const payment = await request('actions', {
      action: 'pay-payable',
      id: payable.id,
      methodId: 'transfer',
    });
    assert.equal(payment.status, 200, JSON.stringify(payment.body));
  }

  const plans = await request('financial-plans');
  const savedRecurring = plans.body.recurring.find(
    (plan) => plan.id === recurringId,
  );
  const savedObligation = plans.body.obligations.find(
    (plan) => plan.id === obligationId,
  );
  assert.equal(savedRecurring.active, 0);
  assert.equal(savedObligation.paidInstallments, 3);
  assert.equal(savedObligation.status, 'paid');

  sql("UPDATE users SET role='VENDEDOR' WHERE id='local_seedy'");
  for (const resource of [
    'financial-calendar',
    'financial-plans',
    `reports?from=${today}&to=${today}`,
  ]) {
    assert.equal((await request(resource)).status, 403, resource);
  }
  sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");

  console.log(
    'PASS: recurrencias idempotentes, cuotas exactas, pago sincronizado y permisos financieros.',
  );
} finally {
  sql("UPDATE users SET role='ADMIN' WHERE id='local_seedy'");
  if (obligationId && /^[0-9a-f-]+$/i.test(obligationId)) {
    sql(
      `DELETE FROM cash_movements WHERE reference IN (SELECT payableId FROM obligation_installments WHERE obligationId='${obligationId}');
       DELETE FROM obligation_installments WHERE obligationId='${obligationId}';
       DELETE FROM payables WHERE reference LIKE 'installment:${obligationId}:%';
       DELETE FROM financial_obligations WHERE id='${obligationId}';
       DELETE FROM audit_log WHERE entityId='${obligationId}';`,
    );
  }
  if (recurringId && /^[0-9a-f-]+$/i.test(recurringId)) {
    sql(
      `DELETE FROM payables WHERE reference LIKE 'recurring:${recurringId}:%';
       DELETE FROM recurring_expenses WHERE id='${recurringId}';
       DELETE FROM audit_log WHERE entityId='${recurringId}';`,
    );
  }
}
