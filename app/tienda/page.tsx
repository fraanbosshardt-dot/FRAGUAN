import Storefront from '../storefront';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';

export default function StorePreviewPage() {
  if (isProductionComingSoon()) return <ComingSoon />;
  return <Storefront />;
}
