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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=users.d.ts.map