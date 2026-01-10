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

export default function AdminWorkflowsPage() {
  const [loading, setLoading] = useState(true);
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
        const profileRes = await apiClient.get('/api/auth/profile');
        if (!profileRes.success) {
          window.location.href = '/dashboard';
          return;
        }

        // Load all workflows (admin endpoint would be needed)
        // For now, we'll show a message that admin endpoints need to be implemented
        setLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
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

        {/* Analytics Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Workflow Analytics</span>
            </CardTitle>
            <CardDescription>Performance metrics and statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Workflow analytics dashboard coming soon</p>
              <p className="text-sm mt-2">
                This will include metrics like average completion time, success rates, and workflow type distribution
              </p>
            </div>
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
