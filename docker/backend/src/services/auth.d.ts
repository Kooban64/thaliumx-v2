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
import { AuthResponse, User } from '../types';
export declare class AuthService {
    private static readonly REFRESH_TOKEN_PREFIX;
    private static readonly PASSWORD_RESET_PREFIX;
    private static readonly MAX_LOGIN_ATTEMPTS;
    private static readonly LOCKOUT_DURATION;
    /**
     * Login user with email and password
     */
    static login(email: string, password: string, mfaCode?: string, rememberMe?: boolean): Promise<AuthResponse>;
    /**
     * Register a new user
     */
    static register(userData: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
        brokerCode?: string;
        [key: string]: any;
    }): Promise<User>;
    /**
     * Refresh access token using refresh token
     */
    static refreshToken(refreshToken: string): Promise<AuthResponse>;
    /**
     * Change user password
     */
    static changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    /**
     * Enable MFA for user
     */
    static enableMFA(userId: string): Promise<{
        secret: string;
        qrCode: string;
    }>;
    /**
     * Verify MFA code
     */
    static verifyMFA(userId: string, code: string): Promise<{
        success: boolean;
    }>;
    /**
     * Logout user and invalidate refresh token
     */
    static logout(userId: string): Promise<void>;
    /**
     * Request password reset
     */
    static requestPasswordReset(email: string): Promise<void>;
    /**
     * Confirm password reset with token
     */
    static confirmPasswordReset(token: string, newPassword: string): Promise<void>;
    /**
     * Disable MFA for user
     */
    static disableMFA(userId: string, password: string): Promise<void>;
    /**
     * Get MFA status for user
     * Returns whether MFA is enabled and configured
     */
    static getMFAStatus(userId: string): Promise<{
        enabled: boolean;
        verified: boolean;
    }>;
    /**
     * Regenerate backup codes for MFA
     * Generates new backup codes and invalidates old ones
     */
    static regenerateBackupCodes(userId: string): Promise<string[]>;
    /**
     * Verify email MFA code
     * Used for email-based MFA verification
     */
    static verifyEmailMFA(userId: string, code: string): Promise<{
        success: boolean;
    }>;
    /**
     * Use backup code for MFA verification
     * Validates and consumes a backup code
     */
    static useBackupCode(userId: string, code: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=auth.d.ts.map