import type { Metadata } from 'next';
import RecoverCart from './recover-cart';

export const metadata: Metadata = {
  title: 'Recuperar selección | FRAGUAN',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <RecoverCart token={(await params).token} />;
}
