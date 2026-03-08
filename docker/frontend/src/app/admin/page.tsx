'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { PolicyViolationAlertContainer } from '@/components/opa/PolicyViolationAlertContainer';
import { AdminDashboard } from '@/components/admin/dashboard';
import type { UserProfile } from '@/stores/userStore';

interface AuthProfileResponse {
  user?: UserProfile;
  data?: UserProfile;
}

export default function PlatformAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/admin');
          return;
        }

        const res = await apiClient.get<AuthProfileResponse>('/api/auth/profile');
        const userProfile = res.data?.user || res.data?.data || null;
        
        // Redirect non-admins to user dashboard
        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
          router.push('/dashboard');
          return;
        }
        
        setProfile(userProfile);
      } catch {
        router.push('/login?next=/admin');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-6">
      <AdminDashboard />
      <PolicyViolationAlertContainer />
    </div>
  );
}
