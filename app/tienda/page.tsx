import Storefront from '../storefront';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FRAGUAN | Tienda online',
  description: 'Indumentaria masculina FRAGUAN por talle y color. Envíos, retiro y beneficios del Club.',
  alternates: { canonical: '/' },
  robots: { index: false, follow: true },
};

export default async function StorePreviewPage() {
  if (isProductionComingSoon()) return <ComingSoon />;
  const catalog = await storeCatalog();
  return <Storefront initialCatalog={catalog} />;
}
