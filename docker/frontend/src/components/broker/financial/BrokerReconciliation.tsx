'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useReconciliationJobs, useCreateReconciliationJob } from '@/lib/api/hooks/useBroker';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/components/shared/Toast';
// Date formatting utility
const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

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
 * BrokerReconciliation - Reconciliation jobs and reports with full functionality
 */
export function BrokerReconciliation() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const limit = 20;

  const { data, isLoading, error } = useReconciliationJobs({
    page,
    limit,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const createMutation = useCreateReconciliationJob();

  const jobs = data?.data || [];
  const pagination = data?.pagination;

  const handleCreateJob = async () => {
    if (!startDate || !endDate) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Please select both start and end dates',
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        type: 'error',
        title: 'Validation error',
        description: 'Start date must be before end date',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({ startDate, endDate });
      toast({
        type: 'success',
        title: 'Reconciliation job created',
        description: 'The reconciliation job has been started',
      });
      setShowCreateDialog(false);
      setStartDate('');
      setEndDate('');
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to create job',
        description: err instanceof Error ? err.message : 'Failed to create reconciliation job',
      });
    }
  };

  const handleDownloadReport = async (jobId: string) => {
    try {
      const response = await fetch(`/api/broker/financial/reconciliation/jobs/${jobId}/report`);
      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconciliation-report-${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        type: 'success',
        title: 'Report downloaded',
        description: 'Reconciliation report has been downloaded',
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
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending: { variant: 'outline', icon: Clock },
      running: { variant: 'secondary', icon: RefreshCw },
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || variants.pending!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const stats = {
    total: jobs.length,
    successful: jobs.filter((j: any) => j.status === 'completed').length,
    failed: jobs.filter((j: any) => j.status === 'failed').length,
    pending: jobs.filter((j: any) => j.status === 'pending' || j.status === 'running').length,
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
            <p className="text-destructive mb-4">Failed to load reconciliation jobs</p>
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
          <h1 className="text-3xl font-bold">Reconciliation</h1>
          <p className="text-muted-foreground">Manage reconciliation jobs and reports</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Reconciliation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Reconciliation Job</DialogTitle>
              <DialogDescription>
                Select the date range for reconciliation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateJob}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Job'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Jobs</CardTitle>
          <CardDescription>Recent reconciliation job history</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reconciliation jobs found</p>
              <p className="text-sm mt-2">Create a new reconciliation job to get started</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {jobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        {getStatusBadge(job.status)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {formatDate(job.startDate)} - {formatDate(job.endDate)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {formatDateTime(job.createdAt)}
                        </div>
                        {job.discrepancies !== undefined && (
                          <div className="text-sm text-muted-foreground">
                            Discrepancies: {job.discrepancies}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' && job.reportUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(job.id)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Report
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
