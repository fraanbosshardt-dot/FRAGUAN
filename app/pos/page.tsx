import Workspace from '../workspace';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import type { Metadata } from 'next';
import { getChatGPTUser } from '../chatgpt-auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Punto de venta | FRAGUAN',
  robots: { index: false, follow: false },
};
export default async function POS() {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN POS" />;
  if (!(await getChatGPTUser())) redirect('/acceso?returnTo=%2Fpos');
  return <Workspace />;
}
