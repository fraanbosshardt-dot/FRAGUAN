'use client';
import { useMemo, useState } from 'react';
import {
  Check,
  CircleCheck,
  Copy,
  Pencil,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, money } from '@/lib/client';
import {
  applyPaymentScenarios,
  businessGrossSalesNeeded,
  cancellationEfficiency,
  expenseTotals,
  projectFinance,
  suggestedPlan,
  type PaymentMode,
  type PaymentScenario,
  type PersonalDebt,
  type PersonalFinanceConfig,
} from '@/lib/personal-finance-model';

const pesos = (minor: number) => money(minor);
const quality = {
  confirmed: 'Dato confirmado',
  estimated: 'Dato estimado',
  pending: 'Dato pendiente',
};
const priorities = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  maintain: 'Mantener',
};
const paymentModes: Record<PaymentMode, string> = {
  minimum: 'Pago mínimo',
  installment: 'Cuota del mes',
  advance: 'Adelanto de cuotas',
  custom: 'Importe personalizado',
  total: 'Cancelación total',
};

type FinancialEditSnapshot = {
  config: PersonalFinanceConfig;
  available: string;
  cashInputs: {
    reserveMinor: string;
    personalIncomeMinor: string;
    businessIncomeMinor: string;
  };
  contributionMargin: string;
};

