'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/navigation/Tabs';
import { useWallets, useAllBalances } from '@/lib/api/hooks/useWallet';
import { HotWalletBalance } from './HotWalletBalance';
import { HotWalletReceive } from './HotWalletReceive';
import { HotWalletSend } from './HotWalletSend';
import { HotWalletTransactions } from './HotWalletTransactions';
import { Wallet, Send, ArrowDown, History } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';

/**
 * HotWalletDashboard - Hot wallet overview and management
 */
export function HotWalletDashboard() {
  const { data: wallets, isLoading: walletsLoading } = useWallets();
  const { isLoading: balancesLoading } = useAllBalances();
  const { selectedWallet, setSelectedWallet } = useWalletStore();
  const [activeTab, setActiveTab] = useState('balance');

  // Filter hot wallets
  const hotWallets = useMemo(
    () => wallets?.filter((w) => w.walletType === 'crypto_hot') || [],
    [wallets],
  );

  useEffect(() => {
    if (hotWallets.length > 0 && !selectedWallet) {
      const firstWallet = hotWallets[0];
      if (firstWallet) {
        setSelectedWallet(firstWallet);
      }
    }
  }, [hotWallets, selectedWallet, setSelectedWallet]);

  if (walletsLoading || balancesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Hot Wallet</h1>
        <p className="text-muted-foreground">
          Platform-managed crypto wallet with MFA recovery
        </p>
      </div>

      {/* Wallet Selection */}
      {hotWallets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {hotWallets.map((wallet) => (
                <Button
                  key={wallet.id}
                  variant={selectedWallet?.id === wallet.id ? 'default' : 'outline'}
                  onClick={() => setSelectedWallet(wallet)}
                >
                  {wallet.currency}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <div className="space-y-6">
        <Tabs
          items={[
            { id: 'balance', label: 'Balance', icon: Wallet },
            { id: 'receive', label: 'Receive', icon: ArrowDown },
            { id: 'send', label: 'Send', icon: Send },
            { id: 'transactions', label: 'History', icon: History },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />
        
        {activeTab === 'balance' && <HotWalletBalance wallet={selectedWallet} />}
        {activeTab === 'receive' && <HotWalletReceive wallet={selectedWallet} />}
        {activeTab === 'send' && <HotWalletSend wallet={selectedWallet} />}
        {activeTab === 'transactions' && <HotWalletTransactions wallet={selectedWallet} />}
      </div>
    </div>
  );
}
