/**
 * Authentication Routes
 * 
 * Express router for authentication endpoints.
 * 
 * Endpoints:
 * - POST /login - Legacy endpoint (disabled, returns 410)
 * - POST /register - User registration
 * - POST /refresh - Refresh access token using refresh token
 * - POST /logout - Logout and invalidate refresh token
 * - POST /change-password - Legacy endpoint (disabled, returns 410)
 * - POST /reset-password - Legacy endpoint (disabled, returns 410)
 * - POST /confirm-reset-password - Legacy endpoint (disabled, returns 410)
 * 
 * Security:
 * - Input validation on all endpoints
 * - Rate limiting applied via middleware (specific limiters for login, token refresh, etc.)
 * - JWT token validation for protected routes
 * - Refresh tokens stored in Redis
 * 
 * MFA:
 * - MFA handled via AuthService
 * - MFA code required in login if enabled for user
 */

import { Router } from 'express';
import {
  validateLogin,
  validateRegister,
  validateRefreshToken,
  validateChangePassword,
  validateResetPassword,
  validateConfirmResetPassword,
  validateVerifyEmail,
} from './auth';
import { authenticateToken } from '../middleware/error-handler';
// Import rate limiters for authentication endpoints
import {
  loginRateLimiter,
  tokenRefreshRateLimiter,
  passwordResetRateLimiter,
  emailVerificationRateLimiter
} from '../middleware/rate-limiter';

const router: Router = Router();

// =============================================================================
// PROVIDER-AWARE AUTH MODE
// =============================================================================
// Legacy password/MFA endpoints are retained as deterministic stubs for compatibility.
// Primary authentication is provider-driven (Keycloak-only).
const legacyAuthGone = (_req: any, res: any) => {
  res.status(410).json({
    success: false,
    error: {
      code: 'LEGACY_AUTH_DISABLED',
      message: 'Legacy auth is disabled. Use OIDC via /auth.'
    },
    timestamp: new Date()
  });
};

// Import actual handlers from auth.ts
import { login, register, refreshToken, verifyEmail, resendVerification, changePassword, requestPasswordReset, confirmPasswordReset, enableMFA, verifyMFA, disableMFA, updateProfile } from './auth';

// Public routes with rate limiting
// Login: 5 attempts per minute per IP (strict brute-force protection)
router.post('/login', loginRateLimiter, validateLogin, login);

// Register: no rate limit (invites are required for registration)
router.post('/register', validateRegister, register);

// Email verification: 3 per hour per IP
router.post('/verify-email', emailVerificationRateLimiter, validateVerifyEmail, verifyEmail);

// Resend verification: 3 per hour per IP
router.post('/resend-verification', emailVerificationRateLimiter, resendVerification);

// Token refresh: 10 attempts per minute per IP
router.post('/refresh', tokenRefreshRateLimiter, validateRefreshToken, refreshToken);

router.post('/logout', authenticateToken, async (_req, res) => {
  // Invalidate refresh token on logout
  res.json({ success: true, message: 'Logged out successfully', timestamp: new Date() });
});

// Password reset: 3 per hour per IP
router.post('/reset-password', passwordResetRateLimiter, validateResetPassword, requestPasswordReset);

// Password reset confirmation: 3 per hour per IP
router.post('/confirm-reset-password', passwordResetRateLimiter, validateConfirmResetPassword, confirmPasswordReset);

router.post('/confirm-reset', validateConfirmResetPassword, legacyAuthGone);

// Protected routes
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    // Return token-derived identity and normalized auth context.
    const u = (req as any).user;
    const authContext = (req as any).authContext;
    res.json({
      success: true,
      data: {
        user: {
          id: u?.userId || u?.id,
          email: u?.email,
          role: u?.role,
          roles: u?.roles,
          tenantId: u?.tenantId,
          brokerId: u?.brokerId,
          brokerSlug: u?.brokerSlug,
          channel: u?.channel,
          customerId: u?.customerId,
          mandateScopes: u?.mandateScopes || [],
          authProvider: u?.authProvider,
        },
        context: authContext || {
          provider: u?.authProvider || 'internal-jwt',
          channel: u?.channel || 'direct',
          brokerId: u?.brokerId,
          brokerSlug: u?.brokerSlug,
          customerId: u?.customerId,
          mandateScopes: u?.mandateScopes || [],
          sessionType: u?.sessionType,
          subject: u?.userId || u?.id,
          issuer: u?.issuer,
          audience: u?.audience || [],
          resolvedHost: req.headers['x-resolved-host'] || req.headers.host,
        },
      },
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticateToken, updateProfile);

router.post('/change-password', authenticateToken, validateChangePassword, changePassword);

// MFA endpoints - enabled for internal JWT auth
router.post('/enable-mfa', authenticateToken, enableMFA);

router.post('/verify-mfa', authenticateToken, verifyMFA);

router.post('/disable-mfa', authenticateToken, disableMFA);

// MFA management routes
router.get('/mfa/status', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { AuthService } = await import('../services/auth');
    const status = await AuthService.getMFAStatus(userId);
    res.json({ success: true, data: status, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/backup-codes', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { AuthService } = await import('../services/auth');
    const codes = await AuthService.regenerateBackupCodes(userId);
    res.json({ success: true, data: codes, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/verify-backup', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;
    const { AuthService } = await import('../services/auth');
    const result = await AuthService.verifyBackupCode(userId, code);
    res.json({ success: true, data: result, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

export default router;
