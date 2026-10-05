'use client';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
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
  return props ? <PagoAprobado key={order.id} {...props} /> : null;
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
