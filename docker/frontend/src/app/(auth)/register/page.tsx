'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthClient from '@/app/auth/AuthClient';

function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next');
    const target = next ? `/auth?next=${encodeURIComponent(next)}` : '/auth';
    router.replace(target);
  }, [router, searchParams]);

  return <AuthClient />;
}

/**
 * Registration Page
 *
 * This page now redirects to the OIDC entrypoint. Registration is handled by the IdP.
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <RegisterRedirect />
    </Suspense>
  );
}
