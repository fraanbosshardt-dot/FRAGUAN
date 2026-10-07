'use client';
import StoreReservation, {
  useReservationExpired,
} from '@/components/store-reservation';
import { ArrowLeft, Check, Clock, PackageCheck, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storeApi, storeMoney } from '@/lib/store-client';
import {
  StorePaymentTicket,
  useOrderPaymentUpdates,
} from '@/components/store-payment-ticket';

const fulfillment: Record<string, string> = {
  pending: 'Pedido recibido',
  preparing: 'Preparando tu pedido',
  ready: 'Listo para retirar',
  shipped: 'Pedido despachado',
  delivered: 'Pedido entregado',
  cancelled: 'Pedido cancelado',
};
const payment: Record<string, string> = {
  pending: 'Pago pendiente',
  reported: 'Transferencia informada',
  paid: 'Pago confirmado',
  failed: 'Pago rechazado',
  refunded: 'Pago reintegrado',
};

export default function OrderTracking({
  orderId,
  thankYou = false,
}: {
  orderId: string;
  thankYou?: boolean;
}) {
  const [order, setOrder] = useState<any>(null);
  const { expired: reservationExpired } = useReservationExpired(order);
  const [error, setError] = useState('');
  useOrderPaymentUpdates(order, setOrder);
  useEffect(() => {
    const token = sessionStorage.getItem(`fraguan-order-${orderId}`) || '';
    storeApi(`store-order?id=${encodeURIComponent(orderId)}`, {
      headers: token ? { 'x-order-token': token } : undefined,
    })
      .then(setOrder)
      .catch((cause) => setError(cause.message));
  }, [orderId]);
  return (
    <div className="store-shell">
      <section className="store-tracking" data-thank-you={thankYou}>
        <a href="/" className="store-back">
          <ArrowLeft /> Volver a la tienda
        </a>
        {error ? (
          <section className="store-tracking-error">
            <h1>No pudimos abrir el pedido.</h1>
            <p>
              {error} Ingresá a Mi FRAGUAN con la cuenta usada en la compra.
            </p>
            <a href="/cuenta">Ir a Mi FRAGUAN</a>
          </section>
        ) : !order ? (
          <div className="store-product-loading">Buscando tu pedido…</div>
        ) : (
          <>
            <header>
              <span>PEDIDO #{order.orderNumber}</span>
              <h1>
                {thankYou
                  ? '¡Gracias por tu compra!'
                  : fulfillment[order.fulfillmentStatus] ||
                    'Estamos con tu pedido'}
              </h1>
              <p>
                Creado el{' '}
                {new Date(order.createdAt).toLocaleDateString('es-AR')} ·{' '}
                {payment[order.paymentStatus] || order.paymentStatus}
              </p>
            </header>
            <StorePaymentTicket
              order={order}
              showPending={
                order.paymentStatus === 'reported' ||
                (order.paymentMethod === 'card' && !reservationExpired)
              }
            />
            <StoreReservation order={order} />
            <section className="store-tracking-steps">
              <article className="done">
                <Check />
                <span>Recibido</span>
              </article>
              <article
                className={
                  ['preparing', 'ready', 'shipped', 'delivered'].includes(
                    order.fulfillmentStatus,
                  )
                    ? 'done'
                    : ''
                }
              >
                <PackageCheck />
                <span>Preparación</span>
              </article>
              <article
                className={
                  ['shipped', 'delivered'].includes(order.fulfillmentStatus)
                    ? 'done'
                    : ''
                }
              >
                <Truck />
                <span>
                  {order.shippingMethod === 'pickup' ? 'Retiro' : 'Envío'}
                </span>
              </article>
              <article
                className={
                  order.fulfillmentStatus === 'delivered' ? 'done' : ''
                }
              >
                <Clock />
                <span>Entregado</span>
              </article>
            </section>
            {order.trackingNumber && (
              <p className="store-tracking-number">
                Código de seguimiento <strong>{order.trackingNumber}</strong>
              </p>
            )}
            <section className="store-tracking-grid">
              <div>
                <h2>Tu compra</h2>
                {order.items.map((item: any) => (
                  <article key={`${item.sku}-${item.color}-${item.size}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>
                        {item.color} · Talle {item.size} · {item.quantity} u.
                      </small>
                    </span>
                    <b>{storeMoney(item.lineTotal)}</b>
                  </article>
                ))}
                <div className="store-tracking-total">
                  <span>Total</span>
                  <strong>{storeMoney(order.total)}</strong>
                </div>
              </div>
              <aside>
                <h2>Entrega</h2>
                <p>
                  {order.shippingMethod === 'pickup'
                    ? 'Retiro en FRAGUAN'
                    : `${order.address}, ${order.city}, ${order.province}, ${order.country || 'Argentina'}`}
                </p>
                <small>
                  Te avisaremos por email cada vez que cambie el estado.
                </small>
              </aside>
            </section>
            <div className="store-tracking-help">
              <a href="/informacion/cambios">Ver política de cambios</a>
              <a href="/arrepentimiento">Solicitar arrepentimiento</a>
              <a href="/informacion/contacto">Necesito ayuda</a>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
