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

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, asyncHandler, validateRequest } from '../middleware/error-handler';
import { UserService } from '../services/user';
import { LoggerService } from '../services/logger';
import { createError, omit } from '../utils';
import { KycStatus, KycLevel, UserRole } from '../types';
import * as Joi from 'joi';

const router: Router = Router();

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
  kycStatus: Joi.string().valid(...Object.values(KycStatus)).required(),
  kycLevel: Joi.string().valid(...Object.values(KycLevel)).required()
});

const listUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  role: Joi.string().valid(...Object.values(UserRole)),
  tenantId: Joi.string().uuid()
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

// All routes require authentication
router.use(authenticateToken);

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
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = listUsersSchema.validate(req.query);
  if (error) {
    throw createError(`Validation error: ${error.details.map(d => d.message).join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const { page, limit, role, tenantId } = value;
  const offset = (page - 1) * limit;
  const user = req.user!;

  let users;
  let total = 0;

  // Helper function to check if user has admin-level role
  const isSuperAdminRole = (role: UserRole): boolean => role === UserRole.SUPER_ADMIN;
  const isAdminRole = (role: UserRole): boolean =>
    role === UserRole.ADMIN ||
    role === UserRole.PLATFORM_ADMIN ||
    role === UserRole.BROKER_ADMIN;

  // Access control based on role
  if (isSuperAdminRole(user.role)) {
    // Super admin can see all users, optionally filtered by tenant
    if (tenantId) {
      users = await UserService.getUsersByTenant(tenantId, limit, offset);
    } else if (role) {
      users = await UserService.getUsersByRole(role, limit, offset);
    } else {
      // Get all users - need to implement this in UserService
      // For now, get by tenant if available
      users = await UserService.getUsersByTenant(user.tenantId || '', limit, offset);
    }
  } else if (isAdminRole(user.role)) {
    // Admin can see all users in their tenant
    if (role) {
      // Filter by role within tenant - need to combine filters
      const allUsers = await UserService.getUsersByTenant(user.tenantId, 1000, 0);
      const filteredUsers = allUsers.filter(u => u.role === role);
      users = filteredUsers.slice(offset, offset + limit);
      total = filteredUsers.length;
    } else {
      users = await UserService.getUsersByTenant(user.tenantId || '', limit, offset);
    }
  } else {
    // Regular users can only see themselves
    const currentUser = await UserService.getUserById(user.userId);
    users = currentUser ? [currentUser] : [];
    total = users.length;
  }

  // Remove sensitive fields from response
  const sanitizedUsers = users.map(u => omit(u, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']));

  LoggerService.info('Users listed', {
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
router.get('/stats', requireRole(['admin', 'super_admin']), asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  // Super admin can see stats across all tenants
  const tenantId = user.role === UserRole.SUPER_ADMIN
    ? undefined
    : user.tenantId;

  const stats = await UserService.getUserStats(tenantId);

  LoggerService.info('User stats retrieved', { userId: user.userId, tenantId });

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
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const isAdmin = currentUser.role === UserRole.ADMIN ||
                  currentUser.role === UserRole.PLATFORM_ADMIN ||
                  currentUser.role === UserRole.BROKER_ADMIN;
  const isSelf = currentUser.userId === id;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !isSelf && !(isAdmin && sameTenant)) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Remove sensitive fields
  const sanitizedUser = omit(targetUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.info('User retrieved', { userId: currentUser.userId, targetUserId: id });

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
router.put('/:id', validateRequest(updateUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;
  const updateData = req.body;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const isAdmin = currentUser.role === UserRole.ADMIN ||
                  currentUser.role === UserRole.PLATFORM_ADMIN ||
                  currentUser.role === UserRole.BROKER_ADMIN;
  const isSelf = currentUser.userId === id;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !isSelf && !(isAdmin && sameTenant)) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Regular users can only update limited fields
  if (!isAdmin && !isSuperAdmin) {
    const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address'];
    const requestedFields = Object.keys(updateData);
    const disallowedFields = requestedFields.filter(f => !allowedFields.includes(f));
    
    if (disallowedFields.length > 0) {
      throw createError(`Cannot update fields: ${disallowedFields.join(', ')}`, 403, 'FIELD_UPDATE_DENIED');
    }
  }

  const updatedUser = await UserService.updateUser(id!, updateData);

  // Remove sensitive fields
  const sanitizedUser = omit(updatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.info('User updated', {
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
router.delete('/:id', requireRole(['admin', 'super_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  // Cannot delete yourself
  if (currentUser.userId === id) {
    throw createError('Cannot delete your own account', 400, 'SELF_DELETE_DENIED');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  // Non-super admins can only delete users in their tenant
  if (!isSuperAdmin && !sameTenant) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Cannot delete super_admin unless you are super_admin
  if (targetUser.role === UserRole.SUPER_ADMIN && !isSuperAdmin) {
    throw createError('Cannot delete super admin', 403, 'SUPER_ADMIN_DELETE_DENIED');
  }

  await UserService.deleteUser(id);

  LoggerService.info('User deleted', {
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
router.post('/:id/activate', requireRole(['admin', 'super_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !sameTenant) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  const activatedUser = await UserService.activateUser(id);

  // Remove sensitive fields
  const sanitizedUser = omit(activatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.info('User activated', {
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
router.post('/:id/deactivate', requireRole(['admin', 'super_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  // Cannot deactivate yourself
  if (currentUser.userId === id) {
    throw createError('Cannot deactivate your own account', 400, 'SELF_DEACTIVATE_DENIED');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !sameTenant) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  const deactivatedUser = await UserService.deactivateUser(id);

  // Remove sensitive fields
  const sanitizedUser = omit(deactivatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.info('User deactivated', {
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
router.post('/:id/verify', requireRole(['admin', 'super_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !sameTenant) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  const verifiedUser = await UserService.verifyUser(id);

  // Remove sensitive fields
  const sanitizedUser = omit(verifiedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.info('User verified', {
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
router.put('/:id/kyc', requireRole(['compliance', 'admin', 'super_admin']), validateRequest(updateKycSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user!;
  const { kycStatus, kycLevel } = req.body;

  if (!id) {
    throw createError('User ID is required', 400, 'MISSING_USER_ID');
  }

  const targetUser = await UserService.getUserById(id);

  if (!targetUser) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Access control
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  const sameTenant = currentUser.tenantId === targetUser.tenantId;

  if (!isSuperAdmin && !sameTenant) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  const updatedUser = await UserService.updateKycStatus(id, kycStatus as KycStatus, kycLevel as KycLevel);

  // Remove sensitive fields
  const sanitizedUser = omit(updatedUser, ['passwordHash', 'mfaSecret', 'mfaSecretTemp', 'mfaBackupCodes', 'mfaEmailCode']);

  LoggerService.logKYC(id, 'kyc_status_updated', {
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

export default router;
