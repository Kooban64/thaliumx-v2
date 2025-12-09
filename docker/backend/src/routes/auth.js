"use strict";
/**
 * Authentication Validation Middleware
 *
 * Express validation middleware for authentication endpoints.
 *
 * Validators:
 * - validateLogin - Validates email and password
 * - validateRegister - Validates registration data
 * - validateRefreshToken - Validates refresh token
 * - validateChangePassword - Validates password change request
 * - validateResetPassword - Validates password reset request
 * - validateConfirmResetPassword - Validates password reset confirmation
 *
 * Validation Rules:
 * - Email format validation
 * - Password strength requirements
 * - Required field checks
 * - Token format validation
 *
 * Error Handling:
 * - Returns 400 with detailed error messages
 * - Includes request ID for tracing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getProfile = exports.disableMFA = exports.verifyMFA = exports.enableMFA = exports.confirmPasswordReset = exports.requestPasswordReset = exports.changePassword = exports.logout = exports.refreshToken = exports.register = exports.login = exports.validateConfirmResetPassword = exports.validateResetPassword = exports.validateChangePassword = exports.validateRefreshToken = exports.validateRegister = exports.validateLogin = void 0;
const auth_1 = require("../services/auth");
const user_1 = require("../services/user");
const utils_1 = require("../utils");
// Validation middleware
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({
            success: false,
            error: 'Email and password are required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        res.status(400).json({
            success: false,
            error: 'Invalid email format',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    next();
};
exports.validateLogin = validateLogin;
const validateRegister = (req, res, next) => {
    const { email, password, username, firstName, lastName } = req.body;
    if (!email || !password || !username || !firstName || !lastName) {
        res.status(400).json({
            success: false,
            error: 'All fields are required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        res.status(400).json({
            success: false,
            error: 'Invalid email format',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    if (password.length < 8) {
        res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    next();
};
exports.validateRegister = validateRegister;
const validateRefreshToken = (req, res, next) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({
            success: false,
            error: 'Refresh token is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    next();
};
exports.validateRefreshToken = validateRefreshToken;
const validateChangePassword = (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400).json({
            success: false,
            error: 'Current password and new password are required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    if (newPassword.length < 8) {
        res.status(400).json({
            success: false,
            error: 'New password must be at least 8 characters long',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    next();
};
exports.validateChangePassword = validateChangePassword;
const validateResetPassword = (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({
            success: false,
            error: 'Email is required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        res.status(400).json({
            success: false,
            error: 'Invalid email format',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
        return;
    }
    next();
};
exports.validateResetPassword = validateResetPassword;
const validateConfirmResetPassword = (req, res, next) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        res.status(400).json({
            success: false,
            error: 'Token and new password are required',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    if (newPassword.length < 8) {
        res.status(400).json({
            success: false,
            error: 'New password must be at least 8 characters long',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    next();
};
exports.validateConfirmResetPassword = validateConfirmResetPassword;
// Route handlers
const login = async (req, res, next) => {
    try {
        const { email, password, mfaCode, rememberMe } = req.body;
        const result = await auth_1.AuthService.login(email, password, mfaCode, rememberMe);
        res.json({
            success: true,
            data: result,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const register = async (req, res, next) => {
    try {
        const userData = req.body;
        const user = await auth_1.AuthService.register(userData);
        res.status(201).json({
            success: true,
            data: { user },
            message: 'User registered successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await auth_1.AuthService.refreshToken(refreshToken);
        res.json({
            success: true,
            data: result,
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (userId) {
            await auth_1.AuthService.logout(userId);
        }
        res.json({
            success: true,
            message: 'Logged out successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { currentPassword, newPassword } = req.body;
        await auth_1.AuthService.changePassword(userId, currentPassword, newPassword);
        res.json({
            success: true,
            message: 'Password changed successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.changePassword = changePassword;
const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        await auth_1.AuthService.requestPasswordReset(email);
        res.json({
            success: true,
            message: 'Password reset email sent if account exists',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.requestPasswordReset = requestPasswordReset;
const confirmPasswordReset = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        await auth_1.AuthService.confirmPasswordReset(token, newPassword);
        res.json({
            success: true,
            message: 'Password reset successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.confirmPasswordReset = confirmPasswordReset;
const enableMFA = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await auth_1.AuthService.enableMFA(userId);
        res.json({
            success: true,
            data: result,
            message: 'MFA enabled successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.enableMFA = enableMFA;
const verifyMFA = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { code } = req.body;
        if (!code) {
            res.status(400).json({
                success: false,
                error: 'MFA code is required',
                timestamp: new Date(),
                requestId: req.headers['x-request-id'] || 'unknown'
            });
            return;
        }
        const result = await auth_1.AuthService.verifyMFA(userId, code);
        res.json({
            success: true,
            data: result,
            message: result.success ? 'MFA verified successfully' : 'Invalid MFA code',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.verifyMFA = verifyMFA;
const disableMFA = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { password } = req.body;
        if (!password) {
            res.status(400).json({
                success: false,
                error: 'Password is required to disable MFA',
                timestamp: new Date(),
                requestId: req.headers['x-request-id'] || 'unknown'
            });
            return;
        }
        await auth_1.AuthService.disableMFA(userId, password);
        res.json({
            success: true,
            message: 'MFA disabled successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.disableMFA = disableMFA;
const getProfile = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const user = await user_1.UserService.getUserById(userId);
        if (!user) {
            throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
        }
        res.json({
            success: true,
            data: { user },
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const updateData = req.body;
        // Remove sensitive fields that shouldn't be updated via this endpoint
        const { passwordHash, mfaSecret, mfaEnabled, ...allowedUpdates } = updateData;
        const user = await user_1.UserService.updateUser(userId, allowedUpdates);
        res.json({
            success: true,
            data: { user },
            message: 'Profile updated successfully',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=auth.js.map