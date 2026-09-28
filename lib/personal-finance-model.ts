export type DataQuality = 'confirmed' | 'estimated' | 'pending';
export type FinanceScope = 'personal' | 'business';
export type DebtKind = 'card' | 'loan' | 'credit';
export type PaymentMode =
  | 'minimum'
  | 'installment'
  | 'advance'
  | 'custom'
  | 'total';

export type FinancePayment = {
  id: string;
  debtId: string;
  paidOn: string;
  amountMinor: number;
  mode: PaymentMode;
  installmentCount: number | null;
};

export type PaymentScenario = {
  debtId: string;
  amountMinor: number;
  mode: PaymentMode;
  installmentCount: number | null;
};

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
  businessContributionMarginBps: number;
  debts: PersonalDebt[];
  payments: FinancePayment[];
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
  businessFlowBeforeMinor: number;
  businessFlowAfterMinor: number;
  businessSupportBeforeMinor: number;
  businessSupportAfterMinor: number;
  personalAfterBusinessBeforeMinor: number;
  personalAfterBusinessAfterMinor: number;
  combinedFlowBeforeMinor: number;
  combinedFlowAfterMinor: number;
};

export type FinanceProjectionMonth = {
  month: string;
  personalDebtMinor: number;
  businessDebtMinor: number;
  personalFlowMinor: number;
  businessFlowMinor: number;
  businessSupportMinor: number;
  personalAfterBusinessMinor: number;
  combinedFlowMinor: number;
};

export type PaymentSimulation = Simulation & {
  config: PersonalFinanceConfig;
};

const payable = (debt: PersonalDebt) => debt.payoffMinor ?? debt.balanceMinor;
const monthly = (debt: PersonalDebt) =>
  debt.monthlyMinor ?? debt.minimumMinor ?? 0;

const isOpen = (debt: PersonalDebt) =>
  !['paid', 'closed'].includes(debt.status);

function flowSnapshot(config: PersonalFinanceConfig, debts: PersonalDebt[]) {
  const personalDebtMinor = debts
    .filter((debt) => debt.scope === 'personal')
    .reduce((sum, debt) => sum + monthly(debt), 0);
  const businessDebtMinor = debts
    .filter((debt) => debt.scope === 'business')
    .reduce((sum, debt) => sum + monthly(debt), 0);
  const personalFlowMinor =
    config.personalIncomeMinor - config.livingCostsMinor - personalDebtMinor;
  const businessFlowMinor =
    Math.round(
      (config.businessIncomeMinor * config.businessContributionMarginBps) /
        10_000,
    ) -
    config.businessFixedCostsMinor -
    config.businessExtraordinaryMinor -
    businessDebtMinor;
  const businessSupportMinor = Math.max(0, -businessFlowMinor);
  return {
    personalFlowMinor,
    businessFlowMinor,
    businessSupportMinor,
    personalAfterBusinessMinor: personalFlowMinor - businessSupportMinor,
    combinedFlowMinor: personalFlowMinor + businessFlowMinor,
  };
}

export function businessGrossSalesNeeded(
  deficitMinor: number,
  contributionMarginBps: number,
) {
  if (deficitMinor <= 0) return 0;
  if (contributionMarginBps <= 0) return null;
  return Math.ceil((deficitMinor * 10_000) / contributionMarginBps);
}

export function applyPaymentScenarios(
  config: PersonalFinanceConfig,
  scenarios: PaymentScenario[],
): PaymentSimulation {
  let capitalUsedMinor = 0;
  const byDebt = new Map(
    scenarios.map((scenario) => [scenario.debtId, scenario]),
  );
  const debts = config.debts.map((debt) => {
    const scenario = byDebt.get(debt.id);
    if (!scenario || !isOpen(debt)) return debt;
    const maximum = payable(debt);
    const amount = Math.max(0, Math.min(maximum, scenario.amountMinor));
    capitalUsedMinor += amount;
    const total = scenario.mode === 'total' || amount >= maximum;
    const installments =
      scenario.mode === 'advance' || scenario.mode === 'installment'
        ? Math.max(1, scenario.installmentCount ?? 1)
        : 0;
    const remainingInstallments =
      debt.remainingInstallments == null
        ? null
        : Math.max(0, debt.remainingInstallments - installments);
    return {
      ...debt,
      balanceMinor: total ? 0 : Math.max(0, debt.balanceMinor - amount),
      payoffMinor:
        debt.payoffMinor == null
          ? null
          : total
            ? 0
            : Math.max(0, debt.payoffMinor - amount),
      remainingInstallments,
      status:
        total || remainingInstallments === 0 ? ('paid' as const) : debt.status,
    };
  });
  const simulatedConfig = { ...config, debts };
  const result = simulateFinance(simulatedConfig, [], config.availableMinor);
  const originalDebt = config.debts
    .filter(isOpen)
    .reduce((sum, debt) => sum + debt.balanceMinor, 0);
  return {
    ...result,
    config: simulatedConfig,
    capitalUsedMinor,
    capitalRemainingMinor: config.availableMinor - capitalUsedMinor,
    debtBeforeMinor: originalDebt,
    debtRemainingMinor: debts
      .filter(isOpen)
      .reduce((sum, debt) => sum + debt.balanceMinor, 0),
  };
}

