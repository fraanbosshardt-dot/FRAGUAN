import { NextResponse, type NextRequest } from 'next/server';
import { isStoreOnlyDeployment, isStaffPath } from '@/lib/deployment-surface';
import { storeApiOrigin } from '@/lib/store-api';

const headers: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Origin-Agent-Cluster': '?1',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://*.mercadopago.com; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://accounts.google.com ws: wss:; frame-src https://accounts.google.com",
};

export async function proxy(request: NextRequest) {
  if (isStoreOnlyDeployment() && isStaffPath(request.nextUrl.pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
    });
  }
  if (['TRACE', 'CONNECT'].includes(request.method))
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'GET, HEAD, POST, OPTIONS' },
    });
  // Staff SSR and APIs run beside PostgreSQL on Railway. The browser keeps
  // the public domain and host-only session cookies throughout the flow.
  const backend = storeApiOrigin();
  const staffAsset = request.nextUrl.pathname.startsWith(
    '/staff-assets/_next/static/',
  );
  const staff = staffAsset || isStaffPath(request.nextUrl.pathname);
  const forwardedHeaders = new Headers(request.headers);
  for (const name of Array.from(forwardedHeaders.keys())) {
    if (
      name.startsWith('oai-') ||
      name.startsWith('x-forwarded-') ||
      name === 'forwarded' ||
      name === 'cf-connecting-ip' ||
      name === 'x-real-ip'
    )
      forwardedHeaders.delete(name);
  }
  let response: NextResponse;
  if (backend && staff) {
    forwardedHeaders.delete('host');
    forwardedHeaders.delete('content-length');
    try {
      const upstream = await fetch(
        new URL(
          (staffAsset
            ? request.nextUrl.pathname.slice('/staff-assets'.length)
            : request.nextUrl.pathname) + request.nextUrl.search,
          backend,
        ),
        {
          method: request.method,
          headers: forwardedHeaders,
          body: ['GET', 'HEAD'].includes(request.method)
            ? undefined
            : await request.arrayBuffer(),
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(30_000),
        },
      );
      const outgoing = new Headers(upstream.headers);
      outgoing.delete('content-encoding');
      outgoing.delete('content-length');
      outgoing.delete('set-cookie');
      for (const cookie of upstream.headers.getSetCookie())
        outgoing.append('Set-Cookie', cookie);
      const type = upstream.headers.get('content-type') ?? '';
      const rewriteAssets =
        /text\/html|text\/x-component/.test(type) ||
        (staffAsset && /javascript|text\/css/.test(type));
      // Railway's Node build and Vercel's build can emit different chunk hashes.
      // Keep the staff document, RSC payload and asset graph on the same build.
      const body =
        request.method === 'HEAD' || [204, 205, 304].includes(upstream.status)
          ? null
          : rewriteAssets
            ? (await upstream.text()).replaceAll(
                '/_next/static/',
                '/staff-assets/_next/static/',
              )
            : upstream.body;
      response = new NextResponse(body, {
        status: upstream.status,
        headers: outgoing,
      });
    } catch {
      response = new NextResponse(
        'El sistema interno no está disponible. Intentá nuevamente en unos minutos.',
        { status: 503 },
      );
    }
  } else response = NextResponse.next();
  for (const [key, value] of Object.entries(headers))
    response.headers.set(key, value);
  if (request.nextUrl.protocol === 'https:')
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/acceso') ||
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/cuenta') ||
    request.nextUrl.pathname.startsWith('/checkout') ||
    request.nextUrl.pathname.startsWith('/pedido/')
  )
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
