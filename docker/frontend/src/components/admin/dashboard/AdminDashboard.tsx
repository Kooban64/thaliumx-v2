'use client';

import { SystemHealthCard } from './SystemHealthCard';
import { PlatformMetricsCard } from './PlatformMetricsCard';
import { QuickActionsCard } from './QuickActionsCard';
import { RecentActivityCard } from './RecentActivityCard';
import { useAdminDashboard } from '@/lib/api/hooks/useAdmin';
import { Loader2 } from 'lucide-react';

/**
 * AdminDashboard - Main admin dashboard component
 */
export function AdminDashboard() {
  const { data: dashboardData, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Platform Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, brokers, policies, and system configuration
        </p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SystemHealthCard />
        <PlatformMetricsCard data={dashboardData} />
        <QuickActionsCard />
      </div>

      {/* Recent Activity */}
      <RecentActivityCard data={dashboardData} />
    </div>
  );
}
