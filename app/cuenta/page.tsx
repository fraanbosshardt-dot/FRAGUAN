import Account from './account';
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
export const metadata: Metadata = { title: 'Mi FRAGUAN', robots: { index: false, follow: false } };
export default function Page() {
  return <Account googleClientId={env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || ''} />;
}
