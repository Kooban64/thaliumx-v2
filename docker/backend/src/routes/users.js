"use strict";
/**
 * User Management Routes
 *
 * Express router for user management endpoints.
 *
 * Endpoints:
 * - GET / - List users (authenticated, role-based)
 * - GET /:id - Get user by ID (authenticated)
 * - PUT /:id - Update user (authenticated)
 * - DELETE /:id - Delete user (admin/super_admin only)
 * - GET /stats - Get user statistics (admin only)
 * - POST /:id/activate - Activate user (admin only)
 * - POST /:id/deactivate - Deactivate user (admin only)
 * - POST /:id/verify - Verify user (admin only)
 * - PUT /:id/kyc - Update KYC status (compliance only)
 *
 * Security:
 * - All routes require authentication
 * - Delete requires admin or super_admin role
 * - Input validation via middleware
 * - Tenant isolation enforced
 *
 * Multi-tenant Support:
 * - Regular users can only see users in their tenant
 * - Admins can see all users in their tenant
 * - Super admins can see all users across tenants
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const user_1 = require("../services/user");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const types_1 = require("../types");
const Joi = __importStar(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const updateUserSchema = Joi.object({
    firstName: Joi.string().min(1).max(100),
    lastName: Joi.string().min(1).max(100),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).allow(null, ''),
    dateOfBirth: Joi.date().iso().allow(null),
    address: Joi.object({
        street: Joi.string().max(200),
        city: Joi.string().max(100),
        state: Joi.string().max(100),
        country: Joi.string().max(100),
        postalCode: Joi.string().max(20)
    }).allow(null)
}).min(1);
const updateKycSchema = Joi.object({
    kycStatus: Joi.string().valid(...Object.values(types_1.KycStatus)).required(),
    kycLevel: Joi.string().valid(...Object.values(types_1.KycLevel)).required()
});
const listUsersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    role: Joi.string().valid(...Object.values(types_1.UserRole)),
    tenantId: Joi.string().uuid()
});
// =============================================================================
// MIDDLEWARE
// =============================================================================
// All routes require authentication
router.use(error_handler_1.authenticateToken);
// =============================================================================
// ROUTES
// =============================================================================
/**
 * GET /users
 * List users with pagination and filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - role: Filter by role
 * - tenantId: Filter by tenant (super_admin only)
 *
 * Access Control:
 * - Regular users: Can only see themselves
 * - Admins: Can see all users in their tenant
 * - Super admins: Can see all users across tenants
 */
