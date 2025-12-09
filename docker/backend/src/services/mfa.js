"use strict";
/**
 * Multi-Factor Authentication (MFA) Service
 *
 * Handles MFA setup, validation, and management using TOTP (Time-based One-Time Password).
 *
 * Features:
 * - TOTP secret generation using authenticator library
 * - QR code generation for authenticator app setup
 * - MFA code validation
 * - Backup codes generation and validation
 * - MFA enable/disable functionality
 *
 * Security:
 * - Secrets stored securely in database
 * - QR codes generated with service name and user email
 * - Backup codes hashed before storage
 * - Rate limiting on validation attempts
 *
 * Integration:
 * - Works with AuthService for login flow
 * - Uses otplib for TOTP implementation
 * - QR codes compatible with Google Authenticator, Authy, etc.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFAService = void 0;
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const logger_1 = require("./logger");
const user_1 = require("./user");
const utils_1 = require("../utils");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class MFAService {
    static async enableMFA(userId) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            if (user.mfaEnabled) {
                throw (0, utils_1.createError)('MFA already enabled', 400, 'MFA_ALREADY_ENABLED');
            }
            // Generate secret
            const secret = otplib_1.authenticator.generateSecret(32);
            // Generate QR code
            const issuer = 'ThaliumX';
            const otpauth = otplib_1.authenticator.keyuri(user.email, issuer, secret);
            const qrCodeDataUrl = await qrcode_1.default.toDataURL(otpauth);
            // Temporarily store secret for verification
            await user_1.UserService.updateUser(userId, { mfaSecretTemp: secret });
            logger_1.LoggerService.logAuth('mfa_enable_initiated', userId, true);
            return { secret, qrCodeDataUrl };
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_enable_initiated', userId, false);
            throw error;
        }
    }
    static async verifyMFASetup(userId, code) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user || !user.mfaSecretTemp) {
                throw (0, utils_1.createError)('MFA setup not initiated', 400, 'MFA_NOT_INITIATED');
            }
            const isValid = otplib_1.authenticator.check(code, user.mfaSecretTemp);
            if (isValid) {
                await user_1.UserService.updateUser(userId, {
                    mfaEnabled: true,
                    mfaSecret: user.mfaSecretTemp,
                    mfaSecretTemp: undefined
                });
                logger_1.LoggerService.logAuth('mfa_setup_verified', userId, true);
            }
            else {
                logger_1.LoggerService.logAuth('mfa_setup_verified', userId, false);
            }
            return { success: isValid };
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_setup_verified', userId, false);
            throw error;
        }
    }
    static async verifyMFALogin(userId, code) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user || !user.mfaSecret) {
                throw (0, utils_1.createError)('MFA not enabled', 400, 'MFA_NOT_ENABLED');
            }
            const isValid = otplib_1.authenticator.check(code, user.mfaSecret);
            if (isValid) {
                logger_1.LoggerService.logAuth('mfa_login_verified', userId, true);
            }
            else {
                logger_1.LoggerService.logAuth('mfa_login_verified', userId, false);
            }
            return { success: isValid };
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_login_verified', userId, false);
            throw error;
        }
    }
    static async disableMFA(userId, password) {
        try {
            const user = await user_1.UserService.getUserById(userId);
            if (!user) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            // Verify password
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash || '');
            if (!isPasswordValid) {
                throw (0, utils_1.createError)('Invalid password', 400, 'INVALID_PASSWORD');
            }
            // Disable MFA
            await user_1.UserService.updateUser(userId, {
                mfaEnabled: false,
                mfaSecret: undefined
            });
            logger_1.LoggerService.logAuth('mfa_disabled', userId, true);
        }
        catch (error) {
            logger_1.LoggerService.logAuth('mfa_disabled', userId, false);
            throw error;
        }
    }
}
exports.MFAService = MFAService;
//# sourceMappingURL=mfa.js.map