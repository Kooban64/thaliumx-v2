'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { Loader2, Shield, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ComplianceDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/admin/compliance';
          return;
        }

        const res = await apiClient.get<{ user?: { email?: string; role?: string } }>('/api/auth/profile');
        const userProfile = res.data?.user || (res.data as { email?: string; role?: string }) || null;
        
        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
          window.location.href = '/dashboard';
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Compliance & Audit Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor compliance status, audit logs, and regulatory reporting
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Compliance Status</span>
              </CardTitle>
              <CardDescription>Overall platform compliance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KYC Compliance:</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AML Screening:</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Monitoring:</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Audit Logs</span>
              </CardTitle>
              <CardDescription>System activity and change logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link href="/admin/policies?audit=1">View Audit Log</Link>
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Access detailed audit trails for policy changes, user actions, and system events
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Reports</span>
              </CardTitle>
              <CardDescription>Regulatory and compliance reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Compliance reporting features coming soon</p>
                <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                  <li>Suspicious Activity Reports (SAR)</li>
                  <li>Transaction reports</li>
                  <li>KYC status reports</li>
                  <li>Risk assessment reports</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Compliance Events</CardTitle>
            <CardDescription>Latest compliance-related activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Compliance event monitoring coming soon</p>
              <p className="text-sm mt-2">
                This will display recent KYC approvals, AML alerts, policy violations, and compliance actions
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
