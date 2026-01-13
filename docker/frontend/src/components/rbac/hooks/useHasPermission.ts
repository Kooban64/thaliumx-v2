import { useRBACStore } from '@/stores/rbacStore';

/**
 * useHasPermission - Hook to check if user has permission
 */
export function useHasPermission(permission: string) {
  const { checkPermission } = useRBACStore();
  return checkPermission(permission);
}
