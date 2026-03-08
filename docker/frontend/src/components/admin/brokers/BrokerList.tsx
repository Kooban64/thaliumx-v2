'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBrokers, type AdminBroker } from '@/lib/api/hooks/useAdmin';
import { Loader2, Search, Building2, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * BrokerList - Display and manage all brokers
 */
export function BrokerList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: brokers, isLoading } = useBrokers();

  const filteredBrokers = brokers?.filter((broker: AdminBroker) => {
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search Brokers</CardTitle>
              <CardDescription>Search by name, ID, or email</CardDescription>
            </div>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch('')}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search brokers by name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('');
                }
              }}
              className="pl-10"
              aria-label="Search brokers"
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
              {filteredBrokers.map((broker: AdminBroker) => (
                <div
                  key={broker.id || broker.brokerId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/brokers/${broker.id || broker.brokerId}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/admin/brokers/${broker.id || broker.brokerId}`);
                    }
                  }}
                  aria-label={`View details for ${broker.name || broker.brokerName || 'broker'}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {broker.name || broker.brokerName || 'Unknown Broker'}
                        </span>
                        {broker.status && (
                          <Badge variant={broker.status === 'active' ? 'default' : 'secondary'} className="flex-shrink-0">
                            {broker.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        {broker.id && (
                          <div className="truncate">ID: {broker.id}</div>
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
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/brokers/${broker.id || broker.brokerId}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/admin/brokers/${broker.id || broker.brokerId}`);
                      }
                    }}
                  >
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
