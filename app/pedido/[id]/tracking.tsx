'use client';
import StoreReservation, {
  useReservationExpired,
} from '@/components/store-reservation';
import { StoreTransferDetails } from '@/components/store-transfer-details';
import { ArrowLeft, Check, Clock, PackageCheck, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storeApi, storeMoney } from '@/lib/store-client';
import { fulfillmentStep } from '@/lib/store-order-status';
import {
  StorePaymentTicket,
  useOrderPaymentUpdates,
} from '@/components/store-payment-ticket';

const fulfillment: Record<string, string> = {
  pending: 'Pedido recibido',
  unfulfilled: 'Pedido recibido',
  preparing: 'Preparando tu pedido',
  ready: 'Listo para retirar',
  ready_pickup: 'Listo para retirar',
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

function trackingLink(value: string, method: string) {
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol)) return url.href;
  } catch {
    /* Un código no es una URL. */
  }
  return method === 'correo-argentino-home'
    ? 'https://www.correoargentino.com.ar/formularios/e-commerce'
    : undefined;
}

export default function OrderTracking({
  orderId,
  thankYou = false,
}: {
  orderId: string;
  thankYou?: boolean;
}) {
  const [order, setOrder] = useState<any>(null);
  const { expired: reservationExpired } = useReservationExpired(order);
  const [copyMessage, setCopyMessage] = useState('');
  const [error, setError] = useState('');
  useOrderPaymentUpdates(order, setOrder, true);
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
                <span
                  key={`${order.id}-${order.fulfillmentStatus}-${thankYou}`}
                >
                  {thankYou
                    ? '¡Gracias por tu compra!'
                    : fulfillment[order.fulfillmentStatus] ||
                      'Estamos con tu pedido'}
                </span>
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
            {order.paymentMethod === 'transfer' &&
              ['pending', 'reported'].includes(order.paymentStatus) &&
              !reservationExpired &&
              order.status !== 'cancelled' && (
                <StoreTransferDetails
                  total={order.total}
                  reference={order.transferReference}
                />
              )}
            <section
              className="store-tracking-progress"
              aria-label="Estado del pedido"
            >
              <ol
                className="store-tracking-steps"
                style={
                  {
                    '--tracking-progress': `${(fulfillmentStep(order.fulfillmentStatus) / 3) * 75}%`,
                  } as React.CSSProperties
                }
              >
                {[
                  { name: 'Recibido', icon: Check },
                  { name: 'Preparación', icon: PackageCheck },
                  {
                    name:
                      order.shippingMethod === 'pickup' ? 'Retiro' : 'Envío',
                    icon: Truck,
                  },
                  { name: 'Entregado', icon: Clock },
                ].map((step, index) => {
                  const current = fulfillmentStep(order.fulfillmentStatus);
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.name}
                      className={
                        index < current
                          ? 'done'
                          : index === current
                            ? 'current'
                            : ''
                      }
                      aria-current={index === current ? 'step' : undefined}
                    >
                      <span className="tracking-dot">
                        <Icon />
                      </span>
                      <span>{step.name}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
            {order.trackingNumber && (
              <section className="store-tracking-number">
                <span>
                  {/^https?:\/\//i.test(order.trackingNumber)
                    ? 'Seguimiento del envío'
                    : 'Código de seguimiento'}
                </span>
                <strong>{order.trackingNumber}</strong>
                <div className="tracking-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          order.trackingNumber,
                        );
                        setCopyMessage('Seguimiento copiado.');
                      } catch {
                        setCopyMessage(
                          'Podés seleccionar y copiar el seguimiento manualmente.',
                        );
                      }
                    }}
                  >
                    Copiar
                  </button>
                  {trackingLink(order.trackingNumber, order.shippingMethod) && (
                    <a
                      href={trackingLink(
                        order.trackingNumber,
                        order.shippingMethod,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Seguir envío →
                    </a>
                  )}
                </div>
                <output aria-live="polite">{copyMessage}</output>
              </section>
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
                <div className="tracking-breakdown">
                  <span>Subtotal</span>
                  <span>{storeMoney(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="tracking-breakdown">
                    <span>Descuentos</span>
                    <span>−{storeMoney(order.discount)}</span>
                  </div>
                )}
                <div className="tracking-breakdown">
                  <span>Envío</span>
                  <span>
                    {order.shipping ? storeMoney(order.shipping) : 'Sin cargo'}
                  </span>
                </div>
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
