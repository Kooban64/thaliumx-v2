'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBrokerTransactions } from '@/lib/api/hooks/useBroker';
import { Loader2, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react';

interface BrokerTransactionItem {
  id: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
}

function isBrokerTransactionItem(value: unknown): value is BrokerTransactionItem {
  if (!value || typeof value !== 'object') return false;
  const tx = value as Record<string, unknown>;
  return (
    typeof tx.id === 'string' &&
    typeof tx.type === 'string' &&
    typeof tx.amount === 'string' &&
    typeof tx.currency === 'string' &&
    typeof tx.status === 'string' &&
    typeof tx.createdAt === 'string'
  );
}

/**
 * BrokerOrderManagement - Manage orders for broker
 */
export function BrokerOrderManagement() {
  const [page] = useState(1);
  const { data, isLoading } = useBrokerTransactions({ page, limit: 20 });

  const transactions: BrokerTransactionItem[] = Array.isArray(data?.data)
    ? (data.data as unknown[]).filter(isBrokerTransactionItem)
    : [];
  const pagination = data?.pagination;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-muted-foreground">View and manage trading orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Recent Orders
          </CardTitle>
          <CardDescription>
            Showing {transactions.length} of {pagination?.total || 0} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No orders found
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {tx.type === 'buy' ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {tx.type?.toUpperCase()} {tx.amount} {tx.currency}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                    {tx.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
