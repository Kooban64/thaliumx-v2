/**
 * Permission Matrix for Role-Based Access Control
 * 
 * This module defines what each role can do in the system.
 * Use with RoleGuard for endpoint protection.
 */

import { rolesBuilder } from './roles-builder';

export type Permission = string;

export const PERMISSIONS = {
  // User management
  'user:create': ['platform_admin'],
  'user:read': ['platform_admin', 'platform_compliance'],
  'user:update': ['platform_admin'],
  'user:delete': ['platform_admin'],
  'user:block': ['platform_admin'],
  'user:unblock': ['platform_admin'],

  // Customer management
  'customer:create': ['platform_admin'],
  'customer:read': ['platform_admin', 'platform_compliance'],
  'customer:update': ['platform_admin'],
  'customer:delete': ['platform_admin'],

  // Workflow management
  'workflow:create': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance'],
  'workflow:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'workflow:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'workflow:delete': ['platform_admin', 'broker_admin'],
  'workflow:assign': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'workflow:decision': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'workflow:reassign': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance'],

  // Document management
  'document:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'document:upload': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'],
  'document:delete': ['platform_admin', 'broker_admin'],
  'document:ocr': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],

  // Case management
  'case:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'case:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'case:assign': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],

  // Business/Company management
  'business:create': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'],
  'business:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'business:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'],
  'business:delete': ['platform_admin', 'broker_admin'],

  // End user management
  'enduser:create': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'],
  'enduser:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_viewer', 'user_analyst', 'user_trader'],
  'enduser:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance'],
  'enduser:delete': ['platform_admin', 'broker_admin'],

  // Alert management
  'alert:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'alert:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'alert:assign': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'alert:resolve': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],

  // Assessment management
  'assessment:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_viewer', 'user_analyst', 'user_trader'],
  'assessment:create': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'assessment:update': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],

  // Workflow definition management
  'workflow_definition:create': ['platform_admin'],
  'workflow_definition:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content'],
  'workflow_definition:update': ['platform_admin'],
  'workflow_definition:delete': ['platform_admin'],
  'workflow_definition:publish': ['platform_admin'],

  // Metrics and reporting
  'metrics:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
  'reports:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst', 'user_trader'],
  'reports:export': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],

  // Secrets management
  'secrets:read': ['platform_admin'],
  'secrets:create': ['platform_admin'],
  'secrets:delete': ['platform_admin'],

  // Webhooks management
  'webhook:create': ['platform_admin', 'broker_admin'],
  'webhook:read': ['platform_admin', 'broker_admin'],
  'webhook:update': ['platform_admin', 'broker_admin'],
  'webhook:delete': ['platform_admin', 'broker_admin'],

  // Storage/Files
  'storage:upload': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'],
  'storage:read': ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'],
  'storage:delete': ['platform_admin', 'broker_admin'],

  // Filter management
  'filter:create': ['platform_admin', 'broker_admin', 'user_analyst'],
  'filter:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_viewer', 'user_analyst', 'user_trader'],
  'filter:update': ['platform_admin', 'broker_admin', 'user_analyst'],
  'filter:delete': ['platform_admin', 'broker_admin'],

  // API Key management
  'apikey:create': ['platform_admin', 'broker_admin'],
  'apikey:read': ['platform_admin', 'broker_admin'],
  'apikey:delete': ['platform_admin', 'broker_admin'],

  // Analytics
  'analytics:read': ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'],
} as const;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission as keyof typeof PERMISSIONS];
  if (!allowedRoles) {
    console.warn(`Permission '${permission}' is not defined in the permission matrix`);
    return false;
  }
  
  return rolesBuilder.hasRole([role], allowedRoles[0]);
}

/**
 * Check if any of the user's roles has a specific permission
 */
export function hasAnyPermission(userRoles: string[], permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission as keyof typeof PERMISSIONS];
  if (!allowedRoles) {
    console.warn(`Permission '${permission}' is not defined in the permission matrix`);
    return false;
  }
  
  return userRoles.some(role => rolesBuilder.hasRole([role], allowedRoles[0]));
}

/**
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: string): Permission[] {
  const permissions: Permission[] = [];
  
  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (rolesBuilder.hasRole([role], allowedRoles[0])) {
      permissions.push(permission as Permission);
    }
  }
  
  return permissions;
}

/**
 * Check if a permission exists in the matrix
 */
export function isValidPermission(permission: string): permission is Permission {
  return permission in PERMISSIONS;
}
