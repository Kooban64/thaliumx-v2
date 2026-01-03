/**
 * Role Mapper Service
 * 
 * Centralized role normalization and matching service.
 * Maps Zitadel kebab-case roles to standard snake_case format.
 */

export class RoleMapperService {
  // Role normalization mapping: kebab-case -> snake_case
  private static readonly roleMap: Record<string, string> = {
    'platform-admin': 'platform_admin',
    'platform-compliance': 'platform_compliance',
    'platform-finance': 'platform_finance',
    'platform-operations': 'platform_operations',
    'platform-security': 'platform_security',
    'platform-support': 'platform_support',
    'platform-risk': 'platform_risk',
    'platform-content': 'platform_content',
    'broker-admin': 'broker_admin',
    'broker-compliance': 'broker_compliance',
    'broker-finance': 'broker_finance',
    'broker-operations': 'broker_operations',
    'broker-trading': 'broker_trading',
    'broker-support': 'broker_support',
    'broker-risk': 'broker_risk',
    'broker-content': 'broker_content',
    'user-trader': 'user_trader',
    'user-analyst': 'user_analyst',
    'user-viewer': 'user_viewer',
    // Legacy mappings
    'admin': 'platform_admin',
    'super-admin': 'master_system_admin',
    'super_admin': 'master_system_admin',
    'compliance': 'platform_compliance',
    'finance': 'platform_finance',
    'operations': 'platform_operations',
    'support': 'platform_support',
    'risk': 'platform_risk',
    'trading': 'broker_trading',
    'trader': 'user_trader',
    'viewer': 'user_viewer',
  };

  /**
   * Normalize roles to standard format (snake_case).
   * Maps Zitadel kebab-case roles to standard snake_case format.
   */
  public static normalizeRoles(roles: string[]): string[] {
    if (!roles || roles.length === 0) {
      return [];
    }

    return roles
      .map(role => {
        const normalized = this.roleMap[role.toLowerCase()] || role.toLowerCase().replace(/-/g, '_');
        return normalized;
      })
      .filter((role, index, arr) => arr.indexOf(role) === index); // Remove duplicates
  }

  /**
   * Check if a role matches any of the provided roles.
   */
  public static matchesAny(role: string | undefined, roles: string[]): boolean {
    if (!role) return false;
    const normalizedRole = this.normalizeRoles([role])[0];
    if (!normalizedRole) return false;
    const normalizedRoles = this.normalizeRoles(roles);
    return normalizedRoles.includes(normalizedRole);
  }

  /**
   * Get the highest priority role from a list of roles.
   */
  public static getHighestPriorityRole(roles: string[]): string | null {
    const normalizedRoles = this.normalizeRoles(roles);
    const rolePriority = [
      'master_system_admin',
      'platform_admin',
      'broker_admin',
      'platform_compliance',
      'broker_compliance',
      'platform_finance',
      'broker_finance',
      'platform_support',
      'broker_support',
      'user_trader',
      'user_viewer'
    ];

    for (const priorityRole of rolePriority) {
      if (normalizedRoles.includes(priorityRole)) {
        return priorityRole;
      }
    }

    return normalizedRoles[0] || null;
  }
}
