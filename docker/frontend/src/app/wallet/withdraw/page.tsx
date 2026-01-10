'use client';

import { useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkflowStatusCard } from '@/components/workflows/WorkflowStatusCard';
import { useUserWorkflows } from '@/lib/api/hooks/workflows';
import { WorkflowType } from '@/lib/api/types/workflows';

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType?: string;
  currency: string;
  status?: string;
  isDefault?: boolean;
};

export default function WithdrawPage() {
  const [currency, setCurrency] = useState('ZAR');
  const [amount, setAmount] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [recentWithdrawalWorkflowId, setRecentWithdrawalWorkflowId] = useState<string | null>(null);
  
  // Fetch recent withdrawal workflows
  const { data: workflowsData } = useUserWorkflows(userId, {
    workflowType: WorkflowType.FIAT_OPERATIONS,
    limit: 1
  });

  const filteredAccounts = useMemo(() => {
    const ccy = currency.toUpperCase();
    return bankAccounts.filter((a) => (a.currency || '').toUpperCase() === ccy);
  }, [bankAccounts, currency]);

  useEffect(() => {
    (async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = `/login?next=/wallet/withdraw`;
          return;
        }

        // Get user ID
        const profileRes = await apiClient.get<{ id: string }>('/api/auth/profile');
        if (profileRes.success && profileRes.data?.id) {
          setUserId(profileRes.data.id);
        }

        await loadBankAccounts();
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize auth');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadBankAccounts = async () => {
    setError('');
    const res = await apiClient.get<BankAccount[]>(`/api/fiat/bank-accounts`);
    if (!res.success) {
      setError(res.error || res.message || 'Failed to load bank accounts');
      return;
    }

    const accounts = res.data || [];
    setBankAccounts(accounts);

    const forCurrency = accounts.filter((a) => (a.currency || '').toUpperCase() === currency.toUpperCase());
    const defaultAcc = forCurrency.find((a) => a.isDefault) || forCurrency[0];
    setBankAccountId(defaultAcc?.id || '');
  };

  useEffect(() => {
    // If currency changes, adjust selection.
    const defaultAcc = filteredAccounts.find((a) => a.isDefault) || filteredAccounts[0];
    setBankAccountId(defaultAcc?.id || '');
  }, [currency, filteredAccounts]);

  const submit = async () => {
    setError('');
    setSuccess('');

    const parsed = parseFloat(amount);
    if (!currency) {
      setError('Currency is required');
      return;
    }
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!bankAccountId) {
      setError('Select a bank account');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post<any>(`/api/fiat/withdrawals`, {
        currency: currency.toUpperCase(),
        amount: parsed,
        bankAccountId,
      });

      if (!res.success) {
        setError(res.error || res.message || 'Withdrawal failed');
        return;
      }

      // Check if response includes workflow ID
      if (res.data?.workflowId) {
        setRecentWithdrawalWorkflowId(res.data.workflowId);
      }

      setSuccess(`Withdrawal initiated (transaction: ${res.data?.id || 'created'})`);
      setAmount('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Withdraw</h1>
        <Button variant="outline" asChild>
          <a href="/dashboard">Back</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdraw to bank account</CardTitle>
          <CardDescription>Creates a FIAT withdrawal transaction and routes it to the configured banking integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Show workflow status if withdrawal is processing */}
              {recentWithdrawalWorkflowId && workflowsData?.workflows && (
                <div className="mt-4">
                  {workflowsData.workflows
                    .filter(w => w.workflowId === recentWithdrawalWorkflowId)
                    .map(workflow => (
                      <WorkflowStatusCard
                        key={workflow.workflowId}
                        workflow={workflow}
                        showActions={false}
                        className="border-blue-200"
                      />
                    ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="ZAR" />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bank account</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="" disabled>
                    Select a bank account
                  </option>
                  {filteredAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} • {acc.accountNumber} ({acc.currency})
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={loadBankAccounts}>
                  Refresh bank accounts
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit withdrawal'}
                </Button>
                <Button variant="outline" asChild>
                  <a href="/wallet/deposit">Deposit instead</a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
