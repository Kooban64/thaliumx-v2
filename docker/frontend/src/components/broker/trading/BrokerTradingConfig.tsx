'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useBrokerTradingConfig, useUpdateBrokerTradingConfig } from '@/lib/api/hooks/useBroker';
import { Loader2, Settings, Plus, Trash2, Save, Edit2 } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerTradingConfig - Configure trading settings with full functionality
 */
export function BrokerTradingConfig() {
  const { data, isLoading, error } = useBrokerTradingConfig();
  const updateMutation = useUpdateBrokerTradingConfig();
  const [editingPair, setEditingPair] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPair, setNewPair] = useState({
    symbol: '',
    baseCurrency: '',
    quoteCurrency: '',
    status: 'active',
    minOrderSize: '',
    maxOrderSize: '',
    tickSize: '',
    fee: '',
  });

  const pairs = data?.pairs || [];

  const handleSavePair = async (pair: any) => {
    try {
      const updatedPairs = pairs.map((p: any) =>
        p.symbol === pair.symbol ? {
          ...pair,
          status: pair.status as 'active' | 'inactive' | 'maintenance',
        } : p
      ) as typeof pairs;
      await updateMutation.mutateAsync({ pairs: updatedPairs });
      toast({
        type: 'success',
        title: 'Trading pair updated',
        description: 'Trading pair configuration has been saved',
      });
      setEditingPair(null);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to update pair',
        description: err instanceof Error ? err.message : 'Failed to update trading pair',
      });
    }
  };

  const handleAddPair = async () => {
    if (!newPair.symbol || !newPair.baseCurrency || !newPair.quoteCurrency) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    try {
      const pair = {
        symbol: newPair.symbol,
        baseCurrency: newPair.baseCurrency,
        quoteCurrency: newPair.quoteCurrency,
        status: newPair.status as 'active' | 'inactive' | 'maintenance',
        minOrderSize: parseFloat(newPair.minOrderSize),
        maxOrderSize: parseFloat(newPair.maxOrderSize),
        tickSize: parseFloat(newPair.tickSize),
        fee: parseFloat(newPair.fee),
      };

      const updatedPairs = [...pairs, pair] as typeof pairs;
      await updateMutation.mutateAsync({ pairs: updatedPairs });
      toast({
        type: 'success',
        title: 'Trading pair added',
        description: 'New trading pair has been added',
      });
      setShowAddDialog(false);
      setNewPair({
        symbol: '',
        baseCurrency: '',
        quoteCurrency: '',
        status: 'active',
        minOrderSize: '',
        maxOrderSize: '',
        tickSize: '',
        fee: '',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to add pair',
        description: err instanceof Error ? err.message : 'Failed to add trading pair',
      });
    }
  };

  const handleDeletePair = async (symbol: string) => {
    if (!confirm(`Are you sure you want to delete trading pair ${symbol}?`)) {
      return;
    }

    try {
      const updatedPairs = pairs.filter((p: any) => p.symbol !== symbol);
      await updateMutation.mutateAsync({ pairs: updatedPairs });
      toast({
        type: 'success',
        title: 'Trading pair deleted',
        description: 'Trading pair has been removed',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to delete pair',
        description: err instanceof Error ? err.message : 'Failed to delete trading pair',
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
            <p className="text-destructive mb-4">Failed to load trading configuration</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Configuration</h1>
          <p className="text-muted-foreground">Configure trading pairs and rules</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Trading Pair
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Trading Pair</DialogTitle>
              <DialogDescription>
                Configure a new trading pair
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="symbol">Symbol *</Label>
                <Input
                  id="symbol"
                  value={newPair.symbol}
                  onChange={(e) => setNewPair({ ...newPair, symbol: e.target.value })}
                  placeholder="BTC/USDT"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseCurrency">Base Currency *</Label>
                  <Input
                    id="baseCurrency"
                    value={newPair.baseCurrency}
                    onChange={(e) => setNewPair({ ...newPair, baseCurrency: e.target.value })}
                    placeholder="BTC"
                  />
                </div>
                <div>
                  <Label htmlFor="quoteCurrency">Quote Currency *</Label>
                  <Input
                    id="quoteCurrency"
                    value={newPair.quoteCurrency}
                    onChange={(e) => setNewPair({ ...newPair, quoteCurrency: e.target.value })}
                    placeholder="USDT"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={newPair.status}
                  onChange={(e) => setNewPair({ ...newPair, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minOrderSize">Min Order Size</Label>
                  <Input
                    id="minOrderSize"
                    type="number"
                    value={newPair.minOrderSize}
                    onChange={(e) => setNewPair({ ...newPair, minOrderSize: e.target.value })}
                    placeholder="0.001"
                  />
                </div>
                <div>
                  <Label htmlFor="maxOrderSize">Max Order Size</Label>
                  <Input
                    id="maxOrderSize"
                    type="number"
                    value={newPair.maxOrderSize}
                    onChange={(e) => setNewPair({ ...newPair, maxOrderSize: e.target.value })}
                    placeholder="1000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tickSize">Tick Size</Label>
                  <Input
                    id="tickSize"
                    type="number"
                    value={newPair.tickSize}
                    onChange={(e) => setNewPair({ ...newPair, tickSize: e.target.value })}
                    placeholder="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="fee">Fee (%)</Label>
                  <Input
                    id="fee"
                    type="number"
                    value={newPair.fee}
                    onChange={(e) => setNewPair({ ...newPair, fee: e.target.value })}
                    placeholder="0.1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPair} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Pair'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Trading Pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Trading Pairs
          </CardTitle>
          <CardDescription>
            Configure trading pairs, fees, and rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pairs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trading pairs configured</p>
              <p className="text-sm mt-2">Add a trading pair to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pairs.map((pair: any) => (
                <div
                  key={pair.symbol}
                  className="p-4 border rounded-lg hover:bg-muted/50"
                >
                  {editingPair === pair.symbol ? (
                    <PairEditor
                      pair={pair}
                      onSave={handleSavePair}
                      onCancel={() => setEditingPair(null)}
                      isSaving={updateMutation.isPending}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">{pair.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {pair.baseCurrency}/{pair.quoteCurrency}
                          </div>
                        </div>
                        <Badge
                          variant={
                            pair.status === 'active'
                              ? 'default'
                              : pair.status === 'maintenance'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {pair.status}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          Min: {pair.minOrderSize} | Max: {pair.maxOrderSize} | Fee: {pair.fee}%
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPair(pair.symbol)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePair(pair.symbol)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Rules</CardTitle>
          <CardDescription>
            Configure trading rules and restrictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Trading rules configuration will be displayed here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PairEditor({ pair, onSave, onCancel, isSaving }: any) {
  const [editedPair, setEditedPair] = useState(pair);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min Order Size</Label>
          <Input
            type="number"
            value={editedPair.minOrderSize}
            onChange={(e) => setEditedPair({ ...editedPair, minOrderSize: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Max Order Size</Label>
          <Input
            type="number"
            value={editedPair.maxOrderSize}
            onChange={(e) => setEditedPair({ ...editedPair, maxOrderSize: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tick Size</Label>
          <Input
            type="number"
            value={editedPair.tickSize}
            onChange={(e) => setEditedPair({ ...editedPair, tickSize: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <Label>Fee (%)</Label>
          <Input
            type="number"
            value={editedPair.fee}
            onChange={(e) => setEditedPair({ ...editedPair, fee: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <select
          value={editedPair.status}
          onChange={(e) => setEditedPair({ ...editedPair, status: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onSave(editedPair)}
          disabled={isSaving}
          size="sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
