export type VerifiedGoogleProfile = {
  sub: string;
  email: string;
  name: string;
  surname: string;
};

type GoogleClaims = Partial<{
  aud: string;
  iss: string;
  email_verified: boolean | string;
  exp: number;
  iat: number;
  nbf: number;
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  name: string;
}>;

const googleKeyCache = globalThis as typeof globalThis & {
  __fraguanGoogleKeys?: { keys: GoogleJwk[]; expiresAt: number };
};
type GoogleJwk = JsonWebKey & { kid?: string; kty?: string };

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

async function googleKeys(forceRefresh = false) {
  const cached = googleKeyCache.__fraguanGoogleKeys;
  if (!forceRefresh && cached && cached.expiresAt > Date.now())
    return cached.keys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return [];
  const result = (await response.json().catch(() => ({}))) as {
    keys?: GoogleJwk[];
  };
  const keys = Array.isArray(result.keys) ? result.keys : [];
  if (!keys.length) return [];
  const maxAge = Number(
    response.headers
      .get('cache-control')
      ?.match(/max-age=(\d+)/i)?.[1] ?? 3600,
  );
  googleKeyCache.__fraguanGoogleKeys = {
    keys,
    expiresAt: Date.now() + Math.min(Math.max(maxAge, 300), 3600) * 1000,
  };
  return keys;
}

export async function verifyGoogleIdToken(
  credential: string,
  audience: string,
): Promise<VerifiedGoogleProfile | null> {
  if (!audience || credential.length < 100 || credential.length > 10000)
    return null;
  const [encodedHeader, encodedClaims, encodedSignature, extra] =
    credential.split('.');
  if (!encodedHeader || !encodedClaims || !encodedSignature || extra)
    return null;
  const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = decodeJson<GoogleClaims>(encodedClaims);
  if (header?.alg !== 'RS256' || !header.kid || !claims) return null;
  let jwk = (await googleKeys()).find(
    (key) => key.kid === header.kid && key.kty === 'RSA',
  );
  if (!jwk)
    jwk = (await googleKeys(true)).find(
      (key) => key.kid === header.kid && key.kty === 'RSA',
    );
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const validSignature = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
    if (!validSignature) return null;
  } catch {
    return null;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const email = (claims.email ?? '').trim().toLowerCase();
  if (
    claims.aud !== audience ||
    !['accounts.google.com', 'https://accounts.google.com'].includes(
      claims.iss ?? '',
    ) ||
    ![true, 'true'].includes(claims.email_verified ?? false) ||
    !Number.isSafeInteger(claims.exp) ||
    Number(claims.exp) <= nowSeconds ||
    (Number.isFinite(claims.iat) && Number(claims.iat) > nowSeconds + 300) ||
    (Number.isFinite(claims.nbf) && Number(claims.nbf) > nowSeconds + 300) ||
    !claims.sub ||
    claims.sub.length > 255 ||
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return null;
  return {
    sub: claims.sub,
    email,
    name: (claims.given_name || claims.name || 'Usuario').trim().slice(0, 80),
    surname: (claims.family_name || '').trim().slice(0, 80),
  };
}
