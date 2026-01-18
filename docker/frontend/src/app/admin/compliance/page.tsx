'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { Loader2, Shield, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ComplianceStatus {
  kycStatus: string;
  amlStatus: string;
  reportingStatus: string;
  lastAudit: string;
  nextAudit: string;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    timestamp: string;
  }>;
}

interface ComplianceEvent {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  userId?: string;
  action?: string;
}

export default function ComplianceDashboard() {
  const [loading, setLoading] = useState(true);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [complianceEvents, setComplianceEvents] = useState<ComplianceEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

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

        // Load compliance status
        try {
          const statusRes = await apiClient.get('/api/audit-logs/compliance-status');
          if (statusRes.success && statusRes.data) {
            setComplianceStatus(statusRes.data as ComplianceStatus);
          }
        } catch (err) {
          console.error('Failed to load compliance status:', err);
        }

        // Load recent compliance events from audit logs
        try {
          const eventsRes = await apiClient.get('/api/audit-logs?limit=10&category=compliance');
          if (eventsRes.success && eventsRes.data) {
            const data = eventsRes.data as any;
            const events = Array.isArray(data) ? data : (data.logs || []);
            setComplianceEvents(events.slice(0, 10) as ComplianceEvent[]);
          }
        } catch (err) {
          console.error('Failed to load compliance events:', err);
        }
      } catch (err) {
        setError('Failed to load compliance data');
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
                  <Badge variant={complianceStatus?.kycStatus === 'active' ? 'default' : 'destructive'}>
                    {complianceStatus?.kycStatus || 'Active'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AML Screening:</span>
                  <Badge variant={complianceStatus?.amlStatus === 'active' ? 'default' : 'destructive'}>
                    {complianceStatus?.amlStatus || 'Active'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Monitoring:</span>
                  <Badge variant={complianceStatus?.reportingStatus === 'up_to_date' ? 'default' : 'destructive'}>
                    {complianceStatus?.reportingStatus === 'up_to_date' ? 'Active' : complianceStatus?.reportingStatus || 'Active'}
                  </Badge>
                </div>
                {complianceStatus?.lastAudit && (
                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <span className="text-muted-foreground">Last Audit:</span>
                    <span className="text-xs">{new Date(complianceStatus.lastAudit).toLocaleDateString()}</span>
                  </div>
                )}
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/compliance/reports?type=sar">SAR Reports</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/compliance/reports?type=transaction">Transactions</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/compliance/reports?type=kyc">KYC Status</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/compliance/reports?type=risk">Risk Assessment</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Generate and download compliance reports for regulatory purposes
                </p>
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
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {complianceEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent compliance events</p>
                <p className="text-sm mt-2">
                  Compliance events will appear here as they occur
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {complianceEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            event.severity === 'high' ? 'destructive' :
                            event.severity === 'medium' ? 'default' : 'secondary'
                          }
                        >
                          {event.severity}
                        </Badge>
                        <span className="text-sm font-medium">{event.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.message}</p>
                      {event.action && (
                        <p className="text-xs text-muted-foreground mt-1">Action: {event.action}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground ml-4">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
