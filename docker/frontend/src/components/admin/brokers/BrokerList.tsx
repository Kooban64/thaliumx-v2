'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBrokers } from '@/lib/api/hooks/useAdmin';
import { Loader2, Search, Building2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * BrokerList - Display and manage all brokers
 */
export function BrokerList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: brokers, isLoading } = useBrokers();

  const filteredBrokers = brokers?.filter((broker: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      broker.name?.toLowerCase().includes(searchLower) ||
      broker.id?.toLowerCase().includes(searchLower) ||
      broker.email?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broker Management</h1>
        <p className="text-muted-foreground">
          Manage broker configurations, allocations, and settings
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Brokers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brokers by name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Broker List */}
      <Card>
        <CardHeader>
          <CardTitle>Brokers</CardTitle>
          <CardDescription>
            {filteredBrokers?.length || 0} broker{filteredBrokers?.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredBrokers || filteredBrokers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No brokers found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBrokers.map((broker: any) => (
                <div
                  key={broker.id || broker.brokerId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/brokers/${broker.id || broker.brokerId}`)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {broker.name || broker.brokerName || 'Unknown Broker'}
                        </span>
                        {broker.status && (
                          <Badge variant={broker.status === 'active' ? 'default' : 'secondary'}>
                            {broker.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {broker.id && (
                          <div>ID: {broker.id}</div>
                        )}
                        {broker.userCount !== undefined && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {broker.userCount} users
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
