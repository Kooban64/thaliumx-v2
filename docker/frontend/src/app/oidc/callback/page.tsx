'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * OIDC Callback Page - Redirects to login
 * 
 * This page is no longer needed as we use backend API authentication instead of direct OIDC.
 * Users are redirected to the login page.
 */
export default function OidcCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Redirecting...</h1>
        <p className="text-sm text-muted-foreground">Please use the login page to sign in.</p>
      </div>
    </div>
  );
}
