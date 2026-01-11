'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransactionLimits {
  maxSingle: number;
  maxDaily: number;
  maxMonthly: number;
  currencies: string[];
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
}

interface AccessInfo {
  accountAccess: boolean;
  tradingAccess: boolean;
  withdrawalAccess: boolean;
  depositAccess: boolean;
  availableFeatures: string[];
}

interface UserLimitsData {
  userId: string;
  kycLevel: string;
  kycStatus: string;
  riskScore: number;
  accountAgeDays: number;
  limits: TransactionLimits;
  access: AccessInfo;
  appliedMultipliers: Record<string, number>;
}

interface TransactionLimitsDisplayProps {
  userId?: string;
  className?: string;
  showUpgradePrompt?: boolean;
}

export function TransactionLimitsDisplay({ 
  userId, 
  className,
  showUpgradePrompt = true 
}: TransactionLimitsDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserLimitsData | null>(null);

  useEffect(() => {
    const fetchLimits = async () => {
      if (!userId) {
        try {
          const profileRes = await apiClient.get<{ id: string }>('/api/auth/profile');
          const currentUserId = (profileRes.data as any)?.user?.id || (profileRes.data as any)?.id;
          if (!currentUserId) {
            setError('User not authenticated');
            setLoading(false);
            return;
          }
          await fetchUserLimits(currentUserId);
        } catch (err: any) {
          setError('Failed to fetch user limits');
          setLoading(false);
        }
      } else {
        await fetchUserLimits(userId);
      }
    };

    const fetchUserLimits = async (targetUserId: string) => {
      setLoading(true);
      setError(null);
      
      try {
        const res = await apiClient.get<any>(`/api/admin/user-limits/${targetUserId}`);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error || 'Failed to fetch limits');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch transaction limits');
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
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

  if (error || !data) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Failed to load transaction limits'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const dailyUsagePercent = data.limits.maxDaily > 0 
    ? (data.limits.dailyUsed / data.limits.maxDaily) * 100 
    : 0;
  const monthlyUsagePercent = data.limits.maxMonthly > 0 
    ? (data.limits.monthlyUsed / data.limits.maxMonthly) * 100 
    : 0;

  const needsUpgrade = data.kycLevel === 'not_started' || data.kycLevel === 'basic';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Transaction Limits
            </CardTitle>
            <CardDescription>
              Based on your KYC level: <Badge variant="outline">{data.kycLevel}</Badge>
            </CardDescription>
          </div>
          {data.kycStatus && (
            <Badge variant={data.kycStatus === 'approved' ? 'default' : 'secondary'}>
              {data.kycStatus}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showUpgradePrompt && needsUpgrade && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Upgrade your KYC level to increase your transaction limits. 
              <a href="/onboarding" className="ml-2 text-primary underline">Complete KYC →</a>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Daily Limit</span>
            <span className="text-muted-foreground">
              {(data.limits.dailyUsed ?? 0).toLocaleString()} / {(data.limits.maxDaily ?? 0).toLocaleString()}
            </span>
          </div>
          <Progress value={dailyUsagePercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Remaining: {(data.limits.dailyRemaining ?? 0).toLocaleString()}</span>
            <span>{dailyUsagePercent.toFixed(1)}% used</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly Limit</span>
            <span className="text-muted-foreground">
              {(data.limits.monthlyUsed ?? 0).toLocaleString()} / {(data.limits.maxMonthly ?? 0).toLocaleString()}
            </span>
          </div>
          <Progress value={monthlyUsagePercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Remaining: {(data.limits.monthlyRemaining ?? 0).toLocaleString()}</span>
            <span>{monthlyUsagePercent.toFixed(1)}% used</span>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Single Transaction Limit</span>
            <span className="text-lg font-bold">{(data.limits.maxSingle ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {data.limits.currencies.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Supported Currencies</div>
            <div className="flex flex-wrap gap-2">
              {data.limits.currencies.map((currency) => (
                <Badge key={currency} variant="outline">{currency}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          <div className="text-sm font-medium mb-2">Access Permissions</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {data.access.accountAccess ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-red-600">✗</span>
              )}
              <span>Account Access</span>
            </div>
            <div className="flex items-center gap-2">
              {data.access.tradingAccess ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-red-600">✗</span>
              )}
              <span>Trading</span>
            </div>
            <div className="flex items-center gap-2">
              {data.access.depositAccess ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-red-600">✗</span>
              )}
              <span>Deposits</span>
            </div>
            <div className="flex items-center gap-2">
              {data.access.withdrawalAccess ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-red-600">✗</span>
              )}
              <span>Withdrawals</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
          <div>Account Age: {data.accountAgeDays} days</div>
          {data.riskScore > 0 && (
            <div>Risk Score: {data.riskScore}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
