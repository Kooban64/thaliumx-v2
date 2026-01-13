'use client';

import { TransactionLimitsDisplay } from '@/components/opa/TransactionLimitsDisplay';
import { KYCAccessInfo } from '@/components/opa/KYCAccessInfo';

import { useState, useEffect } from 'react';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LightweightChart } from '@/components/LightweightChart';
import { Web3WalletConnector } from '@/components/trading/Web3WalletConnector';
import { TradingPanel } from '@/components/trading/TradingPanel';
import { WalletBalance } from '@/components/trading/WalletBalance';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign,
  Activity,
} from 'lucide-react';
import { logNetworkError } from '@/lib/services/errorLogger';

export default function Dashboard() {
  const [activeTab] = useState('trading'); // Tab state for content switching
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  useEffect(() => {

    // Check authentication and load user data
    const checkAuthAndLoadUser = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/dashboard';
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
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      // Fetch historical data for the chart
      const historicalResponse = await fetch('/api/market/historical/BTC?days=7');
      if (historicalResponse.ok) {
        const historicalData = await historicalResponse.json();
        if (historicalData.success && historicalData.data.prices) {
          const formattedData = historicalData.data.prices.map((price: any) => ({
            time: Math.floor(price.timestamp / 1000) as any,
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
    } catch {
      logNetworkError(error, { endpoint: '/api/market', component: 'Dashboard' });
      // Fallback to mock data if API fails
      setChartData(Array.from({ length: 100 }, (_, i) => ({
        time: (Date.now() / 1000 - (100 - i) * 60) as any,
        value: 45000 + Math.sin(i / 10) * 1000 + (i * 10),
      })));
    }
  };

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
    <div className="min-h-screen bg-background">
      <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold capitalize">{activeTab}</h1>
              <p className="text-muted-foreground">
                {activeTab === 'trading' && 'Trade cryptocurrencies with advanced tools'}
                {activeTab === 'wallet' && 'Manage your digital assets'}
                {activeTab === 'portfolio' && 'Track your investment performance'}
                {activeTab === 'analytics' && 'Analyze market trends and patterns'}
                {activeTab === 'account' && 'Manage your account settings and KYC status'}
              </p>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'trading' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>
                          BTC/USDT
                          {currentPrice !== null && currentPrice !== undefined && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2) || '0.00'}%
                          </span>
                          {priceChange >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </CardTitle>
                      <CardDescription>
                        Real-time price chart with TradingView Lightweight Charts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LightweightChart
                        data={chartData.length > 0 ? chartData : Array.from({ length: 100 }, (_, i) => ({
                          time: (Date.now() / 1000 - (100 - i) * 60) as any,
                          value: 45000 + Math.sin(i / 10) * 1000 + (i * 10),
                        }))}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Trading Panel */}
                <div className="space-y-6">
                  <TradingPanel />
                  <Web3WalletConnector />
                </div>
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WalletBalance />
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Your latest wallet activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">BTC Purchase</p>
                            <p className="text-sm text-muted-foreground">2 hours ago</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">+0.001 BTC</p>
                          <p className="text-sm text-muted-foreground">$45.23</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">ETH Sale</p>
                            <p className="text-sm text-muted-foreground">1 day ago</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-red-600">-0.5 ETH</p>
                          <p className="text-sm text-muted-foreground">$1,234.56</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'portfolio' && (
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

            {activeTab === 'account' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" defaultValue={user?.firstName || ''} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" defaultValue={user?.lastName || ''} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue={user?.email || ''} />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const issuer = (process.env.NEXT_PUBLIC_ZITADEL_ISSUER || 'https://auth.thaliumx.com').replace(/\/+$/, '');
                        window.open(issuer, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Manage in Account Console
                    </Button>
                  </CardContent>
                </Card>

                {/* KYC Access Info and Transaction Limits - Only show on Account tab */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <KYCAccessInfo showUpgradePrompt={true} />
                  <TransactionLimitsDisplay showUpgradePrompt={true} />
                </div>
              </div>
            )}
          </div>
    </div>
  );
}
