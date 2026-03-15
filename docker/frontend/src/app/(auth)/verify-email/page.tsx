'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api/client';

function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      router.replace('/login?error=verify');
      return;
    }

    (async () => {
      try {
        const response = await apiClient.post('/api/auth/verify-email', { token });
        if (!response.success) {
          setStatus('error');
          router.replace('/login?error=verify');
          return;
        }
        setStatus('success');
        router.replace('/login');
      } catch {
        setStatus('error');
        router.replace('/login?error=verify');
      }
    })();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Verifying email...</h1>
        {status === 'error' ? (
          <p className="text-sm text-red-600">Verification failed. Redirecting to login.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Please wait while we confirm your email.</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailClient />
    </Suspense>
  );
}
