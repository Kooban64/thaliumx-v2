'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import { initKeycloak } from '@/lib/auth/keycloak';
import { getAccessToken } from '@/lib/auth/token-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function DepositPage() {
  const [currency, setCurrency] = useState('ZAR');
  const [reference, setReference] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        await initKeycloak();
        if (!getAccessToken()) {
          window.location.href = `/auth?next=/wallet/deposit`;
          return;
        }
        await refresh();
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize auth');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setError('');
    const res = await apiClient.get<{ reference: string; currency: string; isPersistent: boolean }>(
      `/api/wallets/reference/persistent/${encodeURIComponent(currency)}`,
    );
    if (!res.success) {
      setError(res.error || res.message || 'Failed to fetch deposit reference');
      return;
    }
    setReference(res.data?.reference || '');
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deposit</h1>
        <Button variant="outline" asChild>
          <a href="/dashboard">Back</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank transfer reference</CardTitle>
          <CardDescription>
            Use this reference when depositing. The platform uses it to allocate funds to your wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="ZAR"
                />
                <Button type="button" variant="outline" onClick={refresh}>
                  Refresh Reference
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref">Deposit reference</Label>
                <Input id="ref" value={reference} readOnly />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

