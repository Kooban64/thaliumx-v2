'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { PolicyViolationAlertContainer } from '@/components/opa/PolicyViolationAlertContainer';

export default function PlatformAdmin() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/admin';
          return;
        }

        const res = await apiClient.get<any>('/api/auth/profile');
        const userProfile = (res.data as any)?.user || res.data || null;
        
        // Redirect non-admins to user dashboard
        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
          window.location.href = '/dashboard';
          return;
        }
        
        setProfile(userProfile);

        // Fetch system health
        try {
          const healthRes = await apiClient.get<any>('/api/admin/health');
          if (healthRes.success && healthRes.data) {
            setSystemHealth(healthRes.data);
          }
        } catch (err) {
          console.error('Failed to fetch system health:', err);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage users, brokers, policies, and system configuration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/admin">Home</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/dashboard">User Dashboard</a>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading admin session…</div>
      ) : !profile ? (
        <div className="text-sm text-red-600">Not authenticated.</div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{profile.email}</span> • role: <span className="font-medium">{profile.role || 'unknown'}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Services and dependencies</CardDescription>
          </CardHeader>
          <CardContent>
            {systemHealth ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Status:</span>
                  <span className={`font-medium ${
                    systemHealth.status === 'healthy' ? 'text-green-600' : 
                    systemHealth.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {systemHealth.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                <div className="pt-2 border-t space-y-1 text-xs">
                  {systemHealth.services && Object.entries(systemHealth.services).map(([service, status]: [string, any]) => (
                    <div key={service} className="flex items-center justify-between">
                      <span className="text-muted-foreground capitalize">{service}:</span>
                      <span className={`font-medium ${
                        status === 'healthy' ? 'text-green-600' : 
                        status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {String(status).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
                {systemHealth.uptime && (
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    Uptime: {Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m
                  </div>
                )}
              </div>
            ) : (
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Loading health data...</li>
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Users & Brokers</CardTitle>
            <CardDescription>Manage tenants and brokers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="/broker">Broker Console</a>
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Manage broker configurations, allocations, and settings
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RBAC & Approvals</CardTitle>
            <CardDescription>Roles, permissions, workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/rbac">Open RBAC</a>
              </Button>
              <Button size="sm" variant="outline" disabled title="Approvals UI not implemented in this frontend yet">
                Approvals
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workflow Management</CardTitle>
            <CardDescription>Monitor and manage all workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/workflows">Workflow Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Policy Management</CardTitle>
            <CardDescription>OPA policies and compliance rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/policies">Manage Policies</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/policies?category=aml">AML Rules</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/policies?category=security">Security</a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance & Audit</CardTitle>
            <CardDescription>Compliance reports and audit logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/compliance">Compliance Dashboard</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/policies?audit=1">Audit Log</a>
              </Button>
              <Button size="sm" variant="outline" disabled title="Reports UI not implemented in this frontend yet">Reports</Button>
              <Button size="sm" variant="outline" disabled title="SAR filing UI not implemented in this frontend yet">SAR Filing</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy Violation Alerts */}
      <PolicyViolationAlertContainer />
    </div>
  );
}
