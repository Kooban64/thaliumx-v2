'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeposit } from '@/lib/api/hooks/useWallet';
import { ArrowDown, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { Wallet as WalletType } from '@/types/wallet';
import { RequireKYCLevel } from '@/components/rbac';

interface FIATDepositProps {
  wallet: WalletType | null;
}

/**
 * FIATDeposit - Deposit funds to FIAT wallet
 */
export function FIATDeposit({ wallet }: FIATDepositProps) {
  // const { data: balance } = useWalletBalance(wallet?.id || '');
  const depositMutation = useDeposit();
  
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('bank');
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

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount) {
      setError('Please enter amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    try {
      await depositMutation.mutateAsync({
        walletId: wallet.id,
        currency: wallet.currency,
        amount: amountNum,
        method,
      });

      // Reset form on success
      setAmount('');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate deposit');
    }
  };

  return (
    <RequireKYCLevel level="L1" showUpgradePrompt={true}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5" />
              Deposit {wallet.currency}
            </CardTitle>
            <CardDescription>
              Add funds to your FIAT wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeposit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {depositMutation.isSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Deposit request submitted! You will receive payment instructions shortly.
                  </AlertDescription>
                </Alert>
              )}

              {/* Deposit Method */}
              <div className="space-y-2">
                <Label htmlFor="method">Deposit Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({wallet.currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <div className="text-sm text-muted-foreground">
                  Minimum deposit: Check payment method requirements
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!amount || depositMutation.isPending}
              >
                {depositMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Initiate Deposit
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div>
                  <div className="font-medium">Select deposit method</div>
                  <div className="text-sm text-muted-foreground">
                    Choose your preferred payment method
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div>
                  <div className="font-medium">Enter amount</div>
                  <div className="text-sm text-muted-foreground">
                    Specify the amount you want to deposit
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div>
                  <div className="font-medium">Complete payment</div>
                  <div className="text-sm text-muted-foreground">
                    Follow the payment instructions provided
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  4
                </div>
                <div>
                  <div className="font-medium">Wait for confirmation</div>
                  <div className="text-sm text-muted-foreground">
                    Funds will appear in your wallet after processing
                  </div>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Processing times vary by payment method. Bank transfers typically take 1-3 business days.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </RequireKYCLevel>
  );
}
