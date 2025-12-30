'use client';

import { useEffect } from 'react';
import { initKeycloak } from '@/lib/auth/keycloak';
import { initZitadel } from '@/lib/auth/zitadel';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Default to Keycloak-first auth.
    const mode = process.env.NEXT_PUBLIC_AUTH_MODE || 'keycloak';
    if (mode === 'keycloak') {
      void initKeycloak();
      return;
    }
    if (mode === 'zitadel') {
      void initZitadel();
      return;
    }
  }, []);

  return <>{children}</>;
}
