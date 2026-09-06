import { rows } from '@/db/queries';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const MAX_RECURRENCE_OCCURRENCES = 10_000;
const MAX_INSTALLMENTS = 600;
export const DEFAULT_FINANCIAL_CALENDAR_HORIZON_DAYS = 60;
export const DEFAULT_BUSINESS_UTC_OFFSET_MINUTES = -180;

export class FinancialCalendarValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialCalendarValidationError';
  }
}

export type RecurrenceFrequency = 'weekly' | 'monthly';

export type RecurrenceExpansionInput = {
  startsOn: string;
  throughOn: string;
  fromOn?: string;
  endsOn?: string | null;
  interval?: number;
  maxOccurrences?: number;
};

export type DueBucket =
  | 'overdue'
  | 'today'
  | 'next_7_days'
  | 'next_30_days'
  | 'next_60_days'
  | 'later';

export const DUE_BUCKET_LABELS: Readonly<Record<DueBucket, string>> = {
  overdue: 'Vencido',
  today: 'Hoy',
  next_7_days: 'Próximos 7 días',
  next_30_days: 'Próximos 30 días',
  next_60_days: 'Próximos 60 días',
  later: 'Más adelante',
};

export type InstallmentPlanInput = {
  obligationId: string;
  totalMinor: number;
  installmentCount: number;
  firstDueOn: string;
  intervalMonths?: number;
};

export type InstallmentPlanItem = {
  number: number;
  amountMinor: number;
  dueOn: string;
  reference: string;
};

export type RecurringExpenseDefinition = {
  id: string;
  description: string;
  amountMinor: number;
  startsOn: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  endsOn?: string | null;
  kind?: string;
  category?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  active?: boolean;
};

export type InstallmentObligationDefinition = InstallmentPlanInput & {
  description: string;
  kind?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  paidInstallmentNumbers?: readonly number[];
  active?: boolean;
};

export type ExistingPayable = {
  id: string;
  description: string;
  amountMinor: number;
  dueAt: string;
  kind: string;
  status?: string;
  reference?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
};

export type FinancialCalendarEntry = {
  id: string;
  source: 'payable' | 'recurring_expense' | 'installment';
  sourceId: string;
  reference: string;
  description: string;
  amountMinor: number;
  dueOn: string;
  daysUntilDue: number;
  bucket: DueBucket;
  kind: string;
  supplierId: string | null;
  supplierName: string | null;
  installmentNumber: number | null;
};

export type FinancialCalendarSource = {
  payables?: readonly ExistingPayable[];
  recurringExpenses?: readonly RecurringExpenseDefinition[];
  installmentObligations?: readonly InstallmentObligationDefinition[];
};

export type FinancialCalendarOptions = {
  asOf?: string | Date;
  horizonDays?: number;
  businessUtcOffsetMinutes?: number;
};

export type FinancialCalendarSummaryBucket = {
  bucket: DueBucket;
  label: string;
  count: number;
  amountMinor: number;
};

export type FinancialCalendar = {
  asOf: string;
  throughOn: string;
  horizonDays: number;
  currencyUnit: 'minor';
  entries: FinancialCalendarEntry[];
  totalMinor: number;
  summary: Record<DueBucket, FinancialCalendarSummaryBucket>;
};

type QueryRows = <T = Record<string, unknown>>(
  sql: string,
  ...values: unknown[]
) => Promise<T[]>;

function validation(message: string): never {
  throw new FinancialCalendarValidationError(message);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    validation(`${field} debe ser un texto no vacío.`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field);
}

function safeInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    validation(
      `${field} debe ser un entero seguro entre ${minimum} y ${maximum}.`,
    );
  }
  return value;
}

