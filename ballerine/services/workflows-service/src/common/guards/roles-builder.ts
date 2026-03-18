/**
 * Role-based access control (RBAC) utility
 * 
 * This module provides role hierarchy and permission checking functionality.
 * It maps incoming roles to normalized roles and checks permissions based
 * on role hierarchy.
 */

export type Role = string;

/**
 * Role hierarchy mapping
 * Maps incoming/alias roles to their canonical role equivalents
 */
const ROLE_HIERARCHY: Record<string, Role[]> = {
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
 * RolesBuilder class provides static methods for role-based access control
 */
export class RolesBuilder {
  /**
   * Normalize a role to its canonical form
   * @param role The role to normalize
   * @returns The canonical role name
   */
  static normalizeRole(role: string): Role {
    const normalized = role.toLowerCase().replace(/-/g, '_');
    return ROLE_HIERARCHY[normalized] ? normalized : role;
  }

  /**
   * Check if a user has a specific role (considering role hierarchy)
   * @param userRoles The user's roles
   * @param requiredRole The required role
   * @returns True if user has the required role (or higher in hierarchy)
   */
  static hasRole(userRoles: Role[], requiredRole: string): boolean {
    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    const normalizedRequired = this.normalizeRole(requiredRole);
    const requiredHierarchy = ROLE_HIERARCHY[normalizedRequired] || [normalizedRequired];

    // Check if any user role matches the required role or is higher in hierarchy
    return userRoles.some(userRole => {
      const normalizedUserRole = this.normalizeRole(userRole);
      return requiredHierarchy.includes(normalizedUserRole);
    });
  }

  /**
   * Check if a user has any of the specified roles
   * @param userRoles The user's roles
   * @param requiredRoles Array of required roles
   * @returns True if user has any of the required roles
   */
  static hasAnyRole(userRoles: Role[], requiredRoles: string[]): boolean {
    return requiredRoles.some(role => this.hasRole(userRoles, role));
  }

  /**
   * Check if a user has all of the specified roles
   * @param userRoles The user's roles
   * @param requiredRoles Array of required roles
   * @returns True if user has all of the required roles
   */
  static hasAllRoles(userRoles: Role[], requiredRoles: string[]): boolean {
    return requiredRoles.every(role => this.hasRole(userRoles, role));
  }

  /**
   * Get all roles that inherit from a given role (including the role itself)
   * @param role The base role
   * @returns Array of roles that inherit from the given role
   */
  static getInheritedRoles(role: string): Role[] {
    const normalized = this.normalizeRole(role);
    return ROLE_HIERARCHY[normalized] || [normalized];
  }

  /**
   * Validate if a role is a valid system role
   * @param role The role to validate
   * @returns True if the role is valid
   */
  static isValidRole(role: string): boolean {
    const normalized = role.toLowerCase().replace(/-/g, '_');
    return normalized in ROLE_HIERARCHY;
  }

  /**
   * Get all available system roles
   * @returns Array of all valid system roles
   */
  static getAllRoles(): Role[] {
    return Object.keys(ROLE_HIERARCHY);
  }

  /**
   * Get role hierarchy display (for debugging/UI)
   * @returns Object showing role hierarchy
   */
  static getRoleHierarchy(): Record<string, string[]> {
    return { ...ROLE_HIERARCHY };
  }
}

// Export singleton instance for dependency injection
export const rolesBuilder = {
  hasRole: RolesBuilder.hasRole.bind(RolesBuilder),
  hasAnyRole: RolesBuilder.hasAnyRole.bind(RolesBuilder),
  hasAllRoles: RolesBuilder.hasAllRoles.bind(RolesBuilder),
  getInheritedRoles: RolesBuilder.getInheritedRoles.bind(RolesBuilder),
  isValidRole: RolesBuilder.isValidRole.bind(RolesBuilder),
  getAllRoles: RolesBuilder.getAllRoles.bind(RolesBuilder),
  getRoleHierarchy: RolesBuilder.getRoleHierarchy.bind(RolesBuilder),
  normalizeRole: RolesBuilder.normalizeRole.bind(RolesBuilder),
};
