/**
 * Broker Dashboard Routes
 *
 * Express router for broker-scoped dashboard endpoints.
 *
 * Endpoints:
 * - GET /dashboard - Broker dashboard data (broker roles only)
 * - Broker-specific statistics and metrics
 * - Broker user management
 * - Broker configuration
 *
 * Security:
 * - All routes require authentication
 * - Restricted to broker roles:
 *   - BROKER_ADMIN
 *   - BROKER_COMPLIANCE
 *   - BROKER_FINANCE
 *   - BROKER_OPERATIONS
 *   - BROKER_TRADING
 *   - BROKER_SUPPORT
 *
 * Features:
 * - Read-only view for broker staff
 * - Broker-scoped data filtering
 * - Comprehensive error handling
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=broker-dashboard.d.ts.map