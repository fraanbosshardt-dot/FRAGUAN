import { AdminPinForm } from './admin-pin-form';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { actor, can } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Acceso a Administración | FRAGUAN',
  robots: { index: false, follow: false },
};

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ADMIN" />;
  const requested = (await searchParams).returnTo ?? '/admin/dashboard';
  const returnTo = /^\/admin\/[a-z0-9-]+$/.test(requested)
    ? requested
    : '/admin/dashboard';
  let currentActor: Awaited<ReturnType<typeof actor>>;
  try {
    currentActor = await actor();
  } catch {
    redirect(
      `/acceso?returnTo=${encodeURIComponent(`/admin-access?returnTo=${returnTo}`)}`,
    );
  }
  if (!can(currentActor, 'dashboard'))
    return (
      <main className="empty-state">
        <h1>Acceso denegado</h1>
        <p>Tu usuario no tiene permiso para entrar a Administración.</p>
        <a href="/pos">Volver al punto de venta</a>
      </main>
    );
  return <AdminPinForm returnTo={returnTo} />;
}
