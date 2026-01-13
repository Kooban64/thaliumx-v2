'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRBACStore } from '@/stores/rbacStore';
import { useKYCStore } from '@/stores/kycStore';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import { KYCUpgradePrompt } from '@/components/kyc/KYCUpgradePrompt';
import type { KYCLevel } from '@/stores/kycStore';

interface RequireKYCLevelProps {
  level: KYCLevel;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  redirectTo?: string;
}

/**
 * RequireKYCLevel - Component wrapper that requires minimum KYC level
 * Shows upgrade prompt if KYC level is insufficient
 */
export function RequireKYCLevel({
  level,
  children,
  fallback,
  showUpgradePrompt = true,
  redirectTo,
}: RequireKYCLevelProps) {
  const { checkKYCLevel } = useRBACStore();
  const { level: userKYCLevel } = useKYCStore();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const access = checkKYCLevel(level);
    setHasAccess(access);

    if (!access && redirectTo) {
      router.push(redirectTo);
    }
  }, [userKYCLevel, level, checkKYCLevel, redirectTo, router]);

  if (hasAccess === null) {
    return null; // Loading
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                This feature requires KYC level {level} or higher. Your current level is{' '}
                {userKYCLevel || 'not verified'}.
              </p>
              <KYCUpgradePrompt
                onUpgradeClick={() => {
                  if (redirectTo) {
                    router.push(redirectTo);
                  } else {
                    router.push('/dashboard/account/kyc/upgrade');
                  }
                }}
              />
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
