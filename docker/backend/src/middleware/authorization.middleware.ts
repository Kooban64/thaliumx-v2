/**
 * Authorization Middleware
 * 
 * Standardized authorization middleware that uses OPA for all authorization decisions.
 * Replaces direct RBAC checks with policy-based authorization for consistency
 * and compliance with financial services standards.
 * 
 * Features:
 * - All authorization decisions go through OPA
 * - Comprehensive audit logging
 * - Fail-secure (deny by default)
 * - Performance optimized with caching
 */

import type { Request, Response, NextFunction } from 'express';
import { OPAService } from '../services/opa';
import { OPAInputBuilder } from '../services/opa-input-builder';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';

export interface AuthorizationOptions {
  /** Resource type (e.g., 'user', 'order', 'transaction') */
  resourceType?: string;
  /** Action (e.g., 'read', 'create', 'update', 'delete') */
  action?: string;
  /** Resource ID (for ownership checks) */
  resourceId?: string;
  /** Additional context for OPA input */
  additionalContext?: Record<string, any>;
  /** Whether to require MFA for this action */
  requireMfa?: boolean;
  /** Custom error message on denial */
  errorMessage?: string;
}

/**
 * Authorization middleware factory
 * Creates middleware that enforces authorization via OPA
 */
export function authorize(options: AuthorizationOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check authentication first
      if (!req.user) {
        await LoggerService.logAudit('authorization_denied', 'authorization', { userId: undefined }, {
          reason: 'not_authenticated',
          resourceType: options.resourceType,
          action: options.action,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        return;
      }

      // Extract resource type and action if not provided
      const resourceType = options.resourceType || 
        OPAInputBuilder.extractResourceType(req);
      const action = options.action || 
        OPAInputBuilder.extractAction(req);
      const resourceId = options.resourceId || req.params?.id;

      // Build OPA input
      const opaInput = await OPAInputBuilder.buildFromRequest(
        req,
        resourceType,
        action,
        resourceId,
        options.additionalContext
      );

      // Check MFA requirement if specified
      if (options.requireMfa) {
        const user = req.user as any;
        if (!user.mfa_enabled || !user.mfa_verified) {
          await LoggerService.logAudit('authorization_denied', 'authorization', { userId: user.id || user.userId }, {
            reason: 'mfa_required',
            resourceType,
            action,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });

          next(createError('Multi-factor authentication required', 403, 'MFA_REQUIRED'));
          return;
        }
      }

      // Evaluate authorization with OPA
      const opaService = new OPAService();
      const decisions = await opaService.evaluateSecurityPolicy(opaInput);

      // Check if any decision explicitly denies
      const denied = decisions.some(d => d.allowed === false);
      if (denied) {
        const denialReason = decisions.find(d => d.allowed === false)?.reason || 'Access denied by policy';
        
        await LoggerService.logAudit('authorization_denied', 'authorization', { userId: opaInput.user.id }, {
          reason: denialReason,
          resourceType,
          action,
          resourceId,
          opaDecision: decisions,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        next(createError(
          options.errorMessage || 'Insufficient permissions',
          403,
          'AUTHORIZATION_DENIED'
        ));
        return;
      }

      // Check if any decision allows
      const allowed = decisions.some(d => d.allowed === true);
      if (!allowed) {
        // Default deny if no explicit allow
        await LoggerService.logAudit('authorization_denied', 'authorization', { userId: opaInput.user.id }, {
          reason: 'no_explicit_allow',
          resourceType,
          action,
          resourceId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        next(createError(
          options.errorMessage || 'Access denied',
          403,
          'AUTHORIZATION_DENIED'
        ));
        return;
      }

      // Authorization granted - log success
      await LoggerService.logAudit('authorization_granted', 'authorization', { userId: opaInput.user.id }, {
        resourceType,
        action,
        resourceId,
        opaDecision: decisions,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Attach authorization context to request for downstream use
      (req as any).authorization = {
        resourceType,
        action,
        resourceId,
        decisions,
      };

      next();
    } catch (error) {
      LoggerService.error('Authorization middleware error', error);
      
      // Fail secure - deny on error
      await LoggerService.logAudit('authorization_error', 'authorization', { 
        userId: (req.user as any)?.id || (req.user as any)?.userId 
      }, {
        reason: error instanceof Error ? error.message : 'unknown_error',
        resourceType: options.resourceType,
        action: options.action,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      next(createError('Authorization check failed', 500, 'AUTHORIZATION_ERROR'));
    }
  };
}

/**
 * Convenience middleware for common authorization patterns
 */
export const requireResourceAccess = (resourceType: string, action: string) => {
  return authorize({ resourceType, action });
};

export const requireResourceOwnership = (resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const resourceId = req.params?.id;
    const ownerId = (req.body as any)?.userId || (req.body as any)?.owner_id;

    if (!ownerId) {
      next(createError('Resource owner not specified', 400, 'INVALID_REQUEST'));
      return;
    }

    return authorize({
      resourceType,
      action: 'read',
      resourceId,
      additionalContext: {
        resource: { owner_id: ownerId },
      },
    })(req, res, next);
  };
};
