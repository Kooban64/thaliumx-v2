'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Clock } from 'lucide-react';

interface UserMetricsCardProps {
  data?: {
    totalUsers?: number;
    activeUsers?: number;
    pendingKYC?: number;
    verifiedUsers?: number;
  };
}

/**
 * UserMetricsCard - Display user-related metrics for broker
 */
export function UserMetricsCard({ data }: UserMetricsCardProps) {
  const metrics = data || {
    totalUsers: 0,
    activeUsers: 0,
    pendingKYC: 0,
    verifiedUsers: 0,
  };

  const activePercentage = (metrics.totalUsers || 0) > 0
    ? Math.round(((metrics.activeUsers || 0) / (metrics.totalUsers || 1)) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Metrics
        </CardTitle>
        <CardDescription>User statistics for your broker</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Total Users</span>
            </div>
            <div className="text-2xl font-bold">{metrics.totalUsers?.toLocaleString() || '0'}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span>Active Users</span>
            </div>
            <div className="text-xl font-semibold">{metrics.activeUsers?.toLocaleString() || '0'}</div>
            <div className="text-xs text-muted-foreground">{activePercentage}%</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span>Verified Users</span>
            </div>
            <div className="text-xl font-semibold">{metrics.verifiedUsers?.toLocaleString() || '0'}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Pending KYC</span>
            </div>
            <div className="text-xl font-semibold text-orange-600">{metrics.pendingKYC?.toLocaleString() || '0'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
