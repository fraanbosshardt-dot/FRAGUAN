import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('./lib/cashflow.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'cashflow.ts',
  reportDiagnostics: true,
});
const errors = (compiled.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);
assert.deepEqual(
  errors.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  ),
  [],
  'cashflow.ts must transpile without syntax errors',
);

const queryCalls = [];
const cashSessions = [
  {
    id: 'cash-open',
    openingMinor: 10_000,
    movementsMinor: 2_500,
    openedAt: '2026-09-04T11:00:00.000Z',
  },
];
const futureSettlements = [
  {
    id: 'settled-before-cutoff',
    saleId: 'sale-0',
    methodId: 'credit',
    methodName: 'Crédito',
    grossMinor: 550,
    commissionMinor: 50,
    netMinor: 500,
    dueAt: '2026-09-04T14:00:00.000Z',
  },
  {
    id: 'settlement-today',
    saleId: 'sale-1',
    methodId: 'credit',
    methodName: 'Crédito',
    grossMinor: 1_100,
    commissionMinor: 100,
    netMinor: 1_000,
    dueAt: '2026-09-04T18:00:00.000Z',
  },
  {
    id: 'settlement-day-7',
    saleId: 'sale-2',
    methodId: 'credit',
    methodName: 'Crédito',
    grossMinor: 2_200,
    commissionMinor: 200,
    netMinor: 2_000,
    dueAt: '2026-09-11T15:00:00.000Z',
  },
  {
    id: 'settlement-day-8',
    saleId: 'sale-3',
    methodId: 'debit',
    methodName: 'Débito',
    grossMinor: 3_300,
    commissionMinor: 300,
    netMinor: 3_000,
    dueAt: '2026-09-12T15:00:00.000Z',
  },
  {
    id: 'settlement-day-60',
    saleId: 'sale-4',
    methodId: 'credit',
    methodName: 'Crédito',
    grossMinor: 4_400,
    commissionMinor: 400,
    netMinor: 4_000,
    dueAt: '2026-11-03T15:00:00.000Z',
  },
  {
    id: 'settlement-day-91',
    saleId: 'sale-5',
    methodId: 'credit',
    methodName: 'Crédito',
    grossMinor: 5_500,
    commissionMinor: 500,
    netMinor: 5_000,
    dueAt: '2026-12-04T15:00:00.000Z',
  },
];
const pendingPayables = [
  {
    id: 'payable-overdue',
    description: 'Vencida',
    supplierId: null,
    supplierName: null,
    amountMinor: 500,
    dueAt: '2026-09-01',
    kind: 'Servicio',
    reference: '',
  },
  {
    id: 'payable-today',
    description: 'Hoy',
    supplierId: null,
    supplierName: null,
    amountMinor: 200,
    dueAt: '2026-09-04',
    kind: 'Servicio',
    reference: '',
  },
  {
    id: 'payable-day-7',
    description: 'Siete días',
    supplierId: 'supplier-1',
    supplierName: 'Proveedor',
    amountMinor: 700,
    dueAt: '2026-09-11',
    kind: 'Proveedor',
    reference: 'purchase-1',
  },
  {
    id: 'payable-day-30',
    description: 'Treinta días',
    supplierId: null,
    supplierName: null,
    amountMinor: 1_000,
    dueAt: '2026-10-04',
    kind: 'Impuesto',
    reference: '',
  },
  {
    id: 'payable-day-60',
    description: 'Sesenta días',
    supplierId: null,
    supplierName: null,
    amountMinor: 1_200,
    dueAt: '2026-11-03',
    kind: 'Servicio',
    reference: '',
  },
  {
    id: 'payable-day-90',
    description: 'Noventa días',
    supplierId: null,
    supplierName: null,
    amountMinor: 2_000,
    dueAt: '2026-12-03',
    kind: 'Servicio',
    reference: '',
  },
  {
    id: 'payable-day-91',
    description: 'Fuera de serie',
    supplierId: null,
    supplierName: null,
    amountMinor: 3_000,
    dueAt: '2026-12-04',
    kind: 'Servicio',
    reference: '',
  },
];

async function query(sql, ...values) {
  queryCalls.push({ sql, values });
  if (sql.includes('FROM cash_sessions')) return cashSessions;
  if (sql.includes('FROM payments')) return futureSettlements;
  if (sql.includes('FROM payables')) return pendingPayables;
  throw new Error(`Unexpected SQL: ${sql}`);
}

const moduleRecord = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  exports: moduleRecord.exports,
  module: moduleRecord,
  require(specifier) {
    if (specifier === '@/db/queries') return { rows: query };
    throw new Error(`Unexpected import: ${specifier}`);
  },
});
const { buildCashFlowSnapshot, getCashFlow } = moduleRecord.exports;
assert.equal(typeof buildCashFlowSnapshot, 'function');
assert.equal(typeof getCashFlow, 'function');

const asOf = '2026-09-04T15:00:00.000Z';
const report = await getCashFlow({ asOf });

