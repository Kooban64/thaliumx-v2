'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { KYCLevel } from '@/stores/kycStore';
import { cn } from '@/lib/utils';

interface KYCStatusCardProps {
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

/**
 * KYCStatusCard - Displays current KYC level and status
 * Cursor IDE-inspired design
 */
export function KYCStatusCard({
  showUpgradeButton = true,
  onUpgradeClick,
  className,
}: KYCStatusCardProps) {
  const { level, status, isLoading } = useKYC();

  const getLevelInfo = (level: KYCLevel | null) => {
    switch (level) {
      case 'L0':
        return { label: 'L0 - Web3 Basic', color: 'bg-blue-500', description: 'Basic wallet connection' };
      case 'L1':
        return { label: 'L1 - Basic Verification', color: 'bg-green-500', description: 'Email + Phone verified' };
      case 'L2':
        return { label: 'L2 - Identity Verified', color: 'bg-purple-500', description: 'ID + Address verified' };
      case 'L3':
        return { label: 'L3 - Enhanced Verification', color: 'bg-orange-500', description: 'Enhanced screening' };
      case 'INSTITUTIONAL':
        return { label: 'Institutional', color: 'bg-indigo-500', description: 'Business verification' };
      default:
        return { label: 'Not Verified', color: 'bg-gray-500', description: 'No verification' };
    }
  };

  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case 'approved':
        return { icon: CheckCircle2, color: 'text-green-600', label: 'Approved' };
      case 'pending':
      case 'in_review':
        return { icon: Clock, color: 'text-yellow-600', label: 'In Review' };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-600', label: 'Rejected' };
      default:
        return { icon: AlertCircle, color: 'text-gray-600', label: 'Not Started' };
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const levelInfo = getLevelInfo(level);
  const statusInfo = getStatusInfo(status);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KYC Status
        </CardTitle>
        <CardDescription>Your current verification level and status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center', levelInfo.color)}>
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold">{levelInfo.label}</p>
              <p className="text-sm text-muted-foreground">{levelInfo.description}</p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <statusInfo.icon className={cn('h-4 w-4', statusInfo.color)} />
          <Badge variant={status === 'approved' ? 'default' : 'secondary'}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Upgrade Button */}
        {showUpgradeButton && level !== 'INSTITUTIONAL' && (
          <Button
            onClick={onUpgradeClick}
            className="w-full"
            variant={status === 'approved' ? 'outline' : 'default'}
          >
            {level === null ? 'Start Verification' : 'Upgrade KYC Level'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
