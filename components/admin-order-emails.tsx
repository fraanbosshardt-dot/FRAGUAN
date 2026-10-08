'use client';
import { useEffect, useState } from 'react';
import { api, date, Row } from '@/lib/client';
import { Button } from '@/components/ui/button';
const labels: Record<string, string> = {
  pending: 'Pendiente',
  retry: 'Reintento programado',
  sent: 'Aceptado por Resend',
  delivered: 'Entregado al servidor del destinatario',
  delayed: 'Entrega demorada',
  bounced: 'Rebotado',
  complained: 'Marcado como spam',
  failed: 'Falló',
  review: 'Revisar en Resend',
};
export function AdminOrderEmails() {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = () =>
    api('order-email-queue')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel admin-tool-panel">
      <div className="panel-heading">
        <h2>Emails de pedidos</h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load().finally(() => setBusy(false));
          }}
        >
          Actualizar
        </Button>
      </div>
      <p>
        Los envíos pendientes se reintentan automáticamente. Aceptado por Resend
        no significa entregado; los rebotes y reclamos no se reenvían
        automáticamente.
      </p>
      {data && !data.webhookConfigured && (
        <p className="quiet">
          Falta configurar el webhook de Resend para recibir entregas y rebotes.
          Endpoint: https://www.fraguan.com/api/webhooks/resend
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="data-table admin-tool-table">
        <table>
          <thead>
            <tr>
              <th>Pedido / aviso</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Intentos</th>
              <th>Actualizado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {data?.jobs?.map((job: Row) => (
              <tr key={job.id}>
                <td>
                  {job.orderId}
                  <small>{job.kind}</small>
                </td>
                <td>{job.recipient}</td>
                <td>
                  {labels[job.status] || job.status}
                  <small>{job.error}</small>
                </td>
                <td>{job.attempts}</td>
                <td>{date(job.updatedAt)}</td>
                <td>
                  {['failed', 'review'].includes(job.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            '¿Revisaste en Resend y confirmás que este aviso NO fue aceptado? Solo continuá si no existe allí.',
                          )
                        )
                          return;
                        setBusy(true);
                        void api('order-email-queue', {
                          action: 'retry',
                          id: job.id,
                          confirmedNotAccepted: true,
                        })
                          .then(load)
                          .catch((e) => setError(e.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Autorizar reintento
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && !data.jobs?.length && (
        <p>
          Todavía no hay avisos en la nueva cola. Los emails históricos se
          conservan.
        </p>
      )}
    </section>
  );
}
