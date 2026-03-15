/**
 * Tenant Middleware
 * 
 * Extracts tenant ID from request headers, query parameters, or body.
 * Sets default tenant to the platform tenant slug if not provided.
 * 
 * SECURITY: This middleware validates the X-Tenant-ID header against the
 * authenticated user's token claims. If the gateway is compromised and sends
 * a different tenant ID than what was authenticated, the request will be rejected.
 * 
 * Priority (when authenticated):
 * 1. Validate X-Tenant-ID against token claims (SECURITY CHECK)
 * 2. Use token's tenantId
 * 
 * Priority (when not authenticated / fallback):
 * 1. X-Tenant-ID header
 * 2. tenantId query parameter
 * 3. tenantId in request body
 * 4. Default: DEFAULT_TENANT_SLUG (fallback: thaliumx-platform)
 */

import type { Request, Response, NextFunction } from 'express';
import type { Model, ModelCtor } from 'sequelize';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: any;
  tenantScope?: TenantScope;
}

export interface TenantScope {
  tenantId: string;
  tenantSlug?: string;
  isPlatformAdmin: boolean;
  isBrokerAdmin: boolean;
  allowedTenantIds?: string[];
}

// Tenant scope storage for request context
const tenantScopeMap = new Map<string, TenantScope>();

type TenantModelInstance = Model & {
  id: string;
  slug: string;
  tenantType: 'regular' | 'broker' | 'platform';
  isActive: boolean;
};

/**
 * Check if user has platform-admin privileges
 */
const isPlatformAdmin = (user: any): boolean => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const role = user.role;
  return role === 'platform_admin' || role === 'super_admin' || 
         roles.includes('platform_admin') || roles.includes('super_admin') ||
         roles.includes('master_system_admin');
};

/**
 * Check if user has broker-admin privileges
 */
const isBrokerAdmin = (user: any, tenant: any): boolean => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const role = user.role;
  
  // Check if user has broker admin role
  if (role === 'broker_admin' || roles.includes('broker_admin')) {
    return true;
  }
  
  // Check if user's tenant is a broker tenant and they have admin-like role
  if (tenant && tenant.tenantType === 'broker') {
    return role === 'admin' || roles.includes('admin') || 
           role === 'broker_manager' || roles.includes('broker_manager');
  }
  
  return false;
};

/**
 * Build tenant scope for database query isolation
 */
const buildTenantScope = (
  tenantId: string,
  tenant: TenantModelInstance | null,
  user: any
): TenantScope => {
  const tenantData = tenant?.toJSON();
  
  return {
    tenantId,
    tenantSlug: tenantData?.slug,
    isPlatformAdmin: isPlatformAdmin(user),
    isBrokerAdmin: isBrokerAdmin(user, tenantData),
    // Platform admins can access multiple tenants, regular users are scoped to their tenant
    allowedTenantIds: isPlatformAdmin(user) ? undefined : [tenantId]
  };
};

/**
 * Validate tenant ID against authenticated token claims
 * Returns the validated tenant ID or throws an error
 */
const validateTenantFromToken = (
  headerTenantId: string | undefined,
  user: any
): string | undefined => {
  // No authenticated user - can't validate
  if (!user) {
    return headerTenantId; // Will fall back to other sources
  }
  
  const tokenTenantId = user.tenantId;
  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  const userRole = user.role;
  
  // Platform admins can access any tenant
  if (isPlatformAdmin(user)) {
    return headerTenantId || tokenTenantId;
  }
  
  // If header tenant ID is provided, validate it matches token
  if (headerTenantId) {
    // Must match the token's tenant ID
    if (tokenTenantId && headerTenantId !== tokenTenantId) {
      throw createError(
        'Tenant ID mismatch: X-Tenant-ID header does not match authenticated token claims. This may indicate a security issue.',
        403,
        'TENANT_ID_MISMATCH'
      );
    }
    return headerTenantId;
  }
  
  // No header tenant ID - use token's tenant ID
  return tokenTenantId;
};

/**
 * Middleware to extract and validate tenant ID from request
 */
