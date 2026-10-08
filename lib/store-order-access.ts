type Customer = { customerId: string; email: string; emailVerified: number };
type OrderOwner = { customerId: string | null; email: string };

export function ownsStoreOrder(customer: Customer | null, order: OrderOwner) {
  if (!customer) return false;
  if (order.customerId) return customer.customerId === order.customerId;
  return (
    Number(customer.emailVerified) === 1 &&
    customer.email.trim().toLowerCase() === order.email.trim().toLowerCase()
  );
}

export function onlineReservationMinutes(paymentMethod: 'transfer' | 'card') {
  return paymentMethod === 'transfer' ? 10 : 30;
}