function parseDateOnly(value: unknown, field: string): number {
  if (typeof value !== 'string') {
    validation(`${field} debe usar el formato YYYY-MM-DD.`);
  }
  const match = DATE_ONLY.exec(value);
  if (!match) validation(`${field} debe usar el formato YYYY-MM-DD.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    validation(`${field} contiene una fecha inexistente.`);
  }
  return timestamp;
}

function formatDateOnly(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizeBusinessDate(
  value: string | Date | undefined,
  offsetMinutes: number,
): string {
  if (value === undefined) {
    const shifted = Date.now() + offsetMinutes * 60_000;
    return formatDateOnly(shifted);
  }
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    parseDateOnly(value, 'asOf');
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    validation('asOf debe ser una fecha válida.');
  return formatDateOnly(date.getTime() + offsetMinutes * 60_000);
}

function normalizeStoredDueDate(
  value: unknown,
  field: string,
  offsetMinutes: number,
): string {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    parseDateOnly(value, field);
    return value;
  }
  if (typeof value !== 'string') validation(`${field} debe ser una fecha.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    validation(`${field} debe ser una fecha válida.`);
  return formatDateOnly(date.getTime() + offsetMinutes * 60_000);
}

function addDays(date: string, days: number): string {
  return formatDateOnly(parseDateOnly(date, 'date') + days * DAY_MS);
}

function addAnchoredMonths(
  startTimestamp: number,
  monthOffset: number,
): number {
  const start = new Date(startTimestamp);
  const anchorDay = start.getUTCDate();
  const firstOfTargetMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1),
  );
  const lastDay = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  return Date.UTC(
    firstOfTargetMonth.getUTCFullYear(),
    firstOfTargetMonth.getUTCMonth(),
    Math.min(anchorDay, lastDay),
  );
}

export function expandRecurrence(
  frequency: RecurrenceFrequency,
  input: RecurrenceExpansionInput,
): string[] {
  if (frequency !== 'weekly' && frequency !== 'monthly') {
    validation('frequency debe ser weekly o monthly.');
  }
  const startsAt = parseDateOnly(input.startsOn, 'startsOn');
  const fromAt = parseDateOnly(input.fromOn ?? input.startsOn, 'fromOn');
  let throughAt = parseDateOnly(input.throughOn, 'throughOn');
  if (input.endsOn) {
    throughAt = Math.min(throughAt, parseDateOnly(input.endsOn, 'endsOn'));
  }
  if (fromAt > throughAt || startsAt > throughAt) return [];

  const interval = safeInteger(input.interval ?? 1, 'interval', 1, 120);
  const limit = safeInteger(
    input.maxOccurrences ?? MAX_RECURRENCE_OCCURRENCES,
    'maxOccurrences',
    1,
    MAX_RECURRENCE_OCCURRENCES,
  );
  const result: string[] = [];
  let sequence = 0;

  while (sequence < limit) {
    const occurrenceAt =
      frequency === 'weekly'
        ? startsAt + sequence * interval * 7 * DAY_MS
        : addAnchoredMonths(startsAt, sequence * interval);
    if (occurrenceAt > throughAt) return result;
    if (occurrenceAt >= fromAt) result.push(formatDateOnly(occurrenceAt));
    sequence += 1;
  }

  const nextAt =
    frequency === 'weekly'
      ? startsAt + sequence * interval * 7 * DAY_MS
      : addAnchoredMonths(startsAt, sequence * interval);
  if (nextAt <= throughAt) {
    validation(
      `La recurrencia supera el máximo de ${limit} ocurrencias permitido.`,
    );
  }
  return result;
}

export function expandWeeklyRecurrence(
  input: RecurrenceExpansionInput,
): string[] {
  return expandRecurrence('weekly', input);
}

export function expandMonthlyRecurrence(
  input: RecurrenceExpansionInput,
): string[] {
  return expandRecurrence('monthly', input);
}

