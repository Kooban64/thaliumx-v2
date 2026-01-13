'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrokerTransactionMonitoring } from '@/lib/api/hooks/useBroker';
import { Loader2, AlertTriangle, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

const formatDateTime = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * BrokerTransactionMonitoring - Monitor suspicious transactions with full functionality
 */
export function BrokerTransactionMonitoring() {
  const [page, setPage] = useState(1);
  const [riskScoreFilter, setRiskScoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, isLoading, error } = useBrokerTransactionMonitoring({
    page,
    limit,
    riskScore: riskScoreFilter !== 'all' ? parseInt(riskScoreFilter) : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const transactions = data?.data || [];
  const pagination = data?.pagination;

  const handleInvestigate = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/broker/compliance/monitoring/${transactionId}/investigate`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark for investigation');
      }
      toast({
        type: 'success',
        title: 'Transaction flagged',
        description: 'Transaction has been marked for investigation',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to flag transaction',
        description: err instanceof Error ? err.message : 'Failed to mark transaction for investigation',
      });
    }
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 80) {
      return <Badge variant="destructive">High Risk</Badge>;
    } else if (riskScore >= 50) {
      return <Badge variant="secondary">Medium Risk</Badge>;
    } else {
      return <Badge variant="outline">Low Risk</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      reviewed: 'secondary',
      resolved: 'default',
      false_positive: 'default',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </Badge>
    );
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
            <p className="text-destructive mb-4">Failed to load transaction monitoring data</p>
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
      <div>
        <h1 className="text-3xl font-bold">Transaction Monitoring</h1>
        <p className="text-muted-foreground">Monitor suspicious transactions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={riskScoreFilter} onValueChange={setRiskScoreFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Risk Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="80">High Risk (80+)</SelectItem>
                <SelectItem value="50">Medium Risk (50-79)</SelectItem>
                <SelectItem value="0">Low Risk (0-49)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="false_positive">False Positive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Suspicious Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Suspicious Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No suspicious transactions found</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {transactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        {getRiskBadge(transaction.riskScore)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {transaction.type} - {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          User ID: {transaction.userId} | {formatDateTime(transaction.createdAt)}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {transaction.flags.map((flag: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {transaction.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInvestigate(transaction.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Investigate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!pagination.hasNext}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
