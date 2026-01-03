/**
 * Zitadel Attributes Service
 * 
 * Utility service to extract Zitadel user attributes from Express Request objects
 * and JWT token payloads.
 */

import { Request } from 'express';
import { RoleMapperService } from './role-mapper';

export interface ZitadelContext {
  organizationId?: string;
  projectId?: string;
  brokerId?: string;
  roles: string[];
  normalizedRoles: string[];
  metadata?: Record<string, any>;
  customClaims?: Record<string, any>;
}

export class ZitadelAttributesService {
  /**
   * Extract Zitadel attributes from an Express Request object.
   */
  public static extractFromRequest(req: Request): ZitadelContext {
    const user = req.user as any;
    const decoded = (req as any).decodedToken || user?.decodedToken;

    // Extract from JWT token payload (if available)
    const organizationId = decoded?.org_id || decoded?.organization_id || user?.organization_id || user?.organizationId;
    const projectId = decoded?.project_id || decoded?.projectId || user?.project_id || user?.projectId;
    const brokerId = decoded?.broker_id || decoded?.brokerId || user?.broker_id || user?.brokerId;

    // Extract roles from Zitadel-specific claim
    const zitadelRolesObj = decoded?.['urn:zitadel:iam:org:project:roles'] || user?.['urn:zitadel:iam:org:project:roles'];
    const roleKeys: string[] = zitadelRolesObj && typeof zitadelRolesObj === 'object' && !Array.isArray(zitadelRolesObj)
      ? Object.keys(zitadelRolesObj)
      : [];

    // Also check standard roles array
    const standardRoles = Array.isArray(decoded?.roles) ? decoded.roles : 
                         Array.isArray(user?.roles) ? user.roles : [];

    // Combine all roles
    const allRoles = Array.from(new Set([...roleKeys, ...standardRoles]));
    const normalizedRoles = RoleMapperService.normalizeRoles(allRoles);

    // Extract metadata and custom claims
    const metadata: Record<string, any> = {};
    const customClaims: Record<string, any> = {};

    if (decoded) {
      // Extract non-standard claims as custom claims
      Object.keys(decoded).forEach(key => {
        if (!['sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti', 'email', 'preferred_username', 'roles', 'tenant_id', 'tenantId', 'broker_id', 'brokerId', 'org_id', 'organization_id', 'project_id', 'projectId', 'urn:zitadel:iam:org:project:roles'].includes(key)) {
          customClaims[key] = decoded[key];
        }
      });
    }

    return {
      organizationId,
      projectId,
      brokerId,
      roles: allRoles,
      normalizedRoles,
      metadata,
      customClaims
    };
  }

  /**
   * Extract Zitadel attributes from a JWT token payload.
   */
  public static extractFromToken(payload: any): ZitadelContext {
    const organizationId = payload?.org_id || payload?.organization_id;
    const projectId = payload?.project_id || payload?.projectId;
    const brokerId = payload?.broker_id || payload?.brokerId;

    // Extract roles from Zitadel-specific claim
    const zitadelRolesObj = payload?.['urn:zitadel:iam:org:project:roles'];
    const roleKeys: string[] = zitadelRolesObj && typeof zitadelRolesObj === 'object' && !Array.isArray(zitadelRolesObj)
      ? Object.keys(zitadelRolesObj)
      : [];

    // Also check standard roles array
    const standardRoles = Array.isArray(payload?.roles) ? payload.roles : [];
    const allRoles = Array.from(new Set([...roleKeys, ...standardRoles]));
    const normalizedRoles = RoleMapperService.normalizeRoles(allRoles);

    // Extract custom claims
    const customClaims: Record<string, any> = {};
    Object.keys(payload || {}).forEach(key => {
      if (!['sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'jti', 'email', 'preferred_username', 'roles', 'tenant_id', 'tenantId', 'broker_id', 'brokerId', 'org_id', 'organization_id', 'project_id', 'projectId', 'urn:zitadel:iam:org:project:roles'].includes(key)) {
        customClaims[key] = payload[key];
      }
    });

    return {
      organizationId,
      projectId,
      brokerId,
      roles: allRoles,
      normalizedRoles,
      metadata: {},
      customClaims
    };
  }
}
