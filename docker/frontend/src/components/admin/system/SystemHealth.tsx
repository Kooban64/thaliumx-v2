'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSystemHealth } from '@/lib/api/hooks/useAdmin';
import { Activity, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

interface SystemHealth {
  status?: string;
  services?: Record<string, string>;
  uptime?: number;
  timestamp?: string;
}

/**
 * SystemHealth - Detailed system health monitoring
 */
export function SystemHealth() {
  const queryClient = useQueryClient();
  const { data: health, isLoading, refetch } = useSystemHealth();
  const healthData = health as SystemHealth | undefined;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'health'] });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">
            Monitor system services and dependencies
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(healthData?.status || 'unknown')}
                <div>
                  <div className="font-semibold text-lg">
                    {healthData?.status?.toUpperCase() || 'UNKNOWN'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last updated: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>
              <Badge className={`${getStatusColor(healthData?.status || 'unknown')} text-lg px-4 py-2`}>
                {healthData?.status?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Individual service health checks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : healthData?.services ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(healthData.services).map(([service, status]: [string, string]) => (
                <div
                  key={service}
                  className={`p-4 border-2 rounded-lg ${getStatusColor(status)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{service.replace(/_/g, ' ')}</span>
                    {getStatusIcon(status)}
                  </div>
                  <Badge className={getStatusColor(status)}>
                    {String(status).toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No service data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      {healthData?.uptime && (
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Uptime</div>
                <div className="text-lg font-semibold">
                  {Math.floor(healthData.uptime / 86400)}d{' '}
                  {Math.floor((healthData.uptime % 86400) / 3600)}h{' '}
                  {Math.floor((healthData.uptime % 3600) / 60)}m
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Last Check</div>
                <div className="text-lg font-semibold">
                  {healthData.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
