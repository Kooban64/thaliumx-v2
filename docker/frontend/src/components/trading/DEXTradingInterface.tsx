'use client';

import { useEffect, useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TokenSwap } from './TokenSwap';
import { LiquidityPool } from './LiquidityPool';
import { OrderHistory } from './OrderHistory';
import { Web3WalletConnector } from './Web3WalletConnector';
import { Globe, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import apiClient from '@/lib/api/client';

/**
 * DEXTradingInterface - Decentralized Exchange trading interface
 * Features: Token swaps, liquidity pools, Web3 wallet required
 */
export function DEXTradingInterface() {
  const { selectedSymbol, fetchOrderHistory } = useTradingStore();
  const [hasWallet, setHasWallet] = useState(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);

  useEffect(() => {
    fetchOrderHistory();
    checkWalletConnection();
  }, [selectedSymbol, fetchOrderHistory]);

  const checkWalletConnection = async () => {
    setIsCheckingWallet(true);
    try {
      const response = await apiClient.get('/api/web3-wallet/wallets');
      if (response.success && response.data) {
        const wallets = Array.isArray(response.data) ? response.data : [];
        const connectedWallets = wallets.filter((w: any) => 
          w.status === 'connected' || w.status === 'pending'
        );
        setHasWallet(connectedWallets.length > 0);
      } else {
        setHasWallet(false);
      }
    } catch (error) {
      setHasWallet(false);
    } finally {
      setIsCheckingWallet(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* DEX Features Banner */}
      <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-500" />
              <CardTitle>Decentralized Exchange</CardTitle>
            </div>
            <Badge variant="secondary">Web3 Required</Badge>
          </div>
          <CardDescription>
            Trade directly on-chain with token swaps and liquidity pools
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Wallet Connection Alert */}
      {!isCheckingWallet && !hasWallet && (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            Connect a Web3 wallet to start trading on DEX. Your wallet is required for all transactions.
          </AlertDescription>
        </Alert>
      )}

      {/* Main DEX Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Token Swap */}
        <div className="space-y-6">
          <TokenSwap />
          <LiquidityPool />
        </div>

        {/* Right Column: Wallet & History */}
        <div className="space-y-6">
          <Web3WalletConnector onWalletConnected={checkWalletConnection} />
          <OrderHistory />
        </div>
      </div>
    </div>
  );
}
