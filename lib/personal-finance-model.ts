export type DataQuality = 'confirmed' | 'estimated' | 'pending';
export type FinanceScope = 'personal' | 'business';
export type DebtKind = 'card' | 'loan' | 'credit';

export type PersonalDebt = {
  id: string;
  entity: string;
  label: string;
  kind: DebtKind;
  scope: FinanceScope;
  balanceMinor: number;
  payoffMinor: number | null;
  monthlyMinor: number | null;
  minimumMinor: number | null;
  remainingInstallments: number | null;
  totalInstallments: number | null;
  annualRateBps: number | null;
  nextDueOn: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'maintain';
  decision: string;
  status: 'pending' | 'review' | 'scheduled' | 'paid' | 'closed';
  quality: DataQuality;
  notes: string;
};

export type PersonalFinanceConfig = {
  availableMinor: number;
  reserveMinor: number;
  personalIncomeMinor: number;
  livingCostsMinor: number;
  businessIncomeMinor: number;
  businessFixedCostsMinor: number;
  businessExtraordinaryMinor: number;
  debts: PersonalDebt[];
};

export type Simulation = {
  selectedIds: string[];
  capitalUsedMinor: number;
  capitalRemainingMinor: number;
  debtBeforeMinor: number;
  debtRemainingMinor: number;
  monthlyBeforeMinor: number;
  monthlyAfterMinor: number;
  monthlyFreedMinor: number;
  personalFlowBeforeMinor: number;
  personalFlowAfterMinor: number;
};

const payable = (debt: PersonalDebt) => debt.payoffMinor ?? debt.balanceMinor;
const monthly = (debt: PersonalDebt) =>
  debt.monthlyMinor ?? debt.minimumMinor ?? 0;

export function simulateFinance(
  config: PersonalFinanceConfig,
  selectedIds: string[],
  availableMinor = config.availableMinor,
): Simulation {
  const open = config.debts.filter(
    (debt) => !['paid', 'closed'].includes(debt.status),
  );
  const selected = open.filter((debt) => selectedIds.includes(debt.id));
  const debtBeforeMinor = open.reduce(
    (sum, debt) => sum + debt.balanceMinor,
    0,
  );
  const monthlyBeforeMinor = open.reduce((sum, debt) => sum + monthly(debt), 0);
  const capitalUsedMinor = selected.reduce(
    (sum, debt) => sum + payable(debt),
    0,
  );
  const monthlyFreedMinor = selected.reduce(
    (sum, debt) => sum + monthly(debt),
    0,
  );
  const baseFlow = config.personalIncomeMinor - config.livingCostsMinor;
  return {
    selectedIds: selected.map((debt) => debt.id),
    capitalUsedMinor,
    capitalRemainingMinor: availableMinor - capitalUsedMinor,
    debtBeforeMinor,
    debtRemainingMinor: Math.max(
      0,
      debtBeforeMinor -
        selected.reduce((sum, debt) => sum + debt.balanceMinor, 0),
    ),
    monthlyBeforeMinor,
    monthlyAfterMinor: Math.max(0, monthlyBeforeMinor - monthlyFreedMinor),
    monthlyFreedMinor,
    personalFlowBeforeMinor: baseFlow - monthlyBeforeMinor,
    personalFlowAfterMinor: baseFlow - monthlyBeforeMinor + monthlyFreedMinor,
  };
}

export function suggestedPlan(
  config: PersonalFinanceConfig,
  mode: 'flow' | 'interest' | 'balanced',
  availableMinor = config.availableMinor,
) {
  const budget = Math.max(0, availableMinor - config.reserveMinor);
  const candidates = config.debts.filter(
    (debt) =>
      !['paid', 'closed'].includes(debt.status) &&
      payable(debt) > 0 &&
      payable(debt) <= budget,
  );
  const ranked = [...candidates].sort((a, b) => {
    const efficiencyA = monthly(a)
      ? payable(a) / monthly(a)
      : Number.MAX_SAFE_INTEGER;
    const efficiencyB = monthly(b)
      ? payable(b) / monthly(b)
      : Number.MAX_SAFE_INTEGER;
    if (mode === 'flow') return efficiencyA - efficiencyB;
    if (mode === 'interest')
      return (
        (b.annualRateBps ?? (b.kind === 'card' ? 10000 : 0)) -
        (a.annualRateBps ?? (a.kind === 'card' ? 10000 : 0))
      );
    const priority = { urgent: 0, high: 1, medium: 2, low: 3, maintain: 4 };
    return (
      priority[a.priority] - priority[b.priority] || efficiencyA - efficiencyB
    );
  });
  const ids: string[] = [];
  let used = 0;
  for (const debt of ranked) {
    const cost = payable(debt);
    if (used + cost <= budget) {
      ids.push(debt.id);
      used += cost;
    }
  }
  return simulateFinance(config, ids, availableMinor);
}

export function cancellationEfficiency(debt: PersonalDebt) {
  const flow = monthly(debt);
  return flow > 0 ? payable(debt) / flow : null;
}
