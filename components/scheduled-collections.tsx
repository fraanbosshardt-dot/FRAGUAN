'use client';
import { useEffect, useState } from 'react';
import { money, date, Row } from '@/lib/client';
import { argentinaDay } from '@/lib/business-date';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ScheduledCollections({
  data,
  refresh,
}: {
  data: Row;
  refresh: () => Promise<unknown>;
}) {
  const [filter, setFilter] = useState(''),
    [search, setSearch] = useState(''),
    [view, setView] = useState<'pending' | 'available'>('pending');
  useEffect(() => {
    const timer = setInterval(() => {
      if (argentinaDay() !== data.asOf) void refresh().catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [data.asOf, refresh]);
  const records: Row[] = data[view] ?? [];
  const methods = [
    ...new Set(
      [...(data.pending ?? []), ...(data.available ?? [])].map((p: Row) =>
        String(p.method),
      ),
    ),
  ];
  const visible = records.filter(
    (p) =>
      (!filter || p.method === filter) &&
      `${p.ticket} ${p.destination} ${p.method}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <h2>Acreditaciones según plazo</h2>
        <span>{data.totals?.pendingCount ?? 0} pendientes</span>
      </div>
      <p>
        Tarjetas: se consideran acreditadas automáticamente el día previsto al
        cobrar. Transferencias del local: ingresadas al confirmar la venta.
        Transferencias de la tienda: aparecen después de confirmar el pago en
        Pedidos online.
      </p>
      <p>
        Importe neto estimado pendiente:{' '}
        <strong>{money(data.totals?.pendingNet ?? 0)}</strong>.
      </p>
      <p className="quiet">
        Este registro usa los plazos del sistema; no consulta el saldo real de
        Mercado Pago. Las devoluciones y los movimientos bancarios se registran
        por separado.
      </p>
      <div className="heading-actions">
        <Button
          variant={view === 'pending' ? 'default' : 'outline'}
          onClick={() => setView('pending')}
        >
          Pendientes ({data.totals?.pendingCount ?? 0})
        </Button>
        <Button
          variant={view === 'available' ? 'default' : 'outline'}
          onClick={() => setView('available')}
        >
          Acreditados según plazo ({data.totals?.availableCount ?? 0})
        </Button>
        <Input
          aria-label="Buscar cobro"
          placeholder="Buscar ticket, destino o método"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrar método de cobro"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos los métodos</option>
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Venta</th>
              <th>Método / destino</th>
              <th>Bruto</th>
              <th>Comisión</th>
              <th>Neto estimado</th>
              <th>Fecha de ingreso</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  Ticket {p.ticket}
                  <small>
                    {p.channel === 'online' ? 'Tienda online' : 'POS'} ·{' '}
                    {date(p.createdAt)}
                  </small>
                  {p.saleStatus !== 'confirmed' && (
                    <small>Con devolución: importes del cobro original.</small>
                  )}
                </td>
                <td>
                  {p.method}
                  <small>{p.destination || 'Destino no registrado'}</small>
                </td>
                <td>{money(p.amount)}</td>
                <td>{money(p.commission)}</td>
                <td>{money(p.net)}</td>
                <td>{date(p.dueAt)}</td>
                <td>
                  {view === 'pending' ? 'Pendiente' : 'Acreditado según plazo'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="quiet">
          {records.length
            ? 'No hay cobros que coincidan con los filtros.'
            : view === 'pending'
              ? 'No hay acreditaciones pendientes.'
              : 'Todavía no hay cobros acreditados según plazo.'}
        </p>
      )}
      <p className="quiet">
        {view === 'pending'
          ? 'Hasta 1.000 pendientes, ordenados por fecha de ingreso.'
          : 'Últimos 250 cobros acreditados según plazo.'}{' '}
        Los contadores incluyen todos los cobros.
      </p>
    </section>
  );
}
