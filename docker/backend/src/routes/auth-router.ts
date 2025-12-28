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
  validateChangePassword,
  validateResetPassword,
  validateConfirmResetPassword
} from './auth';
import { authenticateToken } from '../middleware/error-handler';

const router: Router = Router();

// =============================================================================
// KEYCLOAK-ONLY AUTH MODE
// =============================================================================
// The ThaliumX platform has standardized on Keycloak (OIDC) as the system-of-record
// for authentication. The legacy email/password + JWT endpoints below are retained
// only as stubs to avoid breaking old clients; they intentionally return HTTP 410.
const legacyAuthGone = (_req: any, res: any) => {
  res.status(410).json({
    success: false,
    error: {
      code: 'LEGACY_AUTH_DISABLED',
      message: 'Legacy auth is disabled. Use Keycloak (OIDC) login.'
    },
    timestamp: new Date()
  });
};

// Public routes
router.post('/login', validateLogin, legacyAuthGone);

router.post('/register', validateRegister, legacyAuthGone);

router.post('/refresh', legacyAuthGone);

router.post('/logout', authenticateToken, async (_req, res) => {
  // Keycloak is stateless for bearer tokens. Client should redirect to Keycloak
  // end-session endpoint if it wants to actively terminate the SSO session.
  res.json({ success: true, message: 'Logged out (client-side)', timestamp: new Date() });
});

router.post('/reset-password', validateResetPassword, legacyAuthGone);

router.post('/confirm-reset', validateConfirmResetPassword, legacyAuthGone);

// Protected routes
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    // Keycloak-authenticated: return token-derived identity.
    // NOTE: Keycloak `sub` is not the same as our legacy DB `users.id`, so we
    // do not attempt DB lookups here.
    const u = (req as any).user;
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
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticateToken, (_req, res) => {
  // Profile updates must be performed via Keycloak Admin API / Account Console.
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Profile updates are managed by Keycloak.'
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
