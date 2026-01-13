'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import type { Transaction } from '@/types/wallet';

interface TransactionDetailsProps {
  transaction: Transaction;
  onClose: () => void;
}

/**
 * TransactionDetails - Display detailed transaction information
 */
export function TransactionDetails({ transaction, onClose }: TransactionDetailsProps) {
  const [copied, setCopied] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getBlockExplorerUrl = (txHash: string, network?: string) => {
    if (!txHash) return null;
    
    const networkLower = network?.toLowerCase() || '';
    if (networkLower.includes('ethereum') || networkLower.includes('evm')) {
      return `https://etherscan.io/tx/${txHash}`;
    }
    if (networkLower.includes('bitcoin') || networkLower.includes('btc')) {
      return `https://blockstream.info/tx/${txHash}`;
    }
    return null;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transaction Details
            <Badge className={getStatusColor(transaction.status)}>
              {transaction.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {transaction.type.toUpperCase()} • {formatDate(transaction.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Amount</div>
            <div className="text-2xl font-bold">
              {transaction.type === 'deposit' ? '+' : '-'}
              {transaction.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              })}{' '}
              {transaction.currency}
            </div>
            {transaction.exchangeRate && (
              <div className="text-sm text-muted-foreground mt-1">
                ≈ ${(transaction.amount * transaction.exchangeRate).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            )}
          </div>

          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Type</div>
              <div className="font-medium">{transaction.type.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge className={getStatusColor(transaction.status)}>
                {transaction.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Fee</div>
              <div className="font-medium">
                {transaction.fee} {transaction.feeCurrency}
              </div>
            </div>
            {transaction.confirmations !== undefined && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Confirmations</div>
                <div className="font-medium">{transaction.confirmations}</div>
              </div>
            )}
          </div>

          {/* Addresses */}
          {(transaction.fromAddress || transaction.toAddress) && (
            <div className="space-y-3">
              {transaction.fromAddress && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">From Address</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm break-all bg-muted p-2 rounded">
                      {transaction.fromAddress}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(transaction.fromAddress!, 'from')}
                    >
                      {copied === 'from' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {transaction.toAddress && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">To Address</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm break-all bg-muted p-2 rounded">
                      {transaction.toAddress}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(transaction.toAddress!, 'to')}
                    >
                      {copied === 'to' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Hash */}
          {transaction.txHash && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Transaction Hash</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm break-all bg-muted p-2 rounded">
                  {transaction.txHash}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(transaction.txHash!, 'hash')}
                >
                  {copied === 'hash' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {getBlockExplorerUrl(transaction.txHash, transaction.metadata?.network) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a
                      href={getBlockExplorerUrl(transaction.txHash, transaction.metadata?.network)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Created</div>
              <div className="text-sm">{formatDate(transaction.createdAt)}</div>
            </div>
            {transaction.completedAt && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Completed</div>
                <div className="text-sm">{formatDate(transaction.completedAt)}</div>
              </div>
            )}
          </div>

          {/* Metadata */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-2">Additional Information</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {transaction.metadata.description && (
                  <div>Description: {transaction.metadata.description}</div>
                )}
                {transaction.metadata.reference && (
                  <div>Reference: {transaction.metadata.reference}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
