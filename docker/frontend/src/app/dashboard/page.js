'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Dashboard;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const LightweightChart_1 = require("@/components/LightweightChart");
const Web3WalletConnector_1 = require("@/components/trading/Web3WalletConnector");
const TradingPanel_1 = require("@/components/trading/TradingPanel");
const WalletBalance_1 = require("@/components/trading/WalletBalance");
const lucide_react_1 = require("lucide-react");
function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = (0, react_1.useState)(false);
    const [activeTab, setActiveTab] = (0, react_1.useState)('trading');
    const [user, setUser] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        // Check authentication and load user data
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/auth';
            return;
        }
        // Load user data
        loadUserData();
    }, []);
    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            }
        }
        catch (error) {
            console.error('Failed to load user data:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        window.location.href = '/auth';
    };
    if (isLoading) {
        return (<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>);
    }
    const sidebarItems = [
        { id: 'trading', label: 'Trading', icon: lucide_react_1.BarChart3 },
        { id: 'wallet', label: 'Wallet', icon: lucide_react_1.Wallet },
        { id: 'portfolio', label: 'Portfolio', icon: lucide_react_1.DollarSign },
        { id: 'analytics', label: 'Analytics', icon: lucide_react_1.Activity },
        { id: 'settings', label: 'Settings', icon: lucide_react_1.Settings },
    ];
    return (<div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <button_1.Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <lucide_react_1.X className="h-5 w-5"/> : <lucide_react_1.Menu className="h-5 w-5"/>}
          </button_1.Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
            return (<button_1.Button key={item.id} variant={activeTab === item.id ? 'default' : 'ghost'} className="w-full justify-start" onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                }}>
                    <Icon className="mr-2 h-4 w-4"/>
                    {item.label}
                  </button_1.Button>);
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
              <button_1.Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                <lucide_react_1.LogOut className="mr-2 h-4 w-4"/>
                Sign Out
              </button_1.Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          {/* Mobile Overlay */}
          {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

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
            {activeTab === 'trading' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2">
                  <card_1.Card>
                    <card_1.CardHeader>
                      <card_1.CardTitle className="flex items-center justify-between">
                        <span>BTC/USDT</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600 text-sm">+2.34%</span>
                          <lucide_react_1.TrendingUp className="h-4 w-4 text-green-600"/>
                        </div>
                      </card_1.CardTitle>
                      <card_1.CardDescription>
                        Real-time price chart with TradingView Lightweight Charts
                      </card_1.CardDescription>
                    </card_1.CardHeader>
                    <card_1.CardContent>
                      <LightweightChart_1.LightweightChart data={Array.from({ length: 100 }, (_, i) => ({
                time: (Date.now() / 1000 - (100 - i) * 60),
                value: 45000 + Math.sin(i / 10) * 1000 + (i * 10),
            }))}/>
                    </card_1.CardContent>
                  </card_1.Card>
                </div>

                {/* Trading Panel */}
                <div className="space-y-6">
                  <TradingPanel_1.TradingPanel />
                  <Web3WalletConnector_1.Web3WalletConnector />
                </div>
              </div>)}

            {activeTab === 'wallet' && (<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WalletBalance_1.WalletBalance />
                <card_1.Card>
                  <card_1.CardHeader>
                    <card_1.CardTitle>Recent Transactions</card_1.CardTitle>
                    <card_1.CardDescription>Your latest wallet activity</card_1.CardDescription>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <lucide_react_1.TrendingUp className="h-4 w-4 text-green-600"/>
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
                            <lucide_react_1.TrendingDown className="h-4 w-4 text-red-600"/>
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
                  </card_1.CardContent>
                </card_1.Card>
              </div>)}

            {activeTab === 'portfolio' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <card_1.Card>
                  <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <card_1.CardTitle className="text-sm font-medium">Total Value</card_1.CardTitle>
                    <lucide_react_1.DollarSign className="h-4 w-4 text-muted-foreground"/>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="text-2xl font-bold">$12,345.67</div>
                    <p className="text-xs text-green-600">+12.5% from last month</p>
                  </card_1.CardContent>
                </card_1.Card>
                <card_1.Card>
                  <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <card_1.CardTitle className="text-sm font-medium">BTC Holdings</card_1.CardTitle>
                    <lucide_react_1.TrendingUp className="h-4 w-4 text-muted-foreground"/>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="text-2xl font-bold">0.1234 BTC</div>
                    <p className="text-xs text-green-600">+8.2% from last month</p>
                  </card_1.CardContent>
                </card_1.Card>
                <card_1.Card>
                  <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <card_1.CardTitle className="text-sm font-medium">ETH Holdings</card_1.CardTitle>
                    <lucide_react_1.Activity className="h-4 w-4 text-muted-foreground"/>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="text-2xl font-bold">2.456 ETH</div>
                    <p className="text-xs text-red-600">-3.1% from last month</p>
                  </card_1.CardContent>
                </card_1.Card>
                <card_1.Card>
                  <card_1.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <card_1.CardTitle className="text-sm font-medium">USDT Balance</card_1.CardTitle>
                    <lucide_react_1.Wallet className="h-4 w-4 text-muted-foreground"/>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="text-2xl font-bold">5,678.90 USDT</div>
                    <p className="text-xs text-muted-foreground">Stable</p>
                  </card_1.CardContent>
                </card_1.Card>
              </div>)}

            {activeTab === 'analytics' && (<div className="space-y-6">
                <card_1.Card>
                  <card_1.CardHeader>
                    <card_1.CardTitle>Performance Analytics</card_1.CardTitle>
                    <card_1.CardDescription>Track your trading performance over time</card_1.CardDescription>
                  </card_1.CardHeader>
                  <card_1.CardContent>
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Analytics charts will be implemented here
                    </div>
                  </card_1.CardContent>
                </card_1.Card>
              </div>)}

            {activeTab === 'settings' && (<div className="space-y-6">
                <card_1.Card>
                  <card_1.CardHeader>
                    <card_1.CardTitle>Account Settings</card_1.CardTitle>
                    <card_1.CardDescription>Manage your account preferences</card_1.CardDescription>
                  </card_1.CardHeader>
                  <card_1.CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label_1.Label htmlFor="firstName">First Name</label_1.Label>
                      <input_1.Input id="firstName" defaultValue={user?.firstName || ''}/>
                    </div>
                    <div className="space-y-2">
                      <label_1.Label htmlFor="lastName">Last Name</label_1.Label>
                      <input_1.Input id="lastName" defaultValue={user?.lastName || ''}/>
                    </div>
                    <div className="space-y-2">
                      <label_1.Label htmlFor="email">Email</label_1.Label>
                      <input_1.Input id="email" type="email" defaultValue={user?.email || ''}/>
                    </div>
                    <button_1.Button>Save Changes</button_1.Button>
                  </card_1.CardContent>
                </card_1.Card>
              </div>)}
          </div>
        </main>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map