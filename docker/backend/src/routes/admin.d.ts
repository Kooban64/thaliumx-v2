/**
 * Admin Routes
 *
 * Express router for administrative endpoints and system management.
 *
 * Endpoints:
 * - GET /prometheus/metrics - Prometheus metrics (public, text format)
 * - GET /prometheus/metrics/json - Prometheus metrics as JSON (admin only)
 * - GET /dashboard - System dashboard data (admin only)
 * - GET /health - Detailed health check (admin only)
 * - GET /system/info - System information (admin only)
 * - GET /system/stats - System statistics (admin only)
 * - GET /logs - Application logs (admin only)
 * - GET /audit - Audit logs (admin only)
 *
 * Security:
 * - Most routes require authentication
 * - Admin/super_admin role required for sensitive endpoints
 * - Metrics endpoint is public for Prometheus scraping
 *
 * Features:
 * - System monitoring and metrics
 * - Health check aggregation
 * - Log access and filtering
 * - Audit trail access
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=admin.d.ts.map