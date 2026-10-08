'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client';
export function AdminInstallments() {
  const [config, setConfig] = useState<any>(null),
    [products, setProducts] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    void Promise.all([api('installments'), api('price-campaigns')])
      .then(([c, p]) => {
        setConfig(c);
        setProducts(
          p.variants.filter(
            (v: any, i: number, all: any[]) =>
              all.findIndex((x) => x.productId === v.productId) === i,
          ),
        );
      })
      .catch((e) => setNotice(e.message));
  }, []);
  return (
    <section className="panel admin-tool-panel">
      <h2>Cuotas sin interés</h2>
      <p>
        Por ahora están desactivadas. Activá la comunicación únicamente cuando
        la promoción esté habilitada en Mercado Pago. Esta configuración no
        contrata ni habilita financiación en el proveedor.
      </p>
      {config && (
        <>
          <label className="admin-tool-check">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />
            Mostrar cuotas sin interés en productos
          </label>
          <label className="admin-tool-field">
            Cantidad de cuotas
            <select
              value={config.installments}
              onChange={(e) =>
                setConfig({ ...config, installments: Number(e.target.value) })
              }
            >
              {[3, 6, 9, 12].map((n) => (
                <option key={n} value={n}>
                  {n} cuotas
                </option>
              ))}
            </select>
          </label>
          <label className="admin-tool-field">
            Costo financiero total efectivo anual (%)
            <input
              type="number"
              min={0}
              max={1000}
              step="0.01"
              value={config.cft || 0}
              onChange={(e) =>
                setConfig({ ...config, cft: Number(e.target.value) })
              }
            />
          </label>
          <p>
            Tarjetas de crédito a través de Mercado Pago. Sin productos
            seleccionados, se aplica a todos.
          </p>
          <div className="admin-tool-grid">
            {products.map((p) => (
              <label key={p.productId} className="admin-tool-check">
                <input
                  type="checkbox"
                  checked={config.productIds.includes(p.productId)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      productIds: e.target.checked
                        ? [...config.productIds, p.productId]
                        : config.productIds.filter(
                            (id: string) => id !== p.productId,
                          ),
                    })
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
          <label className="admin-tool-check">
            <input
              type="checkbox"
              checked={config.providerConfirmed}
              onChange={(e) =>
                setConfig({ ...config, providerConfirmed: e.target.checked })
              }
            />
            Confirmé en Mercado Pago las cuotas sin interés y las tarjetas
            participantes.
          </label>
          <Button
            type="button"
            disabled={busy || (config.enabled && !config.providerConfirmed)}
            onClick={() => {
              setBusy(true);
              void api('installments', config)
                .then(() => setNotice('Configuración guardada.'))
                .catch((e) => setNotice(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Guardar configuración de cuotas
          </Button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
