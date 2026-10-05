export type ReceiptOrder = {
  id: string;
  orderNumber: string | number;
  paymentStatus: string;
  paymentMethod: string;
  status?: string;
  paidAt?: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: {
    productName: string;
    color: string;
    size: string;
    unitPrice: number;
    quantity: number;
  }[];
};

export function paymentReceiptProps(order: ReceiptOrder, showPending = false) {
  const approved =
    order.paymentStatus === 'paid' && order.status !== 'cancelled';
  const pending =
    ['pending', 'reported'].includes(order.paymentStatus) &&
    order.status !== 'cancelled';
  if (!approved && !(pending && showPending)) return null;
  return {
    status: approved ? ('approved' as const) : ('processing' as const),
    pedido: order.orderNumber,
    items: order.items.map((item) => ({
      nombre: item.productName,
      variante: item.color,
      talle: item.size,
      precio: item.unitPrice / 100,
      cantidad: item.quantity,
    })),
    subtotal: order.subtotal / 100,
    descuento: order.discount / 100,
    envio: order.shipping / 100,
    total: order.total / 100,
    metodo:
      order.paymentMethod === 'transfer' ? 'Transferencia' : 'Mercado Pago',
    fecha: order.paidAt ? new Date(order.paidAt) : undefined,
  };
}
