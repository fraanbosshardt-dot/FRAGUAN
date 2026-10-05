import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const ITERATIONS = 600000;

function configuredHash() {
  const value = (
    env as unknown as Record<string, string | undefined>
  ).INTERNAL_PASSWORD_HASH?.trim();
  return value && /^pbkdf2-sha256:600000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}

export function internalPasswordConfigured() {
  return Boolean(configuredHash());
}

export async function verifyInternalPassword(password: string) {
  const configured = configuredHash();
  if (!configured) return false;
  const [, , salt, expected] = configured.split(':');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  );
  const received = Array.from(hash, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1)
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
