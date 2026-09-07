import { AdminPinForm } from './admin-pin-form';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ADMIN" />;
  const requested = (await searchParams).returnTo ?? '/admin/dashboard';
  const returnTo =
    requested.startsWith('/admin/') && !requested.startsWith('//')
      ? requested
      : '/admin/dashboard';
  return <AdminPinForm returnTo={returnTo} />;
}
