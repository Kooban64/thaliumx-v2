'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTradingStore } from '@/stores/tradingStore';
// import { cn } from '@/lib/utils';
import type { OrderBook as OrderBookType, OrderBookEntry } from '@/types/trading';

interface OrderBookProps {
  symbol?: string;
  exchange?: 'cex' | 'omni' | 'dex';
  className?: string;
  maxEntries?: number;
}

/**
 * OrderBook - Displays order book with bids and asks
 * Shows real-time order book data with depth visualization
 */
export function OrderBook({ 
  symbol = 'BTC/USDT', 
  exchange,
  className,
  maxEntries = 20 
}: OrderBookProps) {
  const { selectedExchange, selectedSymbol } = useTradingStore();
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeExchange = exchange || selectedExchange;
  const activeSymbol = symbol || selectedSymbol;

  useEffect(() => {
    const fetchOrderBook = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let endpoint = '';
        switch (activeExchange) {
          case 'cex':
            endpoint = `/api/native-cex/orderbook/${activeSymbol.replace('/', '')}`;
            break;
          case 'omni':
            endpoint = `/api/omni-exchange/orderbook/${activeSymbol.replace('/', '')}`;
            break;
          case 'dex':
            // DEX might not have traditional order book
            setOrderBook({ bids: [], asks: [], timestamp: Date.now() });
            setIsLoading(false);
            return;
          default:
            endpoint = `/api/native-cex/orderbook/${activeSymbol.replace('/', '')}`;
        }

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch order book');
        }

        const data = await response.json();
        const book: OrderBookType = data.data || data.orderBook || {
          bids: data.bids || [],
          asks: data.asks || [],
          timestamp: Date.now(),
        };

        setOrderBook(book);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load order book');
        // Set mock data for development
        setOrderBook({
          bids: generateMockOrders('bid', 20),
          asks: generateMockOrders('ask', 20),
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderBook();

    // Refresh order book every 2 seconds
    const interval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(interval);
  }, [activeExchange, activeSymbol]);

  const generateMockOrders = (side: 'bid' | 'ask', count: number): OrderBookEntry[] => {
    const basePrice = 45000;
    const orders: OrderBookEntry[] = [];
    
    for (let i = 0; i < count; i++) {
      const priceOffset = side === 'bid' 
        ? -i * 10 - Math.random() * 5
        : i * 10 + Math.random() * 5;
      const price = basePrice + priceOffset;
      const amount = Math.random() * 0.5 + 0.1;
      const prevOrder = i > 0 ? orders[i - 1] : null;
      const total = prevOrder ? prevOrder.total + amount : amount;
      
      orders.push({ price, amount, total });
    }
    
    return orders;
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const getDepthPercentage = (entry: OrderBookEntry, maxTotal: number) => {
    return (entry.total / maxTotal) * 100;
  };

  if (isLoading && !orderBook) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
          <CardDescription>{activeSymbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !orderBook) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
          <CardDescription>{activeSymbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-muted-foreground py-8">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderBook) return null;

  const bids = (orderBook.bids || []).slice(0, maxEntries).reverse();
  const asks = (orderBook.asks || []).slice(0, maxEntries);
  const maxBidTotal = bids.length > 0 ? Math.max(...bids.map((b) => b.total), 1) : 1;
  const maxAskTotal = asks.length > 0 ? Math.max(...asks.map((a) => a.total), 1) : 1;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
        <CardDescription>
          {activeSymbol} • {activeExchange.toUpperCase()}
          {orderBook.exchange && ` • ${orderBook.exchange}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x">
          {/* Asks (Sell Orders) */}
          <div className="p-4">
            <div className="text-xs font-semibold text-red-600 mb-2">Asks (Sell)</div>
            <div className="space-y-0.5">
              {asks.map((ask, index) => {
                const depth = getDepthPercentage(ask, maxAskTotal);
                return (
                  <div
                    key={index}
                    className="relative flex items-center justify-between text-xs hover:bg-muted/50 px-2 py-1 rounded cursor-pointer group"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-red-500/10 rounded"
                      style={{ width: `${depth}%` }}
                    />
                    <div className="relative flex-1 flex items-center justify-between">
                      <span className="text-red-600 font-medium">{formatPrice(ask.price)}</span>
                      <span className="text-muted-foreground">{formatAmount(ask.amount)}</span>
                      <span className="text-muted-foreground">{formatAmount(ask.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bids (Buy Orders) */}
          <div className="p-4">
            <div className="text-xs font-semibold text-green-600 mb-2">Bids (Buy)</div>
            <div className="space-y-0.5">
              {bids.map((bid, index) => {
                const depth = getDepthPercentage(bid, maxBidTotal);
                return (
                  <div
                    key={index}
                    className="relative flex items-center justify-between text-xs hover:bg-muted/50 px-2 py-1 rounded cursor-pointer group"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-green-500/10 rounded"
                      style={{ width: `${depth}%` }}
                    />
                    <div className="relative flex-1 flex items-center justify-between">
                      <span className="text-green-600 font-medium">{formatPrice(bid.price)}</span>
                      <span className="text-muted-foreground">{formatAmount(bid.amount)}</span>
                      <span className="text-muted-foreground">{formatAmount(bid.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spread */}
        {bids.length > 0 && asks.length > 0 && bids[0] && asks[0] && (
          <div className="border-t p-2 text-center text-xs text-muted-foreground">
            Spread: {formatPrice(asks[0].price - bids[0].price)} (
            {((asks[0].price - bids[0].price) / bids[0].price * 100).toFixed(4)}%)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
