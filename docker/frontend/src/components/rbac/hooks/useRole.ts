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

  return {
    role,
    roles,
    isAdmin: role === 'admin' || role === 'super_admin',
    isBroker: role?.startsWith('broker_') || false,
    isUser: role === 'user' || (!role?.startsWith('broker_') && role !== 'admin' && role !== 'super_admin'),
  };
}
