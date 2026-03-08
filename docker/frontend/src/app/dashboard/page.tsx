'use client';


import { useState, useEffect, useCallback } from 'react';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Wallet, 
  DollarSign,
  Activity,
  BarChart3,
  Settings,
} from 'lucide-react';
import { logNetworkError } from '@/lib/services/errorLogger';
import { ThalTokenSection } from '@/components/dashboard/ThalTokenSection';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('portfolio'); // Default to portfolio view
  const [, setUser] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setChartData] = useState<Array<{ time: number; value: number }>>([]);
  const [, setCurrentPrice] = useState<number | null>(null);
  const [, setPriceChange] = useState<number>(0);

  type HistoricalPricePoint = {
    timestamp: number;
    price: number;
  };

  const loadChartData = useCallback(async () => {
    try {
      // Fetch historical data for the chart
      const historicalResponse = await fetch('/api/market/historical/BTC?days=7');
      if (historicalResponse.ok) {
        const historicalData = await historicalResponse.json();
        if (historicalData.success && historicalData.data.prices) {
          const formattedData = (historicalData.data.prices as HistoricalPricePoint[]).map((price) => ({
            time: Math.floor(price.timestamp / 1000),
            value: price.price,
          }));
          setChartData(formattedData);
        }
      }

      // Fetch current price for display
      const priceResponse = await fetch('/api/market/prices/BTC');
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        if (priceData.success && priceData.data) {
          setCurrentPrice(priceData.data.price);
          setPriceChange(priceData.data.changePercent24h);
        }
      }
    } catch (err) {
      logNetworkError(err, { endpoint: '/api/market', component: 'Dashboard' });
      // Fallback to mock data if API fails
      setChartData(Array.from({ length: 100 }, (_, i) => ({
        time: Date.now() / 1000 - (100 - i) * 60,
        value: 45000 + Math.sin(i / 10) * 1000 + (i * 10),
      })));
    }
  }, [setChartData, setCurrentPrice, setPriceChange]);

  useEffect(() => {
    // Check authentication and load user data
    const checkAuthAndLoadUser = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/dashboard';
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
          window.location.href = '/login?next=/dashboard';
          return;
        }

        // In Zitadel mode, `/api/auth/profile` returns the user identity.
        // Use it directly instead of calling a non-existent `/api/user/profile`.
        const json = await response.json();
        const u = json?.data?.user || json?.data || null;
        setUser(u);
        
        // Redirect admins to admin dashboard
        if (u?.role === 'admin' || u?.role === 'super_admin') {
          window.location.href = '/admin';
          return;
        }
        
        setIsLoading(false);
      } catch {
        window.location.href = '/login?next=/dashboard';
      }
    };
    checkAuthAndLoadUser();
    void loadChartData();
  }, [loadChartData]);

  // Logout handled by HeaderUserMenu component

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Sidebar removed - navigation is now in header

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your trading and portfolio overview
        </p>
      </div>

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/trading')}
          className="flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Trading
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/wallet')}
          className="flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          Wallet
        </Button>
        <Button
          variant="outline"
          onClick={() => setActiveTab('portfolio')}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Portfolio
        </Button>
        <Button
          variant="outline"
          onClick={() => setActiveTab('analytics')}
          className="flex items-center gap-2"
        >
          <Activity className="h-4 w-4" />
          Analytics
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/account/kyc')}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Account
        </Button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'portfolio' && (
              <div className="space-y-6">
                {/* THAL Token Section - Prominent in Portfolio */}
                <ThalTokenSection />
                
                {/* Other Holdings */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">$12,345.67</div>
                      <p className="text-xs text-green-600">+12.5% from last month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">BTC Holdings</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">0.1234 BTC</div>
                      <p className="text-xs text-green-600">+8.2% from last month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">ETH Holdings</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">2.456 ETH</div>
                      <p className="text-xs text-red-600">-3.1% from last month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">USDT Balance</CardTitle>
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">5,678.90 USDT</div>
                      <p className="text-xs text-muted-foreground">Stable</p>
                    </CardContent>
                  </Card>
                </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>Track your trading performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Analytics charts will be implemented here
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
