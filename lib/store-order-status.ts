export const fulfillmentLabels: Record<string, string> = {
  pending: 'Recibido',
  unfulfilled: 'Recibido',
  preparing: 'Preparando',
  ready: 'Listo para retirar',
  ready_pickup: 'Listo para retirar',
  shipped: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
export function fulfillmentStep(status: string) {
  if (status === 'preparing') return 1;
  if (['ready', 'ready_pickup', 'shipped'].includes(status)) return 2;
  if (status === 'delivered') return 3;
  return 0;
}