export function splitAmountIntoInstallments(
  totalMinor: number,
  installmentCount: number,
): number[] {
  const total = safeInteger(totalMinor, 'totalMinor', 1);
  const count = safeInteger(
    installmentCount,
    'installmentCount',
    1,
    MAX_INSTALLMENTS,
  );
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function buildInstallmentPlan(
  input: InstallmentPlanInput,
): InstallmentPlanItem[] {
  const obligationId = requiredText(input.obligationId, 'obligationId');
  const firstDueAt = parseDateOnly(input.firstDueOn, 'firstDueOn');
  const intervalMonths = safeInteger(
    input.intervalMonths ?? 1,
    'intervalMonths',
    1,
    120,
  );
  const amounts = splitAmountIntoInstallments(
    input.totalMinor,
    input.installmentCount,
  );
  return amounts.map((amountMinor, index) => ({
    number: index + 1,
    amountMinor,
    dueOn: formatDateOnly(
      addAnchoredMonths(firstDueAt, index * intervalMonths),
    ),
    reference: `installment:${obligationId}:${index + 1}`,
  }));
}

export function daysUntilDue(dueOn: string, asOf: string): number {
  return (parseDateOnly(dueOn, 'dueOn') - parseDateOnly(asOf, 'asOf')) / DAY_MS;
}

export function classifyDueDate(dueOn: string, asOf: string): DueBucket {
  const days = daysUntilDue(dueOn, asOf);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'next_7_days';
  if (days <= 30) return 'next_30_days';
  if (days <= 60) return 'next_60_days';
  return 'later';
}

function emptySummary(): Record<DueBucket, FinancialCalendarSummaryBucket> {
  return Object.fromEntries(
    (Object.keys(DUE_BUCKET_LABELS) as DueBucket[]).map((bucket) => [
      bucket,
      {
        bucket,
        label: DUE_BUCKET_LABELS[bucket],
        count: 0,
        amountMinor: 0,
      },
    ]),
  ) as Record<DueBucket, FinancialCalendarSummaryBucket>;
}

function calendarOptions(options: FinancialCalendarOptions) {
  const offset = safeInteger(
    options.businessUtcOffsetMinutes ?? DEFAULT_BUSINESS_UTC_OFFSET_MINUTES,
    'businessUtcOffsetMinutes',
    -840,
    840,
  );
  const asOf = normalizeBusinessDate(options.asOf, offset);
  const horizonDays = safeInteger(
    options.horizonDays ?? DEFAULT_FINANCIAL_CALENDAR_HORIZON_DAYS,
    'horizonDays',
    0,
    3_660,
  );
  return { offset, asOf, horizonDays, throughOn: addDays(asOf, horizonDays) };
}

function newEntry(
  input: Omit<FinancialCalendarEntry, 'daysUntilDue' | 'bucket'>,
  asOf: string,
): FinancialCalendarEntry {
  const days = daysUntilDue(input.dueOn, asOf);
  return {
    ...input,
    daysUntilDue: days,
    bucket: classifyDueDate(input.dueOn, asOf),
  };
}

export function buildFinancialCalendar(
  source: FinancialCalendarSource,
  options: FinancialCalendarOptions = {},
): FinancialCalendar {
  const { offset, asOf, horizonDays, throughOn } = calendarOptions(options);
  const throughAt = parseDateOnly(throughOn, 'throughOn');
  const entries: FinancialCalendarEntry[] = [];
  const persistedReferences = new Set<string>();

  for (const payable of source.payables ?? []) {
    if (payable.status && payable.status !== 'pending') continue;
    const id = requiredText(payable.id, 'payable.id');
    const dueOn = normalizeStoredDueDate(
      payable.dueAt,
      `payable.dueAt (${id})`,
      offset,
    );
    if (parseDateOnly(dueOn, 'payable.dueOn') > throughAt) continue;
    const reference = optionalText(
      payable.reference,
      `payable.reference (${id})`,
    );
    if (reference) persistedReferences.add(reference);
    entries.push(
      newEntry(
        {
          id: `payable:${id}`,
          source: 'payable',
          sourceId: id,
          reference: reference ?? `payable:${id}`,
          description: requiredText(
            payable.description,
            `payable.description (${id})`,
          ),
          amountMinor: safeInteger(
            payable.amountMinor,
            `payable.amountMinor (${id})`,
            1,
          ),
          dueOn,
          kind: requiredText(payable.kind, `payable.kind (${id})`),
          supplierId: optionalText(
            payable.supplierId,
            `payable.supplierId (${id})`,
          ),
          supplierName: optionalText(
            payable.supplierName,
            `payable.supplierName (${id})`,
          ),
          installmentNumber: null,
        },
        asOf,
      ),
    );
  }

  for (const recurring of source.recurringExpenses ?? []) {
    if (recurring.active === false) continue;
    const id = requiredText(recurring.id, 'recurringExpense.id');
    const description = requiredText(
      recurring.description,
      `recurringExpense.description (${id})`,
    );
    const amountMinor = safeInteger(
      recurring.amountMinor,
      `recurringExpense.amountMinor (${id})`,
      1,
    );
    const dueDates = expandRecurrence(recurring.frequency, {
      startsOn: recurring.startsOn,
      fromOn: asOf,
      throughOn,
      endsOn: recurring.endsOn,
      interval: recurring.interval,
    });
    for (const dueOn of dueDates) {
      const reference = `recurring:${id}:${dueOn}`;
      if (persistedReferences.has(reference)) continue;
      entries.push(
        newEntry(
          {
            id: reference,
            source: 'recurring_expense',
            sourceId: id,
            reference,
            description,
            amountMinor,
            dueOn,
            kind: recurring.kind?.trim() || 'Gasto recurrente',
            supplierId: optionalText(
              recurring.supplierId,
              `recurringExpense.supplierId (${id})`,
            ),
            supplierName: optionalText(
              recurring.supplierName,
              `recurringExpense.supplierName (${id})`,
            ),
            installmentNumber: null,
          },
          asOf,
        ),
      );
    }
  }

  for (const obligation of source.installmentObligations ?? []) {
    if (obligation.active === false) continue;
    const id = requiredText(obligation.obligationId, 'obligation.id');
    const description = requiredText(
      obligation.description,
      `obligation.description (${id})`,
    );
    const paid = new Set<number>();
    for (const number of obligation.paidInstallmentNumbers ?? []) {
      paid.add(
        safeInteger(
          number,
          `obligation.paidInstallmentNumbers (${id})`,
          1,
          obligation.installmentCount,
        ),
      );
    }
    for (const installment of buildInstallmentPlan(obligation)) {
      if (paid.has(installment.number)) continue;
      if (parseDateOnly(installment.dueOn, 'installment.dueOn') > throughAt)
        continue;
      if (persistedReferences.has(installment.reference)) continue;
      entries.push(
        newEntry(
          {
            id: installment.reference,
            source: 'installment',
            sourceId: id,
            reference: installment.reference,
            description,
            amountMinor: installment.amountMinor,
            dueOn: installment.dueOn,
            kind: obligation.kind?.trim() || 'Obligación en cuotas',
            supplierId: optionalText(
              obligation.supplierId,
              `obligation.supplierId (${id})`,
            ),
            supplierName: optionalText(
              obligation.supplierName,
              `obligation.supplierName (${id})`,
            ),
            installmentNumber: installment.number,
          },
          asOf,
        ),
      );
    }
  }

  const priority: Record<FinancialCalendarEntry['source'], number> = {
    payable: 0,
    installment: 1,
    recurring_expense: 2,
  };
  entries.sort(
    (left, right) =>
      left.dueOn.localeCompare(right.dueOn) ||
      priority[left.source] - priority[right.source] ||
      left.id.localeCompare(right.id),
  );

  const summary = emptySummary();
  let totalMinor = 0;
  for (const entry of entries) {
    summary[entry.bucket].count += 1;
    summary[entry.bucket].amountMinor += entry.amountMinor;
    totalMinor += entry.amountMinor;
  }

  return {
    asOf,
    throughOn,
    horizonDays,
    currencyUnit: 'minor',
    entries,
    totalMinor,
    summary,
  };
}

export async function readFinancialCalendarFromD1(
  source: Omit<FinancialCalendarSource, 'payables'> = {},
  options: FinancialCalendarOptions = {},
  queryRows: QueryRows = rows,
): Promise<FinancialCalendar> {
  const { throughOn } = calendarOptions(options);
  const payables = await queryRows<ExistingPayable>(
    `WITH commitments AS (SELECT p.id,
            p.description,
            p.amount AS amountMinor,
            COALESCE(c.dueAt,p.dueAt) AS dueAt,
            p.kind,
            p.status,
            p.reference,
            p.supplierId,
            s.name AS supplierName
       FROM payables p
       LEFT JOIN suppliers s ON s.id = p.supplierId
       LEFT JOIN checks c ON c.payableId=p.id AND c.status='issued'
      WHERE p.status = 'pending'
      UNION ALL
      SELECT 'check:'||c.id,'Cheque '||c.number,c.amount,c.dueAt,'Cheque','pending',c.id,NULL,NULL
      FROM checks c WHERE c.direction='issued' AND c.status='issued' AND c.payableId IS NULL)
      SELECT * FROM commitments WHERE substr(dueAt,1,10)<=? ORDER BY dueAt,id`,
    throughOn,
  );
  return buildFinancialCalendar({ ...source, payables }, options);
}

/**
 * Contract for the final database/API integration. Recurrences should be
 * materialized into `payables` transactionally, using `reference` as an
 * idempotency key. The calendar remains a read model and never creates cash
 * movements or marks debt as paid by itself.
 */
export const FINANCIAL_CALENDAR_RECOMMENDED_INTEGRATION = {
  schemaVersion: 1,
  migrations: {
    recurringExpenses: {
      table: 'recurring_expenses',
      fields: [
        'id TEXT PRIMARY KEY',
        'description TEXT NOT NULL',
        'category TEXT',
        'amount INTEGER NOT NULL CHECK(amount > 0)',
        "frequency TEXT NOT NULL CHECK(frequency IN ('weekly','monthly'))",
        'interval INTEGER NOT NULL DEFAULT 1 CHECK(interval > 0)',
        'startsOn TEXT NOT NULL',
        'endsOn TEXT',
        'supplierId TEXT REFERENCES suppliers(id)',
        'methodId TEXT',
        'active INTEGER NOT NULL DEFAULT 1',
        'createdBy TEXT NOT NULL',
        'createdAt TEXT NOT NULL',
        'updatedAt TEXT NOT NULL',
      ],
    },
    obligations: {
      table: 'financial_obligations',
      fields: [
        'id TEXT PRIMARY KEY',
        'description TEXT NOT NULL',
        'supplierId TEXT REFERENCES suppliers(id)',
        'total INTEGER NOT NULL CHECK(total > 0)',
        'installmentCount INTEGER NOT NULL CHECK(installmentCount > 0)',
        'firstDueOn TEXT NOT NULL',
        'intervalMonths INTEGER NOT NULL DEFAULT 1 CHECK(intervalMonths > 0)',
        "status TEXT NOT NULL DEFAULT 'active'",
        'createdBy TEXT NOT NULL',
        'createdAt TEXT NOT NULL',
      ],
    },
    installments: {
      table: 'obligation_installments',
      fields: [
        'id TEXT PRIMARY KEY',
        'obligationId TEXT NOT NULL REFERENCES financial_obligations(id)',
        'number INTEGER NOT NULL',
        'amount INTEGER NOT NULL CHECK(amount > 0)',
        'dueOn TEXT NOT NULL',
        "status TEXT NOT NULL DEFAULT 'pending'",
        'payableId TEXT REFERENCES payables(id)',
        'paidAt TEXT',
        'UNIQUE(obligationId, number)',
      ],
    },
    payableGuard:
      "CREATE UNIQUE INDEX payables_reference_unique ON payables(reference) WHERE reference <> '';",
  },
  materialization: {
    recurringReference: 'recurring:{recurringExpenseId}:{YYYY-MM-DD}',
    installmentReference: 'installment:{obligationId}:{number}',
    rule: 'Crear cada payable y registrar su origen dentro de una única transacción; ON CONFLICT(reference) no debe duplicar el vencimiento.',
  },
  api: {
    read: 'GET /api/financial-calendar?asOf=YYYY-MM-DD&horizonDays=60',
    permissions: ['cash-flow', 'payables'],
    serverRule:
      'Validar permisos y devolver importes financieros solamente a gerente o administrador.',
  },
} as const;
