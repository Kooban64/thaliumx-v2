'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditLogs, type AuditLog } from '@/lib/api/hooks/useAdmin';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface RecentActivityCardProps {
  data?: unknown;
}

/**
 * RecentActivityCard - Display recent admin activity
 */
export function RecentActivityCard({}: RecentActivityCardProps) {
  const router = useRouter();
  const { data: auditLogs, isLoading } = useAuditLogs({ limit: 10 });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest administrative actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest administrative actions</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/compliance/audit')}
          >
            View All
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!auditLogs || auditLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.slice(0, 5).map((log: AuditLog) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{log.action || 'Action'}</span>
                    {log.userId && (
                      <span className="text-xs text-muted-foreground">
                        by User {log.userId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  {log.resource && (
                    <div className="text-xs text-muted-foreground">
                      Resource: {log.resource}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.timestamp || log.createdAt || new Date().toISOString())}
                  </div>
                </div>
                {log.status && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    log.status === 'success' ? 'bg-green-100 text-green-800' :
                    log.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {log.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
