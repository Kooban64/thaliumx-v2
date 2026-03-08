/**
 * Auth Attributes Service
 * 
 * Utility service to extract runtime user attributes from Express Request objects
 * and JWT token payloads.
 */

import type { Request } from 'express';
import { RoleMapperService } from './role-mapper';

export interface ZitadelContext {
  organizationId?: string;
  clientId?: string;
  brokerId?: string;
  roles: string[];
  normalizedRoles: string[];
  metadata?: Record<string, any>;
  customClaims?: Record<string, any>;
}

export class AuthAttributesService {
  private static extractRolesFromClaims(source: any): string[] {
    if (!source || typeof source !== 'object') {
      return [];
    }

    const directRoles = Array.isArray(source.roles) ? source.roles : [];
    const realmRoles = Array.isArray(source.realm_access?.roles) ? source.realm_access.roles : [];

    const resourceRoles = source.resource_access && typeof source.resource_access === 'object'
      ? Object.values(source.resource_access)
          .flatMap((resource: any) => (Array.isArray(resource?.roles) ? resource.roles : []))
      : [];

    const primaryRole = typeof source.role === 'string' ? [source.role] : [];

    return Array.from(new Set([...directRoles, ...realmRoles, ...resourceRoles, ...primaryRole]));
  }

  /**
   * Extract auth attributes from an Express Request object.
   */
  public static extractFromRequest(req: Request): ZitadelContext {
    const user = req.user as any;
    const decoded = (req as any).decodedToken || user?.decodedToken;

    // Extract from JWT token payload (if available)
    const organizationId = decoded?.org_id || decoded?.organization_id || user?.organization_id || user?.organizationId;
    const clientId = decoded?.azp || decoded?.client_id || user?.azp || user?.client_id || user?.clientId;
    const brokerId = decoded?.broker_id || decoded?.brokerId || user?.broker_id || user?.brokerId;

    // Extract roles from standard Keycloak-compatible claims
    const decodedRoles = this.extractRolesFromClaims(decoded);
    const userRoles = this.extractRolesFromClaims(user);
    const allRoles = Array.from(new Set([...decodedRoles, ...userRoles]));
    const normalizedRoles = RoleMapperService.normalizeRoles(allRoles);

    // Extract metadata and custom claims
    const metadata: Record<string, any> = {};
    const customClaims: Record<string, any> = {};

    if (decoded) {
      // Extract non-standard claims as custom claims
      Object.keys(decoded).forEach(key => {
        if (!['sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti', 'email', 'preferred_username', 'role', 'roles', 'realm_access', 'resource_access', 'azp', 'client_id', 'tenant_id', 'tenantId', 'broker_id', 'brokerId', 'org_id', 'organization_id'].includes(key)) {
          customClaims[key] = decoded[key];
        }
      });
    }

    return {
      organizationId,
      clientId,
      brokerId,
      roles: allRoles,
      normalizedRoles,
      metadata,
                customClaims
    };
  }

  /**
   * Extract auth attributes from a JWT token payload.
   */
  public static extractFromToken(payload: any): ZitadelContext {
    const organizationId = payload?.org_id || payload?.organization_id;
    const clientId = payload?.azp || payload?.client_id;
    const brokerId = payload?.broker_id || payload?.brokerId;

    const allRoles = this.extractRolesFromClaims(payload);
    const normalizedRoles = RoleMapperService.normalizeRoles(allRoles);

    // Extract custom claims
    const customClaims: Record<string, any> = {};
    Object.keys(payload || {}).forEach(key => {
      if (!['sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti', 'email', 'preferred_username', 'role', 'roles', 'realm_access', 'resource_access', 'azp', 'client_id', 'tenant_id', 'tenantId', 'broker_id', 'brokerId', 'org_id', 'organization_id'].includes(key)) {
        customClaims[key] = payload[key];
      }
    });

    return {
      organizationId,
      clientId,
      brokerId,
      roles: allRoles,
      normalizedRoles,
      metadata: {},
                customClaims
    };
  }
}

// Backward-compatible export during auth naming migration
export const ZitadelAttributesService = AuthAttributesService;
