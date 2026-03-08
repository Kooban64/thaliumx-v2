'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBrokerAuditLogs } from '@/lib/api/hooks/useBroker';
import { Loader2, FileText } from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  createdAt?: string;
  timestamp?: string;
  userId?: string;
}

function isAuditLogItem(value: unknown): value is AuditLogItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.action === 'string';
}

/**
 * BrokerAuditLogs - View broker audit logs
 */
export function BrokerAuditLogs() {
  const [page] = useState(1);
  const { data, isLoading } = useBrokerAuditLogs({ page, limit: 20 });

  const logs: AuditLogItem[] = Array.isArray(data?.data)
    ? (data.data as unknown[]).filter(isAuditLogItem)
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
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">View broker events and audit trail</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs ({pagination?.total || 0})
          </CardTitle>
          <CardDescription>
            Showing {logs.length} of {pagination?.total || 0} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="p-3 border rounded text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground">
                      {new Date(log.createdAt || log.timestamp || Date.now()).toLocaleString()}
                    </span>
                  </div>
                  {log.userId && (
                    <div className="text-muted-foreground mt-1">
                      User: {log.userId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
