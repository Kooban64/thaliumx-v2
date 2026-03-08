'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { getKeycloakToken } from '@/lib/auth/backend-auth';
import { UpgradePrompt } from './UpgradePrompt';

interface LimitStatus {
  current: number; limit: number; remaining: number; percentage: number;
  status: 'within_limit' | 'approaching_limit' | 'at_limit' | 'exceeded';
  breakdown: { presale: number; tokenSale: number; mainPlatform: number; total: number; };
}

interface UnifiedKYCStatus {
  kycLevel: string; kycStatus: string;
  limits: { investment: LimitStatus; trading: LimitStatus; withdrawal: LimitStatus; };
  upgradeRecommended: boolean;
}

export function LimitDashboard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<UnifiedKYCStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const token = getKeycloakToken();
      if (!token) { setError('Not authenticated'); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const res = await fetch('/api/kyc/status/unified', {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) setStatus(data.data);
          else setError('Failed to fetch KYC status');
        } else setError('Failed to fetch KYC status');
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to fetch KYC status'); }
      finally { setLoading(false); }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Card className={className}><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (error || !status) return <Card className={className}><CardContent className="py-8"><div className="text-center text-muted-foreground">{error || 'Failed to load limit information'}</div></CardContent></Card>;

  const renderLimitCard = (title: string, limitStatus: LimitStatus, _type: 'investment' | 'trading' | 'withdrawal') => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>{title}</span>
          <Badge variant={limitStatus.status === 'at_limit' || limitStatus.status === 'exceeded' ? 'destructive' : 'outline'}>
            {limitStatus.status.replace('_', ' ')}
          </Badge>
        </CardTitle>
        <CardDescription>Cumulative usage across presale and main platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Current Usage</span>
            <span className={limitStatus.status === 'at_limit' || limitStatus.status === 'exceeded' ? 'text-destructive' : 'text-foreground'}>
              {limitStatus.current.toLocaleString()} / {limitStatus.limit.toLocaleString()}
            </span>
          </div>
          <Progress value={limitStatus.percentage} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Remaining: {limitStatus.remaining.toLocaleString()}</span>
            <span className="flex items-center gap-1">
              {limitStatus.status === 'at_limit' || limitStatus.status === 'exceeded' ? <AlertTriangle className="h-4 w-4" /> : limitStatus.status === 'approaching_limit' ? <TrendingUp className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              {limitStatus.percentage.toFixed(1)}% used
            </span>
          </div>
        </div>
        <div className="pt-2 border-t space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Presale:</span><span>${limitStatus.breakdown.presale.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Main Platform:</span><span>${limitStatus.breakdown.mainPlatform.toLocaleString()}</span></div>
          <div className="flex justify-between font-medium pt-1 border-t"><span>Total:</span><span>${limitStatus.breakdown.total.toLocaleString()}</span></div>
        </div>
        {(limitStatus.status === 'approaching_limit' || limitStatus.status === 'at_limit') && (
            <Button 
              variant={limitStatus.status === 'at_limit' ? 'default' : 'outline'} 
              size="sm" 
              className="w-full" 
              onClick={async () => {
                // Trigger upgrade workflow via API (same as UpgradePrompt)
                try {
                  const token = getKeycloakToken();
                  if (!token) {
                    window.location.href = '/login?next=/dashboard';
                    return;
                  }

                  const response = await fetch('/api/kyc/upgrade/trigger', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      fromLevel: status?.kycLevel || 'L0',
                      toLevel: 'L1', // Default to next level
                      reason: 'Upgrade required for limit increase',
                      triggerType: 'blocking'
                    })
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.workflowId) {
                      // Redirect to onboarding page which will show collection flow
                      window.location.href = `/onboarding?workflowId=${data.data.workflowId}`;
                    } else {
                      window.location.href = '/onboarding';
                    }
                  } else {
                    window.location.href = '/onboarding';
                  }
                } catch {
                  window.location.href = '/onboarding';
                }
              }}
            >
              Upgrade KYC Level <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />KYC Limits Dashboard</CardTitle>
              <CardDescription>Unified limits across presale and main platform</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg">{status.kycLevel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {status.upgradeRecommended && <UpgradePrompt limitType="investment" />}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderLimitCard('Investment Limits', status.limits.investment, 'investment')}
            {renderLimitCard('Trading Limits', status.limits.trading, 'trading')}
            {renderLimitCard('Withdrawal Limits', status.limits.withdrawal, 'withdrawal')}
          </div>
          <div className="pt-4 border-t text-sm text-muted-foreground">
            <p className="mb-2"><strong>Note:</strong> Limits are cumulative across both presale investments and main platform trading.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/onboarding'}>
              Complete KYC Verification <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
