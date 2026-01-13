import { useRBACStore } from '@/stores/rbacStore';
import { useEffect } from 'react';

/**
 * usePermissions - Hook to get user permissions
 */
export function usePermissions() {
  const { permissions, fetchPermissions } = useRBACStore();

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    hasPermission: (permission: string) => {
      return useRBACStore.getState().checkPermission(permission);
    },
    hasAnyPermission: (requiredPermissions: string[]) => {
      return requiredPermissions.some((p) => useRBACStore.getState().checkPermission(p));
    },
    hasAllPermissions: (requiredPermissions: string[]) => {
      return requiredPermissions.every((p) => useRBACStore.getState().checkPermission(p));
    },
  };
}
