'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleManager } from '@/components/admin/rbac/RoleManager';
import { PermissionMatrix } from '@/components/admin/rbac/PermissionMatrix';
import { RoleAssignment } from '@/components/admin/rbac/RoleAssignment';
import { useRoles } from '@/lib/api/hooks/useRBAC';
import { Loader2 } from 'lucide-react';

export default function RBACAdmin() {
  const [activeTab, setActiveTab] = useState('roles');
  const { data: roles, isLoading } = useRoles();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RBAC Management</h1>
          <p className="text-muted-foreground">
            Manage roles, permissions, and role assignments
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin">Back to Admin</a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
          <TabsTrigger value="assignments">Role Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <RoleManager />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                View all permissions and which roles have access to them
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : roles && roles.length > 0 ? (
                <PermissionMatrix roles={roles} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No roles found. Create roles first to view the permission matrix.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <RoleAssignment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
