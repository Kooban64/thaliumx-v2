/**
 * Admin Migration Routes
 *
 * Express router for administrative migration operations.
 *
 * Endpoints:
 * - POST /migration/dry-run - Preview migration without executing (admin/super_admin)
 * - POST /migration/execute - Execute migration (admin/super_admin)
 *
 * Features:
 * - Dry-run mode for safe migration preview
 * - User attribution to brokers
 * - Presale investment migration
 * - Keycloak realm migration
 * - Idempotency support
 *
 * Security:
 * - All routes require authentication
 * - Requires admin or super_admin role
 * - Comprehensive logging for audit
 *
 * Use Cases:
 * - Migrating users to broker accounts
 * - Presale investment attribution
 * - Keycloak realm setup
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=admin-migration.d.ts.map