import { rows } from '@/db/queries';
import { getCashFlow, buildCashFlowSnapshot } from './cashflow';
export async function consolidatedCashFlow() {
  const base = await getCashFlow();
  const accounts = await rows<{ balance: number }>(
    'SELECT a.opening+COALESCE(SUM(e.amount),0) AS balance FROM bank_accounts a LEFT JOIN bank_entries e ON e.accountId=a.id AND e.occurredAt<=? WHERE a.createdAt<=? GROUP BY a.id',
    base.asOfDate,
    base.asOf,
  );
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
      futureSettlements: base.futureSettlements.items,
      pendingPayables: base.pendingPayables.items,
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
        ...result.assumptions.notes.slice(3),
      ],
    },
  };
}
