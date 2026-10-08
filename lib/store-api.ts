import { AppError } from './auth';
export function storeApiOrigin() {
  const configured = process.env.FRAGUAN_API_ORIGIN?.trim();
  if (!configured) return null;
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('La API de la tienda debe usar un origen HTTPS.');
  return url.origin;
}

export async function publicStoreData<T>(
  resource: string,
  params: Record<string, string> = {},
): Promise<T> {
  const origin = storeApiOrigin();
  if (!origin || !resource.startsWith('store-'))
    throw new Error('La API pública de la tienda no está configurada.');
  const url = new URL(`/api/${resource}`, origin);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AppError(response.status, 'No se pudo cargar la información de la tienda.');
  return response.json() as Promise<T>;
}

export async function forwardStoreApi(req: Request): Promise<Response | null> {
  const origin = storeApiOrigin();
  if (!origin) return null;
  const incoming = new URL(req.url);
  if (!/^\/api\/(store-[a-z-]+|webhooks\/[^/]+)\/?$/.test(incoming.pathname))
    return null;
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');
  // Ignore browser-supplied proxy identity headers. The backend uses customer
  // cookies and validates the public site's Origin for writes.
  // Snapshot the names: deleting from Headers changes its live iterator.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const name of [...headers.keys()]) {
    if (name.startsWith('oai-') || name.startsWith('x-forwarded-') || name === 'forwarded')
      headers.delete(name);
  }
  return fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
}
