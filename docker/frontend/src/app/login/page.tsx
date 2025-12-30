import { Suspense } from 'react';

// IMPORTANT:
// In prod-v1, `/auth/*` on `thaliumx.com` is reserved for the IdP proxy (APISIX).
// This page provides a stable frontend login entrypoint that can initiate the
// OIDC redirect (Zitadel PKCE) from the app origin.
import AuthClient from '../auth/AuthClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
          <div className="text-center">
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <AuthClient />
    </Suspense>
  );
}

