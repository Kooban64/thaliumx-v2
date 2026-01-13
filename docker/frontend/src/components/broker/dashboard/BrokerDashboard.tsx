'use client';

import { BrokerMetricsCard } from './BrokerMetricsCard';
import { UserMetricsCard } from './UserMetricsCard';
import { QuickActionsCard } from './QuickActionsCard';
import { useBrokerDashboard } from '@/lib/api/hooks/useBroker';
import { Loader2 } from 'lucide-react';

/**
 * BrokerDashboard - Main broker dashboard component
 */
export function BrokerDashboard() {
  const { data: dashboardData, isLoading } = useBrokerDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broker Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your broker operations, users, and compliance
        </p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <BrokerMetricsCard data={metrics} />
        <UserMetricsCard data={metrics} />
        <QuickActionsCard />
      </div>
    </div>
  );
}
