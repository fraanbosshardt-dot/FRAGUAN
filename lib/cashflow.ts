import { rows } from '@/db/queries';

export const CASH_FLOW_HORIZONS = [7, 30, 60, 90] as const;
export const CASH_FLOW_MAX_DAYS = 90;
export const DEFAULT_BUSINESS_UTC_OFFSET_MINUTES = -180;

export const CASH_FLOW_ASSUMPTIONS = {
  bankBalanceIncluded: false,
  bankBalanceMinor: null,
  currencyUnit: 'minor' as const,
  notes: [
    'El saldo inicial incluye solamente el efectivo registrado en la caja abierta.',
    'Si no hay una caja abierta, el saldo inicial registrado es cero y no se arrastra el conteo de un cierre anterior.',
    'No se consulta, estima ni incorpora ningún saldo de cuenta bancaria.',
    'Las liquidaciones futuras incluyen pagos no efectivos de ventas confirmadas, por su importe neto de comisión y únicamente mientras dueAt sea posterior al corte.',
    'Cada pago se proyecta como una sola liquidación en dueAt porque el esquema actual no guarda un calendario separado por cuota.',
    'Las liquidaciones con vencimiento anterior al corte no se incorporan porque el modelo no registra si ya ingresaron al banco.',
    'Toda cuenta con estado pending se descuenta en su vencimiento; las vencidas se descuentan en el día cero de la proyección.',
    'El medio con el que se pagará una cuenta pendiente todavía no está registrado, por lo que la proyección la descuenta sin asignarla a efectivo o banco.',
    'No se pronostican ventas, gastos, retiros, devoluciones ni otros movimientos que todavía no estén registrados.',
  ],
} as const;

type QueryRows = <T = Record<string, unknown>>(
  sql: string,
  ...values: unknown[]
) => Promise<T[]>;

type CashSessionRow = {
  id: string;
  openingMinor: number;
  movementsMinor: number;
  openedAt: string;
};

type SettlementRow = {
  id: string;
  saleId: string;
  methodId: string;
  methodName: string;
  grossMinor: number;
  commissionMinor: number;
  netMinor: number;
  dueAt: string;
};

type PayableRow = {
  id: string;
  description: string;
  supplierId: string | null;
  supplierName: string | null;
  amountMinor: number;
  dueAt: string;
  kind: string;
  reference: string;
};

export type CashFlowSourceRows = {
  cashSessions: readonly CashSessionRow[];
  futureSettlements: readonly SettlementRow[];
  pendingPayables: readonly PayableRow[];
};

export type CashFlowOptions = {
  asOf?: string | Date;
  businessUtcOffsetMinutes?: number;
  currency?: string;
};

export type DailyCashFlow = {
  day: number;
  date: string;
  settlementMinor: number;
  payableMinor: number;
  netMovementMinor: number;
  projectedKnownFundsMinor: number;
};

export type CashFlowProjection = {
  days: (typeof CASH_FLOW_HORIZONS)[number];
  throughDate: string;
  settlementMinor: number;
  payableMinor: number;
  netMovementMinor: number;
  projectedKnownFundsMinor: number;
};

export type CashFlowSnapshot = {
  asOf: string;
  asOfDate: string;
  currency: string;
  currencyUnit: 'minor';
  businessUtcOffsetMinutes: number;
  currentRecordedCash: {
    status: 'open' | 'no_open_session';
    amountMinor: number;
    sessionId: string | null;
    openingMinor: number;
    movementsMinor: number;
    openedAt: string | null;
  };
  futureSettlements: {
    totalGrossMinor: number;
    totalCommissionMinor: number;
    totalNetMinor: number;
    count: number;
    byMethod: Array<{
      methodId: string;
      methodName: string;
      grossMinor: number;
      commissionMinor: number;
      netMinor: number;
      count: number;
      nextDueAt: string;
    }>;
    items: Array<SettlementRow & { scheduledDate: string }>;
  };
  pendingPayables: {
    totalMinor: number;
    overdueMinor: number;
    count: number;
    overdueCount: number;
    items: Array<
      PayableRow & {
        dueDate: string;
        scheduledDate: string;
        overdue: boolean;
      }
    >;
  };
  horizons: Record<
    `${(typeof CASH_FLOW_HORIZONS)[number]}`,
    CashFlowProjection
  >;
  daily: DailyCashFlow[];
  assumptions: typeof CASH_FLOW_ASSUMPTIONS;
};

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function integer(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${label} debe ser un entero seguro en unidad mínima.`);
  return parsed;
}

function nonnegativeMoney(value: unknown, label: string): number {
  const parsed = integer(value, label);
  if (parsed < 0) throw new Error(`${label} no puede ser negativo.`);
  return parsed;
}

function addMoney(total: number, amount: number, label: string): number {
  const result = total + amount;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} excede el rango entero seguro.`);
  return result;
}

