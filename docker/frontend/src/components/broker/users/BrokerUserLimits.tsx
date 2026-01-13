'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBrokerUsers } from '@/lib/api/hooks/useBroker';
import { Loader2, Search, User, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserLimits } from '@/components/admin/users/UserLimits';

/**
 * BrokerUserLimits - Manage transaction limits for broker users
 */
export function BrokerUserLimits() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading } = useBrokerUsers({
    search: search || undefined,
    limit: 100,
  });

  const users = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Transaction Limits</h1>
        <p className="text-muted-foreground">
          View and manage transaction limits for broker users
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <Card>
          <CardHeader>
            <CardTitle>Select User</CardTitle>
            <CardDescription>
              Search and select a user to view their limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !users || users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {users.map((user: any) => (
                  <div
                    key={user.id || user.userId}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === (user.id || user.userId)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedUserId(user.id || user.userId)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.name || user.fullName || user.email || 'Unknown User'}
                          </span>
                          {user.kycLevel && (
                            <Badge variant="secondary">{user.kycLevel}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/broker/users/${user.id || user.userId}`);
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

        {/* Limits Display */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Limits</CardTitle>
            <CardDescription>
              {selectedUserId
                ? 'Current limits for selected user'
                : 'Select a user from the list to view their limits'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedUserId ? (
              <UserLimits
                userId={selectedUserId}
                limits={undefined}
                isLoading={false}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a user from the list to view their transaction limits</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
