'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { checkAuth as checkBackendAuth, getKeycloakToken } from '@/lib/auth/backend-auth';
import { getPostLoginRedirectPath } from '@/lib/utils/domain-detection';
import { initializePostLogin } from '@/lib/auth/post-login-init';

/**
 * Registration Page Content
 */
function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        // Only check if we have a token (avoid unnecessary API calls)
        const token = getKeycloakToken();
        if (!token) {
          return; // No token, show registration form
        }

        const isAuthenticated = await checkBackendAuth();
        if (isAuthenticated) {
          // Initialize stores
          const user = await initializePostLogin();
          
          // User is already logged in, redirect based on role
          if (user?.role === 'admin' || user?.role === 'super_admin') {
            router.push('/admin');
          } else if (user?.role?.startsWith('broker_')) {
            router.push('/broker');
          } else {
            const nextPath = searchParams.get('next') || undefined;
            const redirectPath = getPostLoginRedirectPath(nextPath, user?.role);
            router.push(redirectPath);
          }
        }
      } catch {
        // Not authenticated, continue with registration
      }
    };
    checkAuth();
  }, [router, searchParams]);

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
          const nextPath = searchParams.get('next') || undefined;
          const redirectPath = getPostLoginRedirectPath(nextPath, userData?.role);
          router.push(redirectPath);
        } else {
          // Fallback to default
          const nextPath = searchParams.get('next') || undefined;
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
        const nextPath = searchParams.get('next') || undefined;
        const redirectPath = getPostLoginRedirectPath(nextPath, user.role);
        router.push(redirectPath);
      }
    } catch {
      // Fallback to default path
      const nextPath = searchParams.get('next') || undefined;
      router.push(getPostLoginRedirectPath(nextPath));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <RegisterForm
        onSuccess={handleAuthSuccess}
        onSwitchToLogin={() => router.push('/login')}
      />
    </div>
  );
}

/**
 * Registration Page
 * 
 * This page handles user registration. It can be accessed directly via /register
 * or through the login page's mode switcher.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
