'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Download,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { api, date } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const timezone = 'America/Argentina/Cordoba';
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

const choices = [
  ['sales', 'Ventas'],
  ['profitability', 'Rentabilidad'],
  ['products', 'Productos'],
  ['categoriesBrands', 'Categorías y marcas'],
  ['stockRotation', 'Stock y rotación'],
  ['sizesColors', 'Talles y colores'],
  ['paymentMethods', 'Medios de pago'],
  ['discountsPromotions', 'Descuentos y promociones'],
  ['customers', 'Clientes'],
  ['daysHours', 'Días y horarios'],
  ['branches', 'Sucursales, si existen'],
] as const;

type Choice = (typeof choices)[number][0];
type Comparison =
  | 'previous_period'
  | 'previous_week'
  | 'previous_month'
  | 'same_period_previous_month'
  | 'none';

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function monthBounds(offset = 0) {
  const base = new Date(`${today()}T12:00:00.000Z`);
  const from = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1, 12),
  );
  const to = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset + 1, 0, 12),
  );
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function fallbackCopy(text: string) {
  const element = document.createElement('textarea');
  element.value = text;
  element.setAttribute('readonly', '');
  element.style.position = 'fixed';
  element.style.opacity = '0';
  document.body.appendChild(element);
  element.select();
  // oxlint-disable-next-line typescript/no-deprecated -- compatibility fallback requested for browsers without Clipboard API.
  const copied = document.execCommand('copy');
  element.remove();
  if (!copied) throw new Error('No se pudo copiar automáticamente.');
}

export function ChatGPTAnalysisExport() {
  const initialMonth = useMemo(() => monthBounds(), []);
  const [from, setFrom] = useState(initialMonth.from);
  const [to, setTo] = useState(today());
  const [comparison, setComparison] = useState<Comparison>('previous_period');
  const [sections, setSections] = useState<Choice[]>(
    choices.map(([key]) => key),
  );
  const [report, setReport] = useState<{
    text: string;
    comparisonPeriod: { from: string; to: string } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function setPreset(kind: '7' | '30' | 'current' | 'previous') {
    const end = today();
    const range =
      kind === 'current'
        ? { from: monthBounds().from, to: end }
        : kind === 'previous'
          ? monthBounds(-1)
          : { from: addDays(end, -(Number(kind) - 1)), to: end };
    setFrom(range.from);
    setTo(range.to);
    setReport(null);
    setNotice('');
  }

  async function generate() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setReport(
        await api('chatgpt-analysis', {
          method: 'POST',
          body: JSON.stringify({ from, to, comparison, sections }),
        }),
      );
    } catch (cause: any) {
      setError(cause.message || 'No se pudo generar el informe.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!report?.text) return;
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(report.text);
      else await fallbackCopy(report.text);
      setNotice('Informe copiado. Ya podés pegarlo en ChatGPT.');
    } catch {
      try {
        await fallbackCopy(report.text);
        setNotice('Informe copiado. Ya podés pegarlo en ChatGPT.');
      } catch (cause: any) {
        setError(
          cause.message ||
            'Seleccioná el texto de la vista previa para copiarlo.',
        );
      }
    }
  }

  function download() {
    if (!report?.text) return;
    const url = URL.createObjectURL(
      new Blob([report.text], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `fraguan-analisis-${from}-${to}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Informe descargado en formato TXT.');
  }

  function clear() {
    setReport(null);
    setError('');
    setNotice('');
  }

  return (
    <section className="panel chatgpt-analysis">
      <div className="chatgpt-analysis-heading">
        <div>
          <p className="eyebrow">ANÁLISIS CON CHATGPT</p>
          <h2>Exportar análisis para ChatGPT</h2>
          <p>
            Generá un informe con los datos reales de FRAGUAN para copiarlo y
            analizarlo en ChatGPT. Esta función no envía información
            automáticamente ni utiliza una API.
          </p>
        </div>
        <FileText aria-hidden="true" />
      </div>

      <div className="analysis-presets" aria-label="Accesos rápidos de período">
        <Button variant="outline" onClick={() => setPreset('7')}>
          Últimos 7 días
        </Button>
        <Button variant="outline" onClick={() => setPreset('30')}>
          Últimos 30 días
        </Button>
        <Button variant="outline" onClick={() => setPreset('current')}>
          Mes actual
        </Button>
        <Button variant="outline" onClick={() => setPreset('previous')}>
          Mes anterior
        </Button>
        <span>Período personalizado: editá las fechas</span>
      </div>

      <div className="analysis-fields">
        <label htmlFor="analysis-from">
          Fecha desde
          <Input
            id="analysis-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => {
              setFrom(event.target.value);
              clear();
            }}
          />
        </label>
        <label htmlFor="analysis-to">
          Fecha hasta
          <Input
            id="analysis-to"
            type="date"
            value={to}
            min={from}
            max={today()}
            onChange={(event) => {
              setTo(event.target.value);
              clear();
            }}
          />
        </label>
        <label>
          Tipo de comparación
          <select
            value={comparison}
            onChange={(event) => {
              setComparison(event.target.value as Comparison);
              clear();
            }}
          >
            <option value="previous_period">
              Período inmediatamente anterior
            </option>
            <option value="previous_week">Semana anterior</option>
            <option value="previous_month">Mes anterior</option>
            <option value="same_period_previous_month">
              Mismo período del mes anterior
            </option>
            <option value="none">Sin comparación</option>
          </select>
        </label>
      </div>

      <fieldset className="analysis-sections">
        <legend>Información incluida</legend>
        <div>
          {choices.map(([key, label]) => (
            <label key={key}>
              <Checkbox
                checked={sections.includes(key)}
                onCheckedChange={(checked) => {
                  setSections((current) =>
                    checked
                      ? [...current, key]
                      : current.filter((item) => item !== key),
                  );
                  clear();
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="analysis-actions">
        <Button
          onClick={generate}
          disabled={busy || !sections.length || !from || !to}
        >
          {busy ? 'Calculando…' : 'Generar informe'}
        </Button>
        <Button variant="outline" onClick={copy} disabled={!report}>
          <Clipboard />
          Copiar para ChatGPT
        </Button>
        <Button variant="outline" onClick={download} disabled={!report}>
          <Download />
          Descargar TXT
        </Button>
        <Button variant="ghost" onClick={generate} disabled={busy || !report}>
          <RefreshCw />
          Regenerar
        </Button>
        <Button
          variant="ghost"
          onClick={clear}
          disabled={!report && !error && !notice}
        >
          <Trash2 />
          Limpiar
        </Button>
      </div>

      {error && (
        <p className="analysis-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <output className="analysis-message success">
          <Check />
          {notice}
        </output>
      )}
      {report && (
        <div className="analysis-preview">
          <div>
            <strong>Vista previa</strong>
            <span>
              {report.comparisonPeriod
                ? `Comparación: ${date(report.comparisonPeriod.from)} al ${date(report.comparisonPeriod.to)}`
                : 'Sin comparación'}
            </span>
          </div>
          <textarea
            readOnly
            spellCheck={false}
            value={report.text}
            aria-label="Vista previa del informe para ChatGPT"
          />
        </div>
      )}
    </section>
  );
}
