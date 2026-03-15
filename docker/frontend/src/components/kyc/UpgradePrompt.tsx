'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { getAuthToken } from '@/lib/auth/backend-auth';
import { KYCCollectionFlow } from './KYCCollectionFlow';
import { toast } from '@/components/shared/Toast';

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
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [showCollectionFlow, setShowCollectionFlow] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      const token = getAuthToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetch('/api/kyc/status/unified', {
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) setStatus(data.data);
        }
      } catch {}
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
    if (currentIndex < 0 || currentIndex >= levels.length - 1) {
      return current;
    }
    const next = levels[currentIndex + 1];
    return next || current;
  };

  const nextLevel = getNextKYCLevel(status.kycLevel || 'L0');
  const isBlocking = limitStatus.status === 'at_limit' || limitStatus.status === 'exceeded';

  // Handle upgrade button click - trigger workflow via backend API
  const handleUpgradeClick = async () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }

    setTriggeringWorkflow(true);
    try {
      const token = getAuthToken();
      if (!token) {
        window.location.href = '/login?next=/dashboard';
        return;
      }

      // Call backend API to trigger KYC upgrade workflow
      const response = await fetch('/api/kyc/upgrade/trigger', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fromLevel: status.kycLevel || 'L0',
          toLevel: nextLevel,
          reason: `Upgrade required for ${limitType} limit increase`,
          triggerType: isBlocking ? 'blocking' : 'proactive'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start upgrade workflow');
      }

      const data = await response.json();
      if (data.success && data.data?.workflowId) {
        // Workflow triggered successfully - show collection flow
        setWorkflowId(data.data.workflowId);
        setShowCollectionFlow(true);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start KYC upgrade. Please try again.';
      toast({
        type: 'error',
        title: 'KYC upgrade failed',
        description: errorMessage,
      });
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  // If collection flow should be shown, render it
  if (showCollectionFlow && workflowId) {
    return (
      <div className={className}>
        <KYCCollectionFlow
          workflowId={workflowId}
          onComplete={() => {
            setShowCollectionFlow(false);
            setWorkflowId(null);
            // Refresh status
            window.location.reload();
          }}
          onError={(error) => {
            toast({
              type: 'error',
              title: 'KYC verification error',
              description: String(error),
            });
            setShowCollectionFlow(false);
          }}
        />
      </div>
    );
  }

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
            <Button 
              size="sm" 
              onClick={handleUpgradeClick} 
              variant={isBlocking ? 'default' : 'outline'}
              disabled={triggeringWorkflow}
            >
              {triggeringWorkflow ? (
                <>Starting...</>
              ) : (
                <>Upgrade KYC <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
