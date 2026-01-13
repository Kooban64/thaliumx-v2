'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrderBook } from './OrderBook';
import { TradingPanel } from './TradingPanel';
import { LightweightChart } from '@/components/LightweightChart';
import { OpenOrders } from './OpenOrders';
import { OrderHistory } from './OrderHistory';
import { ExchangeHealthMonitor } from './ExchangeHealthMonitor';
import { Zap, CheckCircle } from 'lucide-react';

/**
 * OmniTradingInterface - Omni-Exchange trading interface
 * Features: Multi-exchange aggregation, auto-routing, best price guarantee
 */
export function OmniTradingInterface() {
  const { selectedSymbol, fetchOrders, fetchOpenOrders, fetchOrderHistory } = useTradingStore();
  // const [selectedExchange, setSelectedExchange] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchOpenOrders();
    fetchOrderHistory();
  }, [selectedSymbol, fetchOrders, fetchOpenOrders, fetchOrderHistory]);

  return (
    <div className="space-y-6">
      {/* Omni-Exchange Features Banner */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <CardTitle>Omni-Exchange</CardTitle>
            </div>
            <Badge variant="secondary">Auto-Routing Active</Badge>
          </div>
          <CardDescription>
            Multi-exchange aggregator with automatic routing to best prices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Connected Exchanges:</span>
            {['KuCoin', 'Bybit', 'OKX', 'Kraken', 'VALR', 'Bitstamp', 'Crypto.com'].map((exchange) => (
              <Badge key={exchange} variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {exchange}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exchange Health Monitor */}
      <ExchangeHealthMonitor />

      {/* Main Trading Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-0">
              <LightweightChart
                data={[]} // Will be populated with real data
              />
            </CardContent>
          </Card>

          {/* Order History */}
          <OrderHistory />
        </div>

        {/* Right Column: Order Book, Trading Panel, Open Orders */}
        <div className="space-y-6">
          <OrderBook />
          <TradingPanel />
          <OpenOrders />
        </div>
      </div>
    </div>
  );
}
