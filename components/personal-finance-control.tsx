'use client';
import { useMemo, useState } from 'react';
import { Check, Copy, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, money } from '@/lib/client';
import {
  cancellationEfficiency,
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

export function PersonalFinanceControl({
  initial,
}: {
  initial: PersonalFinanceConfig;
}) {
  const [config, setConfig] = useState(initial),
    [available, setAvailable] = useState(initial.availableMinor / 100),
    [selected, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState<'flow' | 'interest' | 'balanced'>('balanced'),
    [notice, setNotice] = useState('');
  const plans = useMemo(
    () => ({
      flow: suggestedPlan(config, 'flow', Math.round(available * 100)),
      interest: suggestedPlan(config, 'interest', Math.round(available * 100)),
      balanced: suggestedPlan(config, 'balanced', Math.round(available * 100)),
    }),
    [config, available],
  );
  const result = useMemo(
    () => simulateFinance(config, selected, Math.round(available * 100)),
    [config, selected, available],
  );
  const activePlan = plans[mode];
  const basePersonal = config.personalIncomeMinor - config.livingCostsMinor;
  async function save() {
    const next = { ...config, availableMinor: Math.round(available * 100) };
    setConfig(
      await api('personal-finance', {
        method: 'POST',
        body: JSON.stringify(next),
      }),
    );
    setNotice('Datos guardados.');
  }
  async function copy() {
    const text = `Analizá mi situación financiera actual. No inventes datos.\n\nDINERO DISPONIBLE: ${pesos(Math.round(available * 100))}\nINGRESOS PERSONALES: ${pesos(config.personalIncomeMinor)}\nGASTOS PERSONALES: ${pesos(config.livingCostsMinor)}\nFLUJO ANTES DE DEUDAS: ${pesos(basePersonal)}\n\nDEUDAS:\n${config.debts.map((d) => `- ${d.entity} · ${d.label}: saldo ${pesos(d.balanceMinor)}, cancelación ${d.payoffMinor == null ? 'Dato pendiente' : pesos(d.payoffMinor)}, pago mensual ${d.monthlyMinor == null && d.minimumMinor == null ? 'Dato pendiente' : pesos(d.monthlyMinor ?? d.minimumMinor ?? 0)}, prioridad ${priorities[d.priority]}, calidad ${quality[d.quality]}. ${d.decision}`).join('\n')}\n\nCompará qué conviene cancelar y qué mantener. Explicá qué hacer, por qué, flujo resultante, riesgos y próximos pasos.`;
    await navigator.clipboard.writeText(text);
    setNotice('Prompt copiado.');
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
              type="number"
              value={available}
              onChange={(e) => setAvailable(Number(e.target.value))}
            />
            , ¿qué hago?
          </h2>
          <p>
            Probá decisiones sin modificar deudas ni registrar pagos. Personal y
            negocio permanecen separados.
          </p>
        </div>
        <Button onClick={save}>
          <Save />
          Guardar capital
        </Button>
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
          label="Déficit/superávit personal"
          value={pesos(result.personalFlowAfterMinor)}
          tone={result.personalFlowAfterMinor >= 0 ? 'positive' : 'negative'}
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
            return (
              <label
                key={debt.id}
                aria-label={`Seleccionar ${debt.entity} ${debt.label}`}
                className={selected.includes(debt.id) ? 'selected' : ''}
              >
                <input
                  type="checkbox"
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
                    {quality[debt.quality]} · {priorities[debt.priority]}
                  </span>
                  <small>{debt.decision}</small>
                </div>
                <div>
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
              </label>
            );
          })}
        </div>
      </section>
      <div className="dashboard-panels">
        <section className="panel">
          <div className="panel-heading">
            <h2>Flujo personal</h2>
            <span>Cómo se calculó</span>
          </div>
          <Calc name="Ingresos" value={config.personalIncomeMinor} />
          <Calc name="Gastos de vida" value={-config.livingCostsMinor} />
          <Calc name="Pagos mensuales" value={-result.monthlyAfterMinor} />
          <Calc name="Resultado" value={result.personalFlowAfterMinor} total />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Flujo negocio</h2>
            <span>Separado del personal</span>
          </div>
          <Calc
            name="Ingresos registrados"
            value={config.businessIncomeMinor}
          />
          <Calc name="Costos fijos" value={-config.businessFixedCostsMinor} />
          <Calc
            name="Extraordinario pendiente"
            value={-config.businessExtraordinaryMinor}
          />
          <Calc
            name="Resultado conocido"
            value={
              config.businessIncomeMinor -
              config.businessFixedCostsMinor -
              config.businessExtraordinaryMinor
            }
            total
          />
        </section>
      </div>
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
      {notice && (
        <output className="analysis-message success">
          <Check />
          {notice}
        </output>
      )}
    </div>
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
