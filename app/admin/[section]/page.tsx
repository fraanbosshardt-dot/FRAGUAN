import { actor, can } from '@/lib/auth';
import { adminPinCookie, verifyAdminPinToken } from '@/lib/admin-pin';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Admin from '../../admin-workspace';
import Operations from '../../operations-workspace';
import ComingSoon from '../../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Administración | FRAGUAN',
  robots: { index: false, follow: false },
};
const adminSections = new Set([
  'dashboard',
  'online-orders',
  'online-catalog',
  'marketing',
  'sales',
  'customers',
  'promotions',
  'customer-intelligence',
  'club-rewards',
  'communications',
  'newsletter',
  'products',
  'storage',
  'purchases',
  'suppliers',
  'stock-movements',
  'replenishment',
  'inventory',
  'cash',
  'banking',
  'expenses',
  'payables',
  'financial-calendar',
  'cash-flow',
  'personal-finance',
  'withdrawals',
  'reports',
  'insights',
  'seller-commissions',
  'users',
  'settings',
  'access',
  'audit',
]);
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ADMIN" />;
  if (section === 'stock') redirect('/admin/products');
  if (!adminSections.has(section)) notFound();
  let a: Awaited<ReturnType<typeof actor>>;
  try {
    a = await actor();
  } catch {
    redirect('/pos');
  }
  const permission = section === 'stock-movements' ? 'stock' : section;
  if (!can(a, permission))
    return (
      <main className="empty-state">
        <h1>Acceso denegado</h1>
        <a href="/pos">Volver al punto de venta</a>
      </main>
    );
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(adminPinCookie)?.value ?? '';
  if (!(await verifyAdminPinToken(adminToken, a.id)))
    redirect(
      `/admin-access?returnTo=${encodeURIComponent(`/admin/${section}`)}`,
    );
  return [
    'banking',
    'club-rewards',
    'access',
    'communications',
    'seller-commissions',
  ].includes(section) ? (
    <Operations section={section} />
  ) : (
    <Admin section={section} />
  );
}
