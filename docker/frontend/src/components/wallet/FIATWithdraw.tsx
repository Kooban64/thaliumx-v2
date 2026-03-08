'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWithdraw, useWalletBalance } from '@/lib/api/hooks/useWallet';
import { ArrowUp, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { Wallet as WalletType } from '@/types/wallet';
import { RequireKYCLevel } from '@/components/rbac';
import { useBankAccounts } from '@/lib/api/hooks/useBankAccount';

interface FIATWithdrawProps {
  wallet: WalletType | null;
}

/**
 * FIATWithdraw - Withdraw funds from FIAT wallet
 */
export function FIATWithdraw({ wallet }: FIATWithdrawProps) {
  const { data: balance } = useWalletBalance(wallet?.id || '');
  const { data: bankAccounts } = useBankAccounts();
  const withdrawMutation = useWithdraw();
  
  const [amount, setAmount] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount) {
      setError('Please enter amount');
      return;
    }

    if (!selectedBankAccount) {
      setError('Please select a bank account');
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
        toAddress: '', // Not used for FIAT
        toAccountId: selectedBankAccount,
      });

      // Reset form on success
      setAmount('');
      setSelectedBankAccount('');
    } catch {
      setError('Failed to initiate withdrawal');
    }
  };

  const setMaxAmount = () => {
    setAmount(maxAmount.toString());
  };

  return (
    <RequireKYCLevel level="L2" showUpgradePrompt={true}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5" />
              Withdraw {wallet.currency}
            </CardTitle>
            <CardDescription>
              Withdraw funds to your bank account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-4">
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
                    Withdrawal request submitted! It will be processed within 1-3 business days.
                  </AlertDescription>
                </Alert>
              )}

              {/* Bank Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="bankAccount">Bank Account</Label>
                <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                  <SelectTrigger id="bankAccount">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts && bankAccounts.length > 0 ? (
                      bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName} - {account.bankName} ({account.accountNumber.slice(-4)})
                          {account.isDefault && ' (Default)'}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No bank accounts. Please add one first.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(!bankAccounts || bankAccounts.length === 0) && (
                  <Button variant="link" size="sm" asChild>
                    <a href="#banks">Add Bank Account</a>
                  </Button>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount ({wallet.currency})</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={setMaxAmount}
                    className="h-auto p-0"
                  >
                    Max: {maxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Button>
                </div>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <div className="text-sm text-muted-foreground">
                  Available: {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {wallet.currency}
                </div>
              </div>

              {/* Estimated Fee */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Fee:</span>
                  <span className="font-medium">Bank transfer fees apply</span>
                </div>
                {amount && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">
                      {(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {wallet.currency}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!amount || !selectedBankAccount || withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Withdraw {wallet.currency}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Withdrawals typically take 1-3 business days to process. You will receive a confirmation email once the withdrawal is initiated.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="text-sm font-medium">Processing Time</div>
              <div className="text-sm text-muted-foreground">
                • Standard withdrawals: 1-3 business days
                <br />
                • Express withdrawals: Same day (fees apply)
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Fees</div>
              <div className="text-sm text-muted-foreground">
                • Bank transfer fees may apply
                <br />
                • Check your bank account for exact fees
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequireKYCLevel>
  );
}
