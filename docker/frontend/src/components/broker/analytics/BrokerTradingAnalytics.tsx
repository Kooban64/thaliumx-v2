'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBrokerTradingAnalytics } from '@/lib/api/hooks/useBroker';
import { Loader2, BarChart3, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * BrokerTradingAnalytics - Trading analytics with full functionality
 */
export function BrokerTradingAnalytics() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data, isLoading, error } = useBrokerTradingAnalytics({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const analytics = data || {
    volume24h: 0,
    volume7d: 0,
    volume30d: 0,
    orders24h: 0,
    revenue24h: 0,
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
            <p className="text-destructive mb-4">Failed to load trading analytics</p>
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
          <h1 className="text-3xl font-bold">Trading Analytics</h1>
          <p className="text-muted-foreground">Trading volume and analytics</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              24h Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(analytics.volume24h)}</div>
            <div className="text-sm text-muted-foreground mt-1">Last 24 hours</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              7-Day Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(analytics.volume7d)}</div>
            <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              30-Day Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(analytics.volume30d)}</div>
            <div className="text-sm text-muted-foreground mt-1">Last 30 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              24h Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(analytics.orders24h)}</div>
            <div className="text-sm text-muted-foreground mt-1">Orders in last 24h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              24h Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(analytics.revenue24h)}</div>
            <div className="text-sm text-muted-foreground mt-1">Revenue from fees</div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Average Order Size (24h)</p>
                <p className="text-sm text-muted-foreground">
                  Average transaction size
                </p>
              </div>
              <div className="text-2xl font-bold">
                {analytics.orders24h > 0
                  ? formatCurrency(analytics.volume24h / analytics.orders24h)
                  : formatCurrency(0)}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Revenue Rate</p>
                <p className="text-sm text-muted-foreground">
                  Revenue as % of volume
                </p>
              </div>
              <div className="text-2xl font-bold">
                {analytics.volume24h > 0
                  ? `${((analytics.revenue24h / analytics.volume24h) * 100).toFixed(2)}%`
                  : '0%'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
