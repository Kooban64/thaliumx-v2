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
      if (!href) return false;

      // Exact match
      if (exact) {
        return pathname === href;
      }

      // Handle root path
      if (href === '/') {
        return pathname === '/';
      }

      // Check if pathname starts with href
      return pathname?.startsWith(href) ?? false;
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
