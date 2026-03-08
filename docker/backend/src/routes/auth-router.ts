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

import { Router } from 'express';
import {
  validateLogin,
  validateRegister,
  validateRefreshToken,
  validateChangePassword,
  validateResetPassword,
  validateConfirmResetPassword,
} from './auth';
import { authenticateToken } from '../middleware/error-handler';

const router: Router = Router();

// =============================================================================
// PROVIDER-AWARE AUTH MODE
// =============================================================================
// Legacy MFA/password-reset paths are retained as stubs for compatibility.
// Primary authentication is provider-driven (Keycloak/Zitadel/internal JWT fallback).
const legacyAuthGone = (_req: any, res: any) => {
  res.status(410).json({
    success: false,
    error: {
      code: 'LEGACY_AUTH_DISABLED',
      message: 'Legacy auth endpoint is disabled. Use OIDC login flow.'
    },
    timestamp: new Date()
  });
};

// Import actual handlers from auth.ts
import { login, register, refreshToken } from './auth';

// Public routes - provider-aware login/register
router.post('/login', validateLogin, login);

router.post('/register', validateRegister, register);

router.post('/refresh', validateRefreshToken, refreshToken);

router.post('/logout', authenticateToken, async (_req, res) => {
  // OIDC sessions are stateless from API perspective; frontend should perform IdP logout redirect.
  res.json({ success: true, message: 'Logged out (client-side)', timestamp: new Date() });
});

router.post('/reset-password', validateResetPassword, legacyAuthGone);

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

router.put('/profile', authenticateToken, (_req, res) => {
  // Profile updates must be performed via the IdP (Zitadel) account console.
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Profile updates are managed by the identity provider.'
    },
    timestamp: new Date()
  });
});

router.post('/change-password', authenticateToken, validateChangePassword, legacyAuthGone);

router.post('/enable-mfa', authenticateToken, legacyAuthGone);

router.post('/verify-mfa', authenticateToken, legacyAuthGone);

router.post('/disable-mfa', authenticateToken, legacyAuthGone);

// MFA management routes
router.get('/mfa/status', authenticateToken, legacyAuthGone);

router.post('/mfa/backup-codes', authenticateToken, legacyAuthGone);

router.post('/mfa/verify-email', authenticateToken, legacyAuthGone);

router.post('/mfa/use-backup', authenticateToken, legacyAuthGone);

export default router;
