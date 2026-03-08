'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUsers, type AdminUser } from '@/lib/api/hooks/useAdmin';
import { Loader2, Search, User, Mail, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * UserList - Display and manage all users
 */
export function UserList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [kycFilter, setKycFilter] = useState<string>('');

  const { data: users, isLoading } = useUsers({
    search: search || undefined,
    role: roleFilter || undefined,
    kycLevel: kycFilter || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Search, filter, and manage all platform users
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Search and filter users by role and KYC level</CardDescription>
            </div>
            {(search || roleFilter || kycFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setKycFilter('');
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
                  }
                }}
                className="pl-10"
                aria-label="Search users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter by role">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="broker_admin">Broker Admin</SelectItem>
                <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kycFilter} onValueChange={setKycFilter}>
              <SelectTrigger aria-label="Filter by KYC level">
                <SelectValue placeholder="All KYC Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All KYC Levels</SelectItem>
                <SelectItem value="L0">L0 - Web3 Basic</SelectItem>
                <SelectItem value="L1">L1 - Basic Verification</SelectItem>
                <SelectItem value="L2">L2 - Identity Verified</SelectItem>
                <SelectItem value="L3">L3 - Enhanced Verification</SelectItem>
                <SelectItem value="INSTITUTIONAL">Institutional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users?.length || 0} user{users?.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user: AdminUser) => {
                const userKey = user.id || user.userId;
                if (!userKey) {
                  return null;
                }

                return <div
                  key={userKey}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/users/${userKey}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/admin/users/${userKey}`);
                    }
                  }}
                  aria-label={`View details for ${user.name || user.email || 'user'}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {user.name || user.fullName || user.email || 'Unknown User'}
                        </span>
                        {user.role && (
                          <Badge variant="outline" className="flex-shrink-0">{user.role}</Badge>
                        )}
                        {user.kycLevel && (
                          <Badge variant="secondary" className="flex-shrink-0">{user.kycLevel}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        {user.email && (
                          <div className="flex items-center gap-1 min-w-0">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}
                        {user.kycStatus && (
                          <div className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {user.kycStatus}
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
                      router.push(`/admin/users/${userKey}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/admin/users/${userKey}`);
                      }
                    }}
                  >
                    View Details
                  </Button>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
