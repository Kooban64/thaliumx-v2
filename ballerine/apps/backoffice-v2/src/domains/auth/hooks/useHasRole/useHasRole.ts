import { useMemo } from 'react';
import { useAuthenticatedUserQuery } from '../queries/useAuthenticatedUserQuery/useAuthenticatedUserQuery';

/**
 * Role hierarchy mapping - matches backend roles-builder.ts
 */
const ROLE_HIERARCHY: Record<string, string[]> = {
  // Platform roles
  'platform_admin': ['platform_admin'],
  'platform_compliance': ['platform_compliance', 'platform_admin'],
  'platform_content': ['platform_content', 'platform_admin'],
  
  // Broker roles
  'broker_admin': ['broker_admin'],
  'broker_compliance': ['broker_compliance', 'broker_admin'],
  'broker_content': ['broker_content', 'broker_admin'],
  
  // User roles
  'user_viewer': ['user_viewer'],
  'user_analyst': ['user_analyst', 'user_viewer'],
  'user_trader': ['user_trader', 'user_analyst', 'user_viewer'],
  
  // Legacy role mappings (aliases)
  'admin': ['platform_admin'],
  'super_admin': ['platform_admin'],
  'super-admin': ['platform_admin'],
  'master_system_admin': ['platform_admin'],
  'compliance': ['platform_compliance'],
  'viewer': ['user_viewer'],
  'trader': ['user_trader'],
  'analyst': ['user_analyst'],
  'content': ['platform_content'],
  'broker': ['broker_admin'],
  'user': ['user_viewer'],
  'member': ['user_viewer'],
};

/**
 * Normalize a role to its canonical form
 */
const normalizeRole = (role: string): string => {
  const normalized = role.toLowerCase().replace(/-/g, '_');
  return ROLE_HIERARCHY[normalized] ? normalized : role;
};

/**
 * Check if a user has a specific role (considering role hierarchy)
 */
const hasRole = (userRoles: string[], requiredRole: string): boolean => {
  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  const normalizedRequired = normalizeRole(requiredRole);
  const requiredHierarchy = ROLE_HIERARCHY[normalizedRequired] || [normalizedRequired];

  return userRoles.some(userRole => {
    const normalizedUserRole = normalizeRole(userRole);
    return requiredHierarchy.includes(normalizedUserRole);
  });
};

/**
 * Check if a user has any of the specified roles
 */
const hasAnyRole = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.some(role => hasRole(userRoles, role));
};

/**
 * Check if a user has all of the specified roles
 */
const hasAllRoles = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.every(role => hasRole(userRoles, role));
};

/**
 * Hook to check if the authenticated user has a specific role
 * 
 * @param requiredRole - The role to check for (supports role hierarchy)
 * @param requireAll - If true, user must have ALL specified roles. If false, any role is sufficient.
 * @returns Boolean indicating if the user has the required role(s)
 * 
 * @example
 * // Check if user is admin
 * const isAdmin = useHasRole('platform_admin');
 * 
 * // Check if user is admin OR compliance
 * const isAdminOrCompliance = useHasRole(['platform_admin', 'platform_compliance']);
 * 
 * // Check if user has ALL specified roles
 * const hasAdminAndCompliance = useHasRole(['platform_admin', 'platform_compliance'], { requireAll: true });
 */
export const useHasRole = (
  requiredRole: string | string[],
  options?: { requireAll?: boolean }
): boolean => {
  const { requireAll = false } = options || {};
  const { data: session } = useAuthenticatedUserQuery();
  const userRoles = session?.user?.roles || [];

  return useMemo(() => {
    if (!Array.isArray(requiredRole)) {
      return hasRole(userRoles, requiredRole);
    }

    if (requiredRole.length === 0) {
      return true;
    }

    return requireAll 
      ? hasAllRoles(userRoles, requiredRole)
      : hasAnyRole(userRoles, requiredRole);
  }, [userRoles, requiredRole, requireAll]);
};

/**
 * Hook to check if the authenticated user is an admin
 * 
 * @returns Boolean indicating if the user has admin privileges
 */
export const useIsAdmin = (): boolean => {
  return useHasRole(['platform_admin', 'broker_admin']);
};

/**
 * Hook to get the user's primary role
 * 
 * @returns The user's primary role or undefined
 */
export const useUserRoles = (): string[] => {
  const { data: session } = useAuthenticatedUserQuery();
  return session?.user?.roles || [];
};

/**
 * Check if user can perform an action based on permissions
 * (Simplified frontend version - maps roles to basic permissions)
 */
export const useCanPerform = (action: string): boolean => {
  const { data: session } = useAuthenticatedUserQuery();
  const userRoles = session?.user?.roles || [];

  // Permission mapping (simplified)
  const rolePermissions: Record<string, string[]> = {
    'platform_admin': ['*'],
    'broker_admin': ['*'],
    'platform_compliance': ['workflow:read', 'workflow:update', 'case:read', 'case:update', 'alert:read', 'alert:update'],
    'broker_compliance': ['workflow:read', 'workflow:update', 'case:read', 'case:update', 'alert:read', 'alert:update'],
    'platform_content': ['workflow:read', 'case:read', 'alert:read'],
    'broker_content': ['workflow:read', 'case:read', 'alert:read'],
    'user_analyst': ['workflow:read', 'workflow:update', 'case:read', 'case:update', 'alert:read', 'alert:update'],
    'user_trader': ['workflow:read', 'case:read', 'alert:read', 'business:read', 'business:create'],
    'user_viewer': ['workflow:read', 'case:read', 'alert:read'],
  };

  return userRoles.some(role => {
    const perms = rolePermissions[role] || [];
    return perms.includes('*') || perms.includes(action);
  });
};
