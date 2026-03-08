'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSystemHealth } from '@/lib/api/hooks/useAdmin';
import { Activity, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * SystemHealthCard - Display system health status
 */
interface SystemHealth {
  status?: string;
  services?: Record<string, string>;
  uptime?: number;
}

export function SystemHealthCard() {
  const { data: health, isLoading } = useSystemHealth();
  const healthData = health as SystemHealth | undefined;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Service status and dependencies</CardDescription>
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
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
        <CardDescription>Service status and dependencies</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Status</span>
          <Badge className={getStatusColor(healthData?.status || 'unknown')}>
            <div className="flex items-center gap-1">
              {getStatusIcon(healthData?.status || 'unknown')}
              {healthData?.status?.toUpperCase() || 'UNKNOWN'}
            </div>
          </Badge>
        </div>

        {/* Services */}
        {healthData?.services && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm font-medium mb-2">Services</div>
            {Object.entries(healthData.services).map(([service, status]: [string, string]) => (
              <div key={service} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground capitalize">{service.replace(/_/g, ' ')}</span>
                <Badge className={getStatusColor(status)}>
                  {getStatusIcon(status)}
                  <span className="ml-1">{String(status).toUpperCase()}</span>
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Uptime */}
        {healthData?.uptime && (
          <div className="pt-2 border-t text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium">
                {Math.floor(healthData.uptime / 3600)}h {Math.floor((healthData.uptime % 3600) / 60)}m
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
