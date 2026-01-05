/**
 * Tenant Middleware
 * 
 * Extracts tenant ID from request headers, query parameters, or body.
 * Sets default tenant to the platform tenant slug if not provided.
 * 
 * Priority:
 * 1. X-Tenant-ID header
 * 2. tenantId query parameter
 * 3. tenantId in request body
 * 4. Default: DEFAULT_TENANT_SLUG (fallback: thaliumx-platform)
 */

import type { Request, Response, NextFunction } from 'express';
import type { Model, ModelCtor } from 'sequelize';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: any;
}

type TenantModelInstance = Model & {
  id: string;
  slug: string;
  isActive: boolean;
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

    // Basic UUID v4/v1/etc check to avoid Postgres "invalid input syntax for type uuid".
    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // Priority 1: X-Tenant-ID header
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    }
    // Priority 2: tenantId query parameter
    else if (req.query.tenantId) {
      tenantId = req.query.tenantId as string;
    }
    // Priority 3: tenantId in request body (for POST/PUT requests)
    else if (req.body && req.body.tenantId) {
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

    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // Try to get tenant ID from various sources
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    } else if (req.query.tenantId) {
      tenantId = req.query.tenantId as string;
    } else if (req.body && req.body.tenantId) {
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
      }
    }

    next();
  } catch (error: any) {
    // Don't fail on error, just log and continue
    LoggerService.warn('Optional tenant middleware error:', error);
    next();
  }
};
