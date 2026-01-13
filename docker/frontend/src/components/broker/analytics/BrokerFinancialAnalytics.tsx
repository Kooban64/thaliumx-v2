'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBrokerFinancialAnalytics } from '@/lib/api/hooks/useBroker';
import { Loader2, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

/**
 * BrokerFinancialAnalytics - Financial analytics with full functionality
 */
export function BrokerFinancialAnalytics() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data, isLoading, error } = useBrokerFinancialAnalytics({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const analytics = data || {
    revenue: 0,
    expenses: 0,
    profit: 0,
    balance: 0,
  };

  const profitMargin = analytics.revenue > 0
    ? (analytics.profit / analytics.revenue) * 100
    : 0;

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
            <p className="text-destructive mb-4">Failed to load financial analytics</p>
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
          <h1 className="text-3xl font-bold">Financial Analytics</h1>
          <p className="text-muted-foreground">Revenue and financial analytics</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start Date"
            className="w-40"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End Date"
            className="w-40"
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(analytics.revenue)}</div>
            <div className="text-sm text-muted-foreground mt-1">All revenue sources</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(analytics.expenses)}</div>
            <div className="text-sm text-muted-foreground mt-1">All expenses</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              analytics.profit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(analytics.profit)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Revenue - Expenses</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(analytics.balance)}</div>
            <div className="text-sm text-muted-foreground mt-1">Current balance</div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Profit Margin</p>
                <p className="text-sm text-muted-foreground">
                  Profit as percentage of revenue
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${
                  profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(profitMargin)}
                </div>
                <Badge variant={profitMargin >= 20 ? 'default' : profitMargin >= 10 ? 'secondary' : 'destructive'}>
                  {profitMargin >= 20 ? 'Excellent' : profitMargin >= 10 ? 'Good' : 'Low'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Expense Ratio</p>
                <p className="text-sm text-muted-foreground">
                  Expenses as percentage of revenue
                </p>
              </div>
              <div className="text-2xl font-bold">
                {analytics.revenue > 0
                  ? formatPercent((analytics.expenses / analytics.revenue) * 100)
                  : '0%'}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Revenue Efficiency</p>
                <p className="text-sm text-muted-foreground">
                  Revenue per dollar of expenses
                </p>
              </div>
              <div className="text-2xl font-bold">
                {analytics.expenses > 0
                  ? `$${((analytics.revenue / analytics.expenses)).toFixed(2)}`
                  : '$0.00'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
