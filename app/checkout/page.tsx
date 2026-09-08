import Checkout from './checkout';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Checkout | FRAGUAN', robots: { index: false, follow: false } };
export default function Page() {
  return <Checkout />;
}
