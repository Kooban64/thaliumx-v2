'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { getAccessToken } from '@/lib/auth/token-store';

interface LimitStatus {
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'within_limit' | 'approaching_limit' | 'at_limit' | 'exceeded';
  breakdown: { presale: number; tokenSale: number; mainPlatform: number; total: number; };
}

interface UnifiedKYCStatus {
  kycLevel: string;
  kycStatus: string;
  limits: { investment: LimitStatus; trading: LimitStatus; withdrawal: LimitStatus; };
  upgradeRecommended: boolean;
}

interface UpgradePromptProps {
  limitType?: 'investment' | 'trading' | 'withdrawal';
  className?: string;
  onUpgradeClick?: () => void;
}

export function UpgradePrompt({ limitType = 'investment', className, onUpgradeClick }: UpgradePromptProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<UnifiedKYCStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!getAccessToken()) { setLoading(false); return; }
      try {
        const res = await fetch('/api/kyc/status/unified', {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${getAccessToken()}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) setStatus(data.data);
        }
      } catch (err) {}
      finally { setLoading(false); }
    };
    fetchStatus();
  }, []);

  if (loading || !status) return null;
  const limitStatus = status.limits[limitType];
  const shouldShow = limitStatus.status === 'approaching_limit' || limitStatus.status === 'at_limit' || status.upgradeRecommended;
  if (!shouldShow) return null;

  const getNextKYCLevel = (current: string): string => {
    const levels = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'];
    const currentIndex = levels.indexOf(current);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : current;
  };

  const nextLevel = getNextKYCLevel(status.kycLevel);
  const isBlocking = limitStatus.status === 'at_limit' || limitStatus.status === 'exceeded';

  return (
    <Alert className={className} variant={isBlocking ? 'destructive' : 'default'}>
      <div className="flex items-start gap-3">
        {isBlocking ? <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" /> : <TrendingUp className="h-5 w-5 text-primary mt-0.5" />}
        <div className="flex-1 space-y-2">
          <AlertDescription className="font-medium">
            {isBlocking ? `Your ${limitType} limit has been reached (${limitStatus.percentage.toFixed(1)}% used)` : `You're approaching your ${limitType} limit (${limitStatus.percentage.toFixed(1)}% used)`}
          </AlertDescription>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Usage</span>
              <span className="font-medium">{limitStatus.current.toLocaleString()} / {limitStatus.limit.toLocaleString()}</span>
            </div>
            <Progress value={limitStatus.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Breakdown: Presale ${limitStatus.breakdown.presale.toLocaleString()} + Main Platform ${limitStatus.breakdown.mainPlatform.toLocaleString()} = Total ${limitStatus.breakdown.total.toLocaleString()}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Current: </span>
              <Badge variant="outline">{status.kycLevel}</Badge>
              <span className="text-muted-foreground ml-2">→ Recommended: </span>
              <Badge>{nextLevel}</Badge>
            </div>
            <Button size="sm" onClick={onUpgradeClick || (() => window.location.href = '/onboarding')} variant={isBlocking ? 'default' : 'outline'}>
              Upgrade KYC <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
