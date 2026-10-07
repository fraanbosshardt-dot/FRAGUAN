'use client';
import './store-reservation.css';
import { Clock, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storeApi, useStoreCart, type StoreCatalog } from '@/lib/store-client';
import {
  reservationSeconds,
  reviewReservedItems,
} from '@/lib/store-reservation';

export function useReservationExpired(order: Record<string, any> | null) {
  const [timestamp, setTimestamp] = useState<number | null>(null);
  useEffect(() => {
    if (!order?.expiresAt || order.paymentStatus === 'paid') return;
    const refresh = () => setTimestamp(Date.now());
    refresh();
    const timer = setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [order?.id, order?.expiresAt, order?.paymentStatus]);
  const seconds =
    timestamp === null || !order?.expiresAt
      ? null
      : reservationSeconds(order.expiresAt, timestamp);
  return { seconds, expired: seconds === 0 && order?.paymentStatus !== 'paid' };
}

export default function StoreReservation({
  order,
}: {
  order: Record<string, any>;
}) {
  const { seconds, expired } = useReservationExpired(order);
  const { restore } = useStoreCart();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState(false);
  if (
    ['paid', 'refunded'].includes(order.paymentStatus) ||
    order.status === 'cancelled' ||
    seconds === null
  )
    return null;
  const reported = order.paymentStatus === 'reported';
  async function resume() {
    setBusy(true);
    setMessage('');
    try {
      const token =
        order.accessToken ||
        sessionStorage.getItem(`fraguan-order-${order.id}`) ||
        '';
      const latest = await storeApi(
        `store-order?id=${encodeURIComponent(order.id)}`,
        { headers: token ? { 'x-order-token': token } : undefined },
      );
      if (
        ['paid', 'reported', 'refunded'].includes(latest.paymentStatus) ||
        latest.status === 'cancelled'
      ) {
        setMessage(
          'El estado de tu pedido cambió. Actualizá la página antes de continuar.',
        );
        return;
      }
      const catalog = await storeApi<StoreCatalog>('store-catalog');
      const { restored, notices } = reviewReservedItems(latest.items, catalog);
      if (restored.length) {
        restore(restored);
        setReviewed(true);
      }
      setMessage(
        [
          restored.length
            ? 'Recuperamos tu selección con los precios y el stock actuales. Revisá el carrito antes de confirmar un nuevo pedido.'
            : 'Estas prendas no tienen disponibilidad por ahora. Tu selección sigue guardada en este pedido.',
          ...notices,
        ].join(' '),
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'No pudimos revisar tu selección. Intentá nuevamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className="store-reservation"
      data-expired={expired}
      aria-label="Reserva de tus prendas"
    >
      <div className="store-reservation-heading">
        <Clock aria-hidden="true" />
        <span>
          {expired
            ? 'La reserva de stock venció'
            : 'Tus prendas están reservadas'}
        </span>
        {!expired && (
          <strong aria-label="Tiempo restante de reserva">
            {String(Math.floor(seconds! / 60)).padStart(2, '0')}:
            {String(seconds! % 60).padStart(2, '0')}
          </strong>
        )}
      </div>
      <p>
        {expired
          ? reported
            ? 'Recibimos tu aviso de transferencia. No vuelvas a pagar: revisaremos el pago y la disponibilidad de tus prendas.'
            : 'Las prendas volvieron a estar disponibles para otras personas. Si ya pagaste, no hagas otro pago: contactanos para revisarlo. Si todavía no pagaste, podés revisar tu selección para retomar.'
          : reported
            ? 'Recibimos tu aviso de transferencia y estamos revisando el pago. No vuelvas a pagar. Este es el tiempo restante de la reserva de stock.'
            : 'Completá el pago antes de que termine este tiempo. La reserva no se renueva al actualizar la página.'}
      </p>
      {expired && !reported && (
        <div className="store-reservation-actions">
          <button type="button" disabled={busy} onClick={resume}>
            {busy ? 'Revisando disponibilidad…' : 'Retomar mi compra'}
            <ArrowRight aria-hidden="true" />
          </button>
          {reviewed && (
            <a href="/carrito">
              Revisar carrito <ArrowRight aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {expired && (
        <a className="store-reservation-help" href="/informacion/contacto">
          Ya pagué: necesito ayuda
        </a>
      )}
      {message && (
        <output className="store-reservation-message" aria-live="polite">
          {message}
        </output>
      )}
    </aside>
  );
}
