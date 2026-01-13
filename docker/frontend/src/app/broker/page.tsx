'use client';

import { BrokerDashboard } from '@/components/broker/dashboard';
import { useRBACStore } from '@/stores/rbacStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BrokerPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has broker permissions
    const { checkPermission } = useRBACStore.getState();
    const canAccessBroker = checkPermission('broker:view') || 
      checkPermission('broker:admin') ||
      checkPermission('broker:compliance') ||
      checkPermission('broker:finance') ||
      checkPermission('broker:operations') ||
      checkPermission('broker:trading');

    if (!canAccessBroker) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="p-6">
      <BrokerDashboard />
    </div>
  );
}
