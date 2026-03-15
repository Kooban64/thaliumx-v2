/**
 * Authentik Attributes Service
 * 
 * Extracts and normalizes authentication attributes from requests for OPA policy evaluation.
 * This service handles Authentik/OIDC token attributes and provides a unified interface.
 */

import type { Request } from 'express';

export interface AuthAttributesContext {
  roles: string[];
  normalizedRoles: string[];
  tenantId?: string;
  brokerId?: string;
  organizationId?: string;
  clientId?: string;
  metadata: Record<string, any>;
  customClaims: Record<string, any>;
}

export class AuthAttributesService {
  /**
   * Extract authentication attributes from request
   * 
   * @param req - Express request object
   * @returns AuthAttributesContext with normalized roles and other auth attributes
   */
  public static extractFromRequest(req: Request): AuthAttributesContext {
    const user = req.user as any;
    
    // Extract roles from various possible locations
    let roles: string[] = [];
    if (user?.roles) {
      roles = Array.isArray(user.roles) ? user.roles : [user.roles];
    } else if (user?.role) {
      roles = [user.role];
    } else if (user?.realm_access?.roles) {
      // Keycloak/Authentik format
      roles = user.realm_access.roles;
    } else if (user?.groups) {
      roles = user.groups;
    }

    // Normalize roles (convert to lowercase for consistent comparison)
    const normalizedRoles = roles.map(r => r.toLowerCase().trim());

    return {
      roles,
      normalizedRoles,
      tenantId: user?.tenantId || req.headers['x-tenant-id'] as string,
      brokerId: user?.brokerId,
      organizationId: user?.organizationId || user?.org_id,
      clientId: user?.clientId || user?.client_id,
      metadata: user?.metadata || {},
      customClaims: user || {}
    };
  }

  /**
   * Extract roles from token claims
   * 
   * @param claims - Token claims object
   * @returns Array of roles
   */
  public static extractRoles(claims: any): string[] {
    if (!claims) return [];
    
    if (claims.roles) {
      return Array.isArray(claims.roles) ? claims.roles : [claims.roles];
    }
    if (claims.realm_access?.roles) {
      return claims.realm_access.roles;
    }
    if (claims.groups) {
      return Array.isArray(claims.groups) ? claims.groups : [claims.groups];
    }
    
    return [];
  }

  /**
   * Normalize a single role
   * 
   * @param role - Role string
   * @returns Normalized role string
   */
  public static normalizeRole(role: string): string {
    return role.toLowerCase().trim();
  }
}