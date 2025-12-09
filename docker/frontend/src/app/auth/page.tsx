'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { submitDeviceFingerprint } from '@/lib/device/fingerprint';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated by making a request
    // Since tokens are in httpOnly cookies, we need to check with the server
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include' // Include cookies
        });
        if (response.ok) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        // User is not authenticated
      }
    };
    checkAuth();
  }, []);

  const handleAuthSuccess = (token: string) => {
    setIsAuthenticated(true);
    // Fire-and-forget device fingerprint submission
    submitDeviceFingerprint();
    // Redirect to dashboard or trading page
    window.location.href = '/dashboard';
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
        {isLogin ? (
          <LoginForm 
            onSuccess={handleAuthSuccess}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm 
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
}
