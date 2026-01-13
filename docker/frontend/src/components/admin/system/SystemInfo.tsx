'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemInfo } from '@/lib/api/hooks/useAdmin';
import { Loader2, Server, Cpu, HardDrive, MemoryStick } from 'lucide-react';

interface SystemInfo {
  node?: {
    version?: string;
    platform?: string;
    arch?: string;
  };
  os?: {
    type?: string;
    platform?: string;
    arch?: string;
    release?: string;
    uptime?: number;
  };
  memory?: {
    total?: number;
    free?: number;
    used?: number;
  };
  cpu?: {
    model?: string;
    cores?: number;
    speed?: number;
  };
}

/**
 * SystemInfo - System information display
 */
export function SystemInfo() {
  const { data: info, isLoading } = useSystemInfo();
  const systemInfo = info as SystemInfo | undefined;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">System Information</h1>
        <p className="text-muted-foreground">
          Node.js and OS metrics
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Node.js Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Node.js Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Version</div>
                <div className="text-lg font-semibold">{systemInfo?.node?.version || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Platform</div>
                <div className="text-lg font-semibold">{systemInfo?.node?.platform || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Architecture</div>
                <div className="text-lg font-semibold">{systemInfo?.node?.arch || 'N/A'}</div>
              </div>
            </CardContent>
          </Card>

          {/* OS Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Operating System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Type</div>
                <div className="text-lg font-semibold">{systemInfo?.os?.type || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Platform</div>
                <div className="text-lg font-semibold">{systemInfo?.os?.platform || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Release</div>
                <div className="text-lg font-semibold">{systemInfo?.os?.release || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Uptime</div>
                <div className="text-lg font-semibold">
                  {formatUptime(systemInfo?.os?.uptime)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MemoryStick className="h-5 w-5" />
                Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total</div>
                <div className="text-lg font-semibold">
                  {formatBytes(systemInfo?.memory?.total)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Used</div>
                <div className="text-lg font-semibold">
                  {formatBytes(systemInfo?.memory?.used)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Free</div>
                <div className="text-lg font-semibold">
                  {formatBytes(systemInfo?.memory?.free)}
                </div>
              </div>
              {systemInfo?.memory?.total && systemInfo?.memory?.used && (
                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full"
                      style={{
                        width: `${((systemInfo.memory.used / systemInfo.memory.total) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((systemInfo.memory.used / systemInfo.memory.total) * 100).toFixed(1)}% used
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CPU Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                CPU
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Model</div>
                <div className="text-lg font-semibold">{systemInfo?.cpu?.model || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Cores</div>
                <div className="text-lg font-semibold">{systemInfo?.cpu?.cores || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Speed</div>
                <div className="text-lg font-semibold">
                  {systemInfo?.cpu?.speed ? `${systemInfo.cpu.speed} MHz` : 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
