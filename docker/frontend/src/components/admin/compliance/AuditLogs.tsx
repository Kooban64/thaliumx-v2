'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuditLogs, type AuditLog } from '@/lib/api/hooks/useAdmin';
import { Loader2, Search, FileText, Download, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/shared/Toast';

/**
 * AuditLogs - View and filter audit logs with full functionality
 */
export function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');

  const { data: logs, isLoading } = useAuditLogs({
    action: actionFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 100,
  });

  const filteredLogs = logs?.filter((log: AuditLog) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (log.userId && log.userId.toLowerCase().includes(searchLower)) ||
      (log.action && log.action.toLowerCase().includes(searchLower)) ||
      (log.category && log.category.toLowerCase().includes(searchLower)) ||
      (log.changes && JSON.stringify(log.changes).toLowerCase().includes(searchLower))
    );
  }) || [];

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams({
        format: exportFormat,
        action: actionFilter || '',
        startDate: startDate || '',
        endDate: endDate || '',
      });

      const response = await fetch(`/api/admin/audit-logs/export?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        type: 'success',
        title: 'Export successful',
        description: `Audit logs have been exported as ${exportFormat.toUpperCase()}`,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Failed to export audit logs',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            View system activity and change logs
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'csv' | 'json' | 'pdf')}>
            <SelectTrigger className="w-32" aria-label="Export format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleExport}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleExport();
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter audit logs by action, date, and search terms</CardDescription>
            </div>
            {(search || actionFilter || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setActionFilter('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
                  }
                }}
                className="pl-10"
                aria-label="Search audit logs"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger aria-label="Filter by action">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date filter"
            />
            <Input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date filter"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Log Entries
          </CardTitle>
          <CardDescription>
            System activity and change logs ({filteredLogs.length} entries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit log entries found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log: AuditLog) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{log.action || 'Unknown'}</span>
                      {log.category && (
                        <span className="text-sm text-muted-foreground">({log.category})</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    User: {log.userId || 'Unknown'}
                  </div>
                  {log.changes && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        View changes
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </details>
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
