'use client';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import PagoAprobado from './PagoAprobado';
import {
  paymentReceiptProps,
  type ReceiptOrder,
} from '@/lib/store-payment-receipt';
import { storeApi } from '@/lib/store-client';

export function StorePaymentTicket({
  order,
  showPending = false,
}: {
  order: ReceiptOrder;
  showPending?: boolean;
}) {
  const props = paymentReceiptProps(order, showPending);
  const [visible, setVisible] = useState(false);
  const key = `fraguan-payment-animation-${order.id}`;
  useEffect(() => {
    try {
      setVisible(
        order.paymentStatus === 'paid' &&
          sessionStorage.getItem(key) !== 'done',
      );
    } catch {
      setVisible(order.paymentStatus === 'paid');
    }
  }, [key, order.paymentStatus]);
  if (!props) return null;
  if (props.status === 'processing')
    return (
      <output className="store-payment-waiting" aria-live="polite">
        Pago pendiente de confirmación. El estado de tu pedido se actualizará
        cuando verifiquemos el pago.
      </output>
    );
  return visible ? (
    <div className="store-payment-animation">
      <PagoAprobado
        key={order.id}
        {...props}
        onPrinted={() => {
          try {
            sessionStorage.setItem(key, 'done');
          } catch {
            /* El resumen sigue disponible si el navegador bloquea el almacenamiento. */
          }
          setVisible(false);
        }}
      />
    </div>
  ) : null;
}

/** Read the protected order until payment reaches a terminal state. */
export function useOrderPaymentUpdates(
  order: Record<string, any> | null,
  setOrder: Dispatch<SetStateAction<any>>,
) {
  const id = order?.id;
  const status = order?.paymentStatus;
  const cancelled = order?.status === 'cancelled';
  useEffect(() => {
    if (!id || cancelled || !['pending', 'reported'].includes(status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function refresh() {
      if (!active) return;
      if (document.visibilityState !== 'hidden') {
        try {
          const token = sessionStorage.getItem(`fraguan-order-${id}`) || '';
          const updated = await storeApi<Record<string, any>>(
            `store-order?id=${encodeURIComponent(id)}`,
            { headers: token ? { 'x-order-token': token } : undefined },
          );
          if (!active) return;
          setOrder((current: Record<string, any> | null) =>
            current?.id === id ? { ...current, ...updated } : current,
          );
          if (
            !['pending', 'reported'].includes(updated.paymentStatus) ||
            updated.status === 'cancelled'
          )
            return;
        } catch {
          // A transient connection error never turns a pending payment into an approval.
        }
      }
      timer = setTimeout(refresh, ++attempts < 12 ? 5000 : 30000);
    }
    timer = setTimeout(refresh, 5000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, status, cancelled, setOrder]);
}
