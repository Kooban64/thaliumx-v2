'use client';

import { useEffect, useState } from 'react';
import { PolicyViolationAlert } from './PolicyViolationAlert';
import { getAccessToken } from '@/lib/auth/token-store';
import apiClient from '@/lib/api/client';

export function PolicyViolationAlertContainer() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const fetchUserId = async () => {
      try {
        if (getAccessToken()) {
          const profileRes = await apiClient.get<{ id: string }>('/api/auth/profile');
          const currentUserId = (profileRes.data as any)?.user?.id || (profileRes.data as any)?.id;
          if (currentUserId) {
            setUserId(currentUserId);
          }
        }
      } catch (err) {
        console.debug('Could not fetch user ID for policy alerts', err);
      }
    };

    fetchUserId();
  }, []);

  if (!mounted || !userId) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full space-y-2">
      <PolicyViolationAlert 
        userId={userId}
        autoDismiss={true}
        dismissAfter={15000}
      />
    </div>
  );
}
