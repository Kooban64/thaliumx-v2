/**
 * RBAC Utilities
 * Helper functions for role and permission checking
 */

import { getPermissionsForRole } from './permissions';
import type { KYCLevel } from '@/stores/kycStore';

/**
 * Check if user has role
 */
export function hasRole(userRole: string | null | undefined, requiredRoles: string | string[]): boolean {
  if (!userRole) return false;
  
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.some((role) => {
    // Exact match
    if (userRole.toLowerCase() === role.toLowerCase()) return true;
    
    // Broker role prefix matching
    if (role.startsWith('broker_') && userRole.toLowerCase().startsWith('broker_')) {
      return true;
    }
    
    // Admin role matching
    if ((role === 'admin' || role === 'super_admin') && 
        (userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'super_admin')) {
      return true;
    }
    
    return false;
  });
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userRole: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (!userRole) return false;

  // Check explicit permissions first
  if (userPermissions && userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = getPermissionsForRole(userRole);
  return rolePermissions.includes(requiredPermission);
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  userRole: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((permission) =>
    hasPermission(userRole, userPermissions, permission)
  );
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  userRole: string | null | undefined,
  userPermissions: string[] | null | undefined,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((permission) =>
    hasPermission(userRole, userPermissions, permission)
  );
}

/**
 * Check if user has minimum KYC level
 */
export function hasKYCLevel(
  userKYCLevel: KYCLevel | null | undefined,
  requiredLevel: KYCLevel
): boolean {
  if (!userKYCLevel) return false;

  const levels: KYCLevel[] = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'];
  const userLevelIndex = levels.indexOf(userKYCLevel);
  const requiredLevelIndex = levels.indexOf(requiredLevel);

  return userLevelIndex >= requiredLevelIndex;
}

/**
 * Check if feature is enabled
 */
export function hasFeature(
  featureFlags: Record<string, boolean> | null | undefined,
  featureName: string
): boolean {
  if (!featureFlags) return false;
  return featureFlags[featureName] === true;
}

/**
 * Check if user can access resource
 * Combines role, permission, KYC, and feature checks
 */
export interface AccessCheckOptions {
  role?: string | string[];
  permission?: string | string[];
  kycLevel?: KYCLevel;
  feature?: string;
  requireAll?: boolean; // If true, all conditions must be met; if false, any condition is sufficient
}

export function canAccess(
  userRole: string | null | undefined,
  userPermissions: string[] | null | undefined,
  userKYCLevel: KYCLevel | null | undefined,
  featureFlags: Record<string, boolean> | null | undefined,
  options: AccessCheckOptions
): boolean {
  const { role, permission, kycLevel, feature, requireAll = false } = options;

  const checks: boolean[] = [];

  // Role check
  if (role) {
    checks.push(hasRole(userRole, role));
  }

  // Permission check
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    checks.push(hasAnyPermission(userRole, userPermissions, permissions));
  }

  // KYC level check
  if (kycLevel) {
    checks.push(hasKYCLevel(userKYCLevel, kycLevel));
  }

  // Feature flag check
  if (feature) {
    checks.push(hasFeature(featureFlags, feature));
  }

  if (checks.length === 0) return true; // No requirements = access granted

  // If requireAll, all checks must pass; otherwise, any check passing is sufficient
  return requireAll ? checks.every((check) => check) : checks.some((check) => check);
}
