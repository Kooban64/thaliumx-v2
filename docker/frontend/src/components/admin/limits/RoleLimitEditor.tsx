'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { type RoleLimits } from '@/lib/api/hooks/useLimits';
import { LimitValidator } from './LimitValidator';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

interface RoleLimitEditorProps {
  role: string;
  limits: RoleLimits;
  onSave: (limits: RoleLimits) => Promise<void>;
  isSaving: boolean;
}

/**
 * RoleLimitEditor - Edit limits for a specific role
 */
export function RoleLimitEditor({ role, limits: initialLimits, onSave, isSaving }: RoleLimitEditorProps) {
  const [limits, setLimits] = useState<RoleLimits>(initialLimits);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLimits(initialLimits);
    setHasChanges(false);
  }, [initialLimits, role]);

  const validateLimit = (value: string): string | null => {
    const numValue = parseFloat(value);
    if (value && (isNaN(numValue) || numValue < 0)) {
      return 'Must be a positive number';
    }
    return null;
  };

  const handleChange = (key: keyof RoleLimits, value: string) => {
    const error = validateLimit(value);
    if (error) {
      setErrors((prev) => ({ ...prev, [key]: error }));
    } else {
      setErrors((prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      }));
    }

    setLimits((prev) => ({
      ...prev,
      [key]: value ? parseFloat(value) : undefined,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.entries(limits).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 0) {
        newErrors[key] = 'Must be a positive number';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSave(limits);
      setHasChanges(false);
      toast({
        type: 'success',
        title: 'Limits saved',
        description: 'Role limits have been saved successfully',
      });
    } catch {
      logRuntimeError(error, 'RoleLimitEditor', { action: 'saveLimits', role });
      toast({
        type: 'error',
        title: 'Failed to save limits',
        description: error instanceof Error ? error.message : 'Failed to save role limits',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure {role.replace(/_/g, ' ')} Limits</CardTitle>
        <CardDescription>
          Set maximum transaction limits for {role} role
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Daily Volume */}
        <div className="space-y-2">
          <Label htmlFor="maxDailyVolume">Max Daily Volume</Label>
          <Input
            id="maxDailyVolume"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxDailyVolume || ''}
            onChange={(e) => handleChange('maxDailyVolume', e.target.value)}
            placeholder="Enter maximum daily volume"
          />
          {errors.maxDailyVolume && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxDailyVolume}
            </div>
          )}
        </div>

        {/* Max Monthly Volume */}
        <div className="space-y-2">
          <Label htmlFor="maxMonthlyVolume">Max Monthly Volume</Label>
          <Input
            id="maxMonthlyVolume"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxMonthlyVolume || ''}
            onChange={(e) => handleChange('maxMonthlyVolume', e.target.value)}
            placeholder="Enter maximum monthly volume"
          />
          {errors.maxMonthlyVolume && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxMonthlyVolume}
            </div>
          )}
        </div>

        {/* Max Single Transaction */}
        <div className="space-y-2">
          <Label htmlFor="maxSingleTransaction">Max Single Transaction</Label>
          <Input
            id="maxSingleTransaction"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxSingleTransaction || ''}
            onChange={(e) => handleChange('maxSingleTransaction', e.target.value)}
            placeholder="Enter maximum single transaction amount"
          />
          {errors.maxSingleTransaction && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxSingleTransaction}
            </div>
          )}
        </div>

        {/* Max Withdrawal Daily */}
        <div className="space-y-2">
          <Label htmlFor="maxWithdrawalDaily">Max Withdrawal Daily</Label>
          <Input
            id="maxWithdrawalDaily"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxWithdrawalDaily || ''}
            onChange={(e) => handleChange('maxWithdrawalDaily', e.target.value)}
            placeholder="Enter maximum daily withdrawal"
          />
          {errors.maxWithdrawalDaily && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxWithdrawalDaily}
            </div>
          )}
        </div>

        {/* Max Withdrawal Monthly */}
        <div className="space-y-2">
          <Label htmlFor="maxWithdrawalMonthly">Max Withdrawal Monthly</Label>
          <Input
            id="maxWithdrawalMonthly"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxWithdrawalMonthly || ''}
            onChange={(e) => handleChange('maxWithdrawalMonthly', e.target.value)}
            placeholder="Enter maximum monthly withdrawal"
          />
          {errors.maxWithdrawalMonthly && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxWithdrawalMonthly}
            </div>
          )}
        </div>

        {/* Max Deposit Daily */}
        <div className="space-y-2">
          <Label htmlFor="maxDepositDaily">Max Deposit Daily</Label>
          <Input
            id="maxDepositDaily"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxDepositDaily || ''}
            onChange={(e) => handleChange('maxDepositDaily', e.target.value)}
            placeholder="Enter maximum daily deposit"
          />
          {errors.maxDepositDaily && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxDepositDaily}
            </div>
          )}
        </div>

        {/* Max Deposit Monthly */}
        <div className="space-y-2">
          <Label htmlFor="maxDepositMonthly">Max Deposit Monthly</Label>
          <Input
            id="maxDepositMonthly"
            type="number"
            min="0"
            step="0.01"
            value={limits.maxDepositMonthly || ''}
            onChange={(e) => handleChange('maxDepositMonthly', e.target.value)}
            placeholder="Enter maximum monthly deposit"
          />
          {errors.maxDepositMonthly && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.maxDepositMonthly}
            </div>
          )}
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            type="text"
            value={limits.currency || 'USD'}
            onChange={(e) => handleChange('currency', e.target.value)}
            placeholder="USD"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || Object.keys(errors).length > 0}
          >
            {isSaving ? (
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
      </CardContent>
      {hasChanges && (
        <CardContent className="pt-0">
          <LimitValidator
            type="role"
            target={role}
            limits={limits}
          />
        </CardContent>
      )}
    </Card>
  );
}
