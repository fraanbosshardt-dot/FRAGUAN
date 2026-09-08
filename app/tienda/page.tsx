import Storefront from '../storefront';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FRAGUAN | Tienda online',
  description: 'Indumentaria masculina FRAGUAN por talle y color. Envíos, retiro y beneficios del Club.',
  alternates: { canonical: '/tienda' },
};

export default function StorePreviewPage() {
  if (isProductionComingSoon()) return <ComingSoon />;
  return <Storefront />;
}
