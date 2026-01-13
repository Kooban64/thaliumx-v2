import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * Handles route protection and redirects
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/landing', '/'];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith('/api'));

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
