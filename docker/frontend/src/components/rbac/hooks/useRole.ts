import { useRBACStore } from '@/stores/rbacStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * useRole - Hook to get current user role
 */
export function useRole() {
  const { userRole, userRoles } = useRBACStore();
  const { user } = useAuthStore();

  // Get role from RBAC store or fallback to user object
  const role = userRole || user?.role || null;
  const roles = userRoles.length > 0 ? userRoles : (role ? [role] : []);
  const normalizedRole = role?.toLowerCase().replace(/-/g, '_') || null;
  const isAdminRole =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'master_system_admin';
  const isBrokerRole = normalizedRole ? normalizedRole === 'broker_admin' || normalizedRole.startsWith('broker_') : false;

  return {
    role,
    roles,
    isAdmin: isAdminRole,
    isBroker: isBrokerRole,
    isUser: normalizedRole === 'user' || (!isBrokerRole && !isAdminRole),
  };
}