function instant(value: string | Date | undefined): string {
  const parsed = value === undefined ? new Date() : new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new RangeError('asOf debe ser una fecha válida.');
  return parsed.toISOString();
}

function dateValue(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} inválida.`);
  return parsed;
}

function businessDate(value: string, offsetMinutes: number): string {
  if (DATE_ONLY.test(value)) return value;
  const parsed = dateValue(value, 'Fecha');
  return new Date(parsed.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

function dateSerial(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`) / DAY_MS;
}

function addDays(value: string, days: number): string {
  return new Date((dateSerial(value) + days) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dayDifference(from: string, to: string): number {
  return dateSerial(to) - dateSerial(from);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateOffset(value: number | undefined): number {
  const offset = value ?? DEFAULT_BUSINESS_UTC_OFFSET_MINUTES;
  if (!Number.isInteger(offset) || offset < -840 || offset > 840)
    throw new RangeError(
      'businessUtcOffsetMinutes debe ser un entero entre -840 y 840.',
    );
  return offset;
}

function validateCurrency(value: string | undefined): string {
  const currency = (value ?? 'ARS').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    throw new RangeError(
      'currency debe ser un código ISO 4217 de tres letras.',
    );
  return currency;
}

/**
 * Builds the report from already queried rows. All monetary values are integer
 * minor units. This export keeps the date and money rules independently testable.
 */
export function buildCashFlowSnapshot(
  source: CashFlowSourceRows,
  options: CashFlowOptions = {},
): CashFlowSnapshot {
  const asOf = instant(options.asOf);
  const offset = validateOffset(options.businessUtcOffsetMinutes);
  const currency = validateCurrency(options.currency);
  const asOfDate = businessDate(asOf, offset);
  const asOfTime = Date.parse(asOf);
  const session = source.cashSessions[0] ?? null;
  const openingMinor = session
    ? nonnegativeMoney(session.openingMinor, 'cash_sessions.opening')
    : 0;
  const movementsMinor = session
    ? integer(session.movementsMinor, 'cash_movements.amount')
    : 0;
  const recordedCashMinor = addMoney(
    openingMinor,
    movementsMinor,
    'Efectivo registrado',
  );

  const settlements = source.futureSettlements
    .map((row) => {
      const grossMinor = nonnegativeMoney(
        row.grossMinor,
        `payments.amount (${row.id})`,
      );
      const commissionMinor = nonnegativeMoney(
        row.commissionMinor,
        `payments.commission (${row.id})`,
      );
      const netMinor = nonnegativeMoney(
        row.netMinor,
        `payments.net (${row.id})`,
      );
      if (netMinor !== grossMinor - commissionMinor)
        throw new Error(
          `La liquidación ${row.id} tiene importes inconsistentes.`,
        );
      const dueAt = dateValue(row.dueAt, `payments.dueAt (${row.id})`);
      return {
        ...row,
        grossMinor,
        commissionMinor,
        netMinor,
        scheduledDate: businessDate(row.dueAt, offset),
        dueTime: dueAt.getTime(),
      };
    })
    .filter((row) => row.dueTime > asOfTime)
    .sort(
      (left, right) =>
        left.dueTime - right.dueTime || compareText(left.id, right.id),
    );

  const payables = source.pendingPayables
    .map((row) => {
      const amountMinor = nonnegativeMoney(
        row.amountMinor,
        `payables.amount (${row.id})`,
      );
      const dueDate = businessDate(row.dueAt, offset);
      const overdue = dueDate < asOfDate;
      return {
        ...row,
        amountMinor,
        dueDate,
        scheduledDate: overdue ? asOfDate : dueDate,
        overdue,
      };
    })
    .sort(
      (left, right) =>
        compareText(left.dueDate, right.dueDate) ||
        compareText(left.id, right.id),
    );

  let totalGrossMinor = 0;
  let totalCommissionMinor = 0;
  let totalNetMinor = 0;
  const methods = new Map<
    string,
    {
      methodId: string;
      methodName: string;
      grossMinor: number;
      commissionMinor: number;
      netMinor: number;
      count: number;
      nextDueAt: string;
    }
  >();
  for (const settlement of settlements) {
    totalGrossMinor = addMoney(
      totalGrossMinor,
      settlement.grossMinor,
      'Total bruto de liquidaciones',
    );
    totalCommissionMinor = addMoney(
      totalCommissionMinor,
      settlement.commissionMinor,
      'Total de comisiones',
    );
    totalNetMinor = addMoney(
      totalNetMinor,
      settlement.netMinor,
      'Total neto de liquidaciones',
    );
    const method = methods.get(settlement.methodId) ?? {
      methodId: settlement.methodId,
      methodName: settlement.methodName,
      grossMinor: 0,
      commissionMinor: 0,
      netMinor: 0,
      count: 0,
      nextDueAt: settlement.dueAt,
    };
    method.grossMinor = addMoney(
      method.grossMinor,
      settlement.grossMinor,
      `Bruto de ${method.methodId}`,
    );
    method.commissionMinor = addMoney(
      method.commissionMinor,
      settlement.commissionMinor,
      `Comisión de ${method.methodId}`,
    );
    method.netMinor = addMoney(
      method.netMinor,
      settlement.netMinor,
      `Neto de ${method.methodId}`,
    );
    method.count += 1;
    if (settlement.dueAt < method.nextDueAt)
      method.nextDueAt = settlement.dueAt;
    methods.set(settlement.methodId, method);
  }

  let totalPayableMinor = 0;
  let overdueMinor = 0;
  let overdueCount = 0;
  for (const payable of payables) {
    totalPayableMinor = addMoney(
      totalPayableMinor,
      payable.amountMinor,
      'Total de cuentas pendientes',
    );
    if (payable.overdue) {
      overdueMinor = addMoney(
        overdueMinor,
        payable.amountMinor,
        'Total de cuentas vencidas',
      );
      overdueCount += 1;
    }
  }

  const settlementByDay = new Map<number, number>();
  const payableByDay = new Map<number, number>();
  for (const settlement of settlements) {
    const day = dayDifference(asOfDate, settlement.scheduledDate);
    if (day < 0 || day > CASH_FLOW_MAX_DAYS) continue;
    settlementByDay.set(
      day,
      addMoney(
        settlementByDay.get(day) ?? 0,
        settlement.netMinor,
        `Liquidaciones del día ${day}`,
      ),
    );
  }
  for (const payable of payables) {
    const day = Math.max(0, dayDifference(asOfDate, payable.scheduledDate));
    if (day > CASH_FLOW_MAX_DAYS) continue;
    payableByDay.set(
      day,
      addMoney(
        payableByDay.get(day) ?? 0,
        payable.amountMinor,
        `Cuentas del día ${day}`,
      ),
    );
  }

  const daily: DailyCashFlow[] = [];
  let projectedKnownFundsMinor = recordedCashMinor;
  let cumulativeSettlementMinor = 0;
  let cumulativePayableMinor = 0;
  const horizons = {} as Record<
    `${(typeof CASH_FLOW_HORIZONS)[number]}`,
    CashFlowProjection
  >;
  for (let day = 0; day <= CASH_FLOW_MAX_DAYS; day += 1) {
    const settlementMinor = settlementByDay.get(day) ?? 0;
    const payableMinor = payableByDay.get(day) ?? 0;
    const netMovementMinor = addMoney(
      settlementMinor,
      -payableMinor,
      `Movimiento neto del día ${day}`,
    );
    projectedKnownFundsMinor = addMoney(
      projectedKnownFundsMinor,
      netMovementMinor,
      `Proyección del día ${day}`,
    );
    cumulativeSettlementMinor = addMoney(
      cumulativeSettlementMinor,
      settlementMinor,
      `Liquidaciones acumuladas al día ${day}`,
    );
    cumulativePayableMinor = addMoney(
      cumulativePayableMinor,
      payableMinor,
      `Cuentas acumuladas al día ${day}`,
    );
    const date = addDays(asOfDate, day);
    daily.push({
      day,
      date,
      settlementMinor,
      payableMinor,
      netMovementMinor,
      projectedKnownFundsMinor,
    });
    if (CASH_FLOW_HORIZONS.includes(day as 7 | 30 | 60 | 90)) {
      const horizon = day as (typeof CASH_FLOW_HORIZONS)[number];
      horizons[String(horizon) as `${typeof horizon}`] = {
        days: horizon,
        throughDate: date,
        settlementMinor: cumulativeSettlementMinor,
        payableMinor: cumulativePayableMinor,
        netMovementMinor: addMoney(
          cumulativeSettlementMinor,
          -cumulativePayableMinor,
          `Movimiento neto a ${horizon} días`,
        ),
        projectedKnownFundsMinor,
      };
    }
  }

  return {
    asOf,
    asOfDate,
    currency,
    currencyUnit: 'minor',
    businessUtcOffsetMinutes: offset,
    currentRecordedCash: {
      status: session ? 'open' : 'no_open_session',
      amountMinor: recordedCashMinor,
      sessionId: session?.id ?? null,
      openingMinor,
      movementsMinor,
      openedAt: session?.openedAt ?? null,
    },
    futureSettlements: {
      totalGrossMinor,
      totalCommissionMinor,
      totalNetMinor,
      count: settlements.length,
      byMethod: [...methods.values()].sort((left, right) =>
        compareText(left.methodId, right.methodId),
      ),
      items: settlements.map(({ dueTime: _dueTime, ...item }) => item),
    },
    pendingPayables: {
      totalMinor: totalPayableMinor,
      overdueMinor,
      count: payables.length,
      overdueCount,
      items: payables,
    },
    horizons,
    daily,
    assumptions: CASH_FLOW_ASSUMPTIONS,
  };
}

/**
 * Reads the current known cash-flow commitments from D1 and returns projections.
 * The optional query argument is intended for deterministic contract tests.
 */
export async function getCashFlow(
  options: CashFlowOptions = {},
  query: QueryRows = rows,
): Promise<CashFlowSnapshot> {
  const asOf = instant(options.asOf);
  const [cashSessions, futureSettlements, pendingPayables] = await Promise.all([
    query<CashSessionRow>(
      `SELECT
         cs.id,
         cs.opening AS openingMinor,
         COALESCE(SUM(cm.amount), 0) AS movementsMinor,
         cs.openedAt
       FROM cash_sessions cs
       LEFT JOIN cash_movements cm
         ON cm.sessionId = cs.id
        AND cm.methodId = 'cash'
        AND cm.createdAt <= ?
       WHERE cs.closedAt IS NULL
         AND cs.openedAt <= ?
       GROUP BY cs.id, cs.opening, cs.openedAt
       ORDER BY cs.openedAt DESC
       LIMIT 1`,
      asOf,
      asOf,
    ),
    query<SettlementRow>(
      `SELECT
         p.id,
         p.saleId,
         p.methodId,
         m.name AS methodName,
         p.amount AS grossMinor,
         p.commission AS commissionMinor,
         p.net AS netMinor,
         p.dueAt
       FROM payments p
       JOIN sales s ON s.id = p.saleId
       JOIN payment_methods m ON m.id = p.methodId
       WHERE s.status = 'confirmed'
         AND p.methodId <> 'cash'
         AND p.dueAt > ?
       ORDER BY p.dueAt, p.id`,
      asOf,
    ),
    query<PayableRow>(
      `SELECT
         p.id,
         p.description,
         p.supplierId,
         s.name AS supplierName,
         p.amount AS amountMinor,
         p.dueAt,
         p.kind,
         p.reference
       FROM payables p
       LEFT JOIN suppliers s ON s.id = p.supplierId
       WHERE p.status = 'pending'
       ORDER BY p.dueAt, p.id`,
    ),
  ]);

  return buildCashFlowSnapshot(
    { cashSessions, futureSettlements, pendingPayables },
    { ...options, asOf },
  );
}
