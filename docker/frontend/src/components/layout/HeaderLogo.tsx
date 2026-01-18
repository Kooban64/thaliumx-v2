'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';

interface HeaderLogoProps {
  className?: string;
  /**
   * If true, always links to landing page (for public headers)
   * If false, checks auth and links to dashboard if authenticated
   */
  publicOnly?: boolean;
}

/**
 * HeaderLogo - Logo and branding component
 * Redirects authenticated users to /dashboard, unauthenticated to /
 * On public pages, always links to /landing
 */
export function HeaderLogo({ className, publicOnly = false }: HeaderLogoProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);

  // Public pages: landing, token-presale, login, register
  const publicPages = ['/landing', '/token-presale', '/login', '/register'];
  const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page));

  useEffect(() => {
    // Only check auth if not on public page and not publicOnly
    if (publicOnly || isPublicPage) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const auth = await checkBackendAuth();
        setIsAuthenticated(auth);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [publicOnly, isPublicPage]);

  // On public pages or if publicOnly, always link to landing
  // Otherwise, link to dashboard if authenticated, landing if not
  const homeHref = (publicOnly || isPublicPage) ? '/landing' : (isAuthenticated ? '/dashboard' : '/landing');

  return (
    <Link href={homeHref} className={cn('flex items-center space-x-2 hover:opacity-80 transition-opacity', className)}>
      <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-lg">T</span>
      </div>
      <span className="text-xl font-bold">ThaliumX</span>
    </Link>
  );
}
