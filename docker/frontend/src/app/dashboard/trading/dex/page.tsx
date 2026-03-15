'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { DEXTradingInterface } from '@/components/trading/DEXTradingInterface';
import { useTradingStore } from '@/stores/tradingStore';

/**
 * DEX Trading Page
 */
export default function DEXTradingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { setSelectedExchange } = useTradingStore();

  useEffect(() => {
    setSelectedExchange('dex');
  }, [setSelectedExchange]);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/dashboard/trading/dex');
          return;
        }

        const { getAuthToken } = await import('@/lib/auth/backend-auth');
        const token = getAuthToken();
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
          router.push('/login?next=/dashboard/trading/dex');
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
        router.push('/login?next=/dashboard/trading/dex');
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

  return <DEXTradingInterface />;
}
