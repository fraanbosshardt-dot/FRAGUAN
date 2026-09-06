import { AdminPinForm } from './admin-pin-form';

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const requested = (await searchParams).returnTo ?? '/admin/dashboard';
  const returnTo =
    requested.startsWith('/admin/') && !requested.startsWith('//')
      ? requested
      : '/admin/dashboard';
  return <AdminPinForm returnTo={returnTo} />;
}