export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG || 'thaliumx-platform';
    let tenantId: string | undefined;
    const tenantSlugHeader = (req.headers['x-tenant-slug'] as string | undefined) || undefined;
    const headerTenantId = (req.headers['x-tenant-id'] as string | undefined) || undefined;

    // Basic UUID v4/v1/etc check to avoid Postgres "invalid input syntax for type uuid".
    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // SECURITY: Validate tenant ID from header against authenticated token
    const user = req.user as any;
    const validatedTenantId = validateTenantFromToken(headerTenantId, user);

    // Priority 1: Use validated tenant ID (from header + token validation)
    if (validatedTenantId) {
      tenantId = validatedTenantId;
    }
    // Priority 2: tenantId query parameter (only if not authenticated or platform admin)
    else if (req.query.tenantId && (!user || isPlatformAdmin(user))) {
      tenantId = req.query.tenantId as string;
    }
    // Priority 3: tenantId in request body (only if not authenticated or platform admin)
    else if (req.body && req.body.tenantId && (!user || isPlatformAdmin(user))) {
      tenantId = req.body.tenantId;
    }

    // If no tenant ID provided, use default tenant slug
    if (!tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      const defaultTenant = await TenantModel.findOne({
        where: { slug: defaultTenantSlug }
      });
      
      if (defaultTenant) {
        tenantId = defaultTenant.id;
        LoggerService.debug('Using default tenant', { tenantId, slug: defaultTenantSlug });
      } else {
        LoggerService.warn('Default tenant not found, using first available tenant', { defaultTenantSlug });
        const firstTenant = await TenantModel.findOne({ where: { isActive: true } });
        if (firstTenant) {
          tenantId = firstTenant.id;
        }
      }
    }

    // Validate tenant exists and is active
    if (tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      let tenant: TenantModelInstance | null = null;

      // 1) Try resolve by ID (if it looks like a UUID)
      if (isUuid(tenantId)) {
        tenant = await TenantModel.findOne({
          where: { id: tenantId, isActive: true }
        });
      }

      // 2) If ID is missing/invalid/not found, try resolve by slug header (useful when gateways inject slug)
      if (!tenant && tenantSlugHeader) {
        tenant = await TenantModel.findOne({
          where: { slug: tenantSlugHeader, isActive: true }
        });
        if (tenant) {
          tenantId = tenant.id;
          LoggerService.debug('Tenant resolved via slug header', { tenantId, slug: tenant.slug });
        }
      }

      if (tenant) {
        req.tenantId = tenantId;
        req.tenant = tenant;
        req.tenantScope = buildTenantScope(tenantId, tenant, user);
        LoggerService.debug('Tenant resolved', { tenantId, slug: tenant.slug });
      } else {
        LoggerService.warn('Invalid or inactive tenant ID', { tenantId });
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TENANT',
            message: 'Invalid or inactive tenant'
          }
        });
        return;
      }
    } else {
      LoggerService.error('No tenant ID available');
      res.status(400).json({
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Tenant ID is required'
        }
      });
      return;
    }

    next();
  } catch (error: any) {
    // Re-throw tenant ID mismatch errors with their original status
    if (error?.code === 'TENANT_ID_MISMATCH') {
      const user = req.user as any;
      LoggerService.warn('Tenant ID validation failed', {
        message: error.message,
        userId: user?.userId,
        headerTenantId: (req.headers['x-tenant-id'] as string | undefined),
        tokenTenantId: user?.tenantId
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_ID_MISMATCH',
          message: error.message
        }
      });
      return;
    }
    
    LoggerService.error('Tenant middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TENANT_MIDDLEWARE_ERROR',
        message: 'Failed to resolve tenant'
      }
    });
    return;
  }
};

/**
 * Optional tenant middleware - doesn't fail if tenant not found
 * Uses default tenant but doesn't block request
 * 
 * SECURITY: Also validates X-Tenant-ID against authenticated token claims
 */
export const optionalTenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG || 'thaliumx-platform';
    let tenantId: string | undefined;
    const tenantSlugHeader = (req.headers['x-tenant-slug'] as string | undefined) || undefined;
    const headerTenantId = (req.headers['x-tenant-id'] as string | undefined) || undefined;

    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // SECURITY: Validate tenant ID from header against authenticated token
    const user = req.user as any;
    const validatedTenantId = validateTenantFromToken(headerTenantId, user);

    // Try to get tenant ID from various sources (with validation)
    if (validatedTenantId) {
      tenantId = validatedTenantId;
    } else if (req.query.tenantId && (!user || isPlatformAdmin(user))) {
      tenantId = req.query.tenantId as string;
    } else if (req.body && req.body.tenantId && (!user || isPlatformAdmin(user))) {
      tenantId = req.body.tenantId;
    }

    // If no tenant ID, use default
    if (!tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      const defaultTenant = await TenantModel.findOne({
        where: { slug: defaultTenantSlug }
      });
      
      if (defaultTenant) {
        tenantId = defaultTenant.id;
      }
    }

    // Set tenant if found
    if (tenantId || tenantSlugHeader) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      let tenant: TenantModelInstance | null = null;

      if (tenantId && isUuid(tenantId)) {
        tenant = await TenantModel.findOne({ where: { id: tenantId, isActive: true } });
      }

      if (!tenant && tenantSlugHeader) {
        tenant = await TenantModel.findOne({ where: { slug: tenantSlugHeader, isActive: true } });
        if (tenant) tenantId = tenant.id;
      }

      if (tenant) {
        req.tenantId = tenantId;
        req.tenant = tenant;
        req.tenantScope = buildTenantScope(tenantId || '', tenant, user);
      }
    }

    next();
  } catch (error: any) {
    // Re-throw tenant ID mismatch errors with their original status (for optional middleware too)
    if (error?.code === 'TENANT_ID_MISMATCH') {
      const user = req.user as any;
      LoggerService.warn('Tenant ID validation failed (optional)', {
        message: error.message,
        userId: user?.userId,
        headerTenantId: (req.headers['x-tenant-id'] as string | undefined),
        tokenTenantId: user?.tenantId
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_ID_MISMATCH',
          message: error.message
        }
      });
      return;
    }
    
    // Don't fail on error, just log and continue
    LoggerService.warn('Optional tenant middleware error:', error);
    next();
  }
};

