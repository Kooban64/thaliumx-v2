'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const nextPath = searchParams.get('next') || '/dashboard';

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
        });
        if (response.ok) {
          router.push(nextPath);
        }
      } catch {
        // User is not authenticated, show login form
      }
    };
    checkAuth();
  }, [router, nextPath]);

  const handleAuthSuccess = async () => {
    // Wait a moment for token to be stored, then check user role to redirect appropriately
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const json = await response.json();
        const user = json?.data?.user || json?.data || null;
        
        // Redirect admins to admin dashboard, others to requested path
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          router.push('/admin');
        } else {
          router.push(nextPath);
        }
      } else {
        router.push(nextPath);
      }
    } catch {
      router.push(nextPath);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {mode === 'login' ? (
        <LoginForm
          onSuccess={handleAuthSuccess}
          onSwitchToRegister={() => setMode('register')}
        />
      ) : (
        <RegisterForm
          onSuccess={() => {
            setMode('login');
            // Show success message or redirect after registration
          }}
          onSwitchToLogin={() => setMode('login')}
        />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

