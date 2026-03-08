'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRBACStore } from '@/stores/rbacStore';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface RequireRoleProps {
  roles: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  showError?: boolean;
}

/**
 * RequireRole - Component wrapper that requires specific role(s)
 * Hides children if user doesn't have required role
 */
export function RequireRole({
  roles,
  children,
  fallback,
  redirectTo,
  showError = false,
}: RequireRoleProps) {
  const { checkRole } = useRBACStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
      return;
    }

    const access = checkRole(roles);
    setHasAccess(access);

    if (!access && redirectTo) {
      router.push(redirectTo);
    }
  }, [user, roles, checkRole, redirectTo, router]);

  if (hasAccess === null) {
    return null; // Loading
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have the required role to access this content.
            {redirectTo && (
              <Button
                variant="link"
                onClick={() => router.push(redirectTo)}
                className="ml-2 p-0 h-auto"
              >
                Go back
              </Button>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
