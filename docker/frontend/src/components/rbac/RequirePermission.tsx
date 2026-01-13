'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRBACStore } from '@/stores/rbacStore';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface RequirePermissionProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  showError?: boolean;
  requireAll?: boolean; // If true, all permissions required; if false, any permission is sufficient
}

/**
 * RequirePermission - Component wrapper that requires specific permission(s)
 * Hides children if user doesn't have required permission
 */
export function RequirePermission({
  permission,
  children,
  fallback,
  redirectTo,
  showError = false,
  requireAll = false,
}: RequirePermissionProps) {
  const { checkPermission } = useRBACStore();
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

    const permissions = Array.isArray(permission) ? permission : [permission];
    const access = requireAll
      ? permissions.every((p) => checkPermission(p))
      : permissions.some((p) => checkPermission(p));

    setHasAccess(access);

    if (!access && redirectTo) {
      router.push(redirectTo);
    }
  }, [user, permission, checkPermission, requireAll, redirectTo, router]);

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
            You don't have the required permission to access this content.
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
