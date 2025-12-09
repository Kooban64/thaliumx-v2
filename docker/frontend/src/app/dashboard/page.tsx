'use client';

import { useState, useEffect } from 'react';
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
  Settings, 
  LogOut,
  Menu,
  X,
  BarChart3,
  DollarSign,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('trading');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  useEffect(() => {
    // Check authentication and load user data
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include' // Include cookies
        });
        if (!response.ok) {
          window.location.href = '/auth';
          return;
        }
        // Load user data
        loadUserData();
      } catch (error) {
        window.location.href = '/auth';
      }
    };
    checkAuth();
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
    } catch (error) {
      console.error('Failed to load chart data:', error);
      // Fallback to mock data if API fails
      setChartData(Array.from({ length: 100 }, (_, i) => ({
        time: (Date.now() / 1000 - (100 - i) * 60) as any,
        value: 45000 + Math.sin(i / 10) * 1000 + (i * 10),
      })));
    }
  };

  const loadUserData = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'include' // Include cookies
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // Include cookies
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    window.location.href = '/auth';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const sidebarItems = [
    { id: 'trading', label: 'Trading', icon: BarChart3 },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'portfolio', label: 'Portfolio', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center space-x-2 p-6 border-b">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">T</span>
              </div>
              <span className="text-xl font-bold">ThaliumX</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">
                    {user?.firstName?.[0] || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold capitalize">{activeTab}</h1>
              <p className="text-muted-foreground">
                {activeTab === 'trading' && 'Trade cryptocurrencies with advanced tools'}
                {activeTab === 'wallet' && 'Manage your digital assets'}
                {activeTab === 'portfolio' && 'Track your investment performance'}
                {activeTab === 'analytics' && 'Analyze market trends and patterns'}
                {activeTab === 'settings' && 'Configure your account preferences'}
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
                        <span>BTC/USDT</span>
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

            {activeTab === 'settings' && (
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
                    <Button>Save Changes</Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
