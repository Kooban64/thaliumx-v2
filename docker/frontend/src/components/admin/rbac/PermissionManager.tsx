'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRoles } from '@/lib/api/hooks/useRBAC';
import { Loader2, Shield } from 'lucide-react';
import { PermissionMatrix } from './PermissionMatrix';

/**
 * PermissionManager - Manage permissions and view permission matrix
 */
export function PermissionManager() {
  const { data: roles, isLoading } = useRoles();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Permission Management</h1>
        <p className="text-muted-foreground">
          View and manage role permissions
        </p>
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </CardTitle>
          <CardDescription>
            View which permissions are assigned to each role
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PermissionMatrix roles={roles || []} />
          )}
        </CardContent>
      </Card>

      {/* Permission Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Categories</CardTitle>
          <CardDescription>
            Available permission categories in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'System',
              'User',
              'Broker',
              'Trading',
              'Exchange',
              'Financial',
              'KYC',
              'Compliance',
              'Audit',
            ].map((category) => (
              <div
                key={category}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium mb-2">{category} Permissions</div>
                <Badge variant="secondary">{category}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
