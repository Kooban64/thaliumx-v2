'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/lib/api/hooks/useWallet';
import { Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Wallet as WalletType } from '@/types/wallet';
import { TransactionDetails } from './TransactionDetails';

interface HotWalletTransactionsProps {
  wallet: WalletType | null;
}

/**
 * HotWalletTransactions - Display transaction history for hot wallet
 */
export function HotWalletTransactions({ wallet }: HotWalletTransactionsProps) {
  const { data: transactions, isLoading } = useTransactions(wallet?.id);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  if (!wallet) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a wallet
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'text-green-600';
      case 'withdrawal':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const paginatedTransactions = (transactions || []).slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil((transactions?.length || 0) / pageSize);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            All transactions for {wallet.currency} wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paginatedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTransaction(tx.id)}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${getTypeColor(tx.type)}`}>
                          {tx.type.toUpperCase()}
                        </span>
                        <Badge className={getStatusColor(tx.status)}>
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-x-2">
                        <span>
                          {tx.type === 'deposit' ? '+' : '-'}
                          {tx.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })}{' '}
                          {tx.currency}
                        </span>
                        {tx.fee > 0 && (
                          <span>Fee: {tx.fee} {tx.feeCurrency}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTransaction(tx.id);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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

      {/* Transaction Details Modal */}
      {selectedTransaction && transactions && (
        <TransactionDetails
          transaction={transactions.find((tx) => tx.id === selectedTransaction)!}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </>
  );
}
