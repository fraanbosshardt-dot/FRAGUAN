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
import { adminPageData } from '@/lib/admin-page-data';

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
  if (!(await verifyAdminPinToken(token, current.id))) {
    const runtime = env as unknown as Record<string, string | undefined>;
    if (runtime.INTERNAL_AUTH_MODE === 'google')
      return (
        <InternalLogin
          localAccess={false}
          passwordAccess={false}
          clientId={runtime.INTERNAL_GOOGLE_CLIENT_ID ?? ''}
          returnTo={entry}
          area="admin"
        />
      );
    return <AdminPinForm returnTo={entry} />;
  }
  if (target !== '/admin') redirect(target);
  const initial = await adminPageData('dashboard');
  return (
    <Admin
      section="dashboard"
      initialData={initial.data}
      initialSession={initial.session}
      initialError={initial.error}
    />
  );
}
