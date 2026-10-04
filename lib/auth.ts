import { getChatGPTUser } from '@/app/chatgpt-auth';
import { one } from '@/db/queries';
export type Actor = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'CAJA' | 'STOCK';
  active: number;
  denied?: string[];
};
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function identity() {
  const u = await getChatGPTUser();
  if (!u) throw new AppError(401, 'Iniciá sesión para continuar.');
  return u;
}
export async function actor() {
  const u = await identity();
  const a = await one<Actor>(
    'SELECT id,email,name,role,active FROM users WHERE email=?',
    u.email.toLowerCase(),
  );
  if (!a?.active)
    throw new AppError(403, 'Tu cuenta no tiene acceso a FRAGUAN.');
  if (a.role !== 'ADMIN') {
    const policy = await one<{ value: string }>(
      'SELECT value FROM settings WHERE key=?',
      `access:${a.id}`,
    );
    if (policy) {
      try {
        const denied = JSON.parse(policy.value);
        if (
          !Array.isArray(denied) ||
          !denied.every((p) => typeof p === 'string')
        )
          throw new Error();
        a.denied = denied;
      } catch {
        throw new AppError(403, 'La configuración de acceso debe revisarse.');
      }
    }
  }
  return a;
}
const grants: Record<string, string[]> = {
  ADMIN: ['*'],
  GERENTE: [
    'pos',
    'customers',
    'sales',
    'dashboard',
    'products',
    'stock',
    'storage',
    'replenishment',
    'suppliers',
    'purchases',
    'expenses',
    'payables',
    'cash',
    'cash-flow',
    'financial-calendar',
    'promotions',
    'reports',
    'refunds',
    'inventory',
    'insights',
    'customer-intelligence',
    'customer-credits',
    'banking',
    'club-rewards',
    'communications',
    'newsletter',
    'seller-commissions',
    'online-orders',
    'pos-online-orders',
    'online-catalog',
    'marketing',
  ],
  VENDEDOR: ['pos', 'customers', 'own-sales', 'pos-online-orders'],
  CAJA: ['pos', 'customers', 'own-sales', 'cash'],
  STOCK: [
    'stock',
    'storage',
    'products',
    'suppliers',
    'purchases',
    'inventory',
    'online-catalog',
  ],
};
export function can(a: Actor, resource: string) {
  if (a.denied?.includes(resource)) return false;
  return (
    grants[a.role]?.includes('*') || grants[a.role]?.includes(resource) || false
  );
}
export function requirePermission(a: Actor, resource: string) {
  if (!can(a, resource)) throw new AppError(403, 'Acceso denegado.');
}
export function requireJsonRequest(req: Request, maxBytes = 100000) {
  if (
    req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new AppError(415, 'Se requiere JSON.');
  const rawSize = req.headers.get('content-length');
  if (rawSize) {
    const size = Number(rawSize);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new AppError(400, 'Tamaño de solicitud inválido.');
    if (size > maxBytes)
      throw new AppError(413, 'Solicitud demasiado grande.');
  }
}
export function protectWrite(req: Request, maxBytes = 100000) {
  const origin = req.headers.get('origin');
  const publicStoreOrigin = process.env.SITE_ORIGIN?.trim();
  const storeRequest = new URL(req.url).pathname.startsWith('/api/store-');
  if (!origin || (origin !== new URL(req.url).origin &&
    !(storeRequest && process.env.FRAGUAN_SURFACE === 'store' && origin === publicStoreOrigin)))
    throw new AppError(403, 'Origen no autorizado.');
  requireJsonRequest(req, maxBytes);
}
export async function readJsonBody(req: Request, maxBytes = 100000) {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, 'Se requiere un cuerpo JSON.');
  const decoder = new TextDecoder();
  let bytes = 0,
    source = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new AppError(413, 'Solicitud demasiado grande.');
      }
      source += decoder.decode(chunk.value, { stream: true });
    }
    source += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    const parsed = JSON.parse(source);
    let nodes = 0;
    const inspect = (value: unknown, depth: number) => {
      nodes += 1;
      if (depth > 12 || nodes > 5000)
        throw new AppError(400, 'La estructura JSON es demasiado compleja.');
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (const item of value) inspect(item, depth + 1);
        return;
      }
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key))
          throw new AppError(400, 'La estructura JSON no es válida.');
        inspect(item, depth + 1);
      }
    };
    inspect(parsed, 0);
    return parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'El cuerpo JSON no es válido.');
  }
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie, oai-authenticated-user-id',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function fail(e: unknown) {
  if (e instanceof AppError) {
    const response = reply({ error: e.message }, e.status);
    for (const [name, value] of Object.entries(e.headers ?? {}))
      response.headers.set(name, value);
    return response;
  }
  if (e instanceof Error && e.name === 'ZodError')
    return reply({ error: 'Revisá los campos ingresados.' }, 400);
  console.error(
    'FRAGUAN operation failed',
    e instanceof Error ? e.message : 'unknown',
  );
  return reply(
    {
      error:
        'No se pudo guardar la operación. Actualizá los datos e intentá nuevamente.',
    },
    409,
  );
}
