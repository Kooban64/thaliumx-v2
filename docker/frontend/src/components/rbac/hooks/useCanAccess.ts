import { useRBACStore } from '@/stores/rbacStore';
import type { AccessCheckOptions } from '@/lib/rbac/utils';

/**
 * useCanAccess - Hook to check if user can access resource
 * Combines role, permission, KYC, and feature checks
 */
export function useCanAccess(options: AccessCheckOptions) {
  const { checkAccess } = useRBACStore();
  return checkAccess(options);
}
