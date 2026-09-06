import { actor, can } from '@/lib/auth';
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
  try {
    const a = await actor();
    if (!can(a, section))
      return (
        <main className="empty-state">
          <h1>Acceso denegado</h1>
          <a href="/pos">Volver al punto de venta</a>
        </main>
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
  } catch {
    redirect('/pos');
  }
}
