'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserOverrides, useCreateUserOverride, useDeleteUserOverride, type UserOverride } from '@/lib/api/hooks/useLimits';
import { Loader2, Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { OverrideEditor } from './OverrideEditor';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

interface UserLimitOverrideProps {
  userId: string;
  userName?: string;
}

/**
 * UserLimitOverride - User-specific limit override interface
 */
export function UserLimitOverride({ userId, userName }: UserLimitOverrideProps) {
  const [showEditor, setShowEditor] = useState(false);
  const { data: overrides, isLoading } = useUserOverrides(userId);
  const createMutation = useCreateUserOverride();
  const deleteMutation = useDeleteUserOverride();

  const handleCreate = async (override: Omit<UserOverride, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createMutation.mutateAsync({ userId, override });
      setShowEditor(false);
      toast({
        type: 'success',
        title: 'Override created',
        description: 'User limit override has been created successfully',
      });
    } catch (error) {
      logRuntimeError(error, 'UserLimitOverride', { action: 'createOverride', userId });
      toast({
        type: 'error',
        title: 'Failed to create override',
        description: error instanceof Error ? error.message : 'Failed to create user limit override',
      });
    }
  };

  const handleDelete = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this override?')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync({ userId, overrideId });
      toast({
        type: 'success',
        title: 'Override deleted',
        description: 'User limit override has been deleted successfully',
      });
    } catch (error) {
      logRuntimeError(error, 'UserLimitOverride', { action: 'deleteOverride', userId, overrideId });
      toast({
        type: 'error',
        title: 'Failed to delete override',
        description: error instanceof Error ? error.message : 'Failed to delete user limit override',
      });
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Limit Overrides</h1>
          <p className="text-muted-foreground">
            {userName ? `Override limits for ${userName}` : `Override limits for user ${userId}`}
          </p>
        </div>
        <Button onClick={() => setShowEditor(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Override
        </Button>
      </div>

      {/* Override Editor */}
      {showEditor && (
        <OverrideEditor
          onSave={handleCreate}
          onCancel={() => setShowEditor(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {/* Overrides List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Overrides</CardTitle>
          <CardDescription>
            {overrides?.length || 0} override(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!overrides || overrides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No overrides configured for this user
            </div>
          ) : (
            <div className="space-y-4">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className={`p-4 border rounded-lg ${
                    isExpired(override.expiresAt) ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={override.type === 'permanent' ? 'default' : 'secondary'}>
                          {override.type === 'permanent' ? 'Permanent' : 'Temporary'}
                        </Badge>
                        {isExpired(override.expiresAt) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                        {override.type === 'temporary' && override.expiresAt && !isExpired(override.expiresAt) && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Expires {new Date(override.expiresAt).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        {Object.entries(override.limits).map(([key, value]) => {
                          if (typeof value === 'number') {
                            return (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="font-medium">{value.toLocaleString()}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                      {override.reason && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <strong>Reason:</strong> {override.reason}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                        <span>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Created: {new Date(override.createdAt).toLocaleString()}
                        </span>
                        {override.approvedBy && (
                          <span>Approved by: {override.approvedBy}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(override.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
