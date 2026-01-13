'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWithdraw, useWalletBalance } from '@/lib/api/hooks/useWallet';
import { Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { AddressValidator } from './AddressValidator';
import type { Wallet as WalletType } from '@/types/wallet';
import { RequireKYCLevel } from '@/components/rbac';

interface HotWalletSendProps {
  wallet: WalletType | null;
}

/**
 * HotWalletSend - Send funds from hot wallet
 */
export function HotWalletSend({ wallet }: HotWalletSendProps) {
  const { data: balance } = useWalletBalance(wallet?.id || '');
  const withdrawMutation = useWithdraw();
  
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [error, setError] = useState('');

  if (!wallet) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a wallet
        </CardContent>
      </Card>
    );
  }

  const availableBalance = balance?.available || 0;
  const maxAmount = availableBalance;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!toAddress || !amount) {
      setError('Please enter address and amount');
      return;
    }

    if (!isValidAddress) {
      setError('Invalid address format');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > maxAmount) {
      setError('Insufficient balance');
      return;
    }

    try {
      await withdrawMutation.mutateAsync({
        walletId: wallet.id,
        currency: wallet.currency,
        amount: amountNum,
        toAddress,
        network: wallet.metadata.network,
      });

      // Reset form on success
      setToAddress('');
      setAmount('');
      setIsValidAddress(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send funds');
    }
  };

  const setMaxAmount = () => {
    setAmount(maxAmount.toString());
  };

  return (
    <RequireKYCLevel level="L1" showUpgradePrompt={true}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send {wallet.currency}
          </CardTitle>
          <CardDescription>
            Send funds to another wallet address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {withdrawMutation.isSuccess && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Transaction submitted successfully! It will be processed shortly.
                </AlertDescription>
              </Alert>
            )}

            {/* To Address */}
            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient Address</Label>
              <Input
                id="toAddress"
                value={toAddress}
                onChange={(e) => {
                  setToAddress(e.target.value);
                  setIsValidAddress(false);
                }}
                placeholder="Enter recipient wallet address"
                className="font-mono text-sm"
              />
              <AddressValidator
                address={toAddress}
                network={wallet.metadata.network}
                onValidationChange={setIsValidAddress}
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={setMaxAmount}
                  className="h-auto p-0"
                >
                  Max: {maxAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </Button>
              </div>
              <Input
                id="amount"
                type="number"
                step="0.00000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="text-sm text-muted-foreground">
                Available: {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })} {wallet.currency}
              </div>
            </div>

            {/* Estimated Fee */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Fee:</span>
                <span className="font-medium">Network fee will be calculated</span>
              </div>
              {amount && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">
                    {(parseFloat(amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} {wallet.currency}
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!toAddress || !amount || !isValidAddress || withdrawMutation.isPending}
            >
              {withdrawMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send {wallet.currency}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </RequireKYCLevel>
  );
}