export function simulateFinance(
  config: PersonalFinanceConfig,
  selectedIds: string[],
  availableMinor = config.availableMinor,
): Simulation {
  const open = config.debts.filter(isOpen);
  const selected = open.filter((debt) => selectedIds.includes(debt.id));
  const remaining = open.filter((debt) => !selectedIds.includes(debt.id));
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
  const before = flowSnapshot(config, open);
  const after = flowSnapshot(config, remaining);
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
    personalFlowBeforeMinor: before.personalFlowMinor,
    personalFlowAfterMinor: after.personalFlowMinor,
    businessFlowBeforeMinor: before.businessFlowMinor,
    businessFlowAfterMinor: after.businessFlowMinor,
    businessSupportBeforeMinor: before.businessSupportMinor,
    businessSupportAfterMinor: after.businessSupportMinor,
    personalAfterBusinessBeforeMinor: before.personalAfterBusinessMinor,
    personalAfterBusinessAfterMinor: after.personalAfterBusinessMinor,
    combinedFlowBeforeMinor: before.combinedFlowMinor,
    combinedFlowAfterMinor: after.combinedFlowMinor,
  };
}

export function projectFinance(
  config: PersonalFinanceConfig,
  selectedIds: string[],
  months = 12,
  start = new Date(),
): FinanceProjectionMonth[] {
  const debts = config.debts.filter(
    (debt) => isOpen(debt) && !selectedIds.includes(debt.id),
  );
  return Array.from({ length: months }, (_, index) => {
    const active = debts.filter(
      (debt) =>
        debt.remainingInstallments == null ||
        debt.remainingInstallments > index,
    );
    const personalDebtMinor = active
      .filter((debt) => debt.scope === 'personal')
      .reduce((sum, debt) => sum + monthly(debt), 0);
    const businessDebtMinor = active
      .filter((debt) => debt.scope === 'business')
      .reduce((sum, debt) => sum + monthly(debt), 0);
    const personalFlowMinor =
      config.personalIncomeMinor - config.livingCostsMinor - personalDebtMinor;
    const businessFlowMinor =
      Math.round(
        (config.businessIncomeMinor * config.businessContributionMarginBps) /
          10_000,
      ) -
      config.businessFixedCostsMinor -
      (index === 0 ? config.businessExtraordinaryMinor : 0) -
      businessDebtMinor;
    const businessSupportMinor = Math.max(0, -businessFlowMinor);
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      personalDebtMinor,
      businessDebtMinor,
      personalFlowMinor,
      businessFlowMinor,
      businessSupportMinor,
      personalAfterBusinessMinor: personalFlowMinor - businessSupportMinor,
      combinedFlowMinor: personalFlowMinor + businessFlowMinor,
    };
  });
}

export function suggestedPlan(
  config: PersonalFinanceConfig,
  mode: 'flow' | 'interest' | 'balanced' | 'deficit' | 'risk',
  availableMinor = config.availableMinor,
) {
  const budget = Math.max(0, availableMinor - config.reserveMinor);
  const candidates = config.debts.filter(
    (debt) => isOpen(debt) && payable(debt) > 0 && payable(debt) <= budget,
  );
  const ranked = [...candidates].sort((a, b) => {
    const efficiencyA = monthly(a)
      ? payable(a) / monthly(a)
      : Number.MAX_SAFE_INTEGER;
    const efficiencyB = monthly(b)
      ? payable(b) / monthly(b)
      : Number.MAX_SAFE_INTEGER;
    if (mode === 'flow' || mode === 'deficit') return efficiencyA - efficiencyB;
    if (mode === 'interest')
      return (
        (b.annualRateBps ?? (b.kind === 'card' ? 10000 : 0)) -
        (a.annualRateBps ?? (a.kind === 'card' ? 10000 : 0))
      );
    const priority = { urgent: 0, high: 1, medium: 2, low: 3, maintain: 4 };
    if (mode === 'risk')
      return (
        priority[a.priority] - priority[b.priority] ||
        Number(b.kind === 'card') - Number(a.kind === 'card') ||
        (b.annualRateBps ?? 0) - (a.annualRateBps ?? 0)
      );
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
      if (
        mode === 'deficit' &&
        simulateFinance(config, ids, availableMinor)
          .personalAfterBusinessAfterMinor >= 0
      )
        break;
    }
  }
  return simulateFinance(config, ids, availableMinor);
}

export function cancellationEfficiency(debt: PersonalDebt) {
  const flow = monthly(debt);
  return flow > 0 ? payable(debt) / flow : null;
}
