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

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { authenticator } from 'otplib';
import { AuthRequest, AuthResponse, User, JWTPayload, UserRole } from '../types';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';
import { ConfigService } from './config';
import { EmailService } from './email';
import { createError } from '../utils';
import { UserService } from './user';
import { MFAService } from './mfa';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils';
import { Response } from 'express';

export class AuthService {
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private static readonly PASSWORD_RESET_PREFIX = 'password_reset:';
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
    * Login user with email and password
    */
   static async login(email: string, password: string, mfaCode?: string, rememberMe?: boolean, res?: Response): Promise<AuthResponse> {
    try {
      // Get user by email
      const user = await UserService.getUserByEmail(email);
      if (!user) {
        LoggerService.logAuth('login_attempt', 'unknown', false);
        LoggerService.info('Login attempt failed', { email, reason: 'USER_NOT_FOUND' });
        throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.isActive) {
        LoggerService.logAuth('login_attempt', user.id, false);
        LoggerService.info('Login attempt failed - account inactive', { email, reason: 'ACCOUNT_INACTIVE' });
        throw createError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
      }

      // Check account lockout
      const lockoutKey = `login_lockout:${user.id}`;
      const isLockedOut = await RedisService.getString(lockoutKey);
      if (isLockedOut) {
        LoggerService.logAuth('login_attempt', user.id, false);
        LoggerService.info('Login attempt failed - account locked', { email, reason: 'ACCOUNT_LOCKED' });
        throw createError('Account is temporarily locked due to too many failed login attempts', 423, 'ACCOUNT_LOCKED');
      }

      // Verify password
      if (!user.passwordHash) {
        LoggerService.logAuth('login_attempt', user.id, false);
        LoggerService.info('Login attempt failed - no password hash', { email, reason: 'NO_PASSWORD_HASH' });
        throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        // Track failed attempts
        const attemptKey = `login_attempts:${user.id}`;
        const attempts = await RedisService.getString(attemptKey);
        const attemptCount = attempts ? parseInt(attempts, 10) + 1 : 1;

        if (attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
          // Lock account
          await RedisService.setString(lockoutKey, '1', this.LOCKOUT_DURATION);
          await RedisService.del(attemptKey);
          LoggerService.logAuth('account_locked', user.id, false);
          LoggerService.info('Account locked due to too many failed attempts', { email, attemptCount });
          throw createError('Too many failed login attempts. Account locked for 15 minutes', 423, 'ACCOUNT_LOCKED');
        } else {
          await RedisService.setString(attemptKey, attemptCount.toString(), this.LOCKOUT_DURATION);
          LoggerService.logAuth('login_attempt', user.id, false);
          LoggerService.info('Login attempt failed', { email, attemptCount });
          throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }
      }

      // Clear failed attempts on successful password check
      await RedisService.del(`login_attempts:${user.id}`);

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaCode) {
          LoggerService.logAuth('login_attempt', user.id, false);
          LoggerService.info('Login attempt - MFA required', { email, reason: 'MFA_REQUIRED' });
          throw createError('MFA code required', 401, 'MFA_REQUIRED');
        }

        // Verify MFA code
        const mfaResult = await MFAService.verifyMFALogin(user.id, mfaCode);
        if (!mfaResult.success) {
          LoggerService.logAuth('login_attempt', user.id, false);
          LoggerService.info('Login attempt - invalid MFA code', { email, reason: 'INVALID_MFA_CODE' });
          throw createError('Invalid MFA code', 401, 'INVALID_MFA_CODE');
        }
      }

