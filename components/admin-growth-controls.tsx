'use client';
import { useEffect, useState } from 'react';
type Config = {
  enabled: boolean;
  firstHours: number;
  secondHours: number;
  secondEnabled: boolean;
  dailyReminderLimit: number;
  monthlyReminderLimit: number;
  freePlanGuard: boolean;
};
export function AdminGrowthControls({
  data,
  busy,
  save,
}: {
  data: {
    recovery: Config;
    recoveryLastRun?: { at: string; sent: number; failed: number };
    scheduler: string;
    emailUsage?: {
      day: number;
      month: number;
      remindersDay: number;
      remindersMonth: number;
    };
    automations?: {
      kind: string;
      recipient: string;
      status: string;
      createdAt: string;
    }[];
  };
  busy: boolean;
  save: (config: Config) => Promise<unknown>;
}) {
  const [config, setConfig] = useState(data.recovery);
  const [source, setSource] = useState(''),
    [medium, setMedium] = useState(''),
    [campaign, setCampaign] = useState(''),
    [path, setPath] = useState('/'),
    [notice, setNotice] = useState('');
  useEffect(() => setConfig(data.recovery), [data.recovery]);
  let link = '';
  try {
    const url = new URL(path, 'https://www.fraguan.com');
    if (
      url.origin !== 'https://www.fraguan.com' ||
      url.username ||
      url.password
    )
      throw new Error();
    for (const [key, value] of Object.entries({
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
    }))
      if (value.trim()) url.searchParams.set(key, value.trim());
    link = url.href;
  } catch {
    /* Show an invalid destination below. */
  }
  return (
    <div className="growth-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Recuperación automática</h2>
          <span>{config.enabled ? 'Activada' : 'Pausada'}</span>
        </div>
        <p>
          Solo con aceptación y email verificado. Se detiene al crear el pedido,
          vaciar el carrito o darse de baja. Sin descuentos.
        </p>
        <form
          className="admin-growth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await save(config);
          }}
        >
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />{' '}
            Activar recordatorios
          </label>
          <label>
            Primer aviso (horas)
            <input
              type="number"
              min="1"
              max="72"
              required
              value={config.firstHours}
              onChange={(e) =>
                setConfig({ ...config, firstHours: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.secondEnabled}
              onChange={(e) =>
                setConfig({ ...config, secondEnabled: e.target.checked })
              }
            />{' '}
            Enviar segundo aviso
          </label>
          <label>
            Segundo aviso (horas)
            <input
              type="number"
              min={config.firstHours + 1}
              max="168"
              required
              value={config.secondHours}
              onChange={(e) =>
                setConfig({ ...config, secondHours: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Máximo de recordatorios por día
            <input
              type="number"
              min="0"
              max="10000"
              value={config.dailyReminderLimit}
              onChange={(e) =>
                setConfig({
                  ...config,
                  dailyReminderLimit: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Máximo de recordatorios por mes
            <input
              type="number"
              min="0"
              max="1000000"
              value={config.monthlyReminderLimit}
              onChange={(e) =>
                setConfig({
                  ...config,
                  monthlyReminderLimit: Number(e.target.value),
                })
              }
            />
          </label>
          <label><input type="checkbox" checked={config.freePlanGuard} onChange={(e) => setConfig({ ...config, freePlanGuard: e.target.checked })} /> Reservar margen del plan gratuito (desactivar solo después de contratar otro plan en Resend)</label>
          <button className="button" disabled={busy}>
            Guardar automatización
          </button>
        </form>
        <p className="quiet">
          Plan gratuito: 3.000 emails/mes y 100/día; marketing: 1.000 contactos.
          Todos los emails actuales usan la API de envíos y comparten el cupo.
          Los recordatorios se posponen al llegar a 80 envíos diarios o 2.400
          mensuales registrados, dejando margen para pedidos. No se contrata un
          plan pago automáticamente.
        </p>
        {data.emailUsage && (
          <p className="quiet">
            Aceptados registrados: hoy {data.emailUsage.day}/100 · mes{' '}
            {data.emailUsage.month}/3.000. Recordatorios: hoy{' '}
            {data.emailUsage.remindersDay} · mes{' '}
            {data.emailUsage.remindersMonth}. Conteo UTC de esta aplicación;
            comprobá el consumo total y el período de facturación en Resend,
            incluidos envíos externos.
          </p>
        )}
        <p className="quiet">
          {data.scheduler} Los tiempos se cuentan desde la última actividad. No
          envía ambos avisos juntos.
        </p>
        <p className="quiet">
          {data.recoveryLastRun
            ? `Última ejecución: ${new Date(data.recoveryLastRun.at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' })}. Enviados: ${data.recoveryLastRun.sent}. Errores: ${data.recoveryLastRun.failed}.`
            : 'Todavía no hay ejecuciones registradas.'}
        </p>
        <div className="growth-list">
          {(data.automations ?? []).map((r, i) => (
            <div key={r.createdAt + i}>
              <span>
                <strong>
                  {r.kind === 'cart_reminder_1'
                    ? 'Primer recordatorio'
                    : r.kind === 'cart_reminder_2'
                      ? 'Segundo recordatorio'
                      : r.kind}
                </strong>
                <small>{r.recipient}</small>
              </span>
              <b>
                {r.status === 'sent' ? 'Aceptado por Resend' : 'Revisar error'}
              </b>
            </div>
          ))}
        </div>
        <a href="/admin/newsletter">Emails, remitentes y campañas →</a>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Links para medir el origen</h2>
          <span>UTM</span>
        </div>
        <p>
          Identificá tus enlaces para medir visitas y compras de cada fuente. La
          medición requiere aceptación del visitante.
        </p>
        <div className="admin-growth-form">
          <label>
            Página de destino
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/producto/..."
            />
          </label>
          <label>
            Origen
            <input
              value={source}
              maxLength={100}
              onChange={(e) => setSource(e.target.value)}
              placeholder="instagram"
            />
          </label>
          <label>
            Medio
            <input
              value={medium}
              maxLength={100}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="social"
            />
          </label>
          <label>
            Campaña
            <input
              value={campaign}
              maxLength={160}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="Nombre de campaña"
            />
          </label>
          <output style={{ overflowWrap: 'anywhere' }}>
            {link || 'Ingresá una página de www.fraguan.com.'}
          </output>
          <button
            type="button"
            className="button"
            disabled={!link}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setNotice('Enlace copiado.');
              } catch {
                setNotice('Seleccioná el enlace para copiarlo.');
              }
            }}
          >
            Copiar enlace
          </button>
          <output>{notice}</output>
        </div>
      </section>
    </div>
  );
}
