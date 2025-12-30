'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackClient() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Backward-compatible path.
        // In prod-v1, `/auth/*` on `thaliumx.com` is reserved for the IdP proxy,
        // so Zitadel redirects should use `/oidc/callback` instead.
        const qs = searchParams.toString();
        window.location.href = `/oidc/callback${qs ? `?${qs}` : ''}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Redirecting…</h1>
        {error ? (
          <div className="text-sm text-red-600">
            <p className="font-medium">Authentication failed</p>
            <p className="mt-1 break-words">{error}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Moving to the correct callback handler.</p>
        )}
      </div>
    </div>
  );
}

