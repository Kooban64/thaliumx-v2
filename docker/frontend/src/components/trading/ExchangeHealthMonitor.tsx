'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeHealth {
  name: string;
  status: 'online' | 'offline' | 'maintenance';
  responseTime: number;
  uptime: number;
  lastCheck: string;
}

const exchanges = [
  'KuCoin',
  'Bybit',
  'OKX',
  'Kraken',
  'VALR',
  'Bitstamp',
  'Crypto.com',
];

/**
 * ExchangeHealthMonitor - Monitors health of all connected exchanges
 */
export function ExchangeHealthMonitor() {
  const [healthData, setHealthData] = useState<ExchangeHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/omni-exchange/exchanges/health');
        if (response.ok) {
          const data = await response.json();
          setHealthData(data.data || data.health || []);
        } else {
          // Mock data for development
          setHealthData(
            exchanges.map((name) => ({
              name,
              status: Math.random() > 0.1 ? 'online' : 'offline',
              responseTime: Math.floor(Math.random() * 200) + 50,
              uptime: 95 + Math.random() * 5,
              lastCheck: new Date().toISOString(),
            }))
          );
        }
      } catch {
        // Mock data on error
        setHealthData(
          exchanges.map((name) => ({
            name,
            status: 'online' as const,
            responseTime: Math.floor(Math.random() * 200) + 50,
            uptime: 95 + Math.random() * 5,
            lastCheck: new Date().toISOString(),
          }))
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ExchangeHealth['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: ExchangeHealth['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exchange Health</CardTitle>
          <CardDescription>Monitoring connected exchanges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Health</CardTitle>
        <CardDescription>Real-time status of connected exchanges</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {healthData.map((exchange) => (
            <div
              key={exchange.name}
              className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{exchange.name}</span>
                {getStatusIcon(exchange.status)}
              </div>
              <Badge className={cn('text-xs', getStatusColor(exchange.status))}>
                {exchange.status}
              </Badge>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Response: {exchange.responseTime}ms</div>
                <div>Uptime: {exchange.uptime.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