router.get('/', (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { error, value } = listUsersSchema.validate(req.query);
    if (error) {
        throw (0, utils_1.createError)(`Validation error: ${error.details.map(d => d.message).join(', ')}`, 400, 'VALIDATION_ERROR');
    }
    const { page, limit, role, tenantId } = value;
    const offset = (page - 1) * limit;
    const user = req.user;
    let users;
    let total = 0;
    // Helper function to check if user has admin-level role
    const isSuperAdminRole = (role) => role === types_1.UserRole.SUPER_ADMIN;
    const isAdminRole = (role) => role === types_1.UserRole.ADMIN ||
        role === types_1.UserRole.PLATFORM_ADMIN ||
        role === types_1.UserRole.BROKER_ADMIN;
    // Access control based on role
    if (isSuperAdminRole(user.role)) {
        // Super admin can see all users, optionally filtered by tenant
        if (tenantId) {
            users = await user_1.UserService.getUsersByTenant(tenantId, limit, offset);
        }
        else if (role) {
            users = await user_1.UserService.getUsersByRole(role, limit, offset);
        }
        else {
            // Get all users - need to implement this in UserService
            // For now, get by tenant if available
            users = await user_1.UserService.getUsersByTenant(user.tenantId || '', limit, offset);
        }
    }
    else if (isAdminRole(user.role)) {
        // Admin can see all users in their tenant
        if (role) {
            // Filter by role within tenant - need to combine filters
            const allUsers = await user_1.UserService.getUsersByTenant(user.tenantId, 1000, 0);
            const filteredUsers = allUsers.filter(u => u.role === role);
            users = filteredUsers.slice(offset, offset + limit);
            total = filteredUsers.length;
        }
        else {
            users = await user_1.UserService.getUsersByTenant(user.tenantId || '', limit, offset);
        }
    }
    else {
        // Regular users can only see themselves
        const currentUser = await user_1.UserService.getUserById(user.userId);
        users = currentUser ? [currentUser] : [];
        total = users.length;
    }
    // Remove sensitive fields from response
    const sanitizedUsers = users.map(u => (0, utils_1.omit)(u, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']));
    logger_1.LoggerService.info('Users listed', {
        userId: user.userId,
        count: sanitizedUsers.length,
        page,
        limit
    });
    res.json({
        success: true,
        data: sanitizedUsers,
        pagination: {
            page,
            limit,
            total: total || sanitizedUsers.length,
            totalPages: Math.ceil((total || sanitizedUsers.length) / limit),
            hasNext: offset + sanitizedUsers.length < (total || sanitizedUsers.length),
            hasPrev: page > 1
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * GET /users/stats
 * Get user statistics
 *
 * Access Control:
 * - Admin and above only
 */
router.get('/stats', (0, error_handler_1.requireRole)(['admin', 'super_admin']), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    // Super admin can see stats across all tenants
    const tenantId = user.role === types_1.UserRole.SUPER_ADMIN
        ? undefined
        : user.tenantId;
    const stats = await user_1.UserService.getUserStats(tenantId);
    logger_1.LoggerService.info('User stats retrieved', { userId: user.userId, tenantId });
    res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * GET /users/:id
 * Get user by ID
 *
 * Access Control:
 * - Users can view their own profile
 * - Admins can view any user in their tenant
 * - Super admins can view any user
 */
router.get('/:id', (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const isAdmin = currentUser.role === types_1.UserRole.ADMIN ||
        currentUser.role === types_1.UserRole.PLATFORM_ADMIN ||
        currentUser.role === types_1.UserRole.BROKER_ADMIN;
    const isSelf = currentUser.userId === id;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !isSelf && !(isAdmin && sameTenant)) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(targetUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.info('User retrieved', { userId: currentUser.userId, targetUserId: id });
    res.json({
        success: true,
        data: sanitizedUser,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * PUT /users/:id
 * Update user information
 *
 * Access Control:
 * - Users can update their own profile (limited fields)
 * - Admins can update any user in their tenant
 * - Super admins can update any user
 */
router.put('/:id', (0, error_handler_1.validateRequest)(updateUserSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const updateData = req.body;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const isAdmin = currentUser.role === types_1.UserRole.ADMIN ||
        currentUser.role === types_1.UserRole.PLATFORM_ADMIN ||
        currentUser.role === types_1.UserRole.BROKER_ADMIN;
    const isSelf = currentUser.userId === id;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !isSelf && !(isAdmin && sameTenant)) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    // Regular users can only update limited fields
    if (!isAdmin && !isSuperAdmin) {
        const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address'];
        const requestedFields = Object.keys(updateData);
        const disallowedFields = requestedFields.filter(f => !allowedFields.includes(f));
        if (disallowedFields.length > 0) {
            throw (0, utils_1.createError)(`Cannot update fields: ${disallowedFields.join(', ')}`, 403, 'FIELD_UPDATE_DENIED');
        }
    }
    const updatedUser = await user_1.UserService.updateUser(id, updateData);
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(updatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.info('User updated', {
        userId: currentUser.userId,
        targetUserId: id,
        updatedFields: Object.keys(updateData)
    });
    res.json({
        success: true,
        data: sanitizedUser,
        message: 'User updated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * DELETE /users/:id
 * Delete user (soft delete)
 *
 * Access Control:
 * - Admin and super_admin only
 * - Cannot delete yourself
 * - Cannot delete super_admin (unless you are super_admin)
 */
router.delete('/:id', (0, error_handler_1.requireRole)(['admin', 'super_admin']), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    // Cannot delete yourself
    if (currentUser.userId === id) {
        throw (0, utils_1.createError)('Cannot delete your own account', 400, 'SELF_DELETE_DENIED');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    // Non-super admins can only delete users in their tenant
    if (!isSuperAdmin && !sameTenant) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    // Cannot delete super_admin unless you are super_admin
    if (targetUser.role === types_1.UserRole.SUPER_ADMIN && !isSuperAdmin) {
        throw (0, utils_1.createError)('Cannot delete super admin', 403, 'SUPER_ADMIN_DELETE_DENIED');
    }
    await user_1.UserService.deleteUser(id);
    logger_1.LoggerService.info('User deleted', {
        userId: currentUser.userId,
        targetUserId: id,
        targetEmail: targetUser.email
    });
    res.json({
        success: true,
        message: 'User deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * POST /users/:id/activate
 * Activate a user account
 *
 * Access Control:
 * - Admin and above only
 */
router.post('/:id/activate', (0, error_handler_1.requireRole)(['admin', 'super_admin']), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !sameTenant) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    const activatedUser = await user_1.UserService.activateUser(id);
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(activatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.info('User activated', {
        userId: currentUser.userId,
        targetUserId: id
    });
    res.json({
        success: true,
        data: sanitizedUser,
        message: 'User activated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * POST /users/:id/deactivate
 * Deactivate a user account
 *
 * Access Control:
 * - Admin and above only
 * - Cannot deactivate yourself
 */
router.post('/:id/deactivate', (0, error_handler_1.requireRole)(['admin', 'super_admin']), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    // Cannot deactivate yourself
    if (currentUser.userId === id) {
        throw (0, utils_1.createError)('Cannot deactivate your own account', 400, 'SELF_DEACTIVATE_DENIED');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !sameTenant) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    const deactivatedUser = await user_1.UserService.deactivateUser(id);
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(deactivatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.info('User deactivated', {
        userId: currentUser.userId,
        targetUserId: id
    });
    res.json({
        success: true,
        data: sanitizedUser,
        message: 'User deactivated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * POST /users/:id/verify
 * Verify a user account
 *
 * Access Control:
 * - Admin and above only
 */
router.post('/:id/verify', (0, error_handler_1.requireRole)(['admin', 'super_admin']), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !sameTenant) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    const verifiedUser = await user_1.UserService.verifyUser(id);
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(verifiedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.info('User verified', {
        userId: currentUser.userId,
        targetUserId: id
    });
    res.json({
        success: true,
        data: sanitizedUser,
        message: 'User verified successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
/**
 * PUT /users/:id/kyc
 * Update user KYC status
 *
 * Access Control:
 * - Compliance role only
 */
router.put('/:id/kyc', (0, error_handler_1.requireRole)(['compliance', 'admin', 'super_admin']), (0, error_handler_1.validateRequest)(updateKycSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const { kycStatus, kycLevel } = req.body;
    if (!id) {
        throw (0, utils_1.createError)('User ID is required', 400, 'MISSING_USER_ID');
    }
    const targetUser = await user_1.UserService.getUserById(id);
    if (!targetUser) {
        throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
    }
    // Access control
    const isSuperAdmin = currentUser.role === types_1.UserRole.SUPER_ADMIN;
    const sameTenant = currentUser.tenantId === targetUser.tenantId;
    if (!isSuperAdmin && !sameTenant) {
        throw (0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED');
    }
    const updatedUser = await user_1.UserService.updateKycStatus(id, kycStatus, kycLevel);
    // Remove sensitive fields
    const sanitizedUser = (0, utils_1.omit)(updatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);
    logger_1.LoggerService.logKYC(id, 'kyc_status_updated', {
        updatedBy: currentUser.userId,
        previousStatus: targetUser.kycStatus,
        newStatus: kycStatus,
        previousLevel: targetUser.kycLevel,
        newLevel: kycLevel
    });
    res.json({
        success: true,
        data: sanitizedUser,
        message: 'KYC status updated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
}));
exports.default = router;
//# sourceMappingURL=users.js.map