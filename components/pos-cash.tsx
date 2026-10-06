'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, date, minor, money, type Row } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PosCash() {
  const [data, setData] = useState<Row | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => setData(await api('cash')), []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const open = Boolean(data?.session && !data.session.closedAt);
  const expected = (data?.session?.opening ?? 0) + (data?.balance?.amount ?? 0);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const counted = minor(amount);
      if (!Number.isSafeInteger(counted) || counted < 0)
        throw new Error('Ingresá un importe válido.');
      await api('actions', {
        action: open ? 'close-cash' : 'open-cash',
        amount: counted,
        ...(open ? { id: data?.session.id } : {}),
      });
      setAmount('');
      setMessage(
        open
          ? 'Caja cerrada. El conteo y la diferencia quedaron registrados.'
          : 'Caja abierta. El fondo inicial quedó registrado.',
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar la operación.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pos-cash">
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && <output>{message}</output>}
      {!data ? (
        <p>Cargando caja…</p>
      ) : (
        <>
          <p>
            <strong>Local 1 · Caja {open ? 'abierta' : 'cerrada'}</strong>
          </p>
          {data.session && (
            <>
              <p>
                Abierta por{' '}
                {data.session.openedByName || 'Usuario no encontrado'} ·{' '}
                {date(data.session.openedAt)}
              </p>
              <p>
                Fondo inicial: <b>{money(data.session.opening)}</b>
              </p>
              <p>
                Efectivo esperado: <b>{money(expected)}</b>
              </p>
              {!open && (
                <>
                  <p>
                    Cerrada por{' '}
                    {data.session.closedByName || 'Usuario no encontrado'} ·{' '}
                    {date(data.session.closedAt)}
                  </p>
                  <p>
                    Efectivo contado: <b>{money(data.session.counted)}</b> ·
                    Diferencia: <b>{money(data.session.difference)}</b>
                  </p>
                </>
              )}
            </>
          )}
          <form className="quick-form" onSubmit={submit}>
            <label htmlFor="pos-cash-amount">
              {open ? 'Efectivo contado al cierre ($)' : 'Efectivo inicial ($)'}
            </label>
            <Input
              id="pos-cash-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
            {open && amount !== '' && (
              <p>
                Diferencia prevista: <b>{money(minor(amount) - expected)}</b>
              </p>
            )}
            <p className="quiet">
              Contá sólo el efectivo. Tarjetas, Pix y transferencias no forman
              parte del dinero del cajón. La operación registra tu cuenta y la
              fecha en Auditoría.
            </p>
            <Button type="submit" disabled={busy}>
              {busy
                ? 'Guardando…'
                : open
                  ? 'Confirmar cierre de caja'
                  : 'Abrir caja'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Actualizar
            </Button>
          </form>
          {!!data.history?.length && (
            <details>
              <summary>Últimas aperturas y cierres</summary>
              {data.history.map((entry: Row) => (
                <article
                  key={entry.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <p>
                    <b>{entry.closedAt ? 'Cerrada' : 'Abierta'}</b> ·{' '}
                    {date(entry.openedAt)} ·{' '}
                    {entry.openedByName || 'Usuario no encontrado'}
                  </p>
                  {entry.closedAt && (
                    <p>
                      Cierre: {date(entry.closedAt)} ·{' '}
                      {entry.closedByName || 'Usuario no encontrado'} · Contado:{' '}
                      {money(entry.counted)} · Diferencia:{' '}
                      {money(entry.difference)}
                    </p>
                  )}
                </article>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
