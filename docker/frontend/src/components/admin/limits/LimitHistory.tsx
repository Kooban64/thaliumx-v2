'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLimitHistory, type LimitChange } from '@/lib/api/hooks/useLimits';
import { Loader2, History, Calendar, User } from 'lucide-react';

/**
 * LimitHistory - Display limit change history and audit trail
 */
export function LimitHistory() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('');
  const limit = 20;

  const { data, isLoading } = useLimitHistory({
    page,
    limit,
    type: typeFilter !== 'all' ? (typeFilter as 'kyc' | 'role' | 'user_override') : undefined,
    target: targetFilter || undefined,
  });

  const history = data?.data || [];
  const pagination = data?.pagination;

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      kyc: 'default',
      role: 'secondary',
      user_override: 'outline',
    };
    return (
      <Badge variant={variants[type] || 'outline'}>
        {type.replace('_', ' ').toUpperCase()}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Limit Change History</h1>
        <p className="text-muted-foreground">
          View audit trail of all limit configuration changes
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="kyc">KYC Limits</option>
                <option value="role">Role Limits</option>
                <option value="user_override">User Overrides</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target (Level/Role/User ID)</label>
              <Input
                value={targetFilter}
                onChange={(e) => {
                  setTargetFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by target..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Change History
          </CardTitle>
          <CardDescription>
            Showing {history.length} of {pagination?.total || 0} changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No limit changes found
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((change: LimitChange) => (
                <div
                  key={change.id}
                  className="p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(change.type)}
                      <span className="font-semibold">{change.target}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(change.changedAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {Object.entries(change.changes).map(([key, { before, after }]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-muted-foreground min-w-[150px]">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="line-through text-muted-foreground">
                          {typeof before === 'number' ? before.toLocaleString() : String(before || 'N/A')}
                        </span>
                        <span className="text-foreground font-medium">
                          → {typeof after === 'number' ? after.toLocaleString() : String(after || 'N/A')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Changed by: {change.changedBy}
                    </div>
                    {change.reason && (
                      <span>Reason: {change.reason}</span>
                    )}
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
