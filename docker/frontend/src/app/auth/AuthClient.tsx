'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginKeycloak } from '@/lib/auth/zitadel';

export default function AuthClient() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get('next') || '/dashboard';
  const incomingError = searchParams.get('error');

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginKeycloak({ nextPath });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start authentication');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm text-center space-y-3">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Continue to authenticate via Keycloak.</p>
        {(incomingError || error) && (
          <p className="text-sm text-red-600 break-words">
            {incomingError || error}
          </p>
        )}
        <button
          type="button"
          onClick={handleContinue}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {isLoading ? 'Redirecting…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
