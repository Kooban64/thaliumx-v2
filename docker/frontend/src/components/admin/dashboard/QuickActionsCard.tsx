'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Users, Building2, Key, Shield, Workflow, FileText, CreditCard, AlertTriangle } from 'lucide-react';

/**
 * QuickActionsCard - Quick action buttons for admin
 */
export function QuickActionsCard() {
  const router = useRouter();

  const quickActions = [
    { label: 'Manage Users', href: '/admin/users', icon: Users },
    { label: 'Manage Brokers', href: '/admin/brokers', icon: Building2 },
    { label: 'RBAC', href: '/admin/rbac', icon: Key },
    { label: 'Policies', href: '/admin/policies', icon: Shield },
    { label: 'Workflows', href: '/admin/workflows', icon: Workflow },
    { label: 'Compliance', href: '/admin/compliance', icon: FileText },
    { label: 'Financial', href: '/admin/financial/ledger', icon: CreditCard },
    { label: 'Security', href: '/admin/security/oversight', icon: AlertTriangle },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common administrative tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => router.push(action.href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(action.href);
                  }
                }}
                aria-label={`Go to ${action.label}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span className="truncate">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
