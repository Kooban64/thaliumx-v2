'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { KYCLevel } from '@/stores/kycStore';

interface KYCBlockingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgradeClick?: () => void;
  reason?: string;
  limitType?: 'investment' | 'trading' | 'withdrawal' | 'deposit';
  currentUsage?: number;
  limit?: number;
}

/**
 * KYCBlockingModal - Blocks transaction and forces upgrade
 * Shown when user reaches 100% limit usage
 */
export function KYCBlockingModal({
  open,
  onOpenChange,
  onUpgradeClick,
  reason,
  limitType = 'withdrawal',
  currentUsage,
  limit,
}: KYCBlockingModalProps) {
  const { level } = useKYC();

  const getNextLevel = (currentLevel: KYCLevel | null): KYCLevel | null => {
    switch (currentLevel) {
      case null:
      case 'L0':
        return 'L1';
      case 'L1':
        return 'L2';
      case 'L2':
        return 'L3';
      case 'L3':
        return 'INSTITUTIONAL';
      default:
        return null;
    }
  };

  const nextLevel = getNextLevel(level);
  const usagePercent = limit && currentUsage ? (currentUsage / limit) * 100 : 100;

  const handleUpgrade = () => {
    onOpenChange(false);
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default: navigate to upgrade page
      window.location.href = '/account/kyc/upgrade';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Transaction Blocked
          </DialogTitle>
          <DialogDescription>
            Your transaction cannot be completed due to limit restrictions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {reason ||
                `You have reached your ${limitType} limit. Upgrade your KYC level to continue.`}
            </AlertDescription>
          </Alert>

          {currentUsage !== undefined && limit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Usage</span>
                <span className="font-medium">
                  {currentUsage.toLocaleString()} / {limit.toLocaleString()} ({usagePercent.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all"
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">To continue:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>Upgrade your KYC level to {nextLevel || 'the next level'}</li>
              <li>Complete required verification steps</li>
              <li>Get access to higher transaction limits</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade}>
            Upgrade KYC Level
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
