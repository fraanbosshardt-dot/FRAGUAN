import ComingSoon from './coming-soon';
import Storefront from './storefront';
import { isProductionComingSoon } from '@/lib/release-mode';
import { storeCatalog } from '@/lib/online-store';

export default async function Home() {
  if (isProductionComingSoon()) return <ComingSoon />;
  const catalog = await storeCatalog();
  return <Storefront initialCatalog={catalog} />;
}
