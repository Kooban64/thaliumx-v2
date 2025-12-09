/**
 * Tenant Management Routes
 *
 * Express router for tenant (broker) management endpoints.
 *
 * Endpoints:
 * - GET / - List all tenants (admin/super_admin only)
 * - GET /:id - Get tenant by ID (admin/super_admin only)
 * - POST / - Create new tenant (admin/super_admin only)
 * - PUT /:id - Update tenant (admin/super_admin only)
 * - DELETE /:id - Delete tenant (admin/super_admin only)
 *
 * Security:
 * - All routes require authentication
 * - All routes require admin or super_admin role
 * - Input validation via middleware
 *
 * Operations:
 * - Tenant CRUD operations
 * - Tenant configuration management
 * - Tenant status management
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=tenants.d.ts.map