      // Generate tokens
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        permissions: user.permissions || []
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store refresh token in Redis
      const refreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${user.id}:${refreshToken.substring(0, 20)}`;
      const refreshTokenTTL = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days or 7 days
      await RedisService.setString(refreshTokenKey, refreshToken, refreshTokenTTL);

      // Update last login
      await UserService.updateLastLogin(user.id);

      // Log successful login
      LoggerService.logAuth('login_success', user.id, true);
      LoggerService.info('Login successful', { email });

      // Get token expiration
      const expiresIn = parseInt(process.env.JWT_EXPIRES_IN?.replace(/[^0-9]/g, '') || '900', 10);

      // Set httpOnly cookies if response object provided
      if (res) {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'strict' as const,
          maxAge: expiresIn * 1000, // Convert to milliseconds
          path: '/'
        };

        res.cookie('accessToken', accessToken, cookieOptions);

        // Refresh token with longer expiration
        const refreshCookieOptions = {
          ...cookieOptions,
          maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000 // 30 days or 7 days
        };
        res.cookie('refreshToken', refreshToken, refreshCookieOptions);
      }

      return {
        user: {
          ...user,
          passwordHash: undefined // Remove password hash from response
        } as User,
        accessToken: res ? undefined : accessToken, // Don't return tokens if using cookies
        refreshToken: res ? undefined : refreshToken,
        expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error: any) {
      if (error.code && error.code !== 'INVALID_CREDENTIALS') {
        throw error;
      }
      LoggerService.error('Login failed:', error);
      throw createError('Login failed', 401, 'LOGIN_FAILED');
    }
  }

  /**
   * Register a new user
   */
  static async register(userData: { email: string; password: string; firstName?: string; lastName?: string; brokerCode?: string; [key: string]: any }): Promise<User> {
    try {
      // Validate email
      const existingUser = await UserService.getUserByEmail(userData.email);
      if (existingUser) {
        throw createError('Email already registered', 400, 'EMAIL_EXISTS');
      }

      // Validate username if provided
      if (userData.username) {
        const existingUsername = await UserService.getUserByUsername(userData.username);
        if (existingUsername) {
          throw createError('Username already taken', 400, 'USERNAME_EXISTS');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 12);

      // Get default tenant (platform tenant)
      const TenantModel = DatabaseService.getModel('Tenant');
      const platformTenant = await TenantModel.findOne({
        where: { tenantType: 'platform', isActive: true }
      });

      if (!platformTenant) {
        throw createError('Platform tenant not found', 500, 'PLATFORM_TENANT_NOT_FOUND');
      }

      // Create user
      const newUser = await UserService.createUser({
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        passwordHash,
        role: UserRole.USER,
        tenantId: platformTenant.get('id') as string,
        kycStatus: 'pending' as any,
        kycLevel: 'basic' as any,
        isActive: true,
        isVerified: false,
        mfaEnabled: false,
        permissions: []
      });

      LoggerService.logAuth('user_registered', newUser.id, true);
      LoggerService.info('User registered successfully', { email: newUser.email });

      return newUser;
    } catch (error: any) {
      LoggerService.logAuth('user_registered', 'unknown', false);
      LoggerService.info('User registration failed', { email: userData.email, error: error.message });
      LoggerService.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = verifyToken(refreshToken, true);

      // Check if refresh token exists in Redis
      const refreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${payload.userId}:${refreshToken.substring(0, 20)}`;
      const storedToken = await RedisService.getString(refreshTokenKey);

      if (!storedToken || storedToken !== refreshToken) {
        throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Get user
      const user = await UserService.getUserById(payload.userId);
      if (!user || !user.isActive) {
        throw createError('User not found or inactive', 401, 'USER_INACTIVE');
      }

      // Generate new tokens
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        permissions: user.permissions || []
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      // Update refresh token in Redis
      await RedisService.del(refreshTokenKey);
      const newRefreshTokenKey = `${this.REFRESH_TOKEN_PREFIX}${user.id}:${newRefreshToken.substring(0, 20)}`;
      const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days
      await RedisService.setString(newRefreshTokenKey, newRefreshToken, refreshTokenTTL);

      LoggerService.logAuth('token_refreshed', user.id, true);

      const expiresIn = parseInt(process.env.JWT_EXPIRES_IN?.replace(/[^0-9]/g, '') || '900', 10);

      return {
        user: {
          ...user,
          passwordHash: undefined
        } as User,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error: any) {
      LoggerService.error('Token refresh failed:', error);
      throw createError('Token refresh failed', 401, 'TOKEN_REFRESH_FAILED');
    }
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user || !user.passwordHash) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        LoggerService.logAuth('password_change_attempt', userId, false);
        LoggerService.info('Password change attempt failed', { reason: 'INVALID_CURRENT_PASSWORD' });
        throw createError('Current password is incorrect', 400, 'INVALID_PASSWORD');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await UserService.updateUser(userId, { passwordHash: newPasswordHash });

