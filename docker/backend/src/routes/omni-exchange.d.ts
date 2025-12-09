/**
 * Omni Exchange Routes
 *
 * Express router for omni-exchange (multi-exchange aggregation) endpoints.
 *
 * Endpoints:
 * - Exchange order management
 * - Trade execution
 * - Balance queries
 * - Order book access
 * - Market data
 *
 * Features:
 * - Rate limiting for auditor endpoints
 * - Service initialization on first request
 * - Comprehensive error handling
 * - Authentication and authorization
 *
 * Security:
 * - All routes require authentication
 * - Role-based access control
 * - Rate limiting on sensitive endpoints
 */
declare const router: import("express-serve-static-core").Router;
export declare const initializeOmniExchange: () => Promise<void>;
export default router;
//# sourceMappingURL=omni-exchange.d.ts.map