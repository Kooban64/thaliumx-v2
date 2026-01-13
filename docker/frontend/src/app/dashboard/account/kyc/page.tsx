'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { KYCUpgradeWizard } from '@/components/kyc/KYCUpgradeWizard';
import { KYCStatusCard } from '@/components/kyc/KYCStatusCard';
import { KYCProgressBar } from '@/components/kyc/KYCProgressBar';
import { KYCWorkflowTracker } from '@/components/kyc/KYCWorkflowTracker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/navigation/Tabs';
import { Shield, TrendingUp, FileText, Clock } from 'lucide-react';

/**
 * KYC Management Page
 */
export default function KYCPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('status');

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/dashboard/account/kyc');
          return;
        }

        const { getZitadelToken } = await import('@/lib/auth/backend-auth');
        const token = getZitadelToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers,
        });

        if (!response.ok) {
          router.push('/login?next=/dashboard/account/kyc');
          return;
        }

        const json = await response.json();
        const user = json?.data?.user || json?.data || null;

        if (user?.role === 'admin' || user?.role === 'super_admin') {
          router.push('/admin');
          return;
        }

        setIsLoading(false);
      } catch {
        router.push('/login?next=/dashboard/account/kyc');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KYC Verification</h1>
        <p className="text-muted-foreground">
          Manage your Know Your Customer verification status
        </p>
      </div>

      <Tabs
        items={[
          { id: 'status', label: 'Status', icon: Shield },
          { id: 'upgrade', label: 'Upgrade', icon: TrendingUp },
          { id: 'documents', label: 'Documents', icon: FileText },
          { id: 'workflow', label: 'Workflow', icon: Clock },
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
      />

      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KYCStatusCard />
          <KYCProgressBar />
        </div>
      )}

      {activeTab === 'upgrade' && <KYCUpgradeWizard />}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Document Management</CardTitle>
            <CardDescription>
              Upload and manage your KYC documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Document management interface will be available here.
              Use the Upgrade tab to upload documents for KYC upgrades.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'workflow' && <KYCWorkflowTracker />}
    </div>
  );
}
