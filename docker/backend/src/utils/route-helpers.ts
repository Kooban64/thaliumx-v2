/**
 * Route Helper Utilities
 * 
 * Safe parameter extraction and type guards for Express routes
 */

import { Request } from 'express';

/**
 * Safely extract a required string parameter from request
 * Throws error if parameter is missing or undefined
 */
export function getRequiredParam(req: Request, paramName: string): string {
  const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
  if (!value || typeof value !== 'string') {
    throw new Error(`Required parameter '${paramName}' is missing or invalid`);
  }
  return value;
}

/**
 * Safely extract an optional string parameter from request
 */
export function getOptionalParam(req: Request, paramName: string): string | undefined {
  const value = req.params[paramName] || req.query[paramName] || req.body[paramName];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely extract user ID from authenticated request
 */
export function getUserId(req: Request): string {
  const user = req.user as any;
  if (!user || !user.id) {
    throw new Error('User ID not found in request');
  }
  return user.id;
}

/**
 * Safely extract tenant ID from request
 */
export function getTenantId(req: Request): string {
  const user = req.user as any;
  const paramTenantId = req.params.tenantId;
  
  if (paramTenantId && typeof paramTenantId === 'string') {
    return paramTenantId;
  }
  
  if (user?.tenantId && typeof user.tenantId === 'string') {
    return user.tenantId;
  }
  
  throw new Error('Tenant ID not found in request');
}

/**
 * Safely extract optional tenant ID from request
 */
export function getOptionalTenantId(req: Request): string | undefined {
  const user = req.user as any;
  const paramTenantId = req.params.tenantId;
  
  if (paramTenantId && typeof paramTenantId === 'string') {
    return paramTenantId;
  }
  
  return user?.tenantId && typeof user.tenantId === 'string' ? user.tenantId : undefined;
}

/**
 * Type guard to ensure all code paths return a value
 * Use this wrapper for async route handlers
 */
export function asyncHandler(
  handler: (req: Request, res: any, next: any) => Promise<any>
): (req: Request, res: any, next: any) => Promise<void> {
  return async (req: Request, res: any, next: any): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

