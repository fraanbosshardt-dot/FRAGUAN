import { actor, can } from '@/lib/auth';
import { adminPinCookie, adminPinToken } from '@/lib/admin-pin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Admin from '../../admin-workspace';
import Operations from '../../operations-workspace';
export const dynamic = 'force-dynamic';
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === 'stock') redirect('/admin/products');
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
  if (cookieStore.get(adminPinCookie)?.value !== (await adminPinToken()))
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
