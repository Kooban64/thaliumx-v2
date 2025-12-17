/**
 * Tenant Middleware
 * 
 * Extracts tenant ID from request headers, query parameters, or body.
 * Sets default tenant to 'platform-default-tenant' if not provided.
 * 
 * Priority:
 * 1. X-Tenant-ID header
 * 2. tenantId query parameter
 * 3. tenantId in request body
 * 4. Default: platform-default-tenant
 */

import { Request, Response, NextFunction } from 'express';
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
    let tenantId: string | undefined;

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

    // If no tenant ID provided, use default: platform-default-tenant
    if (!tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      const defaultTenant = await TenantModel.findOne({
        where: { slug: 'platform-default-tenant' }
      });
      
      if (defaultTenant) {
        tenantId = defaultTenant.id;
        LoggerService.debug('Using default tenant: platform-default-tenant', { tenantId });
      } else {
        LoggerService.warn('Default tenant not found, using first available tenant');
        const firstTenant = await TenantModel.findOne({ where: { isActive: true } });
        if (firstTenant) {
          tenantId = firstTenant.id;
        }
      }
    }

    // Validate tenant exists and is active
    if (tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      const tenant = await TenantModel.findOne({
        where: { id: tenantId, isActive: true }
      });

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
    let tenantId: string | undefined;

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
        where: { slug: 'platform-default-tenant' }
      });
      
      if (defaultTenant) {
        tenantId = defaultTenant.id;
      }
    }

    // Set tenant if found
    if (tenantId) {
      const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
      const tenant = await TenantModel.findOne({
        where: { id: tenantId, isActive: true }
      });

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
