import { Suspense } from 'react';

import AuthClient from './AuthClient';

export default function AuthPage() {
  // Next.js requires `useSearchParams()` consumers to be wrapped in Suspense.
  // We keep the client logic in [`AuthClient`](docker/frontend/src/app/auth/AuthClient.tsx:1).
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