/**
 * Tenant Isolation Query Builder
 * 
 * Provides utilities to automatically scope database queries to the current tenant.
 * This ensures complete data isolation between tenants.
 * 
 * Usage:
 * ```typescript
 * const query = TenantIsolation.buildScopedQuery(
 *   { tenantId, isPlatformAdmin, allowedTenantIds },
 *   'users',
 *   { includeAll: isPlatformAdmin }
 * );
 * const users = await UserModel.findAll(query);
 * ```
 */
export class TenantIsolation {
  /**
   * Build a tenant-scoped query object for Sequelize
   */
  static buildScopedQuery(
    scope: TenantScope,
    _modelName: string,
    options: {
      includeAll?: boolean;  // For platform admins, include all tenants
      fallbackToAll?: boolean;  // If no tenant scope, allow all (use with caution)
    } = {}
  ): any {
    const { tenantId, isPlatformAdmin, allowedTenantIds } = scope;
    const { includeAll = false, fallbackToAll = false } = options;

    // Platform admins can see all data if explicitly allowed
    if (isPlatformAdmin && includeAll) {
      return {}; // No filtering
    }

    // If allowedTenantIds is defined and not empty, use it
    if (allowedTenantIds && allowedTenantIds.length > 0) {
      return {
        where: {
          tenantId: {
            $in: allowedTenantIds
          }
        }
      };
    }

    // Regular tenant scoping
    if (tenantId) {
      return {
        where: {
          tenantId: tenantId
        }
      };
    }

    // Fallback: if no tenant scope but allowed, return no filter
    if (fallbackToAll) {
      LoggerService.warn('TenantIsolation: Using fallback to all data (no tenant filter)', {
        isPlatformAdmin,
        hasTenantId: !!tenantId
      });
      return {};
    }

    // Default: filter to no data (safe default)
    LoggerService.warn('TenantIsolation: No tenant scope, returning empty filter', {
      isPlatformAdmin,
      hasTenantId: !!tenantId
    });
    return {
      where: {
        tenantId: null // Match nothing by default
      }
    };
  }

  /**
   * Add tenant scope to a raw SQL query
   */
  static scopeSqlQuery(sql: string, scope: TenantScope): string {
    const { tenantId, isPlatformAdmin, allowedTenantIds } = scope;

    // Platform admins see all
    if (isPlatformAdmin) {
      return sql;
    }

    // Build tenant filter
    let tenantFilter: string;
    if (allowedTenantIds && allowedTenantIds.length > 0) {
      const ids = allowedTenantIds.map(id => `'${id}'`).join(', ');
      tenantFilter = `tenantId IN (${ids})`;
    } else if (tenantId) {
      tenantFilter = `tenantId = '${tenantId}'`;
    } else {
      tenantFilter = '1=0'; // Match nothing
    }

    // Add tenant filter to WHERE clause or append
    if (sql.toLowerCase().includes('where')) {
      return sql.replace(/where/i, `WHERE ${tenantFilter} AND (`) + ')';
    } else {
      return sql + ` WHERE ${tenantFilter}`;
    }
  }

  /**
   * Validate that a user can access a specific resource tenant
   */
  static canAccessTenant(scope: TenantScope, targetTenantId: string): boolean {
    const { isPlatformAdmin, allowedTenantIds } = scope;

    // Platform admins can access any tenant
    if (isPlatformAdmin) {
      return true;
    }

    // Check if target tenant is in allowed list
    if (allowedTenantIds && allowedTenantIds.length > 0) {
      return allowedTenantIds.includes(targetTenantId);
    }

    // Direct tenant ID match
    return scope.tenantId === targetTenantId;
  }

  /**
   * Middleware factory for automatic tenant scoping
   * Apply this to routes that need automatic tenant isolation
   */
  static middleware(required: boolean = true) {
    return (req: TenantRequest, res: Response, next: NextFunction): void => {
      const scope = req.tenantScope;
      
      if (!scope && required) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TENANT_SCOPE_REQUIRED',
            message: 'Tenant scope is required for this operation'
          }
        });
        return;
      }

      // Attach tenant isolation helpers to request
      (req as any).tenantIsolation = {
        scope,
        buildQuery: (modelName: string, options?: any) => 
          this.buildScopedQuery(scope!, modelName, options),
        scopeSql: (sql: string) => this.scopeSqlQuery(sql, scope!),
        canAccess: (tenantId: string) => this.canAccessTenant(scope!, tenantId)
      };

      next();
    };
  }
}
