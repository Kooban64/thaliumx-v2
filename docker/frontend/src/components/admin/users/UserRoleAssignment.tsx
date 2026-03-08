'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useUsers, useAdminAssignRole, type AdminUser } from '@/lib/api/hooks/useAdmin';
import { useRoles, type Role } from '@/lib/api/hooks/useRBAC';
import { Loader2, Search, User, Shield, Check } from 'lucide-react';
import { toast } from '@/components/shared/Toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * UserRoleAssignment - Assign and manage user roles
 */
export function UserRoleAssignment() {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const { data: users, isLoading: isLoadingUsers } = useUsers({
    search: search || undefined,
  });
  const { data: roles, isLoading: isLoadingRoles } = useRoles();
  const assignRoleMutation = useAdminAssignRole();

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: 'Error',
        description: 'Please select both a user and a role',
        type: 'error',
      });
      return;
    }

    try {
      await assignRoleMutation.mutateAsync({
        userId: selectedUser,
        role: selectedRole,
      });
      toast({
        type: 'success',
        title: 'Success',
        description: 'Role assigned successfully',
      });
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign role',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Role Assignment</h1>
        <p className="text-muted-foreground">
          Assign and manage roles for platform users
        </p>
      </div>

      {/* Role Assignment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Assign Role</CardTitle>
          <CardDescription>
            Select a user and assign them a role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingRoles ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    roles?.map((role: Role) => (
                      <SelectItem key={role.id || role.name} value={role.id || role.name}>
                        {role.name || role.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleAssignRole}
            disabled={!selectedUser || !selectedRole || assignRoleMutation.isPending}
            className="w-full"
          >
            {assignRoleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Assign Role
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Click on a user to select them for role assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user: AdminUser) => {
                const userKey = user.id || user.userId;
                if (!userKey) {
                  return null;
                }

                return <div
                  key={userKey}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedUser === userKey
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedUser(userKey)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.name || user.fullName || user.email || 'Unknown User'}
                        </span>
                        {user.role && (
                          <Badge variant="outline">{user.role}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  {selectedUser === userKey && (
                    <Shield className="h-5 w-5 text-primary" />
                  )}
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
