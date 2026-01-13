'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileCheck, Settings, BarChart3 } from 'lucide-react';
import Link from 'next/link';

/**
 * QuickActionsCard - Quick action buttons for broker dashboard
 */
export function QuickActionsCard() {
  const actions = [
    {
      label: 'Manage Users',
      href: '/broker/users',
      icon: Users,
      description: 'View and manage broker users',
    },
    {
      label: 'KYC Review',
      href: '/broker/users/kyc',
      icon: FileCheck,
      description: 'Review pending KYC applications',
    },
    {
      label: 'Trading Operations',
      href: '/broker/trading/orders',
      icon: BarChart3,
      description: 'Manage orders and trading',
    },
    {
      label: 'Broker Settings',
      href: '/broker/settings',
      icon: Settings,
      description: 'Configure broker settings',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common broker management tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href={action.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span>{action.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
