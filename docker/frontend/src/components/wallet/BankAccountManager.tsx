'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBankAccounts, useAddBankAccount, useRemoveBankAccount } from '@/lib/api/hooks/useBankAccount';
import { Building2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * BankAccountManager - Manage bank accounts for FIAT withdrawals
 */
export function BankAccountManager() {
  const { data: bankAccounts, isLoading } = useBankAccounts();
  const addBankAccountMutation = useAddBankAccount();
  const removeBankAccountMutation = useRemoveBankAccount();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    bankCode: '',
    accountType: 'checking' as 'checking' | 'savings',
    currency: 'ZAR',
  });
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.accountName || !formData.accountNumber || !formData.bankName) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await addBankAccountMutation.mutateAsync(formData);
      setIsAddDialogOpen(false);
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: '',
        bankCode: '',
        accountType: 'checking',
        currency: 'ZAR',
      });
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to add bank account');
    }
  };

  const handleRemove = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) {
      return;
    }

    try {
      await removeBankAccountMutation.mutateAsync(accountId);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to remove bank account');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Bank Accounts
              </CardTitle>
              <CardDescription>
                Manage bank accounts for FIAT withdrawals
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!bankAccounts || bankAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bank accounts added</p>
              <p className="text-sm">Add a bank account to enable withdrawals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.accountName}</span>
                      {account.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      {account.isVerified ? (
                        <Badge className="bg-green-100 text-green-800">Verified</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {account.bankName} • {account.accountType}
                    </div>
                    <div className="text-sm font-mono text-muted-foreground">
                      ****{account.accountNumber.slice(-4)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(account.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bank Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
            <DialogDescription>
              Add a new bank account for FIAT withdrawals
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="accountName">Account Holder Name</Label>
              <Input
                id="accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankCode">Bank Code</Label>
              <Input
                id="bankCode"
                value={formData.bankCode}
                onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value: string) => setFormData({ ...formData, accountType: value as 'checking' | 'savings' })}
              >
                <SelectTrigger id="accountType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addBankAccountMutation.isPending}
              >
                {addBankAccountMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Account'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
