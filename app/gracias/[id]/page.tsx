import OrderTracking from '@/app/pedido/[id]/tracking';
export const metadata = {
  title: 'Gracias por tu compra | FRAGUAN',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <OrderTracking orderId={(await params).id} thankYou />;
}
