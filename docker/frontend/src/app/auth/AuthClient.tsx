'use client';

/**
 * AuthClient - Redirects to main login page
 * 
 * This component is deprecated. All authentication now goes through backend APIs
 * with clean UI. Users are redirected to the main login page.
 */
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect to main login page with next parameter preserved
    const nextParam = searchParams.get('next') || '/dashboard';
    router.push(`/login?next=${encodeURIComponent(nextParam)}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}
