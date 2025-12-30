import { Suspense } from 'react';
import AuthCallbackClient from './AuthCallbackClient';

export default function AuthCallbackPage() {
  // Next.js requires `useSearchParams()` consumers to be wrapped in Suspense.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
            <h1 className="text-xl font-semibold mb-2">Redirecting…</h1>
            <p className="text-sm text-muted-foreground">Loading callback handler.</p>
          </div>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
