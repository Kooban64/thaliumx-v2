'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Shield, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface KYCAccessInfo {
  kycLevel: string;
  kycStatus: string;
  riskScore: number;
  accountAccess: boolean;
  tradingAccess: boolean;
  withdrawalAccess: boolean;
  depositAccess: boolean;
  availableFeatures: string[];
  initialLimits?: {
    max_single: number;
    max_daily: number;
    max_monthly: number;
  };
  complianceFlags?: string[];
}

interface ProfileResponse {
  id?: string;
  user?: {
    id?: string;
  };
}

interface UserLimitsResponse {
  kycLevel: string;
  kycStatus: string;
  riskScore: number;
  access: {
    accountAccess: boolean;
    tradingAccess: boolean;
    withdrawalAccess: boolean;
    depositAccess: boolean;
    availableFeatures?: string[];
  };
  limits?: {
    maxSingle: number;
    maxDaily: number;
    maxMonthly: number;
  };
}

interface KYCAccessInfoProps {
  userId?: string;
  className?: string;
  showUpgradePrompt?: boolean;
}

export function KYCAccessInfo({ 
  userId, 
  className,
  showUpgradePrompt = true 
}: KYCAccessInfoProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessInfo, setAccessInfo] = useState<KYCAccessInfo | null>(null);

  useEffect(() => {
    const fetchAccessInfo = async () => {
      if (!userId) {
        try {
          const profileRes = await apiClient.get<ProfileResponse>('/api/auth/profile');
          const currentUserId = profileRes.data?.user?.id || profileRes.data?.id;
          if (!currentUserId) {
            setError('User not authenticated');
            setLoading(false);
            return;
          }
          await fetchUserAccessInfo(currentUserId);
        } catch {
          setError('Failed to fetch KYC access info');
          setLoading(false);
        }
      } else {
        await fetchUserAccessInfo(userId);
      }
    };

    const fetchUserAccessInfo = async (targetUserId: string) => {
      setLoading(true);
      setError(null);
      
      try {
        const res = await apiClient.get<UserLimitsResponse>(`/api/admin/user-limits/${targetUserId}`);
        if (res.success && res.data) {
          setAccessInfo({
            kycLevel: res.data.kycLevel,
            kycStatus: res.data.kycStatus,
            riskScore: res.data.riskScore,
            accountAccess: res.data.access.accountAccess,
            tradingAccess: res.data.access.tradingAccess,
            withdrawalAccess: res.data.access.withdrawalAccess,
            depositAccess: res.data.access.depositAccess,
            availableFeatures: res.data.access.availableFeatures || [],
            initialLimits: res.data.limits ? {
              max_single: res.data.limits.maxSingle,
              max_daily: res.data.limits.maxDaily,
              max_monthly: res.data.limits.maxMonthly
            } : undefined,
            complianceFlags: []
          });
        } else {
          setError(res.error || 'Failed to fetch access info');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch KYC access information');
      } finally {
        setLoading(false);
      }
    };

    fetchAccessInfo();
  }, [userId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !accessInfo) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load KYC access information'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getKYCLevelColor = (level: string) => {
    switch (level) {
      case 'institutional': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'basic': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return "bg-orange-100 text-orange-800";
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const needsUpgrade = accessInfo.kycLevel === 'not_started' || accessInfo.kycLevel === 'basic';
  const isApproved = accessInfo.kycStatus === 'approved';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC Status & Access
            </CardTitle>
            <CardDescription>Your verification status and platform access</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">KYC Level</span>
            <Badge className={getKYCLevelColor(accessInfo.kycLevel)}>
              {accessInfo.kycLevel.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Verification Status</span>
            <Badge className={getStatusColor(accessInfo.kycStatus)}>
              {accessInfo.kycStatus.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          {accessInfo.riskScore > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Risk Score</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={accessInfo.riskScore} 
                  className="w-24 h-2"
                />
                <span className="text-sm font-medium">{accessInfo.riskScore}</span>
              </div>
            </div>
          )}
        </div>

        {showUpgradePrompt && needsUpgrade && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              {accessInfo.kycLevel === 'not_started' 
                ? 'Complete KYC verification to unlock full platform access and higher transaction limits.'
                : 'Upgrade your KYC level to access more features and increase your transaction limits.'
              }
              <Button 
                variant="link" 
                className="p-0 h-auto ml-2"
                onClick={() => window.location.href = '/onboarding'}
              >
                {accessInfo.kycLevel === 'not_started' ? 'Start KYC →' : 'Upgrade KYC →'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t space-y-3">
          <div className="text-sm font-medium">Access Permissions</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                {accessInfo.accountAccess ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Account Access</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {accessInfo.accountAccess ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                {accessInfo.tradingAccess ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Trading</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {accessInfo.tradingAccess ? 'Enabled' : isApproved ? 'Requires KYC approval' : 'KYC required'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                {accessInfo.depositAccess ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Deposits</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {accessInfo.depositAccess ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                {accessInfo.withdrawalAccess ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Withdrawals</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {accessInfo.withdrawalAccess ? 'Enabled' : isApproved ? 'Requires KYC approval' : 'KYC required'}
              </span>
            </div>
          </div>
        </div>

        {accessInfo.availableFeatures.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Available Features</div>
            <div className="flex flex-wrap gap-2">
              {accessInfo.availableFeatures.map((feature) => (
                <Badge key={feature} variant="outline" className="text-xs">
                  {feature.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {accessInfo.initialLimits && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Transaction Limits</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Single Transaction</span>
                <span className="font-medium">{(accessInfo.initialLimits.max_single ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Limit</span>
                <span className="font-medium">{(accessInfo.initialLimits.max_daily ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Limit</span>
                <span className="font-medium">{(accessInfo.initialLimits.max_monthly ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {accessInfo.complianceFlags && accessInfo.complianceFlags.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Compliance Flags Active</div>
              <ul className="list-disc list-inside text-xs space-y-1">
                {accessInfo.complianceFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
              <p className="text-xs mt-2">Please contact support for assistance.</p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
