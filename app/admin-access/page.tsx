import { redirect } from 'next/navigation';
import { adminEntryPath } from '@/lib/admin-entry';

export const dynamic = 'force-dynamic';

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  redirect(adminEntryPath((await searchParams).returnTo));
}
