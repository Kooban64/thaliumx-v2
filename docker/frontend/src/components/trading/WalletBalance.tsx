'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Coins
} from 'lucide-react';

interface WalletBalance {
  asset: string;
  balance: string;
  usdValue: string;
  change24h: number;
}

export function WalletBalance() {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalValue, setTotalValue] = useState('0.00');

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    try {
      const response = await fetch('/api/wallet/balances', {
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        setBalances(data.balances || []);
        setTotalValue(data.totalValue || '0.00');
      }
    } catch (err) {
      setError('Failed to load wallet balances');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalances = () => {
    setIsLoading(true);
    loadBalances();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Wallet Balance</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading balances...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Wallet Balance</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBalances}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Your current asset balances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Total Value */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <p className="text-2xl font-bold">${totalValue}</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Individual Balances */}
        <div className="space-y-3">
          {balances.length > 0 ? (
            balances.map((balance) => (
              <div key={balance.asset} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Coins className="h-4 w-4 text-primary" />
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
                  <div className={`flex items-center text-sm ${
                    balance.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {balance.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(balance.change24h).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No balances found</p>
              <p className="text-sm">Connect a wallet or deposit funds to get started</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">
            Deposit
          </Button>
          <Button variant="outline" size="sm">
            Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
