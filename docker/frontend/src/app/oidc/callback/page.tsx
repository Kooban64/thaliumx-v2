'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleOidcCallback } from '@/lib/auth/oidc';
import { initializePostLogin } from '@/lib/auth/post-login-init';
import { setAuthToken } from '@/lib/auth/backend-auth';
import {
  getEntryBrokerSlug,
  getEntryChannel,
  getPostLoginRedirectPath,
  getSafePostLoginPath,
} from '@/lib/utils/domain-detection';

export default function OidcCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { nextPath, accessToken, expiresIn } = await handleOidcCallback(window.location.search);

        // Keep backend-auth in-memory token synchronized with OIDC token-store.
        setAuthToken(accessToken, expiresIn || 3600);

        const user = await initializePostLogin();
        const requestedPath = getSafePostLoginPath(nextPath);

        const entryChannel = getEntryChannel();
        const entryBrokerSlug = getEntryBrokerSlug();

        // Strict runtime guard for broker-channel callback safety.
        if (entryChannel === 'broker' && entryBrokerSlug) {
          const expectedPrefix = `/b/${entryBrokerSlug}`;
          const role = user?.role;
          const isBrokerRole = typeof role === 'string' && role.startsWith('broker_');
          const fallback = isBrokerRole ? expectedPrefix : '/auth';
          const target = requestedPath.startsWith(expectedPrefix) ? requestedPath : fallback;
          router.replace(target);
          return;
        }

        const roleBasedRedirect = getPostLoginRedirectPath(requestedPath, user?.role);
        router.replace(getSafePostLoginPath(roleBasedRedirect));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'OIDC callback failed');
        // Use hard navigation for deterministic fail-closed behavior under E2E/dev runtime.
        window.location.assign('/auth?error=oidc_callback_failed');
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Completing sign-in...</h1>
        {error ? (
          <p className="text-sm text-red-600 break-words">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Validating callback and initializing your session.</p>
        )}
      </div>
    </div>
  );
}
