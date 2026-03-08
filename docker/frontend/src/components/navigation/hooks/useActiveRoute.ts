'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

/**
 * useActiveRoute - Hook to check if a route is active
 * Handles nested routes and exact matching
 */
export function useActiveRoute() {
  const pathname = usePathname();

  const isActive = useMemo(
    () => (href?: string, exact = false): boolean => {
      if (!href || !pathname) return false;

      // Normalize paths - remove trailing slashes for comparison
      const normalizedHref = href.replace(/\/$/, '') || '/';
      const normalizedPathname = pathname.replace(/\/$/, '') || '/';

      // Exact match
      if (exact) {
        return normalizedPathname === normalizedHref;
      }

      // Handle root path - only match exactly
      if (normalizedHref === '/') {
        return normalizedPathname === '/';
      }

      // Check if pathname starts with href
      // But ensure we don't match partial segments (e.g., /dashboard shouldn't match /dashboard-trading)
      if (normalizedPathname.startsWith(normalizedHref)) {
        // If the next character after the href is a slash or end of string, it's a valid match
        const nextChar = normalizedPathname[normalizedHref.length];
        return !nextChar || nextChar === '/';
      }

      return false;
    },
    [pathname]
  );

  const isExactActive = useMemo(
    () => (href?: string): boolean => {
      return isActive(href, true);
    },
    [isActive]
  );

  return {
    pathname,
    isActive,
    isExactActive,
  };
}
