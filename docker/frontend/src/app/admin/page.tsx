'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { initKeycloak, getKeycloak } from '@/lib/auth/keycloak';
import { initZitadel } from '@/lib/auth/zitadel';
import { getAccessToken } from '@/lib/auth/token-store';
import apiClient from '@/lib/api/client';

export default function PlatformAdmin() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const authMode = process.env.NEXT_PUBLIC_AUTH_MODE || 'keycloak';

  useEffect(() => {
    (async () => {
      try {
        if (authMode === 'keycloak') {
          await initKeycloak();
        } else if (authMode === 'zitadel') {
          await initZitadel();
        }

        if ((authMode === 'keycloak' || authMode === 'zitadel') && !getAccessToken()) {
          window.location.href = '/login?next=/admin';
          return;
        }

        const res = await apiClient.get<any>('/api/auth/profile');
        setProfile((res.data as any)?.user || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [authMode]);

  const openIdentityAdmin = (hashPath: string) => {
    if (authMode === 'keycloak') {
      const kc = getKeycloak();
      // Example: https://thaliumx.com/auth/admin/thaliumx-platform/console/#/realms/thaliumx-platform/users
      const url = `${kc.authServerUrl}/admin/${kc.realm}/console/${hashPath}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (authMode === 'zitadel') {
      // Zitadel console path differs by deployment; open the issuer root as a safe fallback.
      const issuer = (process.env.NEXT_PUBLIC_ZITADEL_ISSUER || 'https://auth.thaliumx.com').replace(/\/+$/, '');
      window.open(issuer, '_blank', 'noopener,noreferrer');
      return;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <Button asChild>
          <a href="/dashboard">Back to App</a>
        </Button>
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => openIdentityAdmin(`#/realms/${getKeycloak().realm}/users`)}
                disabled={loading || !profile || authMode !== 'keycloak'}
                title={authMode === 'keycloak' ? undefined : 'Identity admin console is only available in Keycloak mode in this UI.'}
              >
                Users
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openIdentityAdmin(`#/realms/${getKeycloak().realm}/clients`)}
                disabled={loading || !profile || authMode !== 'keycloak'}
                title={authMode === 'keycloak' ? undefined : 'Identity admin console is only available in Keycloak mode in this UI.'}
              >
                Clients
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/broker">Broker Console</a>
              </Button>
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled title="Reports UI not implemented in this frontend yet">Reports</Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/admin/policies?audit=1">Audit Log</a>
              </Button>
              <Button size="sm" variant="outline" disabled title="SAR filing UI not implemented in this frontend yet">SAR Filing</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
