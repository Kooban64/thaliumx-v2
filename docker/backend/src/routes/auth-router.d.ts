/**
 * Authentication Routes
 *
 * Express router for authentication endpoints.
 *
 * Endpoints:
 * - POST /login - User login with email/password (MFA optional)
 * - POST /register - User registration
 * - POST /refresh - Refresh access token using refresh token
 * - POST /logout - Logout and invalidate refresh token
 * - POST /change-password - Change password (authenticated)
 * - POST /reset-password - Request password reset
 * - POST /confirm-reset-password - Confirm password reset with token
 *
 * Security:
 * - Input validation on all endpoints
 * - Rate limiting applied via middleware
 * - JWT token validation for protected routes
 * - Refresh tokens stored in Redis
 *
 * MFA:
 * - MFA handled via AuthService
 * - MFA code required in login if enabled for user
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=auth-router.d.ts.map