      // Invalidate all refresh tokens (force re-login)
      const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
      const keys = await RedisService.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => RedisService.del(key)));
      }

      LoggerService.logAuth('password_changed', userId, true);
    } catch (error: any) {
      LoggerService.logAuth('password_changed', userId, false);
      LoggerService.info('Password change failed', { error: error.message });
      LoggerService.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Enable MFA for user
   */
  static async enableMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const result = await MFAService.enableMFA(userId);
      return {
        secret: result.secret,
        qrCode: result.qrCodeDataUrl
      };
    } catch (error: any) {
      LoggerService.error('Enable MFA failed:', error);
      throw error;
    }
  }

  /**
   * Verify MFA code
   */
  static async verifyMFA(userId: string, code: string): Promise<{ success: boolean }> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if MFA is being set up (temporary secret exists)
      if (user.mfaSecretTemp) {
        return await MFAService.verifyMFASetup(userId, code);
      }

      // Otherwise verify login MFA
      return await MFAService.verifyMFALogin(userId, code);
    } catch (error: any) {
      LoggerService.error('Verify MFA failed:', error);
      throw error;
    }
  }

  /**
    * Logout user and invalidate refresh token
    */
   static async logout(userId: string, res?: Response): Promise<void> {
     try {
       // Invalidate all refresh tokens for this user
       const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
       const keys = await RedisService.keys(pattern);
       if (keys && keys.length > 0) {
         await Promise.all(keys.map(key => RedisService.del(key)));
       }

       // Clear cookies if response object provided
       if (res) {
         res.clearCookie('accessToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
         res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
       }

       LoggerService.logAuth('logout', userId, true);
     } catch (error: any) {
       LoggerService.error('Logout failed:', error);
       // Don't throw - logout should always succeed
     }
   }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await UserService.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists - security best practice
        LoggerService.info('Password reset requested for non-existent email', { email });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetTokenKey = `${this.PASSWORD_RESET_PREFIX}${resetToken}`;
      const resetTokenTTL = 60 * 60; // 1 hour

      // Store token in Redis
      await RedisService.setString(resetTokenKey, user.id, resetTokenTTL);

      // Send reset email
      await EmailService.sendPasswordReset({
        email: user.email,
        token: resetToken,
        userId: user.id
      });

      LoggerService.logAuth('password_reset_requested', user.id, true);
      LoggerService.info('Password reset requested', { email });
    } catch (error: any) {
      LoggerService.error('Password reset request failed:', error);
      // Don't throw - don't reveal if user exists
    }
  }

  /**
   * Confirm password reset with token
   */
  static async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      // Get user ID from token
      const resetTokenKey = `${this.PASSWORD_RESET_PREFIX}${token}`;
      const userId = await RedisService.getString(resetTokenKey);

      if (!userId) {
        throw createError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
      }

      // Get user
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await UserService.updateUser(userId, { passwordHash: newPasswordHash });

      // Delete reset token
      await RedisService.del(resetTokenKey);

      // Invalidate all refresh tokens (force re-login)
      const pattern = `${this.REFRESH_TOKEN_PREFIX}${userId}:*`;
      const keys = await RedisService.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => RedisService.del(key)));
      }

      LoggerService.logAuth('password_reset_completed', userId, true);
    } catch (error: any) {
      LoggerService.error('Password reset confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for user
   */
  static async disableMFA(userId: string, password: string): Promise<void> {
    return MFAService.disableMFA(userId, password);
  }

  /**
   * Get MFA status for user
   * Returns whether MFA is enabled and configured
   */
  static async getMFAStatus(userId: string): Promise<{ enabled: boolean; verified: boolean }> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      return {
        enabled: user.mfaEnabled || false,
        verified: !!user.mfaVerifiedAt
      };
    } catch (error: any) {
      LoggerService.error('Get MFA status failed:', error);
      throw error;
    }
  }

  /**
   * Regenerate backup codes for MFA
   * Generates new backup codes and invalidates old ones
   */
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.mfaEnabled) {
        throw createError('MFA not enabled', 400, 'MFA_NOT_ENABLED');
      }

      // Generate 10 backup codes
      const backupCodes: string[] = [];
      for (let i = 0; i < 10; i++) {
        backupCodes.push(Math.random().toString(36).substring(2, 10).toUpperCase() + 
                        Math.random().toString(36).substring(2, 10).toUpperCase());
      }

      // Hash backup codes before storing
      const hashedCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 10))
      );

      await UserService.updateUser(userId, {
        mfaBackupCodes: hashedCodes
      });

      LoggerService.logAuth('mfa_backup_codes_regenerated', userId, true);
      
      // Return plain codes (user should save these immediately)
      return backupCodes;
    } catch (error: any) {
      LoggerService.logAuth('mfa_backup_codes_regenerated', userId, false);
      LoggerService.error('Regenerate backup codes failed:', error);
      throw error;
    }
  }

  /**
   * Verify email MFA code
   * Used for email-based MFA verification
   */
  static async verifyEmailMFA(userId: string, code: string): Promise<{ success: boolean }> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.mfaEmailCode || !user.mfaEmailCodeExpiresAt) {
        throw createError('No email MFA code found', 400, 'MFA_CODE_NOT_FOUND');
      }

      if (new Date() > new Date(user.mfaEmailCodeExpiresAt)) {
        throw createError('Email MFA code expired', 400, 'MFA_CODE_EXPIRED');
      }

      const isValid = user.mfaEmailCode === code;

      if (isValid) {
        // Clear the code after successful verification
        await UserService.updateUser(userId, {
          mfaEmailCode: undefined,
          mfaEmailCodeExpiresAt: undefined
        });
        LoggerService.logAuth('mfa_email_verified', userId, true);
      } else {
        LoggerService.logAuth('mfa_email_verified', userId, false);
      }

      return { success: isValid };
    } catch (error: any) {
      LoggerService.logAuth('mfa_email_verified', userId, false);
      LoggerService.error('Verify email MFA failed:', error);
      throw error;
    }
  }

  /**
   * Use backup code for MFA verification
   * Validates and consumes a backup code
   */
  static async useBackupCode(userId: string, code: string): Promise<{ success: boolean }> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.mfaEnabled) {
        throw createError('MFA not enabled', 400, 'MFA_NOT_ENABLED');
      }

      if (!user.mfaBackupCodes || !Array.isArray(user.mfaBackupCodes) || user.mfaBackupCodes.length === 0) {
        throw createError('No backup codes available', 400, 'NO_BACKUP_CODES');
      }

      // Check if code matches any hashed backup code
      let isValid = false;
      const remainingCodes: string[] = [];

      for (const hashedCode of user.mfaBackupCodes) {
        const matches = await bcrypt.compare(code, hashedCode);
        if (matches) {
          isValid = true;
          // Don't add this code to remaining codes (it's being used)
        } else {
          remainingCodes.push(hashedCode);
        }
      }

      if (isValid) {
        // Remove used backup code
        await UserService.updateUser(userId, {
          mfaBackupCodes: remainingCodes
        });
        LoggerService.logAuth('mfa_backup_code_used', userId, true);
      } else {
        LoggerService.logAuth('mfa_backup_code_used', userId, false);
      }

      return { success: isValid };
    } catch (error: any) {
      LoggerService.logAuth('mfa_backup_code_used', userId, false);
      LoggerService.error('Use backup code failed:', error);
      throw error;
    }
  }
}
