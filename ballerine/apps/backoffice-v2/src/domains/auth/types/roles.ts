/**
 * Role and Permission Types for Frontend
 */

// Role hierarchy - matches backend roles-builder.ts
export const ROLE_HIERARCHY = {
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
} as const;

// Available roles for assignment
export const AVAILABLE_ROLES = [
  { value: 'platform_admin', label: 'Platform Admin', description: 'Full system access', category: 'Platform' },
  { value: 'platform_compliance', label: 'Platform Compliance', description: 'Compliance team access', category: 'Platform' },
  { value: 'platform_content', label: 'Platform Content', description: 'Content management access', category: 'Platform' },
  { value: 'broker_admin', label: 'Broker Admin', description: 'Broker administration access', category: 'Broker' },
  { value: 'broker_compliance', label: 'Broker Compliance', description: 'Broker compliance access', category: 'Broker' },
  { value: 'broker_content', label: 'Broker Content', description: 'Broker content access', category: 'Broker' },
  { value: 'user_trader', label: 'Trader', description: 'Trading operations access', category: 'User' },
  { value: 'user_analyst', label: 'Analyst', description: 'Analysis and review access', category: 'User' },
  { value: 'user_viewer', label: 'Viewer', description: 'Read-only access', category: 'User' },
] as const;

// Role categories
export const ROLE_CATEGORIES = {
  PLATFORM: 'Platform',
  BROKER: 'Broker',
  USER: 'User',
} as const;

// Permission categories
export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: 'User Management',
  WORKFLOW: 'Workflow Management',
  BUSINESS: 'Business Management',
  ALERTS: 'Alert Management',
  ASSESSMENTS: 'Assessment Management',
  REPORTS: 'Reports & Analytics',
  ADMINISTRATION: 'Administration',
} as const;

// Permission matrix - maps roles to permissions
export const PERMISSIONS = {
  // User management
  'user:create': { roles: ['platform_admin'], category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  'user:read': { roles: ['platform_admin', 'platform_compliance'], category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  'user:update': { roles: ['platform_admin'], category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  'user:delete': { roles: ['platform_admin'], category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  'user:block': { roles: ['platform_admin'], category: PERMISSION_CATEGORIES.USER_MANAGEMENT },
  
  // Workflow
  'workflow:create': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance'], category: PERMISSION_CATEGORIES.WORKFLOW },
  'workflow:read': { roles: ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'], category: PERMISSION_CATEGORIES.WORKFLOW },
  'workflow:update': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'], category: PERMISSION_CATEGORIES.WORKFLOW },
  'workflow:delete': { roles: ['platform_admin', 'broker_admin'], category: PERMISSION_CATEGORIES.WORKFLOW },
  'workflow:decision': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'], category: PERMISSION_CATEGORIES.WORKFLOW },
  
  // Business
  'business:create': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'], category: PERMISSION_CATEGORIES.BUSINESS },
  'business:read': { roles: ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'], category: PERMISSION_CATEGORIES.BUSINESS },
  'business:update': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_trader'], category: PERMISSION_CATEGORIES.BUSINESS },
  
  // Alerts
  'alert:read': { roles: ['platform_admin', 'platform_compliance', 'platform_content', 'broker_admin', 'broker_compliance', 'broker_content', 'user_viewer', 'user_analyst', 'user_trader'], category: PERMISSION_CATEGORIES.ALERTS },
  'alert:update': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'], category: PERMISSION_CATEGORIES.ALERTS },
  
  // Reports
  'reports:read': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst', 'user_trader'], category: PERMISSION_CATEGORIES.REPORTS },
  'reports:export': { roles: ['platform_admin', 'platform_compliance', 'broker_admin', 'broker_compliance', 'user_analyst'], category: PERMISSION_CATEGORIES.REPORTS },
  
  // Admin
  'admin:full': { roles: ['platform_admin'], category: PERMISSION_CATEGORIES.ADMINISTRATION },
} as const;

// Helper function to check if a role has a permission
export function hasPermission(role: RoleValue, permission: keyof typeof PERMISSIONS): boolean {
  const perm = PERMISSIONS[permission];
  if (!perm) return false;
  return perm.roles.includes(role as typeof perm.roles[number]);
}

// Helper function to get all permissions for a role
export function getPermissionsForRole(role: RoleValue): string[] {
  return Object.entries(PERMISSIONS)
    .filter(([_, perm]) => perm.roles.includes(role as typeof perm.roles[number]))
    .map(([perm]) => perm);
}

// Type exports
export type RoleValue = typeof AVAILABLE_ROLES[number]['value'];
export type RoleCategory = typeof ROLE_CATEGORIES[keyof typeof ROLE_CATEGORIES];
export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];
