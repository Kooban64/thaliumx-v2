'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { getPostLoginRedirectPath } from '@/lib/utils/domain-detection';

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
        const isAuthenticated = await checkBackendAuth();
        if (isAuthenticated) {
          // User is already logged in, redirect to dashboard
          const nextPath = searchParams.get('next') || undefined;
          const redirectPath = getPostLoginRedirectPath(nextPath);
          router.push(redirectPath);
        }
      } catch (error) {
        // Not authenticated, continue with registration
      }
    };
    checkAuth();
  }, [router, searchParams]);

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
        
        // Redirect admins to admin dashboard
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          router.push('/admin');
          return;
        }
        
        // For regular users, use domain-aware redirect
        const nextPath = searchParams.get('next') || undefined;
        const redirectPath = getPostLoginRedirectPath(nextPath);
        router.push(redirectPath);
      } else {
        const nextPath = searchParams.get('next') || undefined;
        const redirectPath = getPostLoginRedirectPath(nextPath);
        router.push(redirectPath);
      }
    } catch (error) {
      const nextPath = searchParams.get('next') || undefined;
      const redirectPath = getPostLoginRedirectPath(nextPath);
      router.push(redirectPath);
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
