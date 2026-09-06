import { rows } from '@/db/queries';
import { getCashFlow, buildCashFlowSnapshot } from './cashflow';
export async function consolidatedCashFlow() {
  const base = await getCashFlow();
  const [accounts, checks] = await Promise.all([
    rows<{ balance: number }>(
      'SELECT a.opening+COALESCE(SUM(e.amount),0) AS balance FROM bank_accounts a LEFT JOIN bank_entries e ON e.accountId=a.id AND e.occurredAt<=? WHERE a.createdAt<=? GROUP BY a.id',
      base.asOfDate,
      base.asOf,
    ),
    rows<{
      id: string;
      number: string;
      direction: string;
      amount: number;
      dueAt: string;
      payableId: string | null;
    }>(
      "SELECT id,number,direction,amount,dueAt,payableId FROM checks WHERE status IN ('issued','received','deposited')",
    ),
  ]);
  const pendingPayables = base.pendingPayables.items.map((p) => {
    const c = checks.find((c) => c.payableId === p.id);
    return c ? { ...p, dueAt: c.dueAt } : p;
  });
  for (const c of checks.filter(
    (c) => c.direction === 'issued' && !c.payableId,
  ))
    pendingPayables.push({
      id: `check:${c.id}`,
      description: `Cheque ${c.number}`,
      supplierId: null,
      supplierName: null,
      amountMinor: c.amount,
      dueAt: c.dueAt,
      kind: 'Cheque',
      reference: c.id,
      dueDate: c.dueAt,
      scheduledDate: c.dueAt,
      overdue: false,
    });
  const futureSettlements = [...base.futureSettlements.items];
  for (const c of checks.filter((c) => c.direction === 'received'))
    futureSettlements.push({
      id: `check:${c.id}`,
      saleId: '',
      methodId: 'check',
      methodName: 'Cheques recibidos',
      grossMinor: c.amount,
      commissionMinor: 0,
      netMinor: c.amount,
      dueAt: `${c.dueAt < base.asOfDate ? base.asOfDate : c.dueAt}T23:59:59-03:00`,
      scheduledDate: c.dueAt,
    });
  const cash = base.currentRecordedCash;
  const result = buildCashFlowSnapshot(
    {
      cashSessions: cash.sessionId
        ? [
            {
              id: cash.sessionId,
              openingMinor: cash.openingMinor,
              movementsMinor: cash.movementsMinor,
              openedAt: cash.openedAt!,
            },
          ]
        : [],
      futureSettlements,
      pendingPayables,
    },
    { asOf: base.asOf },
  );
  const balance = accounts.reduce((n, a) => n + a.balance, 0);
  return {
    ...result,
    currentRecordedBank: { amountMinor: balance, accounts: accounts.length },
    daily: result.daily.map((d) => ({
      ...d,
      projectedKnownFundsMinor: d.projectedKnownFundsMinor + balance,
    })),
    horizons: Object.fromEntries(
      Object.entries(result.horizons).map(([k, v]) => [
        k,
        {
          ...v,
          projectedKnownFundsMinor: v.projectedKnownFundsMinor + balance,
        },
      ]),
    ),
    assumptions: {
      ...result.assumptions,
      bankBalanceIncluded: accounts.length > 0,
      bankBalanceMinor: balance,
      notes: [
        'Incluye efectivo de la caja abierta y saldos bancarios registrados; no consulta bancos externos.',
        'Los cheques vinculados reemplazan el vencimiento de su cuenta a pagar y no se suman dos veces.',
        'Los cheques recibidos pendientes se proyectan por su vencimiento; su cobro aún no está confirmado.',
        ...result.assumptions.notes.slice(3),
      ],
    },
  };
}
