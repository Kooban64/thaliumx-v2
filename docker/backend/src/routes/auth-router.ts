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
import { AuthService } from '../services/auth';
// MFA handled via AuthService proxies
import { UserService } from '../services/user';
import {
  validateLogin,
  validateRegister,
  validateRefreshToken,
  validateChangePassword,
  validateResetPassword,
  validateConfirmResetPassword
} from './auth';
import { authenticateToken } from '../middleware/error-handler';
import { AppError } from '../utils/error-handler';

const router: Router = Router();

// Public routes
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password, mfaCode, rememberMe } = req.body;
    const result = await AuthService.login(email, password, mfaCode, rememberMe);
    res.json({ success: true, data: result, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const user = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: { user }, message: 'User registered successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', validateRefreshToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshToken(refreshToken);
    res.json({ success: true, data: result, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (userId) await AuthService.logout(userId);
    res.json({ success: true, message: 'Logged out successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', validateResetPassword, async (req, res, next) => {
  try {
    const { email } = req.body;
    await AuthService.requestPasswordReset(email);
    res.json({ success: true, message: 'Password reset email sent if account exists', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/confirm-reset', validateConfirmResetPassword, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await AuthService.confirmPasswordReset(token, newPassword);
    res.json({ success: true, message: 'Password reset successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

// Protected routes
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await UserService.getUserById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    res.json({ success: true, data: { user }, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const updateData = req.body;
    const { passwordHash, mfaSecret, mfaEnabled, ...allowedUpdates } = updateData;
    const user = await UserService.updateUser(userId, allowedUpdates);
    res.json({ success: true, data: { user }, message: 'Profile updated successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authenticateToken, validateChangePassword, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(userId, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/enable-mfa', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const result = await AuthService.enableMFA(userId);
    res.json({ success: true, data: result, message: 'MFA setup initiated', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-mfa', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;
    const result = await AuthService.verifyMFA(userId, code);
    res.json({ success: true, data: result, message: result.success ? 'MFA enabled successfully' : 'Invalid MFA code', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/disable-mfa', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { password } = req.body;
    await AuthService.disableMFA(userId, password);
    res.json({ success: true, message: 'MFA disabled successfully', timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

// MFA management routes
router.get('/mfa/status', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const status = await AuthService.getMFAStatus(userId);
    res.json({ success: true, data: status, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/backup-codes', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const codes = await AuthService.regenerateBackupCodes(userId);
    res.json({ success: true, data: { backupCodes: codes }, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/verify-email', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;
    const result = await AuthService.verifyEmailMFA(userId, code);
    res.json({ success: true, data: result, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/use-backup', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;
    const result = await AuthService.useBackupCode(userId, code);
    res.json({ success: true, data: result, timestamp: new Date() });
  } catch (error) {
    next(error);
  }
});

export default router;
