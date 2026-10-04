import { NextResponse, type NextRequest } from 'next/server';
import { isStoreOnlyDeployment, isStaffPath } from '@/lib/deployment-surface';

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

export function proxy(request: NextRequest) {
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
  const response = NextResponse.next();
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
