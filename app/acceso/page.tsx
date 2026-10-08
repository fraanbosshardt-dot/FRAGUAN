import '../internal-workspace.css';
import { env } from 'cloudflare:workers';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { InternalLogin } from './internal-login';
import type { Metadata } from 'next';
import { getChatGPTUser } from '../chatgpt-auth';
import { redirect } from 'next/navigation';
import { internalPasswordConfigured } from '@/lib/internal-password';
import { internalSessionsConfigured } from '@/lib/internal-session';
import { adminEntryPath } from '@/lib/admin-entry';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Acceso del personal | FRAGUAN',
  robots: { index: false, follow: false },
};

function safeReturnTo(requested: string) {
  try {
    const parsed = new URL(requested, 'https://fraguan.local');
    if (parsed.origin !== 'https://fraguan.local') return '/pos';
    if (parsed.pathname === '/pos') return '/pos';
    if (parsed.pathname === '/admin' || parsed.pathname === '/admin-access') {
      const adminTarget = parsed.searchParams.get('returnTo') ?? '';
      return adminEntryPath(adminTarget);
    }
    if (/^\/admin\/[a-z0-9-]+$/.test(parsed.pathname))
      return adminEntryPath(parsed.pathname);
  } catch {}
  return '/pos';
}

export default async function InternalAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ACCESO" />;
  const returnTo = safeReturnTo((await searchParams).returnTo ?? '/pos');
  if (await getChatGPTUser()) redirect(returnTo);
  const runtime = env as unknown as Record<string, string | undefined>;
  return (
    <InternalLogin
      localAccess={import.meta.env.DEV}
      passwordAccess={
        internalPasswordConfigured() && internalSessionsConfigured()
      }
      clientId={runtime.INTERNAL_GOOGLE_CLIENT_ID ?? ''}
      returnTo={returnTo}
    />
  );
}
