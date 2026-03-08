'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useBrokerFinancialReports, useGenerateBrokerReport } from '@/lib/api/hooks/useBroker';
import { Loader2, FileText, Download, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

interface FinancialReportItem {
  id: string;
  type: string;
  period: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  downloadUrl?: string;
}

function isFinancialReportItem(value: unknown): value is FinancialReportItem {
  if (!value || typeof value !== 'object') return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.id === 'string' &&
    typeof report.type === 'string' &&
    typeof report.period === 'string' &&
    typeof report.status === 'string' &&
    typeof report.createdAt === 'string'
  );
}

// Date formatting utility
const formatDateTime = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * BrokerFinancialReports - Financial reports with full functionality
 */
export function BrokerFinancialReports() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const limit = 20;

  const { data, isLoading, error } = useBrokerFinancialReports({
    page,
    limit,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  });

  const generateMutation = useGenerateBrokerReport();

  const reports: FinancialReportItem[] = Array.isArray(data?.data)
    ? (data.data as unknown[]).filter(isFinancialReportItem)
    : [];
  const pagination = data?.pagination;

  const reportTypes = [
    { id: 'revenue', name: 'Revenue Report', description: 'Revenue and income summary' },
    { id: 'transaction', name: 'Transaction Report', description: 'All transaction details' },
    { id: 'balance', name: 'Balance Report', description: 'Account balance summary' },
    { id: 'profit-loss', name: 'Profit & Loss Report', description: 'Profit and loss statement' },
  ];

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Please select a report type',
      });
      return;
    }

    try {
      await generateMutation.mutateAsync({
        type: selectedReportType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      toast({
        type: 'success',
        title: 'Report generation started',
        description: 'Your report is being generated. You will be notified when it is ready.',
      });
      setShowGenerateDialog(false);
      setSelectedReportType('');
      setStartDate('');
      setEndDate('');
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to generate report',
        description: err instanceof Error ? err.message : 'Failed to generate report',
      });
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/broker/financial/reports/${reportId}`);
      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        type: 'success',
        title: 'Report downloaded',
        description: 'Financial report has been downloaded',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Failed to download report',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: LucideIcon }> = {
      generating: { variant: 'outline', icon: Clock },
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || variants.generating!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
            <p className="text-destructive mb-4">Failed to load financial reports</p>
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
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">View revenue and financial reports</p>
        </div>
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Financial Report</DialogTitle>
              <DialogDescription>
                Select report type and date range
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Report Type</label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select report type...</option>
                  {reportTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date (Optional)</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date (Optional)</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateReport}
                disabled={generateMutation.isPending || !selectedReportType}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Report'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportTypes.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                {type.name}
              </CardTitle>
              <CardDescription>{type.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedReportType(type.id);
                  setShowGenerateDialog(true);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Report Types</option>
            {reportTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm mt-2">Generate a report to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        {getStatusBadge(report.status)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {reportTypes.find(t => t.id === report.type)?.name || report.type}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Period: {report.period}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {formatDateTime(report.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.status === 'completed' && report.downloadUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(report.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {report.status === 'generating' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </div>
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
