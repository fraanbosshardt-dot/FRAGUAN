import { env } from 'cloudflare:workers';
import Checkout from './checkout';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Checkout | FRAGUAN',
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Checkout
      passwordAuthEnabled={
        import.meta.env.DEV ||
        (env as unknown as Record<string, string>)
          .STORE_PASSWORD_AUTH_ENABLED === 'true'
      }
    />
  );
}
