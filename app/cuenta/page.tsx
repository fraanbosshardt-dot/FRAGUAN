import Account from './account';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Mi FRAGUAN', robots: { index: false, follow: false } };
export default function Page() {
  return <Account />;
}
