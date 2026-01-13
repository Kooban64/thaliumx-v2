'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/navigation/Tabs';
import { useWallets, useAllBalances } from '@/lib/api/hooks/useWallet';
import { FIATBalance } from './FIATBalance';
import { FIATDeposit } from './FIATDeposit';
import { FIATWithdraw } from './FIATWithdraw';
import { FIATTransactions } from './FIATTransactions';
import { BankAccountManager } from './BankAccountManager';
import { Wallet, ArrowDown, ArrowUp, History, Building2 } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';

/**
 * FIATWalletDashboard - FIAT wallet overview and management
 */
export function FIATWalletDashboard() {
  const { data: wallets, isLoading: walletsLoading } = useWallets();
  const { isLoading: balancesLoading } = useAllBalances();
  const { selectedWallet, setSelectedWallet } = useWalletStore();
  const [activeTab, setActiveTab] = useState('balance');

  // Filter FIAT wallets
  const fiatWallets = wallets?.filter((w) => w.walletType === 'fiat') || [];

  useEffect(() => {
    if (fiatWallets.length > 0 && !selectedWallet) {
      const firstWallet = fiatWallets[0];
      if (firstWallet) {
        setSelectedWallet(firstWallet);
      }
    }
  }, [fiatWallets, selectedWallet, setSelectedWallet]);

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
        <h1 className="text-3xl font-bold">FIAT Wallet</h1>
        <p className="text-muted-foreground">
          Manage your fiat currency deposits and withdrawals
        </p>
      </div>

      {/* Wallet Selection */}
      {fiatWallets.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {fiatWallets.map((wallet) => (
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
            { id: 'deposit', label: 'Deposit', icon: ArrowDown },
            { id: 'withdraw', label: 'Withdraw', icon: ArrowUp },
            { id: 'transactions', label: 'History', icon: History },
            { id: 'banks', label: 'Bank Accounts', icon: Building2 },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />

        {activeTab === 'balance' && <FIATBalance wallet={selectedWallet} />}
        {activeTab === 'deposit' && <FIATDeposit wallet={selectedWallet} />}
        {activeTab === 'withdraw' && <FIATWithdraw wallet={selectedWallet} />}
        {activeTab === 'transactions' && <FIATTransactions wallet={selectedWallet} />}
        {activeTab === 'banks' && <BankAccountManager />}
      </div>
    </div>
  );
}
