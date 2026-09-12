import { env } from 'cloudflare:workers';

export const internalSessionCookie = 'fraguan_internal_session';
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type InternalSessionIdentity = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};

function secret() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const configured = runtime.INTERNAL_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (import.meta.env.DEV)
    return `fraguan-local-internal-session:${runtime.INTERNAL_GOOGLE_CLIENT_ID || 'development-only'}`;
  return null;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signature(value: string, sessionSecret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    ),
  );
}

function constantTimeEqual(received: string, expected: string) {
  let difference = received.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1)
    difference |=
      (received.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function internalSessionsConfigured() {
  return Boolean(secret());
}

export async function createInternalSession(identity: InternalSessionIdentity) {
  const sessionSecret = secret();
  if (!sessionSecret) throw new Error('Internal session secret is missing.');
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        version: 1,
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        nonce: base64Url(nonce),
        ...identity,
      }),
    ),
  );
  return `${payload}.${await signature(payload, sessionSecret)}`;
}

export async function verifyInternalSession(
  cookieHeader: string,
): Promise<InternalSessionIdentity | null> {
  const sessionSecret = secret();
  if (!sessionSecret) return null;
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === internalSessionCookie)
    ?.slice(1)
    .join('=');
  if (!token || token.length > 4000) return null;
  const [payload, receivedSignature, extra] = token.split('.');
  if (!payload || !receivedSignature || extra) return null;
  const expectedSignature = await signature(payload, sessionSecret);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return null;
  try {
    const data = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    if (
      data.version !== 1 ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt <= Math.floor(Date.now() / 1000) ||
      data.expiresAt > Math.floor(Date.now() / 1000) + SESSION_SECONDS ||
      typeof data.nonce !== 'string' ||
      data.nonce.length < 20 ||
      typeof data.userId !== 'string' ||
      data.userId.length > 255 ||
      typeof data.email !== 'string' ||
      data.email.length > 254 ||
      typeof data.displayName !== 'string' ||
      data.displayName.length > 120
    )
      return null;
    return {
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
      fullName:
        typeof data.fullName === 'string' ? data.fullName.slice(0, 120) : null,
    };
  } catch {
    return null;
  }
}

export function internalSessionSetCookie(token: string, secure: boolean) {
  return `${internalSessionCookie}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict; Priority=High${secure ? '; Secure' : ''}`;
}

export function internalSessionClearCookie(secure: boolean) {
  return `${internalSessionCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Priority=High${secure ? '; Secure' : ''}`;
}
