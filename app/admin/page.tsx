import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { actor, can } from '@/lib/auth';
import { adminPinCookie, verifyAdminPinToken } from '@/lib/admin-pin';
import { adminEntryPath, adminReturnTo } from '@/lib/admin-entry';
import { internalPasswordConfigured } from '@/lib/internal-password';
import { internalSessionsConfigured } from '@/lib/internal-session';
import { isProductionComingSoon } from '@/lib/release-mode';
import { InternalLogin } from '../acceso/internal-login';
import { AdminPinForm } from '../admin-access/admin-pin-form';
import ComingSoon from '../coming-soon';
import Admin from '../admin-workspace';
import { dashboard } from '@/lib/admin';
import { isOpenStaffAccess } from '@/lib/staff-access';
import { one } from '@/db/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Administración | FRAGUAN',
  robots: { index: false, follow: false },
};

export default async function Administration({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ADMIN" />;
  const target = adminReturnTo((await searchParams).returnTo);
  const entry = adminEntryPath(target);
  let current: Awaited<ReturnType<typeof actor>> | null = null;
  try {
    current = await actor();
  } catch {
    /* Render the protected entry without redirecting to POS. */
  }
  if (!current) {
    const runtime = env as unknown as Record<string, string | undefined>;
    return (
      <InternalLogin
        localAccess={import.meta.env.DEV}
        passwordAccess={
          internalPasswordConfigured() && internalSessionsConfigured()
        }
        clientId={runtime.INTERNAL_GOOGLE_CLIENT_ID ?? ''}
        returnTo={entry}
        area="admin"
      />
    );
  }
  if (!can(current, 'dashboard'))
    return (
      <main className="empty-state">
        <h1>Acceso denegado</h1>
        <p>Tu usuario no tiene permiso para entrar a Administración.</p>
        <a href="/pos">Volver al punto de venta</a>
      </main>
    );
  const token = (await cookies()).get(adminPinCookie)?.value ?? '';
  if (!(await verifyAdminPinToken(token, current.id)))
    return <AdminPinForm returnTo={entry} />;
  if (target !== '/admin') redirect(target);
  // Seed the existing view after the same role/PIN checks. Readers that do not
  // execute JavaScript receive the real overview; browser actions still hydrate.
  let initialData: Awaited<ReturnType<typeof dashboard>> | null = null;
  try {
    // Match the existing JSON API contract: PostgreSQL date columns may arrive
    // as Date objects, while chart labels expect ISO strings in the browser.
    initialData = JSON.parse(JSON.stringify(await dashboard()));
  } catch {
    // Keep the interactive panel available to retry through its existing API.
  }
  const permissions = [
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
  ].filter((permission) => can(current, permission));
  return (
    <Admin
      section="dashboard"
      initialData={initialData}
      initialSession={{
        user: { id: current.id, name: current.name, role: current.role },
        demo:
          (
            await one<{ value: string }>(
              'SELECT value FROM settings WHERE key=?',
              'demo',
            )
          )?.value === '1',
        permissions,
        openAccess: isOpenStaffAccess(),
      }}
    />
  );
}
