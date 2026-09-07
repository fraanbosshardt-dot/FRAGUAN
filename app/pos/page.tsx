import Workspace from '../workspace';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
export const dynamic = 'force-dynamic';
export default function POS() {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN POS" />;
  return <Workspace />;
}