function parsePesos(value: string) {
  const cleaned = value.trim().replace(/[$\s]/g, '');
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, '')
      : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function PersonalFinanceControl({
  initial,
}: {
  initial: PersonalFinanceConfig;
}) {
  const [config, setConfig] = useState(initial),
    [available, setAvailable] = useState(String(initial.availableMinor / 100)),
    [cashInputs, setCashInputs] = useState({
      reserveMinor: String(initial.reserveMinor / 100),
      personalIncomeMinor: String(initial.personalIncomeMinor / 100),
      businessIncomeMinor: String(initial.businessIncomeMinor / 100),
    }),
    [contributionMargin, setContributionMargin] = useState(
      String(initial.businessContributionMarginBps / 100),
    ),
    [selected, setSelected] = useState<string[]>(
      () =>
        suggestedPlan(initial, 'balanced', initial.availableMinor).selectedIds,
    ),
    [manualScenarios, setManualScenarios] = useState<PaymentScenario[]>([]),
    [mode, setMode] = useState<
      'flow' | 'interest' | 'balanced' | 'deficit' | 'risk'
    >('balanced'),
    [editingDebt, setEditingDebt] = useState(''),
    [paymentMode, setPaymentMode] = useState<PaymentMode>('custom'),
    [paymentAmount, setPaymentAmount] = useState(''),
    [installmentCount, setInstallmentCount] = useState('1'),
    [busyDebt, setBusyDebt] = useState(''),
    [isEditing, setIsEditing] = useState(false),
    [editSnapshot, setEditSnapshot] = useState<FinancialEditSnapshot | null>(
      null,
    ),
    [notice, setNotice] = useState({ text: '', tone: 'success' });
  const availableMinor = Math.round((parsePesos(available) ?? 0) * 100);
  const marginPercent = Number(contributionMargin.replace(',', '.'));
  const marginBps = Number.isFinite(marginPercent)
    ? Math.max(0, Math.min(100, marginPercent)) * 100
    : 0;
  const draftConfig = useMemo(() => {
    const next = {
      ...config,
      availableMinor,
      businessContributionMarginBps: Math.round(marginBps),
    };
    for (const [key, value] of Object.entries(cashInputs)) {
      const parsed = parsePesos(value);
      if (parsed != null)
        (next as unknown as Record<string, unknown>)[key] = Math.round(
          parsed * 100,
        );
    }
    return next;
  }, [availableMinor, cashInputs, config, marginBps]);
  const plans = useMemo(
    () => ({
      flow: suggestedPlan(draftConfig, 'flow', availableMinor),
      interest: suggestedPlan(draftConfig, 'interest', availableMinor),
      balanced: suggestedPlan(draftConfig, 'balanced', availableMinor),
      deficit: suggestedPlan(draftConfig, 'deficit', availableMinor),
      risk: suggestedPlan(draftConfig, 'risk', availableMinor),
    }),
    [draftConfig, availableMinor],
  );
  const scenarios = useMemo(
    () => [
      ...manualScenarios,
      ...selected
        .filter(
          (debtId) =>
            !manualScenarios.some((scenario) => scenario.debtId === debtId),
        )
        .map((debtId) => {
          const debt = draftConfig.debts.find((item) => item.id === debtId)!;
          return {
            debtId,
            amountMinor: debt.payoffMinor ?? debt.balanceMinor,
            mode: 'total' as const,
            installmentCount: null,
          };
        }),
    ],
    [draftConfig.debts, manualScenarios, selected],
  );
  const result = useMemo(
    () => applyPaymentScenarios(draftConfig, scenarios),
    [draftConfig, scenarios],
  );
  const projection = useMemo(
    () => projectFinance(result.config, []),
    [result.config],
  );
  const grossSalesNeeded = businessGrossSalesNeeded(
    result.businessSupportAfterMinor,
    draftConfig.businessContributionMarginBps,
  );
  const grossSalesTarget =
    grossSalesNeeded == null
      ? null
      : draftConfig.businessIncomeMinor + grossSalesNeeded;
  const editedDebt = draftConfig.debts.find((debt) => debt.id === editingDebt);
  const expenses = expenseTotals(draftConfig);
  const expenseGroups = useMemo(() => {
    const groups = new Map<string, PersonalFinanceConfig['expenses']>();
    for (const expense of draftConfig.expenses) {
      const key = `${expense.scope}|${expense.category}`;
      groups.set(key, [...(groups.get(key) ?? []), expense]);
    }
    return [...groups.entries()];
  }, [draftConfig.expenses]);
  const activePlan = plans[mode];
  const basePersonal = draftConfig.personalIncomeMinor - expenses.personalMinor;
  function updateExpense(
    expenseId: string,
    patch: Partial<PersonalFinanceConfig['expenses'][number]>,
  ) {
    if (!isEditing) return;
    setConfig((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === expenseId ? { ...expense, ...patch } : expense,
      ),
    }));
  }
  function beginEdit() {
    setEditSnapshot({
      config: structuredClone(config),
      available,
      cashInputs: { ...cashInputs },
      contributionMargin,
    });
    setIsEditing(true);
    setNotice({ text: 'Edición habilitada.', tone: 'success' });
  }
  function cancelEdit() {
    if (editSnapshot) {
      setConfig(editSnapshot.config);
      setAvailable(editSnapshot.available);
      setCashInputs(editSnapshot.cashInputs);
      setContributionMargin(editSnapshot.contributionMargin);
    }
    setEditSnapshot(null);
    setIsEditing(false);
    setNotice({ text: 'Cambios descartados.', tone: 'success' });
  }
  function openPayment(debt: PersonalDebt) {
    const initialMode: PaymentMode =
      debt.kind === 'card'
        ? debt.minimumMinor
          ? 'minimum'
          : 'custom'
        : debt.monthlyMinor
          ? 'installment'
          : 'custom';
    setEditingDebt(debt.id);
    setPaymentMode(initialMode);
    setInstallmentCount('1');
    setPaymentAmount(
      String(
        ((initialMode === 'minimum'
          ? debt.minimumMinor
          : initialMode === 'installment'
            ? debt.monthlyMinor
            : 0) ?? 0) / 100,
      ),
    );
  }
  function paymentScenario(debt: PersonalDebt) {
    const count = Math.max(1, Number.parseInt(installmentCount, 10) || 1);
    let amountMinor = Math.round((parsePesos(paymentAmount) ?? 0) * 100);
    if (paymentMode === 'minimum') amountMinor = debt.minimumMinor ?? 0;
    if (paymentMode === 'installment') amountMinor = debt.monthlyMinor ?? 0;
    if (paymentMode === 'advance')
      amountMinor = (debt.monthlyMinor ?? 0) * count;
    if (paymentMode === 'total')
      amountMinor = debt.payoffMinor ?? debt.balanceMinor;
    return {
      debtId: debt.id,
      amountMinor: Math.min(
        debt.payoffMinor ?? debt.balanceMinor,
        Math.max(0, amountMinor),
      ),
      mode: paymentMode,
      installmentCount:
        paymentMode === 'advance'
          ? count
          : paymentMode === 'installment'
            ? 1
            : null,
    } satisfies PaymentScenario;
  }
  function simulatePayment(debt: PersonalDebt) {
    const scenario = paymentScenario(debt);
    if (scenario.amountMinor <= 0) {
      setNotice({ text: 'Ingresá un pago válido.', tone: 'error' });
      return;
    }
    setSelected((ids) => ids.filter((id) => id !== debt.id));
    setManualScenarios((items) => [
      ...items.filter((item) => item.debtId !== debt.id),
      scenario,
    ]);
    setNotice({
      text: 'Pago agregado a la simulación. La deuda real no cambió.',
      tone: 'success',
    });
  }
  async function persist(next: PersonalFinanceConfig, message: string) {
    const saved = await api('personal-finance', {
      method: 'POST',
      body: JSON.stringify(next),
    });
    setConfig(saved);
    setNotice({ text: message, tone: 'success' });
  }
  async function save() {
    const parsed = parsePesos(available);
    const invalidCash = Object.values(cashInputs).some(
      (value) => parsePesos(value) == null,
    );
    if (
      parsed == null ||
      invalidCash ||
      !Number.isFinite(marginPercent) ||
      marginPercent < 0 ||
      marginPercent > 100
    ) {
      setNotice({
        text: 'Revisá los importes ingresados.',
        tone: 'error',
      });
      return;
    }
    try {
      await persist(draftConfig, 'Datos y proyección guardados.');
      setIsEditing(false);
      setEditSnapshot(null);
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : 'No se pudieron guardar los datos.',
        tone: 'error',
      });
    }
  }
  async function recordPayment(debt: PersonalDebt) {
    const scenario = paymentScenario(debt);
    if (scenario.amountMinor <= 0) {
      setNotice({ text: 'Ingresá un pago válido.', tone: 'error' });
      return;
    }
    setBusyDebt(debt.id);
    try {
      const applied = applyPaymentScenarios(draftConfig, [scenario]).config;
      const next = {
        ...applied,
        payments: [
          ...draftConfig.payments,
          {
            id: crypto.randomUUID(),
            debtId: debt.id,
            paidOn: new Date().toISOString(),
            amountMinor: scenario.amountMinor,
            mode: scenario.mode,
            installmentCount: scenario.installmentCount,
          },
        ],
      };
      await persist(next, 'Pago registrado y saldo actualizado.');
      setSelected((ids) => ids.filter((id) => id !== debt.id));
      setManualScenarios((items) =>
        items.filter((item) => item.debtId !== debt.id),
      );
      setEditingDebt('');
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la deuda.',
        tone: 'error',
      });
    } finally {
      setBusyDebt('');
    }
  }
  async function reopenDebt(debtId: string) {
    setBusyDebt(debtId);
    try {
      await persist(
        {
          ...draftConfig,
          debts: draftConfig.debts.map((debt) =>
            debt.id === debtId ? { ...debt, status: 'pending' as const } : debt,
          ),
        },
        'Deuda reabierta.',
      );
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : 'No se pudo reabrir la deuda.',
        tone: 'error',
      });
    } finally {
      setBusyDebt('');
    }
  }
  async function copy() {
    const text = `Analizá mi situación financiera actual. No inventes datos.\n\nDINERO DISPONIBLE: ${pesos(availableMinor)}\nINGRESOS PERSONALES: ${pesos(draftConfig.personalIncomeMinor)}\nGASTOS PERSONALES DETALLADOS: ${pesos(expenses.personalMinor)}\nFLUJO PERSONAL ANTES DE DEUDAS: ${pesos(basePersonal)}\nVENTAS BRUTAS DEL NEGOCIO: ${pesos(draftConfig.businessIncomeMinor)}\nMARGEN DE CONTRIBUCIÓN: ${(draftConfig.businessContributionMarginBps / 100).toFixed(1)}%\nGASTOS FIJOS DEL NEGOCIO: ${pesos(expenses.businessMonthlyMinor)}\nGASTOS EXTRAORDINARIOS DEL NEGOCIO: ${pesos(expenses.businessOneTimeMinor)}\nAPORTE PERSONAL NECESARIO AL NEGOCIO: ${pesos(result.businessSupportAfterMinor)}\nVENTA BRUTA ADICIONAL PARA CUBRIR EL DÉFICIT: ${grossSalesNeeded == null ? 'Margen no configurado' : pesos(grossSalesNeeded)}\nRESULTADO PERSONAL FINAL: ${pesos(result.personalAfterBusinessAfterMinor)}\n\nDETALLE DE EGRESOS ACTIVOS:\n${draftConfig.expenses
      .filter((expense) => expense.active)
      .map(
        (expense) =>
          `- ${expense.scope === 'business' ? 'Negocio' : 'Personal'} · ${expense.category} · ${expense.label}: ${pesos(expense.amountMinor)} (${expense.frequency === 'monthly' ? 'mensual' : 'único'})`,
      )
      .join(
        '\n',
      )}\n\nDEUDAS:\n${draftConfig.debts.map((d) => `- ${d.entity} · ${d.label}: saldo ${pesos(d.balanceMinor)}, cancelación ${d.payoffMinor == null ? 'Dato pendiente' : pesos(d.payoffMinor)}, pago mensual ${d.monthlyMinor == null && d.minimumMinor == null ? 'Dato pendiente' : pesos(d.monthlyMinor ?? d.minimumMinor ?? 0)}, estado ${d.status}, prioridad ${priorities[d.priority]}, calidad ${quality[d.quality]}. ${d.decision}`).join('\n')}\n\nCompará qué conviene cancelar y qué mantener. Explicá qué hacer, por qué, flujo resultante, aporte requerido por el negocio, riesgos y próximos pasos.`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ text: 'Prompt copiado.', tone: 'success' });
    } catch {
      setNotice({
        text: 'No se pudo copiar. Revisá el permiso del portapapeles.',
        tone: 'error',
      });
    }
  }
  return (
    <div className="finance-control">
      <section className="panel finance-hero">
        <div>
          <p className="eyebrow">CENTRO DE CONTROL FINANCIERO</p>
          <h2>
            Si hoy tengo{' '}
            <Input
              aria-label="Dinero disponible"
              type="text"
              inputMode="decimal"
              disabled={!isEditing}
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
            />
            , ¿qué hago?
          </h2>
          <p>
            Simulá decisiones antes de confirmarlas. Los flujos personal y del
            negocio se muestran separados y también consolidados.
          </p>
        </div>
        <div className="finance-edit-actions">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEdit}>
                <X />
                Cancelar
              </Button>
              <Button onClick={save}>
                <Save />
                Guardar cambios
              </Button>
            </>
          ) : (
            <Button onClick={beginEdit}>
              <Pencil />
              Editar datos
            </Button>
          )}
        </div>
      </section>
      <nav
        className="finance-step-nav"
        aria-label="Pasos del centro financiero"
      >
        <a href="#finance-step-1">
          <b>1</b>
          <span>Datos</span>
        </a>
        <a href="#finance-step-2">
          <b>2</b>
          <span>Objetivo</span>
        </a>
        <a href="#finance-step-3">
          <b>3</b>
          <span>Resultado</span>
        </a>
        <a href="#finance-step-4">
          <b>4</b>
          <span>Pagos</span>
        </a>
        <a href="#finance-step-5">
          <b>5</b>
          <span>Impacto</span>
        </a>
      </nav>
      <StepHeader
        id="finance-step-1"
        number="01"
        title="Confirmá la foto actual"
        description="Revisá capital, ingresos, ventas, margen y egresos. Solo habilitá Editar datos si algo cambió."
      />
      <section
        className={`panel finance-input-panel ${isEditing ? 'is-editing' : 'is-locked'}`}
      >
        <div className="panel-heading">
          <div>
            <h2>Ingresos y egresos mensuales</h2>
            <span>
              El aporte al negocio se descuenta del flujo personal cuando el
              negocio queda en déficit.
            </span>
          </div>
        </div>
        <div className="finance-money-grid">
          <MoneyInput
            label="Reserva que no querés usar"
            disabled={!isEditing}
            value={cashInputs.reserveMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                reserveMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Ingresos personales"
            disabled={!isEditing}
            value={cashInputs.personalIncomeMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                personalIncomeMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Ventas brutas mensuales del negocio"
            disabled={!isEditing}
            value={cashInputs.businessIncomeMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                businessIncomeMinor: value,
              }))
            }
          />
          <label htmlFor="finance-contribution-margin">
            <span>Margen disponible sobre cada venta</span>
            <div className="finance-percent-input">
              <Input
                id="finance-contribution-margin"
                aria-label="Margen de contribución"
                type="text"
                inputMode="decimal"
                disabled={!isEditing}
                value={contributionMargin}
                onChange={(event) => setContributionMargin(event.target.value)}
              />
              <b>%</b>
            </div>
            <small>
              Después de mercadería, descuentos y costos variables. Ajustalo con
              el margen real.
            </small>
          </label>
        </div>
      </section>
      <section className="panel finance-expenses">
        <div className="panel-heading">
          <div>
            <h2>Detalle completo de egresos</h2>
            <span>
              {isEditing
                ? 'Cada concepto alimenta el flujo. Ajustá lo necesario y guardá los cambios.'
                : 'Modo consulta. Pulsá “Editar datos” para modificar importes o conceptos activos.'}
            </span>
          </div>
        </div>
        <div className="finance-expense-summary">
          <Metric
            label="Personales mensuales"
            value={pesos(expenses.personalMinor)}
          />
          <Metric
            label="Negocio mensuales"
            value={pesos(expenses.businessMonthlyMinor)}
          />
          <Metric
            label="Negocio pago único"
            value={pesos(expenses.businessOneTimeMinor)}
          />
          <Metric
            label="Diferencia contra $3.440.000 informado"
            value={pesos(Math.abs(344_000_000 - expenses.personalMinor))}
            tone={
              expenses.personalMinor === 344_000_000 ? 'positive' : 'negative'
            }
          />
        </div>
        <div className="finance-expense-groups">
          {expenseGroups.map(([key, items]) => {
            const [scope, category] = key.split('|');
            const total = items
              .filter((item) => item.active)
              .reduce((sum, item) => sum + item.amountMinor, 0);
            return (
              <details key={key}>
                <summary>
                  <span>
                    {scope === 'business' ? 'Negocio' : 'Personal'} · {category}
                  </span>
                  <b>{pesos(total)}</b>
                </summary>
                <div>
                  {items.map((expense) => (
                    <div key={expense.id}>
                      <input
                        aria-label={`Incluir ${expense.label}`}
                        type="checkbox"
                        disabled={!isEditing}
                        checked={expense.active}
                        onChange={(event) =>
                          updateExpense(expense.id, {
                            active: event.target.checked,
                          })
                        }
                      />
                      <label htmlFor={`expense-${expense.id}`}>
                        <strong>{expense.label}</strong>
                        <span>
                          {expense.frequency === 'monthly'
                            ? 'Mensual'
                            : 'Pago único'}{' '}
                          · {quality[expense.quality]}
                        </span>
                      </label>
                      <Input
                        id={`expense-${expense.id}`}
                        aria-label={`Importe de ${expense.label}`}
                        type="text"
                        inputMode="decimal"
                        disabled={!isEditing}
                        value={String(expense.amountMinor / 100)}
                        onChange={(event) => {
                          const value = parsePesos(event.target.value);
                          if (value != null)
                            updateExpense(expense.id, {
                              amountMinor: Math.round(value * 100),
                            });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>
      <StepHeader
        id="finance-step-2"
        number="02"
        title="Elegí qué querés lograr"
        description="Cada estrategia arma una simulación distinta. Todavía no registra pagos ni modifica saldos reales."
      />
      <div className="finance-strategies">
        {(
          [
            ['flow', 'Maximizar flujo', 'Libera la mayor cuota mensual.'],
            [
              'interest',
              'Minimizar intereses',
              'Prioriza las tasas más altas.',
            ],
            ['balanced', 'Equilibrado', 'Combina urgencia, costo y liquidez.'],
            [
              'deficit',
              'Salir del déficit',
              'Cancela solo hasta recuperar flujo.',
            ],
            ['risk', 'Bajar riesgo', 'Prioriza tarjetas y deudas urgentes.'],
          ] as const
        ).map(([key, label, detail]) => (
          <button
            key={key}
            className={mode === key ? 'active' : ''}
            onClick={() => {
              setMode(key);
              setSelected(plans[key].selectedIds);
              setManualScenarios([]);
            }}
          >
            <strong>{label}</strong>
            <small>{detail}</small>
            <span>Usar {pesos(plans[key].capitalUsedMinor)}</span>
            <b>Libera {pesos(plans[key].monthlyFreedMinor)}/mes</b>
            <small>{plans[key].selectedIds.length} deudas seleccionadas</small>
          </button>
        ))}
      </div>
      <StepHeader
        id="finance-step-3"
        number="03"
        title="Revisá la recomendación principal"
        description="Mirá cuánto capital usarías, qué deuda quedaría y cuánto necesita vender el negocio para cubrir su déficit."
      />
      <div className="metric-grid finance-results">
        <Metric
          label="Capital restante"
          value={pesos(result.capitalRemainingMinor)}
        />
        <Metric
          label="Deuda restante"
          value={pesos(result.debtRemainingMinor)}
        />
        <Metric
          label="Pagos mensuales restantes"
          value={pesos(result.monthlyAfterMinor)}
        />
        <Metric
          label="Aporte necesario al negocio"
          value={pesos(result.businessSupportAfterMinor)}
          tone={
            result.businessSupportAfterMinor === 0 ? 'positive' : 'negative'
          }
        />
        <Metric
          label="Venta bruta adicional para cubrirlo"
          value={
            grossSalesNeeded == null
              ? 'Configurá el margen'
              : pesos(grossSalesNeeded)
          }
          tone={grossSalesNeeded === 0 ? 'positive' : 'negative'}
        />
        <Metric
          label="Personal después de sostener el negocio"
          value={pesos(result.personalAfterBusinessAfterMinor)}
          tone={
            result.personalAfterBusinessAfterMinor >= 0
              ? 'positive'
              : 'negative'
          }
        />
        <Metric
          label="Resultado consolidado"
          value={pesos(result.combinedFlowAfterMinor)}
          tone={result.combinedFlowAfterMinor >= 0 ? 'positive' : 'negative'}
        />
      </div>
      <section className="panel finance-sales-target">
        <div>
          <p className="eyebrow">META DE FACTURACIÓN</p>
          <h2>
            {grossSalesTarget == null
              ? 'Configurá el margen para calcularla'
              : grossSalesNeeded === 0
                ? 'El negocio cubre sus gastos con la venta cargada'
                : `Deberías vender ${pesos(grossSalesTarget)} brutos por mes`}
          </h2>
          <p>
            Con un margen disponible de{' '}
            {(draftConfig.businessContributionMarginBps / 100).toFixed(1)}%, la
            venta actual es {pesos(draftConfig.businessIncomeMinor)} y el
            faltante bruto es{' '}
            {grossSalesNeeded == null
              ? 'no disponible'
              : pesos(grossSalesNeeded)}
            .
          </p>
        </div>
        <div>
          <span>Gastos y cuotas a cubrir este mes</span>
          <strong>
            {pesos(
              expenses.businessMonthlyMinor +
                expenses.businessOneTimeMinor +
                (projection[0]?.businessDebtMinor ?? 0),
            )}
          </strong>
          <small>
            La meta usa margen de contribución, no confunde facturación con
            ganancia.
          </small>
        </div>
      </section>
      <StepHeader
        id="finance-step-4"
        number="04"
        title="Armá y confirmá el plan de pagos"
        description="Usá la casilla para simular una cancelación total u Opciones de pago para mínimos, cuotas, adelantos y otros importes."
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Armá tu escenario</h2>
            <span>
              La casilla simula cancelación total. “Opciones de pago” permite
              mínimo, cuota, adelanto, otro importe o total.
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelected(activePlan.selectedIds);
              setManualScenarios([]);
            }}
          >
            <SlidersHorizontal />
            Aplicar estrategia
          </Button>
        </div>
        {editedDebt && (
          <div className="finance-payment-planner">
            <div>
              <p className="eyebrow">PLANIFICAR PAGO</p>
              <h3>
                {editedDebt.entity} · {editedDebt.label}
              </h3>
              <span>
                Saldo {pesos(editedDebt.balanceMinor)} · Cancelación{' '}
                {pesos(editedDebt.payoffMinor ?? editedDebt.balanceMinor)}
              </span>
            </div>
            <label>
              <span>Qué querés pagar</span>
              <select
                value={paymentMode}
                onChange={(event) =>
                  setPaymentMode(event.target.value as PaymentMode)
                }
              >
                {editedDebt.kind === 'card' ? (
                  <>
                    <option value="minimum">Pago mínimo</option>
                    <option value="custom">Otro importe</option>
                    <option value="total">Total</option>
                  </>
                ) : (
                  <>
                    <option value="installment">Cuota del mes</option>
                    <option value="advance">Adelantar cuotas</option>
                    <option value="custom">Otro importe</option>
                    <option value="total">Cancelación total</option>
                  </>
                )}
              </select>
            </label>
            {paymentMode === 'advance' && (
              <label htmlFor="finance-installment-count">
                <span>Cuotas a adelantar</span>
                <Input
                  id="finance-installment-count"
                  type="number"
                  min="1"
                  max={editedDebt.remainingInstallments ?? 600}
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
              </label>
            )}
            {paymentMode === 'custom' && (
              <MoneyInput
                label="Importe a pagar"
                value={paymentAmount}
                onChange={setPaymentAmount}
              />
            )}
            <div className="finance-payment-total">
              <span>Importe calculado</span>
              <strong>{pesos(paymentScenario(editedDebt).amountMinor)}</strong>
              {paymentMode === 'minimum' && !editedDebt.minimumMinor && (
                <small>Cargá el mínimo usando “Otro importe”.</small>
              )}
              {paymentMode === 'advance' && !editedDebt.monthlyMinor && (
                <small>Cargá la cuota antes de adelantar.</small>
              )}
              {paymentMode === 'advance' && editedDebt.monthlyMinor && (
                <small>
                  Estimación cuota × cantidad. Confirmá el importe exacto con la
                  entidad.
                </small>
              )}
              {paymentMode === 'minimum' && editedDebt.minimumMinor && (
                <small>
                  El próximo resumen puede sumar intereses y consumos nuevos.
                </small>
              )}
            </div>
            <div className="finance-payment-actions">
              <Button
                variant="outline"
                onClick={() => simulatePayment(editedDebt)}
              >
                Simular
              </Button>
              <Button
                disabled={busyDebt === editedDebt.id}
                onClick={() => recordPayment(editedDebt)}
              >
                <CircleCheck />
                {busyDebt === editedDebt.id ? 'Guardando…' : 'Registrar pago'}
              </Button>
              <button type="button" onClick={() => setEditingDebt('')}>
                Cerrar
              </button>
            </div>
          </div>
        )}
        <div className="finance-debt-list">
          {config.debts.map((debt) => {
            const efficiency = cancellationEfficiency(debt);
            const paid = ['paid', 'closed'].includes(debt.status);
            return (
              <div
                key={debt.id}
                className={`${selected.includes(debt.id) ? 'selected' : ''} ${paid ? 'paid' : ''}`}
              >
                <input
                  aria-label={`Simular cancelación de ${debt.entity} ${debt.label}`}
                  type="checkbox"
                  disabled={paid}
                  checked={selected.includes(debt.id)}
                  onChange={(e) => {
                    setManualScenarios((items) =>
                      items.filter((item) => item.debtId !== debt.id),
                    );
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, debt.id]
                        : s.filter((id) => id !== debt.id),
                    );
                  }}
                />
                <div>
                  <strong>
                    {debt.entity} · {debt.label}
                  </strong>
                  <span>
                    {paid ? 'Pagada' : quality[debt.quality]} ·{' '}
                    {priorities[debt.priority]}
                  </span>
                  <small>{debt.decision}</small>
                </div>
                <div className="finance-debt-amount">
                  <b>{pesos(debt.payoffMinor ?? debt.balanceMinor)}</b>
                  <span>
                    libera{' '}
                    {debt.monthlyMinor || debt.minimumMinor
                      ? `${pesos(debt.monthlyMinor ?? debt.minimumMinor ?? 0)}/mes`
                      : 'Dato pendiente'}
                  </span>
                  <small>
                    {efficiency == null
                      ? 'Eficiencia pendiente'
                      : `${efficiency.toFixed(1)} meses equivalentes`}
                  </small>
                </div>
                <button
                  type="button"
                  className="finance-paid-button"
                  disabled={busyDebt === debt.id}
                  onClick={() =>
                    paid ? reopenDebt(debt.id) : openPayment(debt)
                  }
                >
                  {paid ? <RotateCcw /> : <SlidersHorizontal />}
                  {busyDebt === debt.id
                    ? 'Guardando…'
                    : paid
                      ? 'Reabrir'
                      : 'Opciones de pago'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <StepHeader
        id="finance-step-5"
        number="05"
        title="Comprobá el impacto antes de decidir"
        description="Verificá el flujo personal, el aporte al negocio y la evolución mensual. Registrá un pago únicamente cuando ya ocurrió."
      />
      <div className="dashboard-panels">
        <section className="panel">
          <div className="panel-heading">
            <h2>Flujo personal</h2>
            <span>Luego de la simulación elegida</span>
          </div>
          <Calc name="Ingresos" value={draftConfig.personalIncomeMinor} />
          <Calc
            name="Gastos de vida detallados"
            value={-expenses.personalMinor}
          />
          <Calc
            name="Cuotas personales"
            value={-(projection[0]?.personalDebtMinor ?? 0)}
          />
          <Calc
            name="Resultado personal"
            value={result.personalFlowAfterMinor}
            total
          />
          <Calc
            name="Aporte para sostener el negocio"
            value={-result.businessSupportAfterMinor}
          />
          <Calc
            name="Disponible personal final"
            value={result.personalAfterBusinessAfterMinor}
            total
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Flujo negocio</h2>
            <span>Se calcula separado antes del aporte</span>
          </div>
          <Calc
            name="Ventas brutas (referencia)"
            value={draftConfig.businessIncomeMinor}
            reference
          />
          <Calc
            name={`Margen disponible (${(draftConfig.businessContributionMarginBps / 100).toFixed(1)}%)`}
            value={Math.round(
              (draftConfig.businessIncomeMinor *
                draftConfig.businessContributionMarginBps) /
                10_000,
            )}
          />
          <Calc name="Costos fijos" value={-expenses.businessMonthlyMinor} />
          <Calc
            name="Extraordinario pendiente"
            value={-expenses.businessOneTimeMinor}
          />
          <Calc
            name="Cuotas del negocio"
            value={-(projection[0]?.businessDebtMinor ?? 0)}
          />
          <Calc
            name="Déficit/superávit del negocio"
            value={result.businessFlowAfterMinor}
            total
          />
        </section>
      </div>
      <section className="panel finance-projection">
        <div className="panel-heading">
          <div>
            <h2>Proyección de cuotas y flujo</h2>
            <span>
              Doce meses con el escenario simulado. El gasto extraordinario del
              negocio se aplica solo al primer mes.
            </span>
          </div>
        </div>
        <div className="finance-projection-scroll">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Cuotas</th>
                <th>Flujo personal</th>
                <th>Flujo negocio</th>
                <th>Aporte al negocio</th>
                <th>Personal final</th>
                <th>Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((month) => (
                <tr key={month.month}>
                  <th>{monthLabel(month.month)}</th>
                  <td>
                    {pesos(month.personalDebtMinor + month.businessDebtMinor)}
                  </td>
                  <SignedMoney value={month.personalFlowMinor} />
                  <SignedMoney value={month.businessFlowMinor} />
                  <td>{pesos(month.businessSupportMinor)}</td>
                  <SignedMoney value={month.personalAfterBusinessMinor} />
                  <SignedMoney value={month.combinedFlowMinor} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="quiet">
          La proyección usa las cuotas y cantidades pendientes cargadas. Las
          deudas sin cuota o plazo confirmado quedan fuera del cálculo mensual
          hasta completar esos datos.
        </p>
      </section>
      {config.payments.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pagos registrados</h2>
              <span>Últimos movimientos confirmados en este centro.</span>
            </div>
          </div>
          <div className="finance-payment-history">
            {[...config.payments]
              .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
              .slice(0, 8)
              .map((payment) => {
                const debt = config.debts.find(
                  (item) => item.id === payment.debtId,
                );
                return (
                  <div key={payment.id}>
                    <div>
                      <strong>
                        {debt
                          ? `${debt.entity} · ${debt.label}`
                          : 'Deuda registrada'}
                      </strong>
                      <span>
                        {paymentModes[payment.mode]} ·{' '}
                        {new Intl.DateTimeFormat('es-AR', {
                          dateStyle: 'medium',
                          timeZone: 'America/Argentina/Buenos_Aires',
                        }).format(new Date(payment.paidOn))}
                      </span>
                    </div>
                    <b>{pesos(payment.amountMinor)}</b>
                  </div>
                );
              })}
          </div>
        </section>
      )}
      <section className="panel finance-export">
        <div>
          <h2>Exportar para ChatGPT</h2>
          <p>Genera texto local. No envía información ni usa una API.</p>
        </div>
        <Button onClick={copy}>
          <Copy />
          Copiar prompt
        </Button>
      </section>
      {notice.text && (
        <output className={`analysis-message ${notice.tone}`}>
          <Check />
          {notice.text}
        </output>
      )}
    </div>
  );
}
function StepHeader({
  id,
  number,
  title,
  description,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <header id={id} className="finance-step-heading">
      <span>{number}</span>
      <div>
        <p>PASO {number}</p>
        <h2>{title}</h2>
        <small>{description}</small>
      </div>
    </header>
  );
}
function MoneyInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <Input
        aria-label={label}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function SignedMoney({ value }: { value: number }) {
  return (
    <td className={value >= 0 ? 'finance-positive' : 'finance-negative'}>
      {value < 0 ? '− ' : '+ '}
      {pesos(Math.abs(value))}
    </td>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <section className={`metric-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
function Calc({
  name,
  value,
  total,
  reference,
}: {
  name: string;
  value: number;
  total?: boolean;
  reference?: boolean;
}) {
  return (
    <div
      className={`rank-row ${total ? 'finance-total' : ''} ${reference ? 'quiet' : ''}`}
    >
      <strong>{name}</strong>
      <span>
        {!reference && (value < 0 ? '− ' : value > 0 ? '+ ' : '')}
        {pesos(Math.abs(value))}
      </span>
    </div>
  );
}
