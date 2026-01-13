'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateUserLimits } from '@/lib/api/hooks/useAdmin';
import { Loader2, CreditCard, TrendingUp, TrendingDown, DollarSign, Save, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/shared/Toast';

interface UserLimitsProps {
  userId: string;
  limits?: any;
  isLoading: boolean;
}

/**
 * UserLimits - Display and manage user transaction limits
 */
export function UserLimits({ userId, limits, isLoading }: UserLimitsProps) {
  const updateLimitsMutation = useUpdateUserLimits();
  const [isEditing, setIsEditing] = useState(false);
  const [editedLimits, setEditedLimits] = useState<any>(limits || {});
  const [reason, setReason] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const limitTypes = [
    { key: 'investment', label: 'Investment', icon: TrendingUp },
    { key: 'trading', label: 'Trading', icon: TrendingDown },
    { key: 'withdrawal', label: 'Withdrawal', icon: DollarSign },
    { key: 'deposit', label: 'Deposit', icon: CreditCard },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction Limits</CardTitle>
            <CardDescription>Current limits based on KYC level</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            disabled={updateLimitsMutation.isPending}
          >
            {isEditing ? 'Cancel' : 'Edit Limits'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!limits ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No limit data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {limitTypes.map((type) => {
              const Icon = type.icon;
              const limitData = limits[type.key] || {};
              const daily = limitData.daily || limitData.dailyLimit || 0;
              const monthly = limitData.monthly || limitData.monthlyLimit || 0;
              const used = limitData.used || 0;
              const remaining = limitData.remaining || (daily - used);

              return (
                <div key={type.key} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{type.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Daily Limit</span>
                      <span className="font-medium">
                        ${daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Limit</span>
                      <span className="font-medium">
                        ${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {used > 0 && (
                      <>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Used</span>
                            <span className="font-medium">
                              ${used.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Remaining</span>
                            <Badge variant={remaining > 0 ? 'default' : 'destructive'}>
                              ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Badge>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isEditing && (
          <div className="mt-6 p-4 border rounded-lg bg-muted/50 space-y-4">
            <div>
              <Label htmlFor="reason">Reason for Override</Label>
              <Textarea
                id="reason"
                placeholder="Provide a reason for this limit override..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {limitTypes.map((type) => {
                const Icon = type.icon;
                const limitData = editedLimits[type.key] || {};
                const daily = limitData.daily || limitData.dailyLimit || 0;
                const monthly = limitData.monthly || limitData.monthlyLimit || 0;

                return (
                  <div key={type.key} className="p-4 border rounded-lg bg-background">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="font-medium">{type.label} Limits</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`${type.key}-daily`}>Daily Limit</Label>
                        <Input
                          id={`${type.key}-daily`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={daily || ''}
                          onChange={(e) => {
                            setEditedLimits((prev: any) => ({
                              ...prev,
                              [type.key]: {
                                ...prev[type.key],
                                daily: e.target.value ? parseFloat(e.target.value) : 0,
                                dailyLimit: e.target.value ? parseFloat(e.target.value) : 0,
                              },
                            }));
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${type.key}-monthly`}>Monthly Limit</Label>
                        <Input
                          id={`${type.key}-monthly`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={monthly || ''}
                          onChange={(e) => {
                            setEditedLimits((prev: any) => ({
                              ...prev,
                              [type.key]: {
                                ...prev[type.key],
                                monthly: e.target.value ? parseFloat(e.target.value) : 0,
                                monthlyLimit: e.target.value ? parseFloat(e.target.value) : 0,
                              },
                            }));
                          }}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditedLimits(limits || {});
                  setReason('');
                }}
                disabled={updateLimitsMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!reason.trim()) {
                    toast({
                      type: 'error',
                      title: 'Validation Error',
                      description: 'Please provide a reason for this limit override',
                    });
                    return;
                  }

                  try {
                    await updateLimitsMutation.mutateAsync({
                      userId,
                      limits: {
                        ...editedLimits,
                        reason,
                      },
                    });
                    toast({
                      type: 'success',
                      title: 'Limits Updated',
                      description: 'User limits have been successfully updated',
                    });
                    setIsEditing(false);
                    setReason('');
                  } catch {
                    toast({
                      type: 'error',
                      title: 'Update Failed',
                      description: error instanceof Error ? error.message : 'Failed to update user limits',
                    });
                  }
                }}
                disabled={updateLimitsMutation.isPending}
              >
                {updateLimitsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
