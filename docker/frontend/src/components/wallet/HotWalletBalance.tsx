'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWalletBalance } from '@/lib/api/hooks/useWallet';
import { Wallet, Loader2 } from 'lucide-react';
import type { Wallet as WalletType } from '@/types/wallet';

interface HotWalletBalanceProps {
  wallet: WalletType | null;
}

/**
 * HotWalletBalance - Display hot wallet balance
 */
export function HotWalletBalance({ wallet }: HotWalletBalanceProps) {
  const { data: balance, isLoading } = useWalletBalance(wallet?.id || '');

  if (!wallet) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a wallet
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Total Balance
          </CardTitle>
          <CardDescription>{wallet.currency}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {balance?.balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }) || '0.00'}
          </div>
          {balance?.usdValue && (
            <div className="text-sm text-muted-foreground mt-2">
              ≈ ${balance.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Available</CardTitle>
          <CardDescription>Ready to use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {balance?.available.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }) || '0.00'}
          </div>
        </CardContent>
      </Card>

      {/* Locked Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Locked</CardTitle>
          <CardDescription>In pending transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {balance?.locked.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }) || '0.00'}
          </div>
        </CardContent>
      </Card>

      {/* Wallet Info */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Wallet Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge className={getStatusColor(wallet.status)}>
                {wallet.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Currency</div>
              <div className="font-medium">{wallet.currency}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Network</div>
              <div className="font-medium">{wallet.metadata.network || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">MFA Enabled</div>
              <div className="font-medium">
                {wallet.metadata.mfaEnabled ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
          {wallet.address && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Address</div>
              <div className="font-mono text-sm break-all bg-muted p-2 rounded">
                {wallet.address}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
