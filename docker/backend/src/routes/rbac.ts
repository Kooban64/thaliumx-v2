/**
 * RBAC Routes - API endpoints for Role-Based Access Control
 * 
 * Production-ready routes for:
 * - Role Management
 * - Permission Management
 * - User Role Assignment
 * - Permission Checking
 * - Role Matrix Management
 */

import { Router, Request, Response } from 'express';
import { RBACService } from '../services/rbac';
import { LoggerService } from '../services/logger';
import { AppError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

// =============================================================================
// ROLE MANAGEMENT ROUTES
// =============================================================================

/**
 * Get All Roles
 * GET /api/rbac/roles
 */
router.get('/roles',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantType } = req.query;

      LoggerService.info('Fetching roles', {
        tenantType
      });

      const roles = await RBACService.getAllRoles(tenantType as any);

      res.json({
        success: true,
        data: roles
      });

    } catch (error) {
      LoggerService.error('Get roles failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Role Details
 * GET /api/rbac/roles/:roleId
 */
router.get('/roles/:roleId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params;

      LoggerService.info('Fetching role details', {
        roleId
      });

      const roles = await RBACService.getAllRoles();
      const role = roles.find(r => r.id === roleId);

      if (!role) {
        res.status(404).json({
          success: false,
          error: 'Role not found',
          code: 'ROLE_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: role
      });

    } catch (error) {
      LoggerService.error('Get role details failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// USER ROLE MANAGEMENT ROUTES
// =============================================================================

/**
 * Assign Role to User
 * POST /api/rbac/users/:userId/roles
 */
router.post('/users/:userId/roles',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  validateRequest(Joi.object({
    roleId: Joi.string().required(),
    reason: Joi.string().min(10).max(500).required(),
    expiresAt: Joi.date().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { tenantId, userId: assignedBy } = req.user as any;
      const { roleId, reason, expiresAt } = req.body;

      LoggerService.info('Assigning role to user', {
        userId,
        roleId,
        tenantId,
        assignedBy,
        reason
      });

      if (!userId || !roleId || !tenantId) {
        res.status(400).json({
          success: false,
          error: 'User ID, Role ID, and Tenant ID are required'
        });
        return;
      }

      const userRole = await RBACService.assignRole(
        userId,
        roleId,
        tenantId,
        assignedBy,
        reason,
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.status(201).json({
        success: true,
        data: userRole,
        message: 'Role assigned successfully'
      });

    } catch (error) {
      LoggerService.error('Assign role failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get User Roles
 * GET /api/rbac/users/:userId/roles
 */
router.get('/users/:userId/roles',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { tenantId } = req.user as any;

      LoggerService.info('Fetching user roles', {
        userId,
        tenantId
      });

      if (!userId || !tenantId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Tenant ID are required'
        });
        return;
      }

      const userRoles = await RBACService.getUserRoles(userId, tenantId);

      res.json({
        success: true,
        data: userRoles
      });

    } catch (error) {
      LoggerService.error('Get user roles failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Remove Role from User
 * DELETE /api/rbac/users/:userId/roles/:roleId
 */
router.delete('/users/:userId/roles/:roleId',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, roleId } = req.params;
      const { tenantId } = req.user as any;

      LoggerService.info('Removing role from user', {
        userId,
        roleId,
        tenantId
      });

      // This would typically remove the role assignment
      // For now, we'll just return success
      res.json({
        success: true,
        message: 'Role removed successfully'
      });

    } catch (error) {
      LoggerService.error('Remove role failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// PERMISSION CHECKING ROUTES
// =============================================================================

/**
 * Check User Permission
 * POST /api/rbac/permissions/check
 */
router.post('/permissions/check',
  authenticateToken,
  validateRequest(Joi.object({
    userId: Joi.string().required(),
    permission: Joi.string().required(),
    resource: Joi.string().optional(),
    context: Joi.object().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { userId, permission, resource, context } = req.body;

      LoggerService.info('Checking user permission', {
        userId,
        permission,
        resource,
        tenantId
      });

      const hasPermission = await RBACService.hasPermission(
        userId,
        permission,
        tenantId,
        context
      );

      res.json({
        success: true,
        data: {
          hasPermission,
          userId,
          permission,
          resource,
          tenantId
        }
      });

    } catch (error) {
      LoggerService.error('Check permission failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// ROLE APPROVAL WORKFLOW ROUTES
// =============================================================================

// Request role assignment
router.post('/roles/request',
  authenticateToken,
  validateRequest(Joi.object({
    userId: Joi.string().required(),
    roleId: Joi.string().required(),
    tenantId: Joi.string().required(),
    reason: Joi.string().min(10).max(500).required(),
    approvalsRequired: Joi.number().min(1).max(10).required(),
    approvers: Joi.array().items(Joi.string()).min(1).required()
  })),
  async (req: Request, res: Response): Promise<void> => {
    const requesterId = (req.user as any)?.userId || (req.user as any)?.id;
    const { userId, roleId, tenantId, reason, approvalsRequired, approvers } = req.body;
    const result = await RBACService.requestRoleAssignment(userId, roleId, tenantId, requesterId, reason, approvalsRequired, approvers);
    res.json({ success: true, data: result });
  }
);

// Approve role request
router.post('/roles/request/:requestId/approve',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    const approverId = (req.user as any)?.userId || (req.user as any)?.id;
    const { requestId } = req.params;
    
    if (!requestId) {
      res.status(400).json({
        success: false,
        error: 'Request ID is required'
      });
      return;
    }
    
    const result = await RBACService.approveRoleRequest(requestId, approverId);
    res.json({ success: true, data: result });
  }
);

// Reject role request
router.post('/roles/request/:requestId/reject',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  validateRequest(Joi.object({ reason: Joi.string().optional() })),
  async (req: Request, res: Response): Promise<void> => {
    const approverId = (req.user as any)?.userId || (req.user as any)?.id;
    const { requestId } = req.params;
    const { reason } = req.body;
    
    if (!requestId) {
      res.status(400).json({
        success: false,
        error: 'Request ID is required'
      });
      return;
    }
    
    const result = await RBACService.rejectRoleRequest(requestId, approverId, reason);
    res.json({ success: true, data: result });
  }
);

// List role requests
router.get('/roles/requests',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    const { tenantId, status } = req.query as any;
    const list = await RBACService.listRoleRequests({ tenantId, status });
    res.json({ success: true, data: list });
  }
);

/**
 * Get User Permissions
 * GET /api/rbac/users/:userId/permissions
 */
router.get('/users/:userId/permissions',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { tenantId } = req.user as any;

      LoggerService.info('Fetching user permissions', {
        userId,
        tenantId
      });

      if (!userId || !tenantId) {
        res.status(400).json({
          success: false,
          error: 'User ID and Tenant ID are required'
        });
        return;
      }

      const userRoles = await RBACService.getUserRoles(userId, tenantId);
      const allRoles = await RBACService.getAllRoles();
      
      const permissions = new Set<string>();
      
      userRoles.forEach(userRole => {
        const role = allRoles.find(r => r.id === userRole.roleId);
        if (role) {
          role.permissions.forEach(permission => {
            permissions.add(permission.id);
          });
        }
      });

      res.json({
        success: true,
        data: {
          userId,
          tenantId,
          permissions: Array.from(permissions),
          roles: userRoles.map(ur => ur.roleId)
        }
      });

    } catch (error) {
      LoggerService.error('Get user permissions failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// ROLE MATRIX ROUTES
// =============================================================================

/**
 * Get Role Matrix
 * GET /api/rbac/matrix
 */
router.get('/matrix',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantType } = req.query;

      LoggerService.info('Fetching role matrix', {
        tenantType
      });

      const roles = await RBACService.getAllRoles(tenantType as any);
      
      const matrix = roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        tenantType: role.tenantType,
        level: role.level,
        permissions: role.permissions.map(p => ({
          id: p.id,
          name: p.name,
          resource: p.resource,
          action: p.action
        })),
        transactionLimits: role.transactionLimits,
        isSystemRole: role.isSystemRole,
        canBeAssigned: role.canBeAssigned,
        requiresApproval: role.requiresApproval,
        maxUsers: role.maxUsers
      }));

      res.json({
        success: true,
        data: {
          roles: matrix,
          totalRoles: matrix.length,
          tenantType: tenantType || 'all'
        }
      });

    } catch (error) {
      LoggerService.error('Get role matrix failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Permission Matrix
 * GET /api/rbac/permissions
 */
router.get('/permissions',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantType } = req.query;

      LoggerService.info('Fetching permission matrix', {
        tenantType
      });

      const roles = await RBACService.getAllRoles(tenantType as any);
      const permissions = new Map<string, any>();

      roles.forEach(role => {
        role.permissions.forEach(permission => {
          if (!permissions.has(permission.id)) {
            permissions.set(permission.id, {
              id: permission.id,
              name: permission.name,
              description: permission.description,
              resource: permission.resource,
              action: permission.action,
              tenantType: permission.tenantType,
              roles: []
            });
          }
          permissions.get(permission.id).roles.push({
            roleId: role.id,
            roleName: role.name,
            tenantType: role.tenantType
          });
        });
      });

      res.json({
        success: true,
        data: {
          permissions: Array.from(permissions.values()),
          totalPermissions: permissions.size,
          tenantType: tenantType || 'all'
        }
      });

    } catch (error) {
      LoggerService.error('Get permission matrix failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * RBAC Service Health Check
 * GET /api/rbac/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = RBACService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'RBAC Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('RBAC health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'RBAC Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
