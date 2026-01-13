'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBrokerUsers } from '@/lib/api/hooks/useBroker';
import { Loader2, ArrowLeft, Mail, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * BrokerUserDetails - Display detailed information about a broker user
 */
export function BrokerUserDetails() {
  const params = useParams();
  const userId = params?.id as string;

  // For now, we'll fetch all users and find the one we need
  // In a real implementation, we'd have a useBrokerUser(userId) hook
  const { data, isLoading } = useBrokerUsers({ limit: 1000 });
  const user = data?.data?.find((u: any) => u.id === userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">User not found</p>
            <Button asChild>
              <Link href="/broker/users">Back to Users</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getKYCBadge = (kycLevel: string) => {
    const colors: Record<string, string> = {
      L0: 'bg-gray-500',
      L1: 'bg-blue-500',
      L2: 'bg-green-500',
      L3: 'bg-purple-500',
      INSTITUTIONAL: 'bg-yellow-500',
    };
    return (
      <Badge className={colors[kycLevel] || 'bg-gray-500'}>
        {kycLevel}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/broker/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mt-4">
            {user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.username || user.email}
          </h1>
        </div>
      </div>

      {/* User Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Username</div>
              <div className="font-medium mt-1">{user.username || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-1">
                {user.isActive ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
                {user.isVerified && (
                  <Badge variant="default" className="ml-2">Verified</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">KYC Level</div>
              <div className="mt-1">{getKYCBadge(user.kycLevel || 'L0')}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">KYC Status</div>
              <div className="mt-1">
                <Badge variant="outline">{user.kycStatus || 'Not Started'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">User ID</div>
              <div className="font-mono text-sm mt-1">{user.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(user.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date((user as any).updatedAt || user.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/broker/users/${user.id}/limits`}>View Limits</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/broker/users/kyc?userId=${user.id}`}>KYC Details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
