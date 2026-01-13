'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrokerLimits, useUpdateBrokerLimits } from '@/lib/api/hooks/useBroker';
import { Loader2, Shield, Save } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerLimits - Transaction limits and access controls with full functionality
 */
export function BrokerLimits() {
  const { data, isLoading, error } = useBrokerLimits();
  const updateMutation = useUpdateBrokerLimits();
  const [limits, setLimits] = useState({
    defaultUserLimits: {
      maxDailyVolume: 0,
      maxMonthlyVolume: 0,
      maxSingleTransaction: 0,
      maxDailyWithdrawal: 0,
      maxMonthlyWithdrawal: 0,
      maxDailyDeposit: 0,
      maxMonthlyDeposit: 0,
    },
    transactionLimits: {
      minTransaction: 0,
      maxTransaction: 0,
    },
    withdrawalLimits: {
      minWithdrawal: 0,
      maxWithdrawal: 0,
    },
    depositLimits: {
      minDeposit: 0,
      maxDeposit: 0,
    },
  });

  useEffect(() => {
    if (data) {
      setLimits({
        defaultUserLimits: {
          maxDailyVolume: data.defaultUserLimits?.maxDailyVolume ?? limits.defaultUserLimits.maxDailyVolume,
          maxMonthlyVolume: data.defaultUserLimits?.maxMonthlyVolume ?? limits.defaultUserLimits.maxMonthlyVolume,
          maxSingleTransaction: data.defaultUserLimits?.maxSingleTransaction ?? limits.defaultUserLimits.maxSingleTransaction,
          maxDailyWithdrawal: data.defaultUserLimits?.maxDailyWithdrawal ?? limits.defaultUserLimits.maxDailyWithdrawal,
          maxMonthlyWithdrawal: data.defaultUserLimits?.maxMonthlyWithdrawal ?? limits.defaultUserLimits.maxMonthlyWithdrawal,
          maxDailyDeposit: data.defaultUserLimits?.maxDailyDeposit ?? limits.defaultUserLimits.maxDailyDeposit,
          maxMonthlyDeposit: data.defaultUserLimits?.maxMonthlyDeposit ?? limits.defaultUserLimits.maxMonthlyDeposit,
        },
        transactionLimits: {
          minTransaction: data.transactionLimits?.minTransaction ?? limits.transactionLimits.minTransaction,
          maxTransaction: data.transactionLimits?.maxTransaction ?? limits.transactionLimits.maxTransaction,
        },
        withdrawalLimits: {
          minWithdrawal: data.withdrawalLimits?.minWithdrawal ?? limits.withdrawalLimits.minWithdrawal,
          maxWithdrawal: data.withdrawalLimits?.maxWithdrawal ?? limits.withdrawalLimits.maxWithdrawal,
        },
        depositLimits: {
          minDeposit: data.depositLimits?.minDeposit ?? limits.depositLimits.minDeposit,
          maxDeposit: data.depositLimits?.maxDeposit ?? limits.depositLimits.maxDeposit,
        },
      });
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(limits);
      toast({
        type: 'success',
        title: 'Limits updated',
        description: 'Broker limits have been saved successfully',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to update limits',
        description: err instanceof Error ? err.message : 'Failed to update broker limits',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load broker limits</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Limits & Controls</h1>
        <p className="text-muted-foreground">Configure transaction limits and access controls</p>
      </div>

      {/* Default User Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Default User Limits
          </CardTitle>
          <CardDescription>
            Set default limits for new users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxDailyVolume">Max Daily Volume</Label>
              <Input
                id="maxDailyVolume"
                type="number"
                value={limits.defaultUserLimits.maxDailyVolume}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxDailyVolume: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxMonthlyVolume">Max Monthly Volume</Label>
              <Input
                id="maxMonthlyVolume"
                type="number"
                value={limits.defaultUserLimits.maxMonthlyVolume}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxMonthlyVolume: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxSingleTransaction">Max Single Transaction</Label>
              <Input
                id="maxSingleTransaction"
                type="number"
                value={limits.defaultUserLimits.maxSingleTransaction}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxSingleTransaction: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxDailyWithdrawal">Max Daily Withdrawal</Label>
              <Input
                id="maxDailyWithdrawal"
                type="number"
                value={limits.defaultUserLimits.maxDailyWithdrawal}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxDailyWithdrawal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxMonthlyWithdrawal">Max Monthly Withdrawal</Label>
              <Input
                id="maxMonthlyWithdrawal"
                type="number"
                value={limits.defaultUserLimits.maxMonthlyWithdrawal}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxMonthlyWithdrawal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxDailyDeposit">Max Daily Deposit</Label>
              <Input
                id="maxDailyDeposit"
                type="number"
                value={limits.defaultUserLimits.maxDailyDeposit}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxDailyDeposit: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxMonthlyDeposit">Max Monthly Deposit</Label>
              <Input
                id="maxMonthlyDeposit"
                type="number"
                value={limits.defaultUserLimits.maxMonthlyDeposit}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    defaultUserLimits: {
                      ...limits.defaultUserLimits,
                      maxMonthlyDeposit: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Limits</CardTitle>
          <CardDescription>
            Configure transaction amount limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minTransaction">Min Transaction</Label>
              <Input
                id="minTransaction"
                type="number"
                value={limits.transactionLimits.minTransaction}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    transactionLimits: {
                      ...limits.transactionLimits,
                      minTransaction: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxTransaction">Max Transaction</Label>
              <Input
                id="maxTransaction"
                type="number"
                value={limits.transactionLimits.maxTransaction}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    transactionLimits: {
                      ...limits.transactionLimits,
                      maxTransaction: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Limits</CardTitle>
          <CardDescription>
            Configure withdrawal amount limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minWithdrawal">Min Withdrawal</Label>
              <Input
                id="minWithdrawal"
                type="number"
                value={limits.withdrawalLimits.minWithdrawal}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    withdrawalLimits: {
                      ...limits.withdrawalLimits,
                      minWithdrawal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxWithdrawal">Max Withdrawal</Label>
              <Input
                id="maxWithdrawal"
                type="number"
                value={limits.withdrawalLimits.maxWithdrawal}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    withdrawalLimits: {
                      ...limits.withdrawalLimits,
                      maxWithdrawal: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Limits</CardTitle>
          <CardDescription>
            Configure deposit amount limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minDeposit">Min Deposit</Label>
              <Input
                id="minDeposit"
                type="number"
                value={limits.depositLimits.minDeposit}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    depositLimits: {
                      ...limits.depositLimits,
                      minDeposit: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="maxDeposit">Max Deposit</Label>
              <Input
                id="maxDeposit"
                type="number"
                value={limits.depositLimits.maxDeposit}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    depositLimits: {
                      ...limits.depositLimits,
                      maxDeposit: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Limits
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
