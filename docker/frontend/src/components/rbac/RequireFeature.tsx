'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRBACStore } from '@/stores/rbacStore';
import { useConfigStore } from '@/stores/configStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RequireFeatureProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

/**
 * RequireFeature - Component wrapper that requires feature flag
 * Hides children if feature is disabled
 */
export function RequireFeature({
  feature,
  children,
  fallback,
  showError = false,
}: RequireFeatureProps) {
  const { checkFeature } = useRBACStore();
  const { features } = useConfigStore();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const access = checkFeature(feature);
    setHasAccess(access);
  }, [feature, features, checkFeature]);

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
            This feature is currently disabled.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
