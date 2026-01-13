'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/navigation/Tabs';
import { useUser, useUserLimits } from '@/lib/api/hooks/useAdmin';
import { Loader2, ArrowLeft, User, Mail, Shield, CreditCard, Settings } from 'lucide-react';
import { UserLimits } from './UserLimits';

interface UserDetailsProps {
  userId: string;
}

/**
 * UserDetails - Display and manage user details
 */
export function UserDetails({ userId }: UserDetailsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const { data: user, isLoading: isLoadingUser } = useUser(userId);
  const { data: limits, isLoading: isLoadingLimits } = useUserLimits(userId);
  // const assignRoleMutation = useAdminAssignRole(); // Reserved for future use

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
        <Button variant="outline" onClick={() => router.push('/admin/users')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'limits', label: 'Limits', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {user.name || user.fullName || user.email || 'User Details'}
            </h1>
            <p className="text-muted-foreground">User ID: {user.id || user.userId}</p>
          </div>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{user.email || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Role</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role || 'user'}</Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">KYC Level</div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <Badge variant="secondary">{user.kycLevel || 'L0'}</Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">KYC Status</div>
              <div className="flex items-center gap-2">
                <Badge variant={user.kycStatus === 'approved' ? 'default' : 'outline'}>
                  {user.kycStatus || 'pending'}
                </Badge>
              </div>
            </div>
            {user.createdAt && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Created</div>
                <div className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            )}
            {user.lastLogin && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Last Login</div>
                <div className="font-medium">
                  {new Date(user.lastLogin).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs items={tabs} value={activeTab} onValueChange={setActiveTab} variant="pills" />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">User ID</div>
                <div className="font-mono text-sm">{user.id || user.userId}</div>
              </div>
              {user.tenantId && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Tenant ID</div>
                  <div className="font-mono text-sm">{user.tenantId}</div>
                </div>
              )}
              {user.brokerId && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Broker ID</div>
                  <div className="font-mono text-sm">{user.brokerId}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'limits' && (
        <UserLimits userId={userId} limits={limits} isLoading={isLoadingLimits} />
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>User account settings and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Account Status</div>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status || 'active'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Email Verified</div>
                  <Badge variant={user.emailVerified ? 'default' : 'outline'}>
                    {user.emailVerified ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>
                {user.twoFactorEnabled !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Two-Factor Authentication</div>
                    <Badge variant={user.twoFactorEnabled ? 'default' : 'outline'}>
                      {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                )}
                {user.notificationsEnabled !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Notifications</div>
                    <Badge variant={user.notificationsEnabled ? 'default' : 'outline'}>
                      {user.notificationsEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                )}
              </div>
              {user.preferences && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Preferences</div>
                  <div className="p-3 bg-muted rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(user.preferences, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Advanced settings management will be available in a future update.
                  For now, user settings can be managed through the user profile page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
