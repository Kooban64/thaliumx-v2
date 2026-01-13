'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { type KYCLimits } from '@/lib/api/hooks/useLimits';

interface LimitPreviewProps {
  level: string;
  currentLimits: KYCLimits;
  newLimits: KYCLimits;
}

/**
 * LimitPreview - Preview changes before saving
 */
export function LimitPreview({ level, currentLimits, newLimits }: LimitPreviewProps) {
  const getChangeIndicator = (current: number | undefined, newValue: number | undefined) => {
    if (current === undefined && newValue === undefined) return null;
    if (current === undefined && newValue !== undefined) {
      return <Badge variant="default" className="ml-2">New</Badge>;
    }
    if (current !== undefined && newValue === undefined) {
      return <Badge variant="destructive" className="ml-2">Removed</Badge>;
    }
    if (current === newValue) return null;
    if ((newValue || 0) > (current || 0)) {
      return <TrendingUp className="h-4 w-4 ml-2 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 ml-2 text-red-500" />;
  };

  const formatValue = (value: number | undefined) => {
    if (value === undefined) return 'Not set';
    return value.toLocaleString();
  };

  const limitFields: Array<{ key: keyof KYCLimits; label: string }> = [
    { key: 'maxInvestment', label: 'Max Investment' },
    { key: 'maxTrading', label: 'Max Trading' },
    { key: 'maxWithdrawal', label: 'Max Withdrawal' },
    { key: 'maxDeposit', label: 'Max Deposit' },
    { key: 'maxDailyTransactions', label: 'Max Daily Transactions' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview Changes for {level}</CardTitle>
        <CardDescription>
          Review the changes before saving
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {limitFields.map(({ key, label }) => {
            const current = currentLimits[key] as number | undefined;
            const newValue = newLimits[key] as number | undefined;
            const hasChange = current !== newValue;

            if (!hasChange && current === undefined && newValue === undefined) {
              return null;
            }

            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  hasChange ? 'bg-accent' : 'bg-background'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium">{label}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatValue(current)}</span>
                    {hasChange && (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        <span className="font-semibold text-foreground">
                          {formatValue(newValue)}
                        </span>
                      </>
                    )}
                    {getChangeIndicator(current, newValue)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
