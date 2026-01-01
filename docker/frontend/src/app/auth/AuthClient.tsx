'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { submitDeviceFingerprint } from '@/lib/device/fingerprint';
import { initZitadel, loginZitadel } from '@/lib/auth/zitadel';
import { getAccessToken } from '@/lib/auth/token-store';
import { Button } from '@/components/ui/button';

export default function AuthClient() {
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authMode = 'zitadel';

  // Preserve the desired post-login destination for seamless UX.
  const nextParam = searchParams.get('next') || '/dashboard';
  const nextPath = nextParam.startsWith('/') ? nextParam : '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = nextPath;
    }
  }, [isAuthenticated, nextPath]);

  useEffect(() => {
    if (authMode === 'zitadel') {
      (async () => {
        try {
          await initZitadel();
          if (getAccessToken()) {
            setIsAuthenticated(true);
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

    // Check if user is already authenticated by making a request
    // Since tokens are in httpOnly cookies, we need to check with the server
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          credentials: 'include' // Include cookies
        });
        if (response.ok) {
          setIsAuthenticated(true);
        }
      } catch {
        // User is not authenticated
      }
    };
    checkAuth();
  }, [authMode]);

  const handleAuthSuccess = (_token: string) => {
    setIsAuthenticated(true);
    // Fire-and-forget device fingerprint submission
    submitDeviceFingerprint();
    // Redirect to nextPath (defaults to dashboard)
    window.location.href = nextPath;
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Authentication Successful!</h2>
          <p className="text-muted-foreground mb-4">Redirecting to dashboard...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="space-y-4 rounded-lg border bg-background p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Continue with Zitadel (secure OIDC + PKCE).
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                void loginZitadel({ nextPath });
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
