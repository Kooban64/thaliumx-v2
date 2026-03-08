'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { initializeEntryDomain, getPostLoginRedirectPath } from '@/lib/utils/domain-detection';
import { initializePostLogin } from '@/lib/auth/post-login-init';
import { getKeycloakToken } from '@/lib/auth/backend-auth';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const requestedNextPath = searchParams.get('next');
  
  // Initialize entry domain detection on page load
  useEffect(() => {
    initializeEntryDomain();
  }, []);
  
  // Determine next path: use requested path, or default based on entry domain
  const nextPath = requestedNextPath || getPostLoginRedirectPath('/dashboard');

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Only check if we have a token (avoid unnecessary API calls)
        const token = getKeycloakToken();
        if (!token) {
          return; // No token, show login form
        }

        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const json = await response.json();
          const user = json?.data?.user || json?.data || null;
          
          // Initialize stores
          await initializePostLogin();
          
          // Redirect based on role
          if (user?.role === 'admin' || user?.role === 'super_admin') {
            router.push('/admin');
          } else if (user?.role?.startsWith('broker_')) {
            router.push('/broker');
          } else {
            router.push(getPostLoginRedirectPath(nextPath, user?.role));
          }
        }
      } catch {
        // User is not authenticated, show login form
      }
    };
    checkAuth();
  }, [router, nextPath]);

  const handleAuthSuccess = async () => {
    // Wait a moment for token to be stored
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      // Initialize all stores and get user profile
      const user = await initializePostLogin();
      
      if (!user) {
        // Fallback: try to get user from API directly
        const token = getKeycloakToken();
        if (!token) {
          router.push('/dashboard');
          return;
        }

        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const json = await response.json();
          const userData = json?.data?.user || json?.data || null;
          
          // Redirect based on role (role takes priority over domain)
          if (userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'platform-admin') {
            router.push('/admin');
            return;
          }
          
          if (userData?.role?.startsWith('broker_') || userData?.role === 'broker_admin') {
            router.push('/broker');
            return;
          }
          
          // For regular users, use domain-aware redirect
          const redirectPath = getPostLoginRedirectPath(nextPath, userData?.role);
          router.push(redirectPath);
        } else {
          // Fallback to default
          router.push(getPostLoginRedirectPath(nextPath));
        }
      } else {
        // User profile loaded, redirect based on role
        if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'platform-admin') {
          router.push('/admin');
          return;
        }
        
        if (user.role?.startsWith('broker_') || user.role === 'broker_admin') {
          router.push('/broker');
          return;
        }
        
        // For regular users, use domain-aware redirect
        const redirectPath = getPostLoginRedirectPath(nextPath, user.role);
        router.push(redirectPath);
      }
    } catch {
      // Fallback to default path
      router.push(getPostLoginRedirectPath(nextPath));
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

