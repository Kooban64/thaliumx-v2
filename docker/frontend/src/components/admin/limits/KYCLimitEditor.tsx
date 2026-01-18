'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { type KYCLimits } from '@/lib/api/hooks/useLimits';
import { LimitPreview } from './LimitPreview';
import { LimitValidator } from './LimitValidator';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

interface KYCLimitEditorProps {
  level: string;
  limits: KYCLimits;
  onSave: (limits: KYCLimits) => Promise<void>;
  isSaving: boolean;
}

/**
 * KYCLimitEditor - Edit limits for a specific KYC level
 */
export function KYCLimitEditor({ level, limits: initialLimits, onSave, isSaving }: KYCLimitEditorProps) {
  const [limits, setLimits] = useState<KYCLimits>(initialLimits);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLimits(initialLimits);
    setHasChanges(false);
  }, [initialLimits, level]);

  const validateLimit = (value: string): string | null => {
    const numValue = parseFloat(value);
    if (value && (isNaN(numValue) || numValue < 0)) {
      return 'Must be a positive number';
    }
    return null;
  };

  const handleChange = (key: keyof KYCLimits, value: string) => {
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
        description: 'KYC level limits have been saved successfully',
      });
    } catch (error) {
      logRuntimeError(error, 'KYCLimitEditor', { action: 'saveLimits', level });
      toast({
        type: 'error',
        title: 'Failed to save limits',
        description: error instanceof Error ? error.message : 'Failed to save KYC level limits',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure {level} Limits</CardTitle>
          <CardDescription>
            Set maximum transaction limits for {level} KYC level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Max Investment */}
          <div className="space-y-2">
            <Label htmlFor="maxInvestment">Max Investment</Label>
            <Input
              id="maxInvestment"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxInvestment || ''}
              onChange={(e) => handleChange('maxInvestment', e.target.value)}
              placeholder="Enter maximum investment amount"
            />
            {errors.maxInvestment && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errors.maxInvestment}
              </div>
            )}
          </div>

          {/* Max Trading */}
          <div className="space-y-2">
            <Label htmlFor="maxTrading">Max Trading</Label>
            <Input
              id="maxTrading"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxTrading || ''}
              onChange={(e) => handleChange('maxTrading', e.target.value)}
              placeholder="Enter maximum trading amount"
            />
            {errors.maxTrading && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errors.maxTrading}
              </div>
            )}
          </div>

          {/* Max Withdrawal */}
          <div className="space-y-2">
            <Label htmlFor="maxWithdrawal">Max Withdrawal</Label>
            <Input
              id="maxWithdrawal"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxWithdrawal || ''}
              onChange={(e) => handleChange('maxWithdrawal', e.target.value)}
              placeholder="Enter maximum withdrawal amount"
            />
            {errors.maxWithdrawal && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errors.maxWithdrawal}
              </div>
            )}
          </div>

          {/* Max Deposit */}
          <div className="space-y-2">
            <Label htmlFor="maxDeposit">Max Deposit</Label>
            <Input
              id="maxDeposit"
              type="number"
              min="0"
              step="0.01"
              value={limits.maxDeposit || ''}
              onChange={(e) => handleChange('maxDeposit', e.target.value)}
              placeholder="Enter maximum deposit amount"
            />
            {errors.maxDeposit && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errors.maxDeposit}
              </div>
            )}
          </div>

          {/* Max Daily Transactions */}
          <div className="space-y-2">
            <Label htmlFor="maxDailyTransactions">Max Daily Transactions</Label>
            <Input
              id="maxDailyTransactions"
              type="number"
              min="0"
              step="1"
              value={limits.maxDailyTransactions || ''}
              onChange={(e) => handleChange('maxDailyTransactions', e.target.value)}
              placeholder="Enter maximum daily transactions count"
            />
            {errors.maxDailyTransactions && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errors.maxDailyTransactions}
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
      </Card>

      {/* Preview Changes */}
      {hasChanges && (
        <>
          <LimitPreview
            level={level}
            currentLimits={initialLimits}
            newLimits={limits}
          />
          <LimitValidator
            type="kyc"
            target={level}
            limits={limits}
          />
        </>
      )}
    </div>
  );
}
