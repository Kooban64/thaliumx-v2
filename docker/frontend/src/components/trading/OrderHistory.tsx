'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTradingStore } from '@/stores/tradingStore';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types/trading';

/**
 * OrderHistory - Displays order history with pagination
 */
export function OrderHistory() {
  const { orderHistory, isLoading, fetchOrderHistory } = useTradingStore();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    fetchOrderHistory();
  }, [fetchOrderHistory]);

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'filled':
        return 'bg-green-100 text-green-800';
      case 'partially_filled':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const paginatedOrders = orderHistory.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(orderHistory.length / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
        <CardDescription>Your completed and cancelled orders</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && orderHistory.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orderHistory.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No order history
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedOrders.map((order) => (
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
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-x-2">
                      <span>Price: {formatPrice(order.price)}</span>
                      <span>Amount: {formatAmount(order.amount)}</span>
                      {order.averagePrice && (
                        <span>Avg: {formatPrice(order.averagePrice)}</span>
                      )}
                      <span>Fee: {order.fee.toFixed(4)} {order.feeCurrency}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                      {order.executedAt && ` • Executed: ${formatDate(order.executedAt)}`}
                    </div>
                    {order.exchangeName && (
                      <div className="text-xs text-muted-foreground">
                        Exchange: {order.exchangeName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
