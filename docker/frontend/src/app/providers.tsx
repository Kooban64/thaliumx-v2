'use client';

import { useEffect } from 'react';
import { initZitadel } from '@/lib/auth/zitadel';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initZitadel();
  }, []);

  return <>{children}</>;
}
