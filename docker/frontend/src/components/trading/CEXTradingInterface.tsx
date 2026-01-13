'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { Card, CardContent } from '@/components/ui/card';
import { OrderBook } from './OrderBook';
import { TradingPanel } from './TradingPanel';
import { LightweightChart } from '@/components/LightweightChart';
import { OpenOrders } from './OpenOrders';
import { OrderHistory } from './OrderHistory';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Gift } from 'lucide-react';

/**
 * CEXTradingInterface - Native CEX trading interface
 * Features: THAL token rewards, liquidity incentives, advanced order types
 */
export function CEXTradingInterface() {
  const { selectedSymbol, fetchOrders, fetchOpenOrders, fetchOrderHistory } = useTradingStore();

  useEffect(() => {
    // Fetch initial data
    fetchOrders();
    fetchOpenOrders();
    fetchOrderHistory();
  }, [selectedSymbol, fetchOrders, fetchOpenOrders, fetchOrderHistory]);

  return (
    <div className="space-y-6">
      {/* CEX Features Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="font-semibold">THAL Token Rewards</span>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Liquidity incentives available</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
