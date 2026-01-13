'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBrokerMarketData } from '@/lib/api/hooks/useBroker';
import { Loader2, TrendingUp, TrendingDown, Search, RefreshCw } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
};

const formatPercent = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

/**
 * BrokerMarketData - Display market data for broker with full functionality
 */
export function BrokerMarketData() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useBrokerMarketData(selectedSymbol || undefined);

  const marketData = data?.data || [];
  const tradingPairs = data?.pairs || [];

  const filteredPairs = tradingPairs.filter((pair: any) =>
    pair.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = () => {
    refetch();
    toast({
      type: 'success',
      title: 'Market data refreshed',
      description: 'Market data has been updated',
    });
  };

  if (isLoading && !data) {
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
            <p className="text-destructive mb-4">Failed to load market data</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Retry
            </button>
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
          <h1 className="text-3xl font-bold">Market Data</h1>
          <p className="text-muted-foreground">View trading pairs and market analytics</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 border rounded-md hover:bg-muted flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Trading Pairs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Market Data Overview */}
      {marketData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketData.slice(0, 6).map((market: any) => (
            <Card key={market.symbol}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{market.symbol}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {formatCurrency(market.price)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    market.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {market.change24h >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatPercent(market.change24h)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Volume 24h: {formatCurrency(market.volume24h)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    High: {formatCurrency(market.high24h)} | Low: {formatCurrency(market.low24h)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trading Pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trading Pairs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPairs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trading pairs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Symbol</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-right p-3 text-sm font-medium">Min Order</th>
                    <th className="text-right p-3 text-sm font-medium">Max Order</th>
                    <th className="text-right p-3 text-sm font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPairs.map((pair: any) => (
                    <tr
                      key={pair.symbol}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedSymbol(pair.symbol)}
                    >
                      <td className="p-3 text-sm font-medium">{pair.symbol}</td>
                      <td className="p-3">
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
                      </td>
                      <td className="p-3 text-sm text-right">{pair.minOrderSize}</td>
                      <td className="p-3 text-sm text-right">{pair.maxOrderSize}</td>
                      <td className="p-3 text-sm text-right">{pair.fee}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
