/**
 * Admin Workflow Dashboard
 * 
 * Admin view of all workflows with monitoring and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkflowHealth } from '@/lib/api/hooks/workflows';
import type { WorkflowHealth } from '@/lib/api/types/workflows';
import { Loader2, Activity, AlertTriangle, BarChart3 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logAuthError } from '@/lib/services/errorLogger';

interface WorkflowAnalytics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageCompletionTime: number;
  successRate: number;
  workflowsByType: Record<string, number>;
}

interface WorkflowRecord {
  status?: string;
  startedAt?: string;
  completedAt?: string;
  type?: string;
  workflowType?: string;
}

interface WorkflowListPayload {
  workflows?: WorkflowRecord[];
}

export default function AdminWorkflowsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null);
  const { data: healthData } = useWorkflowHealth();

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/admin/workflows';
          return;
        }

        // Check if user is admin
        const profileRes = await apiClient.get<{ user?: { role?: string }; data?: { role?: string }; role?: string }>('/api/auth/profile');
        if (!profileRes.success) {
          window.location.href = '/dashboard';
          return;
        }
        const profile = profileRes.data?.user || profileRes.data?.data || profileRes.data;
        if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
          window.location.href = '/dashboard';
          return;
        }

        // Load workflow analytics
        try {
          const workflowsRes = await apiClient.get<WorkflowRecord[] | WorkflowListPayload>('/api/workflows');
          if (workflowsRes.success && workflowsRes.data) {
            const data = workflowsRes.data;
            const workflows = Array.isArray(data) ? data : (data.workflows || []);
            
            // Calculate analytics
            const total = workflows.length;
            const active = workflows.filter((w) => w.status === 'active' || w.status === 'running').length;
            const completed = workflows.filter((w) => w.status === 'completed' || w.status === 'success').length;
            const failed = workflows.filter((w) => w.status === 'failed' || w.status === 'error').length;
            
            const completedWorkflows = workflows.filter((w) => w.status === 'completed' || w.status === 'success');
            const totalCompletionTime = completedWorkflows.reduce((sum, w) => {
              if (w.startedAt && w.completedAt) {
                const start = new Date(w.startedAt).getTime();
                const end = new Date(w.completedAt).getTime();
                return sum + (end - start);
              }
              return sum;
            }, 0);
            const avgCompletionTime = completedWorkflows.length > 0 
              ? totalCompletionTime / completedWorkflows.length / 1000 / 60 // Convert to minutes
              : 0;
            
            const successRate = total > 0 ? (completed / total) * 100 : 0;
            
            const workflowsByType = workflows.reduce((acc: Record<string, number>, w) => {
              const type = w.type || w.workflowType || 'unknown';
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {});

            setAnalytics({
              totalWorkflows: total,
              activeWorkflows: active,
              completedWorkflows: completed,
              failedWorkflows: failed,
              averageCompletionTime: avgCompletionTime,
              successRate: successRate,
              workflowsByType: workflowsByType,
            });
          }
        } catch (err) {
          console.error('Failed to load workflow analytics:', err);
        }

        setLoading(false);
      } catch (err) {
        logAuthError(err, 'checkAuth', { component: 'AdminWorkflows' });
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const health = healthData as WorkflowHealth | undefined;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin - Workflow Management</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage all workflows across the platform
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>

        {/* Health Status */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className={`text-lg font-semibold capitalize ${
                    health.status === 'healthy' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {health.status}
                  </div>
                </div>
                {health.activeWorkflows !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">Active Workflows</div>
                    <div className="text-lg font-semibold">{health.activeWorkflows}</div>
                  </div>
                )}
                {health.failedWorkflows !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">Failed Workflows</div>
                    <div className="text-lg font-semibold text-red-600">{health.failedWorkflows}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Workflow Analytics</span>
            </CardTitle>
            <CardDescription>Performance metrics and statistics</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total Workflows</div>
                  <div className="text-2xl font-bold">{analytics.totalWorkflows}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Active</div>
                  <div className="text-2xl font-bold text-blue-600">{analytics.activeWorkflows}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Completed</div>
                  <div className="text-2xl font-bold text-green-600">{analytics.completedWorkflows}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Failed</div>
                  <div className="text-2xl font-bold text-red-600">{analytics.failedWorkflows}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className="text-2xl font-bold">
                    {analytics.successRate.toFixed(1)}%
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Avg Completion</div>
                  <div className="text-2xl font-bold">
                    {analytics.averageCompletionTime > 0 
                      ? `${analytics.averageCompletionTime.toFixed(1)} min`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading workflow analytics...</p>
              </div>
            )}
            
            {analytics && Object.keys(analytics.workflowsByType).length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-sm font-medium mb-3">Workflows by Type</div>
                <div className="space-y-2">
                  {Object.entries(analytics.workflowsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize">{type}</span>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Workflow List */}
        <Card>
          <CardHeader>
            <CardTitle>All Workflows</CardTitle>
            <CardDescription>
              View and manage workflows across all users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Admin workflow listing requires backend endpoint for fetching all workflows.
                Currently showing user-specific workflows. Backend endpoint: GET /api/workflows/admin/all
              </AlertDescription>
            </Alert>
            <div className="text-center py-8 text-muted-foreground">
              <p>Admin workflow management interface</p>
              <p className="text-sm mt-2">
                Backend endpoint needed: GET /api/workflows/admin/all
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
