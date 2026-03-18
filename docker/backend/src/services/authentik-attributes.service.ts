/**
 * Auth Attributes Service
 * 
 * ⚠️ LEGACY SERVICE - DEPRECATED March 2026
 * 
 * This service was previously used to extract authentication attributes
 * from Authentik tokens. Since Authentik has been deprecated in favor
 * of internal JWT authentication, this service now provides simplified
 * attribute extraction from the internal JWT context.
 * 
 * The functionality is kept for backward compatibility with existing code
 * that depends on this interface.
 */

import type { Request } from 'express';
import type { User } from '../types';

export interface AuthContextAttributes {
  roles: string[];
  normalizedRoles: string[];
  organizationId?: string;
  clientId?: string;
  brokerId?: string;
  metadata: Record<string, any>;
  customClaims: Record<string, any>;
}

/**
 * Extract authentication attributes from request
 * 
 * With internal JWT, attributes come directly from the JWT payload
 * rather than from an external identity provider.
 */
export const AuthAttributesService = {
  /**
   * Extract auth context from request (JWT-based)
   */
  extractFromRequest(req: Request): AuthContextAttributes {
    const user = req.user as any;
    
    // Extract roles from JWT payload
    const roles: string[] = user?.roles || (user?.role ? [user.role] : []);
    
    // Extract other attributes from JWT claims
    const organizationId = user?.organizationId || user?.tenantId;
    const clientId = user?.clientId;
    const brokerId = user?.brokerId;
    
    return {
      roles,
      normalizedRoles: roles.map(r => r.toLowerCase()),
      organizationId,
      clientId,
      brokerId,
      metadata: user?.metadata || {},
      customClaims: user?.customClaims || {}
    };
  },

  /**
   * Extract roles from JWT payload
   */
  extractRoles(req: Request): string[] {
    const user = req.user as any;
    return user?.roles || (user?.role ? [user.role] : []);
  },

  /**
   * Extract organization/tenant ID from JWT
   */
  extractOrganizationId(req: Request): string | undefined {
    const user = req.user as any;
    return user?.organizationId || user?.tenantId;
  },

  /**
   * Extract broker ID from JWT (if applicable)
   */
  extractBrokerId(req: Request): string | undefined {
    const user = req.user as any;
    return user?.brokerId;
  },

  /**
   * Check if user has specific role
   */
  hasRole(req: Request, role: string): boolean {
    const roles = this.extractRoles(req);
    return roles.some(r => r.toLowerCase() === role.toLowerCase());
  },

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(req: Request, roles: string[]): boolean {
    const userRoles = this.extractRoles(req);
    const lowerUserRoles = userRoles.map(r => r.toLowerCase());
    return roles.some(r => lowerUserRoles.includes(r.toLowerCase()));
  }
};

export default AuthAttributesService;
