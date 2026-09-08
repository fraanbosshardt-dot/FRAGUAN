import OrderTracking from './tracking';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Seguimiento de pedido | FRAGUAN', robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderTracking orderId={id} />;
}
