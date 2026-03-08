'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { HotWalletDashboard, FIATWalletDashboard } from '@/components/wallet';
import { Tabs } from '@/components/navigation/Tabs';
import { Wallet, Building2 } from 'lucide-react';

/**
 * Wallet Dashboard - Main wallet page with tab navigation
 */
export default function WalletPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('hot');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/dashboard/wallet');
          return;
        }

        const { getKeycloakToken } = await import('@/lib/auth/backend-auth');
        const token = getKeycloakToken();
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
          router.push('/login?next=/dashboard/wallet');
          return;
        }

        const json = await response.json();
        const user = json?.data?.user || json?.data || null;

        // Redirect admins to admin dashboard
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          router.push('/admin');
          return;
        }

        setIsLoading(false);
      } catch {
        router.push('/login?next=/dashboard/wallet');
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
        <h1 className="text-3xl font-bold">Wallets</h1>
        <p className="text-muted-foreground">
          Manage your Hot Wallet, Web3 Wallets, and FIAT Wallet
        </p>
      </div>

      <Tabs
        items={[
          { id: 'hot', label: 'Hot Wallet', icon: Wallet },
          { id: 'fiat', label: 'FIAT Wallet', icon: Building2 },
        ]}
        value={activeTab}
        onValueChange={setActiveTab}
      />

      {activeTab === 'hot' && <HotWalletDashboard />}
      {activeTab === 'fiat' && <FIATWalletDashboard />}
    </div>
  );
}
