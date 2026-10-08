'use client';
import { useEffect, useState } from 'react';
import { api, money, Row } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const statuses: Record<string, string> = {
  scheduled: 'Programada',
  active: 'Activa',
  restored: 'Finalizada / restaurada',
  restoring: 'Restaurando',
};
export function AdminPriceCampaigns() {
  const [data, setData] = useState<Row | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [name, setName] = useState('CyberMonday'),
    [discount, setDiscount] = useState(10),
    [referencePrices, setReferencePrices] = useState<Record<string, number>>(
      {},
    ),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [preview, setPreview] = useState<Row | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = () => api('price-campaigns').then(setData);
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
  }, []);
  const config = () => ({
    name,
    discount,
    startsAt: new Date(start + '-03:00').toISOString(),
    endsAt: new Date(end + '-03:00').toISOString(),
    variantIds: ids,
    referencePrices: Object.fromEntries(
      ids.map((id) => [
        id,
        referencePrices[id] ??
          data?.variants.find((v: Row) => v.id === id)?.price,
      ]),
    ),
  });
  async function write(action: string, id?: string) {
    setBusy(true);
    setNotice('');
    try {
      const result = await api(
        'price-campaigns',
        id ? { action, id } : { action, config: config() },
      );
      if (action === 'preview') setPreview(result);
      else {
        setPreview(null);
        setNotice(
          action === 'create'
            ? 'Campaña guardada. Se aplicará según su programación.'
            : 'Restauración registrada. Los cambios manuales posteriores se conservan.',
        );
        await load();
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-tool-panel">
      <h2>Campañas temporales · CyberMonday</h2>
      <p>
        Elegí el precio tachado de referencia y el descuento. La vista previa
        muestra el precio final. Usá una referencia real y verificable.
        Guardamos el precio anterior online y lo restauramos al terminar. El
        sistema revisa las campañas cada cinco minutos. Horarios de Argentina.
      </p>
      <div className="admin-tool-grid" onChange={() => setPreview(null)}>
        <label>
          Nombre
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Descuento (%)
          <Input
            type="number"
            min={1}
            max={80}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </label>
        <label>
          Inicio
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onInput={(e) => setStart(e.currentTarget.value)}
          />
        </label>
        <label>
          Fin
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            onInput={(e) => setEnd(e.currentTarget.value)}
          />
        </label>
      </div>
      <div className="data-table admin-tool-table">
        <table>
          <thead>
            <tr>
              <th>Incluir</th>
              <th>Prenda / variante</th>
              <th>Precio guardado</th>
              <th>Precio tachado ($)</th>
              <th>Precio final</th>
            </tr>
          </thead>
          <tbody>
            {data?.variants?.map((v: Row) => (
              <tr key={v.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={
                      'Incluir ' + v.name + ' ' + v.color + ' ' + v.size
                    }
                    checked={ids.includes(v.id)}
                    onChange={(e) => {
                      setIds(
                        e.target.checked
                          ? [...ids, v.id]
                          : ids.filter((i) => i !== v.id),
                      );
                      setPreview(null);
                    }}
                  />
                </td>
                <td>
                  {v.name} · {v.color} · {v.size}
                </td>
                <td>{money(v.price)}</td>
                <td>
                  <Input
                    aria-label={
                      'Precio tachado de ' +
                      v.name +
                      ' ' +
                      v.color +
                      ' ' +
                      v.size
                    }
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={(referencePrices[v.id] ?? v.price) / 100}
                    onChange={(e) => {
                      setReferencePrices({
                        ...referencePrices,
                        [v.id]: Math.round(Number(e.target.value) * 100),
                      });
                      setPreview(null);
                    }}
                  />
                </td>
                <td>
                  {money(
                    Math.max(
                      1,
                      Math.round(
                        ((referencePrices[v.id] ?? v.price) *
                          (100 - discount)) /
                          100,
                      ),
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        disabled={busy || !ids.length || !start || !end}
        onClick={() => void write('preview')}
      >
        Vista previa
      </Button>
      {preview && (
        <div className="data-table admin-tool-table">
          <table>
            <thead>
              <tr>
                <th>Variante</th>
                <th>Tachado</th>
                <th>Promocional</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((v: Row) => (
                <tr key={v.id}>
                  <td>
                    {v.name} · {v.color} · {v.size}
                  </td>
                  <td>
                    <del>{money(v.referencePrice)}</del>
                    <small>
                      Guardado para restaurar: {money(v.originalPrice)}
                    </small>
                  </td>
                  <td>{money(v.campaignPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button disabled={busy} onClick={() => void write('create')}>
            Guardar campaña
          </Button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="data-table admin-tool-table">
        <table>
          <thead>
            <tr>
              <th>Campaña</th>
              <th>Estado</th>
              <th>Variantes</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {data?.campaigns?.map((c: Row) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  <small>
                    {new Date(c.startsAt).toLocaleString('es-AR', {
                      timeZone: 'America/Argentina/Cordoba',
                    })}{' '}
                    →{' '}
                    {new Date(c.endsAt).toLocaleString('es-AR', {
                      timeZone: 'America/Argentina/Cordoba',
                    })}
                  </small>
                </td>
                <td>{statuses[c.status] || c.status}</td>
                <td>
                  {c.variants}
                  {Number(c.skipped) > 0 && (
                    <small>
                      {c.skipped} omitidas por cambios o superposición
                    </small>
                  )}
                </td>
                <td>
                  {['scheduled', 'active'].includes(c.status) && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            '¿Finalizar esta campaña y restaurar los precios que no fueron modificados manualmente?',
                          )
                        )
                          void write('restore', c.id);
                      }}
                    >
                      Finalizar y restaurar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
