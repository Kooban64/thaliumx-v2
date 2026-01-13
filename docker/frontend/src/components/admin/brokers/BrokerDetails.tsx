'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBroker } from '@/lib/api/hooks/useAdmin';
import { Loader2, Building2, ArrowLeft, Settings, Users, BarChart3 } from 'lucide-react';

interface BrokerDetailsProps {
  brokerId: string;
}

/**
 * BrokerDetails - Display and manage broker details
 */
export function BrokerDetails({ brokerId }: BrokerDetailsProps) {
  const router = useRouter();
  const { data: broker, isLoading } = useBroker(brokerId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!broker) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Broker not found</p>
        <Button variant="outline" onClick={() => router.push('/admin/brokers')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Brokers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push('/admin/brokers')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Brokers
          </Button>
          <h1 className="text-3xl font-bold">{broker.name || broker.id || 'Broker Details'}</h1>
          <p className="text-muted-foreground">
            View and manage broker configuration and settings
          </p>
        </div>
        <Button onClick={() => router.push(`/admin/brokers/${brokerId}/settings`)}>
          <Settings className="h-4 w-4 mr-2" />
          Edit Settings
        </Button>
      </div>

      {/* Broker Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Broker Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Broker ID</div>
              <div className="text-lg font-semibold">{broker.id || broker.brokerId || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Name</div>
              <div className="text-lg font-semibold">{broker.name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <div className="text-lg font-semibold">{broker.email || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge variant={broker.status === 'active' ? 'default' : 'secondary'}>
                {broker.status || 'unknown'}
              </Badge>
            </div>
            {broker.createdAt && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Created At</div>
                <div className="text-lg font-semibold">
                  {new Date(broker.createdAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Users</div>
              <div className="text-lg font-semibold">{broker.userCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Active Users</div>
              <div className="text-lg font-semibold">{broker.activeUserCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Transactions</div>
              <div className="text-lg font-semibold">{broker.transactionCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Volume</div>
              <div className="text-lg font-semibold">
                ${(broker.totalVolume || 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/brokers/${brokerId}/settings`)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/analytics/brokers?brokerId=${brokerId}`)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/users?brokerId=${brokerId}`)}
            >
              <Users className="h-4 w-4 mr-2" />
              View Users
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
