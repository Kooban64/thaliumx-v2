'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrokerLedger } from '@/lib/api/hooks/useBroker';
import { Loader2, BookOpen, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/components/shared/Toast';
// Date formatting utility
const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

/**
 * BrokerLedger - View broker ledger with full functionality
 */
export function BrokerLedger() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const limit = 20;

  const { data, isLoading, error } = useBrokerLedger({
    page,
    limit,
    search: search || undefined,
    accountType: accountType !== 'all' ? accountType : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const entries = data?.entries || [];
  const summary = data?.summary;
  const pagination = data?.pagination;

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/broker/financial/ledger/export?${new URLSearchParams({
        accountType: accountType !== 'all' ? accountType : '',
        startDate: startDate || '',
        endDate: endDate || '',
        search: search || '',
      }).toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        type: 'success',
        title: 'Export successful',
        description: 'Ledger data has been exported',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Failed to export ledger data',
      });
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getAccountTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-green-500/10 text-green-500',
      liability: 'bg-red-500/10 text-red-500',
      equity: 'bg-blue-500/10 text-blue-500',
      revenue: 'bg-purple-500/10 text-purple-500',
      expense: 'bg-orange-500/10 text-orange-500',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-500/10 text-gray-500'}>
        {type}
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
            <p className="text-destructive mb-4">Failed to load ledger data</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Broker Ledger</h1>
          <p className="text-muted-foreground">View account balances and ledger entries</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalAssets)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalLiabilities)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Net Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalEquity)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts or transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue placeholder="Account Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ledger Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Ledger Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ledger entries found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">Date</th>
                      <th className="text-left p-3 text-sm font-medium">Account</th>
                      <th className="text-left p-3 text-sm font-medium">Type</th>
                      <th className="text-right p-3 text-sm font-medium">Debit</th>
                      <th className="text-right p-3 text-sm font-medium">Credit</th>
                      <th className="text-right p-3 text-sm font-medium">Balance</th>
                      <th className="text-left p-3 text-sm font-medium">Description</th>
                      <th className="text-left p-3 text-sm font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="p-3 text-sm font-medium">{entry.accountName}</td>
                        <td className="p-3">{getAccountTypeBadge(entry.accountType)}</td>
                        <td className="p-3 text-sm text-right">
                          {entry.debit > 0 ? formatCurrency(entry.debit, entry.currency) : '-'}
                        </td>
                        <td className="p-3 text-sm text-right">
                          {entry.credit > 0 ? formatCurrency(entry.credit, entry.currency) : '-'}
                        </td>
                        <td className="p-3 text-sm text-right font-medium">
                          {formatCurrency(entry.balance, entry.currency)}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{entry.description}</td>
                        <td className="p-3 text-sm text-muted-foreground font-mono text-xs">
                          {entry.reference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
