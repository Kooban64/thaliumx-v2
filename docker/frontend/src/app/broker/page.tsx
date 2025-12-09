'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BrokerAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Broker Admin</h1>
        <Button asChild>
          <a href="/dashboard">Back to App</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Allocations</CardTitle>
            <CardDescription>User and account allocations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Wallets</CardTitle>
            <CardDescription>Hot wallets and segregation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance</CardTitle>
            <CardDescription>Approvals and reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
