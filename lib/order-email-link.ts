import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
function secret() {
  const runtime = env as unknown as Record<string, string | undefined>;
  return (
    runtime.STORE_ORDER_LINK_SECRET ||
    runtime.STORE_EMAIL_VERIFICATION_SECRET ||
    runtime.INTERNAL_SESSION_SECRET ||
    ''
  );
}
async function key() {
  const value = secret();
  if (value.length < 32) return null;
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(value),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
function encoded(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
export async function orderEmailLink(orderId: string) {
  const signingKey = await key();
  if (!signingKey) return '';
  const expires = Math.floor(Date.now() / 1000) + 90 * 86400;
  const signature = encoded(
    await crypto.subtle.sign(
      'HMAC',
      signingKey,
      encoder.encode(`order-read:${orderId}:${expires}`),
    ),
  );
  return `https://www.fraguan.com/pedido/${encodeURIComponent(orderId)}#email-token=el1.${expires}.${signature}`;
}
export async function verifyOrderEmailToken(orderId: string, token: string) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'el1') return false;
  const expires = Number(parts[1]),
    current = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expires) ||
    expires <= current ||
    expires > current + 90 * 86400 ||
    !/^[\w-]{43}$/.test(parts[2])
  )
    return false;
  const signingKey = await key();
  if (!signingKey) return false;
  const binary = atob(parts[2].replaceAll('-', '+').replaceAll('_', '/') + '=');
  return crypto.subtle.verify(
    'HMAC',
    signingKey,
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    encoder.encode(`order-read:${orderId}:${expires}`),
  );
}
