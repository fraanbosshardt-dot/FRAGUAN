import { env } from 'cloudflare:workers';
import ComingSoon from '../coming-soon';
import { isProductionComingSoon } from '@/lib/release-mode';
import { InternalLogin } from './internal-login';

export const dynamic = 'force-dynamic';

function safeReturnTo(requested: string) {
  try {
    const parsed = new URL(requested, 'https://fraguan.local');
    if (parsed.origin !== 'https://fraguan.local') return '/pos';
    if (parsed.pathname === '/pos') return '/pos';
    if (parsed.pathname === '/admin-access') {
      const adminTarget = parsed.searchParams.get('returnTo') ?? '';
      if (/^\/admin\/[a-z0-9-]+$/.test(adminTarget))
        return `/admin-access?returnTo=${encodeURIComponent(adminTarget)}`;
      return '/admin-access';
    }
  } catch {}
  return '/pos';
}

export default async function InternalAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (isProductionComingSoon()) return <ComingSoon area="FRAGUAN ACCESO" />;
  const runtime = env as unknown as Record<string, string | undefined>;
  return (
    <InternalLogin
      clientId={runtime.INTERNAL_GOOGLE_CLIENT_ID ?? ''}
      returnTo={safeReturnTo((await searchParams).returnTo ?? '/pos')}
    />
  );
}
