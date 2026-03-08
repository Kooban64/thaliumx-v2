import { getCurrentUser } from './backend-auth';
import { useRBACStore } from '@/stores/rbacStore';
import type { KYCLevel } from '@/stores/kycStore';
import React from 'react';

/**
 * Route Guards
 * Functions to check authentication, roles, and KYC levels
 */

/**
 * Check if user is authenticated
 */
export async function requireAuth(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
}

/**
 * Check if user has required role
 */
export async function requireRole(requiredRoles: string | string[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    // Use RBAC store for role checking
    const { checkRole } = useRBACStore.getState();
    return checkRole(requiredRoles);
  } catch {
    return false;
  }
}

/**
 * Check if user has required permission
 */
export async function requirePermission(permission: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { checkPermission } = useRBACStore.getState();
    return checkPermission(permission);
  } catch {
    return false;
  }
}

/**
 * Check if user has minimum KYC level
 */
export async function requireKYCLevel(minLevel: KYCLevel): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const kycLevel = user.kycLevel || 'L0';
    const levels: KYCLevel[] = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'];
    const userLevelIndex = levels.indexOf(kycLevel as KYCLevel);
    const minLevelIndex = levels.indexOf(minLevel);

    return userLevelIndex >= minLevelIndex;
  } catch {
    return false;
  }
}

/**
 * Get redirect path for unauthorized access
 */
export function getUnauthorizedRedirect(requiredRole?: string): string {
  if (requiredRole) {
    return `/login?next=${encodeURIComponent(window.location.pathname)}&required=${requiredRole}`;
  }
  return `/login?next=${encodeURIComponent(window.location.pathname)}`;
}

/**
 * HOC wrapper for protected routes
 * Note: This is a client-side guard. For server-side protection, use middleware or page-level checks.
 * Use this in client components with 'use client' directive.
 */
export function withAuth<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  options?: {
    requiredRole?: string | string[];
    requiredPermission?: string | string[];
    requiredKYC?: KYCLevel;
    redirectTo?: string;
  }
): React.ComponentType<T> {
  return function ProtectedComponent(props: T) {
    const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

    React.useEffect(() => {
      const checkAuth = async () => {
        const isAuthenticated = await requireAuth();
        
        if (!isAuthenticated) {
          const redirect = options?.redirectTo || getUnauthorizedRedirect();
          if (typeof window !== 'undefined') {
            window.location.href = redirect;
          }
          setIsAuthorized(false);
          return;
        }

        if (options?.requiredRole) {
          const hasRole = await requireRole(options.requiredRole);
          if (!hasRole) {
            const redirect = options?.redirectTo || getUnauthorizedRedirect(options.requiredRole as string);
            if (typeof window !== 'undefined') {
              window.location.href = redirect;
            }
            setIsAuthorized(false);
            return;
          }
        }

        if (options?.requiredPermission) {
          const permissions = Array.isArray(options.requiredPermission) 
            ? options.requiredPermission 
            : [options.requiredPermission];
          const hasPerm = permissions.some((p) => {
            const { checkPermission } = useRBACStore.getState();
            return checkPermission(p);
          });
          if (!hasPerm) {
            const redirect = options?.redirectTo || getUnauthorizedRedirect();
            if (typeof window !== 'undefined') {
              window.location.href = redirect;
            }
            setIsAuthorized(false);
            return;
          }
        }

        if (options?.requiredKYC) {
          const hasKYC = await requireKYCLevel(options.requiredKYC);
          if (!hasKYC) {
            if (typeof window !== 'undefined') {
              window.location.href = '/dashboard/account/kyc?upgrade=true';
            }
            setIsAuthorized(false);
            return;
          }
        }

        setIsAuthorized(true);
      };

      checkAuth();
    }, []);

    if (isAuthorized === null) {
      return null; // Loading state
    }

    if (!isAuthorized) {
      return null; // Will redirect
    }

    return React.createElement(Component, props);
  };
}
