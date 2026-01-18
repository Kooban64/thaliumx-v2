'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTradingStore } from '@/stores/tradingStore';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types/trading';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

/**
 * OpenOrders - Displays list of open orders with cancel functionality
 */
export function OpenOrders() {
  const { openOrders, isLoading, cancelOrder, fetchOpenOrders } = useTradingStore();

  useEffect(() => {
    fetchOpenOrders();
    // Refresh open orders every 5 seconds
    const interval = setInterval(fetchOpenOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOpenOrders]);

  const handleCancel = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      fetchOpenOrders();
      toast({
        type: 'success',
        title: 'Order cancelled',
        description: 'The order has been cancelled successfully',
      });
    } catch (error) {
      logRuntimeError(error, 'OpenOrders', { action: 'cancelOrder', orderId });
      toast({
        type: 'error',
        title: 'Failed to cancel order',
        description: error instanceof Error ? error.message : 'Failed to cancel order',
      });
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'open':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return 'Market';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Orders</CardTitle>
        <CardDescription>Your active trading orders</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && openOrders.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : openOrders.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No open orders
          </div>
        ) : (
          <div className="space-y-2">
            {openOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'font-semibold',
                      order.side === 'buy' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {order.side.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{order.symbol}</span>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-x-2">
                    <span>Price: {formatPrice(order.price)}</span>
                    <span>Amount: {formatAmount(order.amount)}</span>
                    {order.filledAmount > 0 && (
                      <span>Filled: {formatAmount(order.filledAmount)}</span>
                    )}
                  </div>
                  {order.exchangeName && (
                    <div className="text-xs text-muted-foreground">
                      Exchange: {order.exchangeName}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancel(order.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
