'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * OIDC Callback Client - Redirects to login
 * 
 * This component is deprecated. All authentication now goes through backend APIs.
 * Users are redirected to the login page.
 */
export default function OidcCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect to login page with next parameter if provided
    const nextParam = searchParams.get('next') || '/dashboard';
    router.push(`/login?next=${encodeURIComponent(nextParam)}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Redirecting...</h1>
        <p className="text-sm text-muted-foreground">Please use the login page to sign in.</p>
      </div>
    </div>
  );
}

