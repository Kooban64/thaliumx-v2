'use client';

import { useEffect, useState } from 'react';
import { PolicyViolationAlert } from './PolicyViolationAlert';
import { getKeycloakToken } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';

interface ProfilePayload {
  id?: string;
  user?: {
    id?: string;
  };
}

export function PolicyViolationAlertContainer() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const fetchUserId = async () => {
      try {
        const token = getKeycloakToken();
        if (token) {
          const profileRes = await apiClient.get<ProfilePayload>('/api/auth/profile');
          const currentUserId = profileRes.data?.user?.id || profileRes.data?.id;
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
