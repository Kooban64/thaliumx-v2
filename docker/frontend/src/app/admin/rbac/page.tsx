'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RBACAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">RBAC Management</h1>
        <Button asChild>
          <a href="/admin">Back</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Create and manage roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="roleName">Role name</Label>
                <Input id="roleName" placeholder="broker-admin" />
              </div>
              <Button size="sm">Add</Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Coming soon: role list, edit, delete
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>Assign permissions to roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            Coming soon: permission matrix editor
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
