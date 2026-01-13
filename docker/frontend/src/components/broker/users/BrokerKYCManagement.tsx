'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBrokerKYC } from '@/lib/api/hooks/useBroker';
import { Loader2, FileCheck, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

/**
 * BrokerKYCManagement - Manage KYC reviews and approvals for broker users
 */
export function BrokerKYCManagement() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const limit = 20;

  const { data, isLoading, error } = useBrokerKYC({
    page,
    limit,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const kycRecords = data?.data || [];
  const pagination = data?.pagination;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending_review: { variant: 'secondary', icon: Clock },
      approved: { variant: 'default', icon: CheckCircle },
      rejected: { variant: 'destructive', icon: XCircle },
      not_started: { variant: 'outline', icon: FileCheck },
    };

    const config = statusConfig[status] || statusConfig.not_started!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getKYCLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      L0: 'bg-gray-500',
      L1: 'bg-blue-500',
      L2: 'bg-green-500',
      L3: 'bg-purple-500',
      INSTITUTIONAL: 'bg-yellow-500',
    };
    return (
      <Badge className={colors[level] || 'bg-gray-500'}>
        {level}
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
          <div className="text-center text-destructive">
            Failed to load KYC records: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = kycRecords.filter((r: any) => r.kycStatus === 'pending_review').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">KYC Management</h1>
        <p className="text-muted-foreground">
          Review and manage KYC applications for broker users
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Pending Review</div>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Records</div>
                <div className="text-2xl font-bold">{pagination?.total || 0}</div>
              </div>
              <FileCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Approved</div>
                <div className="text-2xl font-bold">
                  {kycRecords.filter((r: any) => r.kycStatus === 'approved').length}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Status</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="not_started">Not Started</option>
          </select>
        </CardContent>
      </Card>

      {/* KYC Records */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Records</CardTitle>
          <CardDescription>
            Showing {kycRecords.length} of {pagination?.total || 0} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kycRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No KYC records found
            </div>
          ) : (
            <div className="space-y-4">
              {kycRecords.map((record: any) => (
                <div
                  key={record.userId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/broker/users/${record.userId}`}
                          className="font-semibold hover:underline"
                        >
                          {record.name || record.email}
                        </Link>
                        {getStatusBadge(record.kycStatus)}
                        {getKYCLevelBadge(record.kycLevel || 'L0')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {record.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Updated: {new Date(record.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.kycStatus === 'pending_review' && (
                      <Button variant="default" size="sm">
                        Review
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/broker/users/${record.userId}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