assert.equal(report.asOfDate, '2026-09-04');
assert.equal(report.currency, 'ARS');
assert.equal(report.currencyUnit, 'minor');
assert.equal(report.businessUtcOffsetMinutes, -180);
assert.equal(report.assumptions.bankBalanceIncluded, false);
assert.equal(report.assumptions.bankBalanceMinor, null);
assert.equal(report.currentRecordedCash.amountMinor, 12_500);
assert.equal(report.currentRecordedCash.status, 'open');

assert.equal(report.futureSettlements.count, 5);
assert.equal(report.futureSettlements.totalGrossMinor, 16_500);
assert.equal(report.futureSettlements.totalCommissionMinor, 1_500);
assert.equal(report.futureSettlements.totalNetMinor, 15_000);
assert.deepEqual(
  Array.from(report.futureSettlements.byMethod, (method) => method.methodId),
  ['credit', 'debit'],
);
assert.equal(report.futureSettlements.byMethod[0].netMinor, 12_000);
assert.equal(report.futureSettlements.byMethod[1].netMinor, 3_000);

assert.equal(report.pendingPayables.count, 7);
assert.equal(report.pendingPayables.totalMinor, 8_600);
assert.equal(report.pendingPayables.overdueCount, 1);
assert.equal(report.pendingPayables.overdueMinor, 500);
assert.equal(report.pendingPayables.items[0].scheduledDate, '2026-09-04');

assert.equal(report.daily.length, 91);
assert.deepEqual(
  {
    ...report.daily[0],
  },
  {
    day: 0,
    date: '2026-09-04',
    settlementMinor: 1_000,
    payableMinor: 700,
    netMovementMinor: 300,
    projectedKnownFundsMinor: 12_800,
  },
);
assert.equal(report.daily[90].date, '2026-12-03');
assert.deepEqual(
  {
    seven: { ...report.horizons['7'] },
    thirty: { ...report.horizons['30'] },
    sixty: { ...report.horizons['60'] },
    ninety: { ...report.horizons['90'] },
  },
  {
    seven: {
      days: 7,
      throughDate: '2026-09-11',
      settlementMinor: 3_000,
      payableMinor: 1_400,
      netMovementMinor: 1_600,
      projectedKnownFundsMinor: 14_100,
    },
    thirty: {
      days: 30,
      throughDate: '2026-10-04',
      settlementMinor: 6_000,
      payableMinor: 2_400,
      netMovementMinor: 3_600,
      projectedKnownFundsMinor: 16_100,
    },
    sixty: {
      days: 60,
      throughDate: '2026-11-03',
      settlementMinor: 10_000,
      payableMinor: 3_600,
      netMovementMinor: 6_400,
      projectedKnownFundsMinor: 18_900,
    },
    ninety: {
      days: 90,
      throughDate: '2026-12-03',
      settlementMinor: 10_000,
      payableMinor: 5_600,
      netMovementMinor: 4_400,
      projectedKnownFundsMinor: 16_900,
    },
  },
);

assert.equal(queryCalls.length, 3);
const normalizedSql = queryCalls.map(({ sql }) =>
  sql.replace(/\s+/g, ' ').trim(),
);
const cashQuery = normalizedSql.find((sql) => sql.includes('cash_sessions'));
const settlementQuery = normalizedSql.find((sql) => sql.includes('payments p'));
const payableQuery = normalizedSql.find((sql) => sql.includes('payables p'));
assert.match(cashQuery, /cm\.methodId = 'cash'/);
assert.match(cashQuery, /cs\.closedAt IS NULL/);
assert.match(cashQuery, /cm\.createdAt <= \?/);
assert.match(settlementQuery, /s\.status = 'confirmed'/);
assert.match(settlementQuery, /p\.methodId <> 'cash'/);
assert.match(settlementQuery, /p\.net AS netMinor/);
assert.match(settlementQuery, /p\.dueAt > \?/);
assert.match(payableQuery, /p\.status = 'pending'/);
assert(!normalizedSql.join(' ').toLowerCase().includes('bank'));
assert.deepEqual(
  queryCalls.find(({ sql }) => sql.includes('cash_sessions')).values,
  [asOf, asOf],
);
assert.deepEqual(
  queryCalls.find(({ sql }) => sql.includes('FROM payments')).values,
  [asOf],
);

const empty = buildCashFlowSnapshot(
  { cashSessions: [], futureSettlements: [], pendingPayables: [] },
  { asOf },
);
assert.equal(empty.currentRecordedCash.status, 'no_open_session');
assert.equal(empty.currentRecordedCash.amountMinor, 0);
assert.equal(empty.horizons['90'].projectedKnownFundsMinor, 0);

assert.throws(
  () =>
    buildCashFlowSnapshot(
      {
        cashSessions: [
          {
            id: 'bad-cash',
            openingMinor: 1.5,
            movementsMinor: 0,
            openedAt: asOf,
          },
        ],
        futureSettlements: [],
        pendingPayables: [],
      },
      { asOf },
    ),
  /entero seguro/,
);

console.log(
  'PASS: cash-flow integer money, cutoff, no-bank assumptions, query filters, overdue payables, daily series, and 7/30/60/90 projections.',
);
