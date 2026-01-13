'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, Loader2 } from 'lucide-react';
import { type UserOverride, type KYCLimits } from '@/lib/api/hooks/useLimits';
import { toast } from '@/components/shared/Toast';

interface OverrideEditorProps {
  onSave: (override: Omit<UserOverride, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * OverrideEditor - Create or edit user limit override
 */
export function OverrideEditor({ onSave, onCancel, isSaving }: OverrideEditorProps) {
  const [type, setType] = useState<'temporary' | 'permanent'>('permanent');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [limits, setLimits] = useState<KYCLimits>({});

  const handleLimitChange = (key: keyof KYCLimits, value: string) => {
    setLimits((prev) => ({
      ...prev,
      [key]: value ? parseFloat(value) : undefined,
    }));
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Please provide a reason for this override',
      });
      return;
    }

    if (type === 'temporary' && !expiresAt) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Please provide an expiry date for temporary overrides',
      });
      return;
    }

    await onSave({
      userId: '', // Will be set by parent
      type,
      limits,
      expiresAt: type === 'temporary' ? expiresAt : undefined,
      reason: reason.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Limit Override</CardTitle>
        <CardDescription>
          Override default limits for a specific user
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Override Type */}
        <div className="space-y-2">
          <Label>Override Type</Label>
          <div className="flex gap-2">
            <Button
              variant={type === 'permanent' ? 'default' : 'outline'}
              onClick={() => {
                setType('permanent');
                setExpiresAt('');
              }}
            >
              Permanent
            </Button>
            <Button
              variant={type === 'temporary' ? 'default' : 'outline'}
              onClick={() => setType('temporary')}
            >
              Temporary
            </Button>
          </div>
        </div>

        {/* Expiry Date (for temporary) */}
        {type === 'temporary' && (
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expiry Date</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        )}

        {/* Limit Fields */}
        <div className="space-y-4">
          <Label>Override Limits</Label>
          
          <div className="space-y-2">
            <Label htmlFor="maxInvestment" className="text-sm">Max Investment</Label>
            <Input
              id="maxInvestment"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxInvestment || ''}
              onChange={(e) => handleLimitChange('maxInvestment', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTrading" className="text-sm">Max Trading</Label>
            <Input
              id="maxTrading"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxTrading || ''}
              onChange={(e) => handleLimitChange('maxTrading', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxWithdrawal" className="text-sm">Max Withdrawal</Label>
            <Input
              id="maxWithdrawal"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxWithdrawal || ''}
              onChange={(e) => handleLimitChange('maxWithdrawal', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDeposit" className="text-sm">Max Deposit</Label>
            <Input
              id="maxDeposit"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxDeposit || ''}
              onChange={(e) => handleLimitChange('maxDeposit', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <Label htmlFor="reason">Reason *</Label>
          <Textarea
            id="reason"
            value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            placeholder="Provide a reason for this override..."
            rows={3}
            required
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !reason.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Override
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
