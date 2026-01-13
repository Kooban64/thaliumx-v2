'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRoleLimits, useUpdateRoleLimits, type RoleLimits } from '@/lib/api/hooks/useLimits';
import { Loader2, Users } from 'lucide-react';
import { RoleLimitEditor } from './RoleLimitEditor';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

const PLATFORM_ROLES = ['user', 'admin', 'super_admin'];
const BROKER_ROLES = ['broker_admin', 'broker_compliance', 'broker_finance', 'broker_operations', 'broker_trading'];

/**
 * RoleLimitConfig - Role-based limit configuration interface
 */
export function RoleLimitConfig() {
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [roleCategory, setRoleCategory] = useState<'platform' | 'broker'>('platform');
  const { data: limits, isLoading } = useRoleLimits();
  const updateMutation = useUpdateRoleLimits();

  const currentLimits = limits?.[selectedRole] || {};

  const handleSave = async (updatedLimits: RoleLimits) => {
    try {
      await updateMutation.mutateAsync({
        role: selectedRole,
        limits: updatedLimits,
      });
    } catch {
      logRuntimeError(error, 'RoleLimitConfig', { action: 'updateRoleLimits', role: selectedRole });
      toast({
        type: 'error',
        title: 'Failed to update limits',
        description: error instanceof Error ? error.message : 'Failed to update role limits',
      });
    }
  };

  const rolesToShow = roleCategory === 'platform' ? PLATFORM_ROLES : BROKER_ROLES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Role-Based Limit Configuration</h1>
        <p className="text-muted-foreground">
          Configure transaction limits for different user roles
        </p>
      </div>

      {/* Role Category Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Role Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={roleCategory === 'platform' ? 'default' : 'outline'}
              onClick={() => {
                setRoleCategory('platform');
                setSelectedRole('user');
              }}
            >
              Platform Roles
            </Button>
            <Button
              variant={roleCategory === 'broker' ? 'default' : 'outline'}
              onClick={() => {
                setRoleCategory('broker');
                setSelectedRole('broker_admin');
              }}
            >
              Broker Roles
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Role</CardTitle>
          <CardDescription>
            Choose a role to configure its limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {rolesToShow.map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? 'default' : 'outline'}
                onClick={() => setSelectedRole(role)}
                className="min-w-[150px]"
              >
                {role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Limit Editor */}
      {selectedRole && (
        <RoleLimitEditor
          role={selectedRole}
          limits={currentLimits}
          onSave={handleSave}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
