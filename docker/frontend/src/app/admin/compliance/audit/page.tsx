'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { AuditLogs } from '@/components/admin/compliance/AuditLogs';

/**
 * Audit Logs Page
 */
export default function AuditLogsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/admin/compliance/audit');
          return;
        }

        const res = await apiClient.get<any>('/api/auth/profile');
        const userProfile = (res.data as any)?.user || res.data || null;

        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin' && userProfile.role !== 'platform_compliance') {
          router.push('/dashboard');
          return;
        }

        setIsLoading(false);
      } catch {
        router.push('/login?next=/admin/compliance/audit');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <AuditLogs />;
}
