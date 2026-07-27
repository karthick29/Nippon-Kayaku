import { NextResponse, type NextRequest } from 'next/server';

/* ════════════════════════════════════════════════════════════════════
   Edge auth gate.

   A cheap presence check only — the cookie's signature is verified in
   `auth()` on the Node runtime, because jose's verify is not something
   we want on every static asset request. Middleware redirects the
   obviously-signed-out; the layout and every API route do the real
   verification.
   ════════════════════════════════════════════════════════════════════ */

const PUBLIC_PATHS = ['/sign-in', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('astra.session');
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  url.search = pathname === '/' ? '' : `?from=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, static assets and the favicon.
     * Keeping assets out of the matcher is what makes this cheap.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)',
  ],
};
