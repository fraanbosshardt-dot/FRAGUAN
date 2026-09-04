import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('./lib/financial-calendar.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'financial-calendar.ts',
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
  'financial-calendar.ts must transpile without syntax errors',
);

const moduleRecord = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  exports: moduleRecord.exports,
  module: moduleRecord,
  require(specifier) {
    if (specifier === '@/db/queries') {
      return {
        rows() {
          throw new Error('Unexpected unmocked D1 read.');
        },
      };
    }
    throw new Error(`Unexpected import: ${specifier}`);
  },
});

const {
  FinancialCalendarValidationError,
  buildFinancialCalendar,
  buildInstallmentPlan,
  classifyDueDate,
  expandMonthlyRecurrence,
  expandWeeklyRecurrence,
  readFinancialCalendarFromD1,
  splitAmountIntoInstallments,
} = moduleRecord.exports;

assert.deepEqual(
  Array.from(
    expandMonthlyRecurrence({
      startsOn: '2027-01-31',
      throughOn: '2027-04-30',
    }),
  ),
  ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'],
  'Monthly dates stay anchored to day 31 instead of drifting after February.',
);
assert.deepEqual(
  Array.from(
    expandMonthlyRecurrence({
      startsOn: '2028-01-31',
      fromOn: '2028-02-01',
      throughOn: '2028-03-31',
    }),
  ),
  ['2028-02-29', '2028-03-31'],
  'Leap years use February 29 safely.',
);
assert.deepEqual(
  Array.from(
    expandWeeklyRecurrence({
      startsOn: '2026-10-25',
      throughOn: '2026-11-15',
    }),
  ),
  ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'],
  'Date-only UTC arithmetic is not affected by daylight-saving transitions.',
);
assert.deepEqual(
  Array.from(
    expandWeeklyRecurrence({
      startsOn: '2026-09-01',
      fromOn: '2026-09-10',
      throughOn: '2026-10-01',
      interval: 2,
      endsOn: '2026-09-29',
    }),
  ),
  ['2026-09-15', '2026-09-29'],
);
assert.throws(
  () =>
    expandMonthlyRecurrence({
      startsOn: '2027-02-29',
      throughOn: '2027-03-31',
    }),
  FinancialCalendarValidationError,
);

assert.deepEqual(
  Array.from(splitAmountIntoInstallments(1_000, 3)),
  [334, 333, 333],
);
assert.equal(
  splitAmountIntoInstallments(10_003, 6).reduce(
    (total, amount) => total + amount,
    0,
  ),
  10_003,
  'Installment allocation must preserve every cent.',
);
assert.deepEqual(
  Array.from(buildInstallmentPlan({
    obligationId: 'sewing-machine',
    totalMinor: 10_003,
    installmentCount: 3,
    firstDueOn: '2026-01-31',
  }), (installment) => ({ ...installment })),
  [
    {
      number: 1,
      amountMinor: 3_335,
      dueOn: '2026-01-31',
      reference: 'installment:sewing-machine:1',
    },
    {
      number: 2,
      amountMinor: 3_334,
      dueOn: '2026-02-28',
      reference: 'installment:sewing-machine:2',
    },
    {
      number: 3,
      amountMinor: 3_334,
      dueOn: '2026-03-31',
      reference: 'installment:sewing-machine:3',
    },
  ],
);

const asOf = '2026-09-04';
assert.equal(classifyDueDate('2026-09-03', asOf), 'overdue');
assert.equal(classifyDueDate('2026-09-04', asOf), 'today');
assert.equal(classifyDueDate('2026-09-05', asOf), 'next_7_days');
assert.equal(classifyDueDate('2026-09-11', asOf), 'next_7_days');
assert.equal(classifyDueDate('2026-09-12', asOf), 'next_30_days');
assert.equal(classifyDueDate('2026-10-04', asOf), 'next_30_days');
assert.equal(classifyDueDate('2026-10-05', asOf), 'next_60_days');
assert.equal(classifyDueDate('2026-11-03', asOf), 'next_60_days');
assert.equal(classifyDueDate('2026-11-04', asOf), 'later');

const queryCalls = [];
async function queryRows(sql, ...values) {
  queryCalls.push({ sql, values });
  return [
    {
      id: 'late-service',
      description: 'Servicio vencido',
      amountMinor: 200,
      dueAt: '2026-09-01',
      kind: 'Servicio',
      status: 'pending',
      reference: '',
      supplierId: null,
      supplierName: null,
    },
    {
      id: 'materialized-rent',
      description: 'Alquiler septiembre',
      amountMinor: 1_000,
      dueAt: '2026-09-10',
      kind: 'Alquiler',
      status: 'pending',
      reference: 'recurring:rent:2026-09-10',
      supplierId: 'owner',
      supplierName: 'Propietario',
    },
    {
      id: 'outside-horizon',
      description: 'Fuera del horizonte',
      amountMinor: 9_999,
      dueAt: '2026-12-01',
      kind: 'Otro',
      status: 'pending',
      reference: '',
      supplierId: null,
      supplierName: null,
    },
  ];
}

const calendar = await readFinancialCalendarFromD1(
  {
    recurringExpenses: [
      {
        id: 'rent',
        description: 'Alquiler',
        amountMinor: 1_000,
        startsOn: '2026-09-10',
        frequency: 'monthly',
        kind: 'Alquiler',
      },
    ],
    installmentObligations: [
      {
        obligationId: 'machine',
        description: 'Máquina',
        totalMinor: 1_000,
        installmentCount: 3,
        firstDueOn: '2026-08-31',
        paidInstallmentNumbers: [1],
      },
    ],
  },
  { asOf, horizonDays: 60 },
  queryRows,
);

assert.equal(queryCalls.length, 1);
assert.match(queryCalls[0].sql, /FROM payables p/);
assert.match(queryCalls[0].sql, /p\.status = 'pending'/);
assert.deepEqual(queryCalls[0].values, ['2026-11-03']);
assert.deepEqual(
  Array.from(calendar.entries, (entry) => entry.reference),
  [
    'payable:late-service',
    'recurring:rent:2026-09-10',
    'installment:machine:2',
    'recurring:rent:2026-10-10',
    'installment:machine:3',
  ],
  'Persisted payable references take precedence over generated occurrences.',
);
assert.equal(calendar.totalMinor, 2_866);
assert.equal(calendar.summary.overdue.count, 1);
assert.equal(calendar.summary.overdue.amountMinor, 200);
assert.equal(calendar.summary.next_7_days.count, 1);
assert.equal(calendar.summary.next_30_days.count, 1);
assert.equal(calendar.summary.next_60_days.count, 2);
assert.equal(
  calendar.entries.filter(
    (entry) => entry.reference === 'recurring:rent:2026-09-10',
  ).length,
  1,
);
assert.equal(
  calendar.entries.some((entry) => entry.sourceId === 'outside-horizon'),
  false,
);

assert.throws(
  () => splitAmountIntoInstallments(100, 0),
  FinancialCalendarValidationError,
);
assert.throws(
  () =>
    buildFinancialCalendar(
      {
        payables: [
          {
            id: 'bad',
            description: 'Dato inválido',
            amountMinor: 10.5,
            dueAt: asOf,
            kind: 'Otro',
          },
        ],
      },
      { asOf },
    ),
  FinancialCalendarValidationError,
);

console.log(
  'Financial calendar tests passed: safe recurrence dates, exact installments, due buckets, D1 payables and idempotent combined entries.',
);
