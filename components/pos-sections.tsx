'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, date, money, Row } from '@/lib/client';
import { LoadingState } from '@/components/loading-state';
import { printCommerce } from '@/lib/printing';

function today() {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}
function period(key: string) {
  const end = today();
  const day = (offset: number) =>
    new Date(Date.parse(end + 'T12:00:00Z') - offset * 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    from:
      key === 'ayer'
        ? day(1)
        : key === '7'
          ? day(6)
          : key === '30'
            ? day(29)
            : key === 'mes'
              ? end.slice(0, 7) + '-01'
              : end,
    to: key === 'ayer' ? day(1) : end,
  };
}

export function PosSections({
  view,
  session,
  onSale,
  onPromotionsChanged,
}: {
  view: 'summary' | 'returns' | 'promotions';
  session: Row;
  onSale: (id: string, refund: boolean) => Promise<void>;
  onPromotionsChanged: () => Promise<void>;
}) {
  const [range, setRange] = useState(period('hoy'));
  const [preset, setPreset] = useState('hoy');
  const [data, setData] = useState<Row | null>(null);
  const [promotions, setPromotions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [kind, setKind] = useState('percentage');
  const canManage = session.permissions?.includes('promotions');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    const valid = range.from && range.to && range.from <= range.to;
    if (view !== 'promotions' && !valid) {
      setError('Elegí una fecha inicial anterior o igual a la final.');
      setLoading(false);
      return;
    }
    api(
      view === 'promotions'
        ? 'pos-promotions'
        : 'pos-summary?' +
            new URLSearchParams({ from: range.from, to: range.to }),
    )
      .then((result) => {
        if (!cancelled) {
          if (view === 'promotions') setPromotions(result);
          else setData(result);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, range.from, range.to, revision]);

  async function savePromotion(action: 'create' | 'toggle', payload: Row) {
    setBusy(true);
    setError('');
    try {
      await api('pos-promotions', { action, payload });
      await onPromotionsChanged();
      setRevision((n) => n + 1);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function openSale(id: string, refund: boolean) {
    setBusy(true);
    setError('');
    try {
      await onSale(id, refund);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = (data?.sales ?? []).filter((s: Row) =>
    `${s.ticket} ${s.customerName ?? ''} ${s.customerSurname ?? ''} ${s.customerPhone ?? ''}`
      .toLocaleLowerCase('es-AR')
      .includes(search.replace('#', '').toLocaleLowerCase('es-AR')),
  );
  const bars = data?.trend ?? [];
  const maximum = Math.max(1, ...bars.map((r: Row) => Math.abs(r.amount)));
  const categories = session.categories ?? [];
  return (
    <section className="pos-day pos-secondary">
      <div className="pos-range no-print">
        {view !== 'promotions' && (
          <div className="chips">
            {[
              ['hoy', 'Hoy'],
              ['ayer', 'Ayer'],
              ['7', '7 días'],
              ['30', '30 días'],
              ['mes', 'Este mes'],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                className={preset === key ? 'selected' : ''}
                onClick={() => {
                  setPreset(key);
                  setRange(period(key));
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {view !== 'promotions' && (
          <>
            <label htmlFor="pos-promo-startsAt">
              Desde
              <Input
                id="pos-promo-startsAt"
                type="date"
                value={range.from}
                max={range.to || today()}
                onChange={(e) => {
                  setPreset('');
                  setRange({ ...range, from: e.target.value });
                }}
              />
            </label>
            <label htmlFor="pos-promo-endsAt">
              Hasta
              <Input
                id="pos-promo-endsAt"
                type="date"
                value={range.to}
                min={range.from}
                max={today()}
                onChange={(e) => {
                  setPreset('');
                  setRange({ ...range, to: e.target.value });
                }}
              />
            </label>
          </>
        )}
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          Actualizar
        </Button>
        {view === 'summary' && data && (
          <Button variant="outline" onClick={() => printCommerce('pos-day')}>
            Imprimir resumen
          </Button>
        )}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <LoadingState label="Cargando datos del POS…" />
      ) : view === 'promotions' ? (
        <>
          <article className="pos-report-card">
            <h2>Promociones</h2>
            <p className="quiet">
              Las vigentes se calculan automáticamente al cobrar. Podés
              quitarlas de la venta actual desde el carrito.
            </p>
            <ul className="pos-records">
              {promotions.map((p) => (
                <li key={p.id}>
                  <span>
                    <b>{p.name}</b>{' '}
                    <span className={'pos-badge ' + (p.active ? 'active' : '')}>
                      {p.active ? 'Activa' : 'Pausada'}
                    </span>
                    <small>
                      {date(p.startsAt)} — {date(p.endsAt)}
                    </small>
                  </span>
                  {canManage && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => savePromotion('toggle', { id: p.id })}
                    >
                      {p.active ? 'Pausar' : 'Activar'}
                    </Button>
                  )}
                </li>
              ))}
              {!promotions.length && (
                <li className="quiet">No hay promociones.</li>
              )}
            </ul>
          </article>
          {canManage && (
            <article className="pos-report-card">
              <h2>Nueva promoción</h2>
              <form
                className="pos-promotion-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fields = new FormData(form);
                  const coupon = kind === 'coupon';
                  const payload = {
                    name: fields.get('name'),
                    kind: kind === 'two_for_one' ? kind : 'percentage',
                    ...(kind !== 'two_for_one'
                      ? { percent: Number(fields.get('percent')) }
                      : {}),
                    category: fields.get('category') || null,
                    methodId: null,
                    startsAt: fields.get('startsAt'),
                    endsAt: fields.get('endsAt'),
                    ...(coupon ? { couponCode: fields.get('couponCode') } : {}),
                  };
                  if (await savePromotion('create', payload)) form.reset();
                }}
              >
                <label htmlFor="pos-promo-name">
                  Nombre
                  <Input
                    id="pos-promo-name"
                    name="name"
                    required
                    maxLength={200}
                    placeholder="Nombre de la promoción"
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="percentage">% de descuento</option>
                    <option value="two_for_one">2×1</option>
                    <option value="coupon">Cupón</option>
                  </select>
                </label>
                <label>
                  Categoría
                  <select name="category">
                    <option value="">Todas</option>
                    {categories.map((c: string) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {kind !== 'two_for_one' && (
                  <label htmlFor="pos-promo-percent">
                    Porcentaje
                    <Input
                      id="pos-promo-percent"
                      name="percent"
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      required
                      placeholder="10"
                    />
                  </label>
                )}
                {kind === 'coupon' && (
                  <label htmlFor="pos-promo-couponCode">
                    Código
                    <Input
                      id="pos-promo-couponCode"
                      name="couponCode"
                      minLength={3}
                      maxLength={50}
                      required
                      autoComplete="off"
                    />
                  </label>
                )}
                <label htmlFor="pos-promo-startsAt">
                  Desde
                  <Input
                    id="pos-promo-startsAt"
                    name="startsAt"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </label>
                <label htmlFor="pos-promo-endsAt">
                  Hasta
                  <Input
                    id="pos-promo-endsAt"
                    name="endsAt"
                    type="date"
                    required
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Guardando…' : 'Agregar promoción'}
                </Button>
              </form>
              <a className="pos-text-link" href="/admin/promotions">
                Configurar todas las reglas de promociones
              </a>
            </article>
          )}
        </>
      ) : (
        data && (
          <div className="pos-day-report">
            <h1>{view === 'summary' ? 'Resumen' : 'Devoluciones'}</h1>
            <p className="quiet">
              {session.user?.name} · {date(range.from)} — {date(range.to)}
            </p>
            {view === 'summary' && (
              <>
                <div className="pos-day-stats">
                  {[
                    ['Vendido neto', money(data.net)],
                    ['Ventas', data.tickets],
                    ['Ticket promedio', money(data.average)],
                    ['Prendas vendidas', data.units],
                    ['Devoluciones', money(data.returned)],
                  ].map(([label, value]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <b>{value}</b>
                    </article>
                  ))}
                </div>
                <div className="pos-report-columns">
                  <article className="pos-report-card">
                    <h2>Ventas por día</h2>
                    <div className="pos-sales-chart">
                      {bars.map((r: Row) => (
                        <button
                          key={r.day}
                          className={r.amount < 0 ? 'negative' : ''}
                          title={`${date(r.day)}: ${money(r.amount)} · ${r.count} ventas`}
                          onClick={() => {
                            setPreset('');
                            setRange({ from: r.day, to: r.day });
                          }}
                        >
                          <span>{money(r.amount)}</span>
                          <i
                            style={{
                              height: `${Math.max(2, (Math.abs(r.amount) / maximum) * 130)}px`,
                            }}
                          />
                          <small>
                            {r.day.slice(8)}/{r.day.slice(5, 7)}
                          </small>
                        </button>
                      ))}
                    </div>
                  </article>
                  <article className="pos-report-card">
                    <h2>Cómo pagaron</h2>
                    <p className="quiet">
                      Cobros originales, antes de reintegros.
                    </p>
                    {data.payments.map((p: Row) => (
                      <div className="pos-meter" key={p.name}>
                        <b>{p.name}</b>
                        <span>{money(p.amount)}</span>
                        <meter
                          min={0}
                          max={Math.max(1, data.gross)}
                          value={p.amount}
                        />
                      </div>
                    ))}
                    {!data.payments.length && (
                      <p className="quiet">Sin cobros en estos días.</p>
                    )}
                  </article>
                </div>
                <article className="pos-report-card">
                  <h2>Qué se vendió</h2>
                  <p className="quiet">
                    Prendas e importes originales, antes de descuentos y
                    devoluciones.
                  </p>
                  {data.products.map((p: Row) => (
                    <div className="pos-meter" key={p.name}>
                      <b>{p.name}</b>
                      <span>
                        {p.units} u. · {money(p.amount)}
                      </span>
                      <meter
                        min={0}
                        max={Math.max(1, data.products[0]?.amount ?? 0)}
                        value={p.amount}
                      />
                    </div>
                  ))}
                  {!data.products.length && (
                    <p className="quiet">Sin prendas vendidas.</p>
                  )}
                </article>
              </>
            )}
            <article className="pos-report-card">
              <h2>
                {view === 'returns' ? 'Elegí la venta a devolver' : 'Ventas'}
              </h2>
              <Input
                className="no-print"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar venta: número, cliente o celular"
                aria-label="Buscar venta"
              />
              <ul className="pos-records">
                {filtered.map((s: Row) => (
                  <li key={s.id}>
                    <button
                      disabled={busy}
                      onClick={() => openSale(s.id, view === 'returns')}
                    >
                      <span>
                        #{String(s.ticket).padStart(6, '0')} ·{' '}
                        {date(s.createdAt)} · {s.units} ítems
                        {s.customerName
                          ? ` · ${s.customerName} ${s.customerSurname ?? ''}`
                          : ''}
                        <small>
                          {s.status === 'refunded'
                            ? 'Devuelta'
                            : s.status === 'partially_refunded'
                              ? 'Devuelta parcialmente'
                              : 'Completada'}
                        </small>
                      </span>
                      <b>{money(s.total)}</b>
                    </button>
                  </li>
                ))}
                {!filtered.length && (
                  <li className="quiet">
                    No se encontró ninguna venta en este período.
                  </li>
                )}
              </ul>
            </article>
            {view === 'returns' && (
              <article className="pos-report-card">
                <h2>Devoluciones registradas</h2>
                <ul className="pos-records">
                  {data.refunds.map((r: Row) => (
                    <li key={r.id}>
                      <span>
                        #{String(r.ticket).padStart(6, '0')} ·{' '}
                        {date(r.createdAt)} · {r.units} prendas · {r.reason}
                        <small>
                          {r.customerName} {r.customerSurname} ·{' '}
                          {r.method === 'credit'
                            ? 'Saldo a favor'
                            : 'Medio original'}
                        </small>
                      </span>
                      <b>−{money(r.amount)}</b>
                    </li>
                  ))}
                  {!data.refunds.length && (
                    <li className="quiet">
                      Todavía no hay devoluciones en estos días.
                    </li>
                  )}
                </ul>
              </article>
            )}
          </div>
        )
      )}
    </section>
  );
}
