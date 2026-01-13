import { useRBACStore } from '@/stores/rbacStore';

/**
 * useHasRole - Hook to check if user has role(s)
 */
export function useHasRole(requiredRoles: string | string[]) {
  const { checkRole } = useRBACStore();
  return checkRole(requiredRoles);
}
