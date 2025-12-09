"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../services/auth");
// MFA handled via AuthService proxies
const user_1 = require("../services/user");
const auth_2 = require("./auth");
const error_handler_1 = require("../middleware/error-handler");
const error_handler_2 = require("../utils/error-handler");
const router = (0, express_1.Router)();
// Public routes
router.post('/login', auth_2.validateLogin, async (req, res, next) => {
    try {
        const { email, password, mfaCode, rememberMe } = req.body;
        const result = await auth_1.AuthService.login(email, password, mfaCode, rememberMe);
        res.json({ success: true, data: result, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/register', auth_2.validateRegister, async (req, res, next) => {
    try {
        const user = await auth_1.AuthService.register(req.body);
        res.status(201).json({ success: true, data: { user }, message: 'User registered successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/refresh', auth_2.validateRefreshToken, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await auth_1.AuthService.refreshToken(refreshToken);
        res.json({ success: true, data: result, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/logout', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (userId)
            await auth_1.AuthService.logout(userId);
        res.json({ success: true, message: 'Logged out successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/reset-password', auth_2.validateResetPassword, async (req, res, next) => {
    try {
        const { email } = req.body;
        await auth_1.AuthService.requestPasswordReset(email);
        res.json({ success: true, message: 'Password reset email sent if account exists', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/confirm-reset', auth_2.validateConfirmResetPassword, async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        await auth_1.AuthService.confirmPasswordReset(token, newPassword);
        res.json({ success: true, message: 'Password reset successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
// Protected routes
router.get('/profile', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const user = await user_1.UserService.getUserById(userId);
        if (!user) {
            throw error_handler_2.AppError.notFound('User not found');
        }
        res.json({ success: true, data: { user }, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.put('/profile', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const updateData = req.body;
        const { passwordHash, mfaSecret, mfaEnabled, ...allowedUpdates } = updateData;
        const user = await user_1.UserService.updateUser(userId, allowedUpdates);
        res.json({ success: true, data: { user }, message: 'Profile updated successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/change-password', error_handler_1.authenticateToken, auth_2.validateChangePassword, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { currentPassword, newPassword } = req.body;
        await auth_1.AuthService.changePassword(userId, currentPassword, newPassword);
        res.json({ success: true, message: 'Password changed successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/enable-mfa', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await auth_1.AuthService.enableMFA(userId);
        res.json({ success: true, data: result, message: 'MFA setup initiated', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/verify-mfa', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;
        const result = await auth_1.AuthService.verifyMFA(userId, code);
        res.json({ success: true, data: result, message: result.success ? 'MFA enabled successfully' : 'Invalid MFA code', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/disable-mfa', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { password } = req.body;
        await auth_1.AuthService.disableMFA(userId, password);
        res.json({ success: true, message: 'MFA disabled successfully', timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
// MFA management routes
router.get('/mfa/status', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const status = await auth_1.AuthService.getMFAStatus(userId);
        res.json({ success: true, data: status, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/backup-codes', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const codes = await auth_1.AuthService.regenerateBackupCodes(userId);
        res.json({ success: true, data: { backupCodes: codes }, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/verify-email', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;
        const result = await auth_1.AuthService.verifyEmailMFA(userId, code);
        res.json({ success: true, data: result, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/use-backup', error_handler_1.authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;
        const result = await auth_1.AuthService.useBackupCode(userId, code);
        res.json({ success: true, data: result, timestamp: new Date() });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth-router.js.map