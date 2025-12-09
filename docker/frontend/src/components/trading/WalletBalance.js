'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletBalance = WalletBalance;
const react_1 = require("react");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
function WalletBalance() {
    const [balances, setBalances] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)('');
    const [totalValue, setTotalValue] = (0, react_1.useState)('0.00');
    (0, react_1.useEffect)(() => {
        loadBalances();
    }, []);
    const loadBalances = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/wallet/balances', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setBalances(data.balances || []);
                setTotalValue(data.totalValue || '0.00');
            }
        }
        catch (err) {
            setError('Failed to load wallet balances');
        }
        finally {
            setIsLoading(false);
        }
    };
    const refreshBalances = () => {
        setIsLoading(true);
        loadBalances();
    };
    if (isLoading) {
        return (<card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center space-x-2">
            <lucide_react_1.Wallet className="h-5 w-5"/>
            <span>Wallet Balance</span>
          </card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent className="p-6">
          <div className="flex items-center justify-center">
            <lucide_react_1.Loader2 className="h-6 w-6 animate-spin"/>
            <span className="ml-2">Loading balances...</span>
          </div>
        </card_1.CardContent>
      </card_1.Card>);
    }
    return (<card_1.Card>
      <card_1.CardHeader>
        <card_1.CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <lucide_react_1.Wallet className="h-5 w-5"/>
            <span>Wallet Balance</span>
          </div>
          <button_1.Button variant="ghost" size="sm" onClick={refreshBalances} disabled={isLoading}>
            <lucide_react_1.RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
          </button_1.Button>
        </card_1.CardTitle>
        <card_1.CardDescription>
          Your current asset balances
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent className="space-y-4">
        {error && (<alert_1.Alert variant="destructive">
            <lucide_react_1.AlertTriangle className="h-4 w-4"/>
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {/* Total Value */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <p className="text-2xl font-bold">${totalValue}</p>
            </div>
            <lucide_react_1.DollarSign className="h-8 w-8 text-primary"/>
          </div>
        </div>

        {/* Individual Balances */}
        <div className="space-y-3">
          {balances.length > 0 ? (balances.map((balance) => (<div key={balance.asset} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <lucide_react_1.Coins className="h-4 w-4 text-primary"/>
                  </div>
                  <div>
                    <p className="font-medium">{balance.asset}</p>
                    <p className="text-sm text-muted-foreground">
                      {balance.balance} {balance.asset}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">${balance.usdValue}</p>
                  <div className={`flex items-center text-sm ${balance.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balance.change24h >= 0 ? (<lucide_react_1.TrendingUp className="h-3 w-3 mr-1"/>) : (<lucide_react_1.TrendingDown className="h-3 w-3 mr-1"/>)}
                    {Math.abs(balance.change24h).toFixed(2)}%
                  </div>
                </div>
              </div>))) : (<div className="text-center py-8 text-muted-foreground">
              <lucide_react_1.Wallet className="h-12 w-12 mx-auto mb-4 opacity-50"/>
              <p>No balances found</p>
              <p className="text-sm">Connect a wallet or deposit funds to get started</p>
            </div>)}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button_1.Button variant="outline" size="sm">
            Deposit
          </button_1.Button>
          <button_1.Button variant="outline" size="sm">
            Withdraw
          </button_1.Button>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
//# sourceMappingURL=WalletBalance.js.map