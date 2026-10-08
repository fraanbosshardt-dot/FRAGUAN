import '../internal-workspace.css';
import Workspace from '../workspace';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import type { Metadata } from 'next';
import { actor, AppError, can } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Punto de venta | FRAGUAN',
  robots: { index: false, follow: false },
};
export default async function POS() {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN POS" />;
  let current;
  try {
    current = await actor();
  } catch (cause) {
    if (!(cause instanceof AppError) || cause.status === 401)
      redirect('/acceso?returnTo=%2Fpos');
    return (
      <main className="empty-state">
        <h1>Acceso denegado</h1>
        <p>Tu cuenta no tiene acceso al punto de venta.</p>
        <a href="/">Volver a la tienda</a>
      </main>
    );
  }
  if (!can(current, 'pos'))
    return (
      <main className="empty-state">
        <h1>Acceso denegado</h1>
        <p>Tu usuario no tiene permiso para usar el POS.</p>
        <a href="/">Volver a la tienda</a>
      </main>
    );
  return <Workspace />;
}
