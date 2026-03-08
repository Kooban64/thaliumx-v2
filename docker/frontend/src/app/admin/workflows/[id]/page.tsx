'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { WorkflowDetails } from '@/components/admin/workflows/WorkflowDetails';

/**
 * Workflow Details Page
 */
export default function WorkflowDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params?.id as string;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push(`/login?next=/admin/workflows/${workflowId}`);
          return;
        }

        const res = await apiClient.get<{ user?: { email?: string; role?: string }; data?: { email?: string; role?: string }; email?: string; role?: string }>('/api/auth/profile');
        const userProfile = res.data?.user || res.data?.data || res.data || null;

        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
          router.push('/dashboard');
          return;
        }

        setIsLoading(false);
      } catch {
        router.push(`/login?next=/admin/workflows/${workflowId}`);
      }
    };

    if (workflowId) {
      checkAuthAndRedirect();
    }
  }, [router, workflowId]);

  if (isLoading || !workflowId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <WorkflowDetails workflowId={workflowId} />;
}
