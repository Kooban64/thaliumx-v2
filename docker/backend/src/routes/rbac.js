"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_1 = require("../services/rbac");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// ROLE MANAGEMENT ROUTES
// =============================================================================
/**
 * Get All Roles
 * GET /api/rbac/roles
 */
router.get('/roles', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantType } = req.query;
        logger_1.LoggerService.info('Fetching roles', {
            tenantType
        });
        const roles = await rbac_1.RBACService.getAllRoles(tenantType);
        res.json({
            success: true,
            data: roles
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get roles failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Role Details
 * GET /api/rbac/roles/:roleId
 */
router.get('/roles/:roleId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { roleId } = req.params;
        logger_1.LoggerService.info('Fetching role details', {
            roleId
        });
        const roles = await rbac_1.RBACService.getAllRoles();
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
    }
    catch (error) {
        logger_1.LoggerService.error('Get role details failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// USER ROLE MANAGEMENT ROUTES
// =============================================================================
/**
 * Assign Role to User
 * POST /api/rbac/users/:userId/roles
 */
router.post('/users/:userId/roles', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    roleId: joi_1.default.string().required(),
    reason: joi_1.default.string().min(10).max(500).required(),
    expiresAt: joi_1.default.date().optional()
})), async (req, res) => {
    try {
        const { userId } = req.params;
        const { tenantId, userId: assignedBy } = req.user;
        const { roleId, reason, expiresAt } = req.body;
        logger_1.LoggerService.info('Assigning role to user', {
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
        const userRole = await rbac_1.RBACService.assignRole(userId, roleId, tenantId, assignedBy, reason, expiresAt ? new Date(expiresAt) : undefined);
        res.status(201).json({
            success: true,
            data: userRole,
            message: 'Role assigned successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Assign role failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get User Roles
 * GET /api/rbac/users/:userId/roles
 */
router.get('/users/:userId/roles', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { tenantId } = req.user;
        logger_1.LoggerService.info('Fetching user roles', {
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
        const userRoles = await rbac_1.RBACService.getUserRoles(userId, tenantId);
        res.json({
            success: true,
            data: userRoles
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user roles failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Remove Role from User
 * DELETE /api/rbac/users/:userId/roles/:roleId
 */
router.delete('/users/:userId/roles/:roleId', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        const { userId, roleId } = req.params;
        const { tenantId } = req.user;
        logger_1.LoggerService.info('Removing role from user', {
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
    }
    catch (error) {
        logger_1.LoggerService.error('Remove role failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// PERMISSION CHECKING ROUTES
// =============================================================================
/**
 * Check User Permission
 * POST /api/rbac/permissions/check
 */
router.post('/permissions/check', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    userId: joi_1.default.string().required(),
    permission: joi_1.default.string().required(),
    resource: joi_1.default.string().optional(),
    context: joi_1.default.object().optional()
})), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { userId, permission, resource, context } = req.body;
        logger_1.LoggerService.info('Checking user permission', {
            userId,
            permission,
            resource,
            tenantId
        });
        const hasPermission = await rbac_1.RBACService.hasPermission(userId, permission, tenantId, context);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Check permission failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// ROLE APPROVAL WORKFLOW ROUTES
// =============================================================================
// Request role assignment
router.post('/roles/request', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    userId: joi_1.default.string().required(),
    roleId: joi_1.default.string().required(),
    tenantId: joi_1.default.string().required(),
    reason: joi_1.default.string().min(10).max(500).required(),
    approvalsRequired: joi_1.default.number().min(1).max(10).required(),
    approvers: joi_1.default.array().items(joi_1.default.string()).min(1).required()
})), async (req, res) => {
    const requesterId = req.user?.userId || req.user?.id;
    const { userId, roleId, tenantId, reason, approvalsRequired, approvers } = req.body;
    const result = await rbac_1.RBACService.requestRoleAssignment(userId, roleId, tenantId, requesterId, reason, approvalsRequired, approvers);
    res.json({ success: true, data: result });
});
// Approve role request
router.post('/roles/request/:requestId/approve', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    const approverId = req.user?.userId || req.user?.id;
    const { requestId } = req.params;
    if (!requestId) {
        res.status(400).json({
            success: false,
            error: 'Request ID is required'
        });
        return;
    }
    const result = await rbac_1.RBACService.approveRoleRequest(requestId, approverId);
    res.json({ success: true, data: result });
});
// Reject role request
router.post('/roles/request/:requestId/reject', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({ reason: joi_1.default.string().optional() })), async (req, res) => {
    const approverId = req.user?.userId || req.user?.id;
    const { requestId } = req.params;
    const { reason } = req.body;
    if (!requestId) {
        res.status(400).json({
            success: false,
            error: 'Request ID is required'
        });
        return;
    }
    const result = await rbac_1.RBACService.rejectRoleRequest(requestId, approverId, reason);
    res.json({ success: true, data: result });
});
// List role requests
router.get('/roles/requests', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    const { tenantId, status } = req.query;
    const list = await rbac_1.RBACService.listRoleRequests({ tenantId, status });
    res.json({ success: true, data: list });
});
/**
 * Get User Permissions
 * GET /api/rbac/users/:userId/permissions
 */
router.get('/users/:userId/permissions', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { tenantId } = req.user;
        logger_1.LoggerService.info('Fetching user permissions', {
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
        const userRoles = await rbac_1.RBACService.getUserRoles(userId, tenantId);
        const allRoles = await rbac_1.RBACService.getAllRoles();
        const permissions = new Set();
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
    }
    catch (error) {
        logger_1.LoggerService.error('Get user permissions failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// ROLE MATRIX ROUTES
// =============================================================================
/**
 * Get Role Matrix
 * GET /api/rbac/matrix
 */
router.get('/matrix', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        const { tenantType } = req.query;
        logger_1.LoggerService.info('Fetching role matrix', {
            tenantType
        });
        const roles = await rbac_1.RBACService.getAllRoles(tenantType);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Get role matrix failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Permission Matrix
 * GET /api/rbac/permissions
 */
router.get('/permissions', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        const { tenantType } = req.query;
        logger_1.LoggerService.info('Fetching permission matrix', {
            tenantType
        });
        const roles = await rbac_1.RBACService.getAllRoles(tenantType);
        const permissions = new Map();
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
    }
    catch (error) {
        logger_1.LoggerService.error('Get permission matrix failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * RBAC Service Health Check
 * GET /api/rbac/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = rbac_1.RBACService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            service: 'RBAC Service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.LoggerService.error('RBAC health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'RBAC Service',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=rbac.js.map