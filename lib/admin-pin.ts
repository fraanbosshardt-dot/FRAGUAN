import { env } from 'cloudflare:workers';

export const adminPinCookie = 'fraguan_admin_access';

function configuredPin() {
  const configured = (env as unknown as Record<string, string | undefined>)[
    'ADMIN_PIN'
  ];
  return configured?.trim() || '197313';
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(`FRAGUAN:${value}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function adminPinToken() {
  return digest(configuredPin());
}

export async function verifyAdminPin(pin: string) {
  const [received, expected] = await Promise.all([
    digest(pin),
    adminPinToken(),
  ]);
  let difference = received.length ^ expected.length;
  for (let index = 0; index < expected.length; index++)
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export async function verifyAdminPinRequest(req: Request) {
  const value = (req.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === adminPinCookie)
    ?.slice(1)
    .join('=');
  if (!value) return false;
  const expected = await adminPinToken();
  let difference = value.length ^ expected.length;
  for (let index = 0; index < expected.length; index++)
    difference |= (value.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function adminPinSetCookie(token: string, secure: boolean) {
  return `${adminPinCookie}=${token}; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}
