"use strict";
/**
 * Authentication Service
 *
 * Handles user authentication, authorization, and session management.
 *
 * Features:
 * - Email/password authentication with bcrypt hashing
 * - Multi-factor authentication (MFA/TOTP) support
 * - JWT token generation and validation (access & refresh tokens)
 * - Password reset functionality with secure tokens
 * - Session management using Redis
 * - Security event logging for audit compliance
 * - Account lockout protection
 *
 * Security:
 * - Passwords hashed with bcrypt (12 rounds)
 * - JWT tokens with configurable expiration
 * - Refresh tokens stored in Redis with TTL
 * - MFA codes validated using TOTP (Time-based One-Time Password)
 * - Failed login attempts logged for security monitoring
 *
 * Token Management:
 * - Access tokens: Short-lived (15 minutes default)
 * - Refresh tokens: Long-lived (7 days default), stored in Redis
 * - Token refresh endpoint for seamless session extension
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
const database_1 = require("../services/database");
const redis_1 = require("../services/redis");
const logger_1 = require("../services/logger");
const email_1 = require("./email");
const utils_1 = require("../utils");
const user_1 = require("./user");
const mfa_1 = require("./mfa");
const utils_2 = require("../utils");
class AuthService {
    static REFRESH_TOKEN_PREFIX = 'refresh_token:';
    static PASSWORD_RESET_PREFIX = 'password_reset:';
    static MAX_LOGIN_ATTEMPTS = 5;
    static LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    /**
     * Login user with email and password
     */
    static async login(email, password, mfaCode, rememberMe) {
        try {
            // Get user by email
            const user = await user_1.UserService.getUserByEmail(email);
            if (!user) {
                logger_1.LoggerService.logAuth('login_attempt', 'unknown', false);
                logger_1.LoggerService.info('Login attempt failed', { email, reason: 'USER_NOT_FOUND' });
                throw (0, utils_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
            }
            // Check if user is active
            if (!user.isActive) {
                logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                logger_1.LoggerService.info('Login attempt failed - account inactive', { email, reason: 'ACCOUNT_INACTIVE' });
                throw (0, utils_1.createError)('Account is inactive', 403, 'ACCOUNT_INACTIVE');
            }
            // Check account lockout
            const lockoutKey = `login_lockout:${user.id}`;
            const isLockedOut = await redis_1.RedisService.getString(lockoutKey);
            if (isLockedOut) {
                logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                logger_1.LoggerService.info('Login attempt failed - account locked', { email, reason: 'ACCOUNT_LOCKED' });
                throw (0, utils_1.createError)('Account is temporarily locked due to too many failed login attempts', 423, 'ACCOUNT_LOCKED');
            }
            // Verify password
            if (!user.passwordHash) {
                logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                logger_1.LoggerService.info('Login attempt failed - no password hash', { email, reason: 'NO_PASSWORD_HASH' });
                throw (0, utils_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
            }
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                // Track failed attempts
                const attemptKey = `login_attempts:${user.id}`;
                const attempts = await redis_1.RedisService.getString(attemptKey);
                const attemptCount = attempts ? parseInt(attempts, 10) + 1 : 1;
                if (attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
                    // Lock account
                    await redis_1.RedisService.setString(lockoutKey, '1', this.LOCKOUT_DURATION);
                    await redis_1.RedisService.del(attemptKey);
                    logger_1.LoggerService.logAuth('account_locked', user.id, false);
                    logger_1.LoggerService.info('Account locked due to too many failed attempts', { email, attemptCount });
                    throw (0, utils_1.createError)('Too many failed login attempts. Account locked for 15 minutes', 423, 'ACCOUNT_LOCKED');
                }
                else {
                    await redis_1.RedisService.setString(attemptKey, attemptCount.toString(), this.LOCKOUT_DURATION);
                    logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                    logger_1.LoggerService.info('Login attempt failed', { email, attemptCount });
                    throw (0, utils_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
                }
            }
            // Clear failed attempts on successful password check
            await redis_1.RedisService.del(`login_attempts:${user.id}`);
            // Check MFA if enabled
            if (user.mfaEnabled) {
                if (!mfaCode) {
                    logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                    logger_1.LoggerService.info('Login attempt - MFA required', { email, reason: 'MFA_REQUIRED' });
                    throw (0, utils_1.createError)('MFA code required', 401, 'MFA_REQUIRED');
                }
                // Verify MFA code
                const mfaResult = await mfa_1.MFAService.verifyMFALogin(user.id, mfaCode);
                if (!mfaResult.success) {
                    logger_1.LoggerService.logAuth('login_attempt', user.id, false);
                    logger_1.LoggerService.info('Login attempt - invalid MFA code', { email, reason: 'INVALID_MFA_CODE' });
                    throw (0, utils_1.createError)('Invalid MFA code', 401, 'INVALID_MFA_CODE');
                }
            }
            // Generate tokens
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                permissions: user.permissions || []
            };
            const accessToken = (0, utils_2.generateAccessToken)(tokenPayload);
            const refreshToken = (0, utils_2.generateRefreshToken)(tokenPayload);
            // Store refresh token in Redis
            const refreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${user.id}:${refreshToken.substring(0, 20)}`;
            const refreshTokenTTL = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days or 7 days
            await redis_1.RedisService.setString(refreshTokenKey, refreshToken, refreshTokenTTL);
            // Update last login
            await user_1.UserService.updateLastLogin(user.id);
            // Log successful login
            logger_1.LoggerService.logAuth('login_success', user.id, true);
            logger_1.LoggerService.info('Login successful', { email });
            // Get token expiration
            const expiresIn = parseInt(process.env.JWT_EXPIRES_IN?.replace(/[^0-9]/g, '') || '900', 10);
            return {
                user: {
                    ...user,
                    passwordHash: undefined // Remove password hash from response
                },
                accessToken,
                refreshToken,
                expiresIn,
                tokenType: 'Bearer'
            };
        }
        catch (error) {
            if (error.code && error.code !== 'INVALID_CREDENTIALS') {
                throw error;
            }
            logger_1.LoggerService.error('Login failed:', error);
            throw (0, utils_1.createError)('Login failed', 401, 'LOGIN_FAILED');
        }
    }
    /**
     * Register a new user
     */
    static async register(userData) {
        try {
            // Validate email
            const existingUser = await user_1.UserService.getUserByEmail(userData.email);
            if (existingUser) {
                throw (0, utils_1.createError)('Email already registered', 400, 'EMAIL_EXISTS');
            }
            // Validate username if provided
            if (userData.username) {
                const existingUsername = await user_1.UserService.getUserByUsername(userData.username);
                if (existingUsername) {
                    throw (0, utils_1.createError)('Username already taken', 400, 'USERNAME_EXISTS');
                }
            }
            // Hash password
            const passwordHash = await bcryptjs_1.default.hash(userData.password, 12);
            // Get default tenant (platform tenant)
            const TenantModel = database_1.DatabaseService.getModel('Tenant');
            const platformTenant = await TenantModel.findOne({
                where: { tenantType: 'platform', isActive: true }
            });
            if (!platformTenant) {
                throw (0, utils_1.createError)('Platform tenant not found', 500, 'PLATFORM_TENANT_NOT_FOUND');
            }
            // Create user
            const newUser = await user_1.UserService.createUser({
                email: userData.email,
                username: userData.username || userData.email.split('@')[0],
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                passwordHash,
                role: types_1.UserRole.USER,
                tenantId: platformTenant.get('id'),
                kycStatus: 'pending',
                kycLevel: 'basic',
                isActive: true,
                isVerified: false,
                mfaEnabled: false,
                permissions: []
            });
            logger_1.LoggerService.logAuth('user_registered', newUser.id, true);
            logger_1.LoggerService.info('User registered successfully', { email: newUser.email });
            return newUser;
        }
        catch (error) {
            logger_1.LoggerService.logAuth('user_registered', 'unknown', false);
            logger_1.LoggerService.info('User registration failed', { email: userData.email, error: error.message });
            logger_1.LoggerService.error('Registration failed:', error);
            throw error;
        }
    }
    /**
     * Refresh access token using refresh token
     */
    static async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const payload = (0, utils_2.verifyToken)(refreshToken, true);
            // Check if refresh token exists in Redis
            const refreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${payload.userId}:${refreshToken.substring(0, 20)}`;
            const storedToken = await redis_1.RedisService.getString(refreshTokenKey);
            if (!storedToken || storedToken !== refreshToken) {
                throw (0, utils_1.createError)('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
            }
            // Get user
            const user = await user_1.UserService.getUserById(payload.userId);
            if (!user || !user.isActive) {
                throw (0, utils_1.createError)('User not found or inactive', 401, 'USER_INACTIVE');
            }
            // Generate new tokens
            const tokenPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                permissions: user.permissions || []
            };
            const newAccessToken = (0, utils_2.generateAccessToken)(tokenPayload);
            const newRefreshToken = (0, utils_2.generateRefreshToken)(tokenPayload);
            // Update refresh token in Redis
            await redis_1.RedisService.del(refreshTokenKey);
            const newRefreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${user.id}:${newRefreshToken.substring(0, 20)}`;
            const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days
            await redis_1.RedisService.setString(newRefreshTokenKey, newRefreshToken, refreshTokenTTL);
            logger_1.LoggerService.logAuth('token_refreshed', user.id, true);
            const expiresIn = parseInt(process.env.JWT_EXPIRES_IN?.replace(/[^0-9]/g, '') || '900', 10);
            return {
                user: {
                    ...user,
                    passwordHash: undefined
                },
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn,
                tokenType: 'Bearer'
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Token refresh failed:', error);
            throw (0, utils_1.createError)('Token refresh failed', 401, 'TOKEN_REFRESH_FAILED');
        }
    }
    /**
     * Change user password
     */
    static async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user || !user.passwordHash) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            // Verify current password
            const isPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
            if (!isPasswordValid) {
                logger_1.LoggerService.logAuth('password_change_attempt', userId, false);
                logger_1.LoggerService.info('Password change attempt failed', { reason: 'INVALID_CURRENT_PASSWORD' });
                throw (0, utils_1.createError)('Current password is incorrect', 400, 'INVALID_PASSWORD');
            }
            // Hash new password
            const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
            // Update password
            await user_1.UserService.updateUser(userId, { passwordHash: newPasswordHash });
            // Invalidate all refresh tokens (force re-login)
            const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
            const keys = await redis_1.RedisService.keys(pattern);
            if (keys && keys.length > 0) {
                await Promise.all(keys.map(key => redis_1.RedisService.del(key)));
            }
            logger_1.LoggerService.logAuth('password_changed', userId, true);
        }
        catch (error) {
            logger_1.LoggerService.logAuth('password_changed', userId, false);
            logger_1.LoggerService.info('Password change failed', { error: error.message });
            logger_1.LoggerService.error('Password change failed:', error);
            throw error;
        }
    }
    /**
     * Enable MFA for user
     */
    static async enableMFA(userId) {
        try {
            const result = await mfa_1.MFAService.enableMFA(userId);
            return {
                secret: result.secret,
                qrCode: result.qrCodeDataUrl
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Enable MFA failed:', error);
            throw error;
        }
    }
    /**
     * Verify MFA code
     */
    static async verifyMFA(userId, code) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            // Check if MFA is being set up (temporary secret exists)
            if (user.mfaSecretTemp) {
                return await mfa_1.MFAService.verifyMFASetup(userId, code);
            }
            // Otherwise verify login MFA
            return await mfa_1.MFAService.verifyMFALogin(userId, code);
        }
        catch (error) {
            logger_1.LoggerService.error('Verify MFA failed:', error);
            throw error;
        }
    }
    /**
     * Logout user and invalidate refresh token
     */
    static async logout(userId) {
        try {
            // Invalidate all refresh tokens for this user
            const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
            const keys = await redis_1.RedisService.keys(pattern);
            if (keys && keys.length > 0) {
                await Promise.all(keys.map(key => redis_1.RedisService.del(key)));
            }
            logger_1.LoggerService.logAuth('logout', userId, true);
        }
        catch (error) {
            logger_1.LoggerService.error('Logout failed:', error);
            // Don't throw - logout should always succeed
        }
    }
    /**
     * Request password reset
     */
    static async requestPasswordReset(email) {
        try {
            const user = await user_1.UserService.getUserByEmail(email);
            if (!user) {
                // Don't reveal if user exists - security best practice
                logger_1.LoggerService.info('Password reset requested for non-existent email', { email });
                return;
            }
            // Generate reset token
            const resetToken = (0, uuid_1.v4)();
            const resetTokenKey = `${this.PASSWORD_RESET_PREFIX}${resetToken}`;
            const resetTokenTTL = 60 * 60; // 1 hour
            // Store token in Redis
            await redis_1.RedisService.setString(resetTokenKey, user.id, resetTokenTTL);
            // Send reset email
            await email_1.EmailService.sendPasswordReset({
                email: user.email,
                token: resetToken,
                userId: user.id
            });
            logger_1.LoggerService.logAuth('password_reset_requested', user.id, true);
            logger_1.LoggerService.info('Password reset requested', { email });
        }
        catch (error) {
            logger_1.LoggerService.error('Password reset request failed:', error);
            // Don't throw - don't reveal if user exists
        }
    }
    /**
     * Confirm password reset with token
     */
    static async confirmPasswordReset(token, newPassword) {
        try {
            // Get user ID from token
            const resetTokenKey = `${this.PASSWORD_RESET_PREFIX}${token}`;
            const userId = await redis_1.RedisService.getString(resetTokenKey);
            if (!userId) {
                throw (0, utils_1.createError)('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
            }
            // Get user
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            // Hash new password
            const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
            // Update password
            await user_1.UserService.updateUser(userId, { passwordHash: newPasswordHash });
            // Delete reset token
            await redis_1.RedisService.del(resetTokenKey);
            // Invalidate all refresh tokens (force re-login)
            const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
            const keys = await redis_1.RedisService.keys(pattern);
            if (keys && keys.length > 0) {
                await Promise.all(keys.map(key => redis_1.RedisService.del(key)));
            }
            logger_1.LoggerService.logAuth('password_reset_completed', userId, true);
        }
        catch (error) {
            logger_1.LoggerService.error('Password reset confirmation failed:', error);
            throw error;
        }
    }
    /**
     * Disable MFA for user
     */
    static async disableMFA(userId, password) {
        return mfa_1.MFAService.disableMFA(userId, password);
    }
    /**
     * Get MFA status for user
     * Returns whether MFA is enabled and configured
     */
    static async getMFAStatus(userId) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            return {
                enabled: user.mfaEnabled || false,
                verified: !!user.mfaVerifiedAt
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get MFA status failed:', error);
            throw error;
        }
    }
    /**
     * Regenerate backup codes for MFA
     * Generates new backup codes and invalidates old ones
     */
    static async regenerateBackupCodes(userId) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            if (!user.mfaEnabled) {
                throw (0, utils_1.createError)('MFA not enabled', 400, 'MFA_NOT_ENABLED');
            }
            // Generate 10 backup codes
            const backupCodes = [];
            for (let i = 0; i < 10; i++) {
                backupCodes.push(Math.random().toString(36).substring(2, 10).toUpperCase() +
                    Math.random().toString(36).substring(2, 10).toUpperCase());
            }
            // Hash backup codes before storing
            const hashedCodes = await Promise.all(backupCodes.map(code => bcryptjs_1.default.hash(code, 10)));
            await user_1.UserService.updateUser(userId, {
                mfaBackupCodes: hashedCodes
            });
            logger_1.LoggerService.logAuth('mfa_backup_codes_regenerated', userId, true);
            // Return plain codes (user should save these immediately)
            return backupCodes;
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_backup_codes_regenerated', userId, false);
            logger_1.LoggerService.error('Regenerate backup codes failed:', error);
            throw error;
        }
    }
    /**
     * Verify email MFA code
     * Used for email-based MFA verification
     */
    static async verifyEmailMFA(userId, code) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            if (!user.mfaEmailCode || !user.mfaEmailCodeExpiresAt) {
                throw (0, utils_1.createError)('No email MFA code found', 400, 'MFA_CODE_NOT_FOUND');
            }
            if (new Date() > new Date(user.mfaEmailCodeExpiresAt)) {
                throw (0, utils_1.createError)('Email MFA code expired', 400, 'MFA_CODE_EXPIRED');
            }
            const isValid = user.mfaEmailCode === code;
            if (isValid) {
                // Clear the code after successful verification
                await user_1.UserService.updateUser(userId, {
                    mfaEmailCode: undefined,
                    mfaEmailCodeExpiresAt: undefined
                });
                logger_1.LoggerService.logAuth('mfa_email_verified', userId, true);
            }
            else {
                logger_1.LoggerService.logAuth('mfa_email_verified', userId, false);
            }
            return { success: isValid };
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_email_verified', userId, false);
            logger_1.LoggerService.error('Verify email MFA failed:', error);
            throw error;
        }
    }
    /**
     * Use backup code for MFA verification
     * Validates and consumes a backup code
     */
    static async useBackupCode(userId, code) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            if (!user.mfaEnabled) {
                throw (0, utils_1.createError)('MFA not enabled', 400, 'MFA_NOT_ENABLED');
            }
            if (!user.mfaBackupCodes || !Array.isArray(user.mfaBackupCodes) || user.mfaBackupCodes.length === 0) {
                throw (0, utils_1.createError)('No backup codes available', 400, 'NO_BACKUP_CODES');
            }
            // Check if code matches any hashed backup code
            let isValid = false;
            const remainingCodes = [];
            for (const hashedCode of user.mfaBackupCodes) {
                const matches = await bcryptjs_1.default.compare(code, hashedCode);
                if (matches) {
                    isValid = true;
                    // Don't add this code to remaining codes (it's being used)
                }
                else {
                    remainingCodes.push(hashedCode);
                }
            }
            if (isValid) {
                // Remove used backup code
                await user_1.UserService.updateUser(userId, {
                    mfaBackupCodes: remainingCodes
                });
                logger_1.LoggerService.logAuth('mfa_backup_code_used', userId, true);
            }
            else {
                logger_1.LoggerService.logAuth('mfa_backup_code_used', userId, false);
            }
            return { success: isValid };
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_backup_code_used', userId, false);
            logger_1.LoggerService.error('Use backup code failed:', error);
            throw error;
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map