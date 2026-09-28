'use client';
import { useMemo, useState } from 'react';
import {
  Check,
  CircleCheck,
  Copy,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, money } from '@/lib/client';
import {
  cancellationEfficiency,
  projectFinance,
  simulateFinance,
  suggestedPlan,
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
      livingCostsMinor: String(initial.livingCostsMinor / 100),
      businessIncomeMinor: String(initial.businessIncomeMinor / 100),
      businessFixedCostsMinor: String(initial.businessFixedCostsMinor / 100),
      businessExtraordinaryMinor: String(
        initial.businessExtraordinaryMinor / 100,
      ),
    }),
    [selected, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState<'flow' | 'interest' | 'balanced'>('balanced'),
    [busyDebt, setBusyDebt] = useState(''),
    [notice, setNotice] = useState({ text: '', tone: 'success' });
  const availableMinor = Math.round((parsePesos(available) ?? 0) * 100);
  const draftConfig = useMemo(() => {
    const next = { ...config, availableMinor };
    for (const [key, value] of Object.entries(cashInputs)) {
      const parsed = parsePesos(value);
      if (parsed != null)
        (next as unknown as Record<string, unknown>)[key] = Math.round(
          parsed * 100,
        );
    }
    return next;
  }, [availableMinor, cashInputs, config]);
  const plans = useMemo(
    () => ({
      flow: suggestedPlan(draftConfig, 'flow', availableMinor),
      interest: suggestedPlan(draftConfig, 'interest', availableMinor),
      balanced: suggestedPlan(draftConfig, 'balanced', availableMinor),
    }),
    [draftConfig, availableMinor],
  );
  const result = useMemo(
    () => simulateFinance(draftConfig, selected, availableMinor),
    [draftConfig, selected, availableMinor],
  );
  const projection = useMemo(
    () => projectFinance(draftConfig, selected),
    [draftConfig, selected],
  );
  const activePlan = plans[mode];
  const basePersonal =
    draftConfig.personalIncomeMinor - draftConfig.livingCostsMinor;
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
    if (parsed == null || invalidCash) {
      setNotice({
        text: 'Revisá los importes ingresados.',
        tone: 'error',
      });
      return;
    }
    try {
      await persist(draftConfig, 'Datos y proyección guardados.');
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
  async function setDebtPaid(debtId: string, paid: boolean) {
    setBusyDebt(debtId);
    try {
      const next = {
        ...draftConfig,
        debts: draftConfig.debts.map((debt) =>
          debt.id === debtId
            ? {
                ...debt,
                status: paid ? ('paid' as const) : ('pending' as const),
              }
            : debt,
        ),
      };
      await persist(
        next,
        paid ? 'Deuda marcada como pagada.' : 'Deuda reabierta.',
      );
      if (paid) setSelected((ids) => ids.filter((id) => id !== debtId));
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
  async function copy() {
    const text = `Analizá mi situación financiera actual. No inventes datos.\n\nDINERO DISPONIBLE: ${pesos(availableMinor)}\nINGRESOS PERSONALES: ${pesos(draftConfig.personalIncomeMinor)}\nGASTOS PERSONALES: ${pesos(draftConfig.livingCostsMinor)}\nFLUJO PERSONAL ANTES DE DEUDAS: ${pesos(basePersonal)}\nINGRESOS DEL NEGOCIO: ${pesos(draftConfig.businessIncomeMinor)}\nGASTOS FIJOS DEL NEGOCIO: ${pesos(draftConfig.businessFixedCostsMinor)}\nGASTOS EXTRAORDINARIOS DEL NEGOCIO: ${pesos(draftConfig.businessExtraordinaryMinor)}\nAPORTE PERSONAL NECESARIO AL NEGOCIO: ${pesos(result.businessSupportAfterMinor)}\nRESULTADO PERSONAL FINAL: ${pesos(result.personalAfterBusinessAfterMinor)}\n\nDEUDAS:\n${draftConfig.debts.map((d) => `- ${d.entity} · ${d.label}: saldo ${pesos(d.balanceMinor)}, cancelación ${d.payoffMinor == null ? 'Dato pendiente' : pesos(d.payoffMinor)}, pago mensual ${d.monthlyMinor == null && d.minimumMinor == null ? 'Dato pendiente' : pesos(d.monthlyMinor ?? d.minimumMinor ?? 0)}, estado ${d.status}, prioridad ${priorities[d.priority]}, calidad ${quality[d.quality]}. ${d.decision}`).join('\n')}\n\nCompará qué conviene cancelar y qué mantener. Explicá qué hacer, por qué, flujo resultante, aporte requerido por el negocio, riesgos y próximos pasos.`;
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
        <Button onClick={save}>
          <Save />
          Guardar datos
        </Button>
      </section>
      <section className="panel finance-input-panel">
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
            value={cashInputs.personalIncomeMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                personalIncomeMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Gastos personales"
            value={cashInputs.livingCostsMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                livingCostsMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Ingresos del negocio"
            value={cashInputs.businessIncomeMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                businessIncomeMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Gastos fijos del negocio"
            value={cashInputs.businessFixedCostsMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                businessFixedCostsMinor: value,
              }))
            }
          />
          <MoneyInput
            label="Gasto extraordinario del negocio"
            value={cashInputs.businessExtraordinaryMinor}
            onChange={(value) =>
              setCashInputs((current) => ({
                ...current,
                businessExtraordinaryMinor: value,
              }))
            }
          />
        </div>
      </section>
      <div className="finance-strategies">
        {(
          [
            ['flow', 'Maximizar flujo mensual'],
            ['interest', 'Minimizar intereses'],
            ['balanced', 'Equilibrado'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={mode === key ? 'active' : ''}
            onClick={() => {
              setMode(key);
              setSelected(plans[key].selectedIds);
            }}
          >
            <strong>{label}</strong>
            <span>Usar {pesos(plans[key].capitalUsedMinor)}</span>
            <b>Libera {pesos(plans[key].monthlyFreedMinor)}/mes</b>
            <small>{plans[key].selectedIds.length} deudas seleccionadas</small>
          </button>
        ))}
      </div>
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
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Armá tu escenario</h2>
            <span>
              Marcá o desmarcá cancelaciones; los resultados cambian al
              instante.
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setSelected(activePlan.selectedIds)}
          >
            <SlidersHorizontal />
            Aplicar estrategia
          </Button>
        </div>
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
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, debt.id]
                        : s.filter((id) => id !== debt.id),
                    )
                  }
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
                  onClick={() => setDebtPaid(debt.id, !paid)}
                >
                  {paid ? <RotateCcw /> : <CircleCheck />}
                  {busyDebt === debt.id
                    ? 'Guardando…'
                    : paid
                      ? 'Reabrir'
                      : 'Marcar pagada'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <div className="dashboard-panels">
        <section className="panel">
          <div className="panel-heading">
            <h2>Flujo personal</h2>
            <span>Luego de la simulación elegida</span>
          </div>
          <Calc name="Ingresos" value={draftConfig.personalIncomeMinor} />
          <Calc name="Gastos de vida" value={-draftConfig.livingCostsMinor} />
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
            name="Ingresos registrados"
            value={draftConfig.businessIncomeMinor}
          />
          <Calc
            name="Costos fijos"
            value={-draftConfig.businessFixedCostsMinor}
          />
          <Calc
            name="Extraordinario pendiente"
            value={-draftConfig.businessExtraordinaryMinor}
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
function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <Input
        aria-label={label}
        type="text"
        inputMode="decimal"
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
}: {
  name: string;
  value: number;
  total?: boolean;
}) {
  return (
    <div className={`rank-row ${total ? 'finance-total' : ''}`}>
      <strong>{name}</strong>
      <span>
        {value < 0 ? '− ' : value > 0 ? '+ ' : ''}
        {pesos(Math.abs(value))}
      </span>
    </div>
  );
}
