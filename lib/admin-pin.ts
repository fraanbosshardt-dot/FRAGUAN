import { env } from 'cloudflare:workers';
import { AppError } from './auth';

export const adminPinCookie = 'fraguan_admin_access';
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function configuredPin() {
  const configured = (env as unknown as Record<string, string | undefined>)[
    'ADMIN_PIN'
  ]?.trim();
  if (configured && /^\d{6}$/.test(configured)) return configured;
  if (import.meta.env.DEV) return '197313';
  throw new AppError(503, 'El PIN administrativo todavía no está configurado.');
}

function sessionSecret() {
  const configured = (env as unknown as Record<string, string | undefined>)[
    'ADMIN_SESSION_SECRET'
  ]?.trim();
  if (configured && configured.length >= 32) return configured;
  if (import.meta.env.DEV)
    return `fraguan-local-admin-session:${configuredPin()}:development-only`;
  throw new AppError(
    503,
    'La sesión administrativa todavía no está configurada.',
  );
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()),
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

async function pinDigest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`FRAGUAN:${value}`),
  );
  return base64Url(new Uint8Array(hash));
}

export async function verifyAdminPin(pin: string) {
  const [received, expected] = await Promise.all([
    pinDigest(pin),
    pinDigest(configuredPin()),
  ]);
  return constantTimeEqual(received, expected);
}

export async function createAdminPinToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = `v1.${expiresAt}.${encodeURIComponent(userId)}.${base64Url(nonce)}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyAdminPinToken(token: string, userId: string) {
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return false;
  const [version, expiresRaw, encodedUserId, nonce, signature] = parts;
  const expiresAt = Number(expiresRaw);
  const current = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= current ||
    expiresAt > current + SESSION_SECONDS ||
    nonce.length < 20
  )
    return false;
  let tokenUserId = '';
  try {
    tokenUserId = decodeURIComponent(encodedUserId);
  } catch {
    return false;
  }
  if (tokenUserId !== userId) return false;
  const payload = `${version}.${expiresRaw}.${encodedUserId}.${nonce}`;
  return constantTimeEqual(signature, await hmac(payload));
}

export async function verifyAdminPinRequest(req: Request, userId: string) {
  const value = (req.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === adminPinCookie)
    ?.slice(1)
    .join('=');
  return value ? verifyAdminPinToken(value, userId) : false;
}

export function adminPinSetCookie(token: string, secure: boolean) {
  return `${adminPinCookie}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict; Priority=High${secure ? '; Secure' : ''}`;
}
