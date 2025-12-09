'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PlatformAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <Button asChild>
          <a href="/dashboard">Back to App</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Services and dependencies</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• API: Healthy</li>
              <li>• Exchanges: Mixed</li>
              <li>• Telemetry: Active</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Users & Brokers</CardTitle>
            <CardDescription>Manage tenants and brokers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Users</Button>
              <Button size="sm" variant="outline">Brokers</Button>
              <Button size="sm" variant="outline">Allocations</Button>
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
              <Button size="sm" variant="outline">Approvals</Button>
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
              <Button size="sm" variant="outline">AML Rules</Button>
              <Button size="sm" variant="outline">Security</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance & Audit</CardTitle>
            <CardDescription>Compliance reports and audit logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Reports</Button>
              <Button size="sm" variant="outline">Audit Log</Button>
              <Button size="sm" variant="outline">SAR Filing</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
