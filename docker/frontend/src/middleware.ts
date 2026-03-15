import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * Handles route protection and redirects
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/login', '/register', '/landing', '/', '/token-presale'];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith('/api'));

  // Strict auth entry enforcement: funnel legacy routes into /auth.
  if (pathname === '/login' || pathname === '/register') {
    const next = request.nextUrl.searchParams.get('next');
    url.pathname = '/auth';
    url.search = '';
    if (next) {
      url.searchParams.set('next', next);
    }
    return NextResponse.redirect(url);
  }

  // Allow public routes and API routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protected routes will be handled by client-side guards
  // This middleware can be extended to check cookies/tokens if needed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
