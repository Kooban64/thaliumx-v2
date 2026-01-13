'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, TrendingUp, Activity } from 'lucide-react';

interface PlatformMetricsCardProps {
  data?: any;
}

/**
 * PlatformMetricsCard - Display platform metrics
 */
export function PlatformMetricsCard({ data }: PlatformMetricsCardProps) {
  const metrics = data?.metrics || {
    totalUsers: 0,
    totalBrokers: 0,
    totalTransactions: 0,
    activeUsers: 0,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Platform Metrics
        </CardTitle>
        <CardDescription>Key platform statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Total Users</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalUsers?.toLocaleString() || '0'}</div>
            <div className="text-xs text-muted-foreground">
              {metrics.activeUsers || 0} active
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Brokers</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalBrokers?.toLocaleString() || '0'}</div>
            <div className="text-xs text-muted-foreground">
              Active brokers
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Transactions</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalTransactions?.toLocaleString() || '0'}</div>
            <div className="text-xs text-muted-foreground">
              Last 24h
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Volume</span>
            </div>
            <div className="text-2xl font-bold">
              ${metrics.totalVolume?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
            </div>
            <div className="text-xs text-muted-foreground">
              Last 24h
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
