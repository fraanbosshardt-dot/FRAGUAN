import { AppError } from './auth';

type Entry = { count: number; resetAt: number };

const globalState = globalThis as typeof globalThis & {
  __fraguanRateLimits?: Map<string, Entry>;
};
const buckets = (globalState.__fraguanRateLimits ??= new Map());

function clientAddress(req: Request) {
  const candidate =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    'local';
  return candidate.trim().slice(0, 64).replace(/[^a-fA-F0-9:.[\]-]/g, '_');
}

function bucketKey(req: Request, scope: string, subject: string) {
  return `${scope}:${clientAddress(req)}:${subject.slice(0, 100)}`;
}

export function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
  subject = '',
) {
  enforceKey(bucketKey(req, scope, subject), limit, windowMs);
}

function enforceKey(key: string, limit: number, windowMs: number) {
  const current = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= current) {
    buckets.set(key, { count: 1, resetAt: current + windowMs });
  } else {
    existing.count += 1;
    if (existing.count > limit)
      throw new AppError(
        429,
        'Demasiados intentos. Esperá unos minutos antes de volver a intentar.',
        {
          'Retry-After': String(
            Math.max(1, Math.ceil((existing.resetAt - current) / 1000)),
          ),
        },
      );
  }
  if (buckets.size > 5000) {
    for (const [bucketKey, entry] of buckets)
      if (entry.resetAt <= current) buckets.delete(bucketKey);
    while (buckets.size > 8000) {
      const oldest = buckets.keys().next().value;
      if (typeof oldest !== 'string') break;
      buckets.delete(oldest);
    }
  }
}

export function enforceGlobalRateLimit(
  scope: string,
  subject: string,
  limit: number,
  windowMs: number,
) {
  enforceKey(`${scope}:global:${subject.slice(0, 100)}`, limit, windowMs);
}

export function clearRateLimit(req: Request, scope: string, subject = '') {
  buckets.delete(bucketKey(req, scope, subject));
}

export function clearGlobalRateLimit(scope: string, subject: string) {
  buckets.delete(`${scope}:global:${subject.slice(0, 100)}`);
}
