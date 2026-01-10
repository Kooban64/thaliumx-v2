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
import { v4 as uuidv4 } from 'uuid';
// jwt imported but not used in this file
import type { AuthResponse, User, JWTPayload} from '../types';
import { UserRole, KYCLevel } from '../types';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';
// authenticator, AuthRequest, ConfigService imported but not used in this file
import { EmailService } from './email';
import { zitadelApiService } from './zitadel-api.service';
import { createError } from '../utils';
import { UserService } from './user';
import { MFAService } from './mfa';
import { wazuhApiService } from './wazuh-api.service';
// Note: Internal JWT generation removed - using Zitadel tokens only
// import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils';
import type { Response } from 'express';
import type { Model, ModelCtor } from 'sequelize';

type TenantModelInstance = Model & {
  id: string;
  slug: string;
  isActive: boolean;
};

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
        LoggerService.info('Login attempt failed', { email, reason: 'USER_NOT_FOUND', wazuh_sent: true });
        
        // Send authentication failure to Wazuh API (real-time)
        wazuhApiService.sendSecurityEvent({
          id: `auth-fail-${Date.now()}`,
          type: 'login_failure',
          severity: 'medium',
          title: 'Authentication Failure - User Not Found',
          description: `Login attempt failed for unknown user: ${email}`,
          source: 'auth_service',
          timestamp: new Date(),
          metadata: { email, reason: 'USER_NOT_FOUND' }
        }).catch((error) => {
          LoggerService.error('Failed to send auth failure to Wazuh', {
            error: error instanceof Error ? error.message : String(error)
          });
        });
        
        const { MetricsService } = await import('./metrics');
        MetricsService.recordAuthLoginFailure('user_not_found');
        throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.isActive) {
        LoggerService.logAuth('login_attempt', user.id, false);
        LoggerService.info('Login attempt failed - account inactive', { email, reason: 'ACCOUNT_INACTIVE' });
        const { MetricsService } = await import('./metrics');
        MetricsService.recordAuthLoginFailure('account_inactive');
        throw createError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
      }

      // Check account lockout
      const lockoutKey = `login_lockout:${user.id}`;
      const isLockedOut = await RedisService.getString(lockoutKey);
      if (isLockedOut) {
        LoggerService.logAuth('login_attempt', user.id, false);
        LoggerService.info('Login attempt failed - account locked', { email, reason: 'ACCOUNT_LOCKED' });
        const { MetricsService } = await import('./metrics');
        MetricsService.recordAuthLoginFailure('account_locked');
        throw createError('Account is temporarily locked due to too many failed login attempts', 423, 'ACCOUNT_LOCKED');
      }

      // Authenticate user - Zitadel-first if zitadelId exists, otherwise fallback to bcrypt
      let isPasswordValid = false;

      if (user.zitadelId) {
        // User has Zitadel ID - authenticate via Zitadel API
        try {
          const zitadelAuth = await zitadelApiService.authenticateUser(email, password);
          isPasswordValid = true; // Zitadel authentication succeeded
          
          // Update zitadelId if it changed (shouldn't happen, but sync just in case)
          if (zitadelAuth.userId !== user.zitadelId) {
            await UserService.updateUser(user.id, { zitadelId: zitadelAuth.userId });
            LoggerService.info('Updated zitadelId for user', { userId: user.id, oldZitadelId: user.zitadelId, newZitadelId: zitadelAuth.userId });
          }
        } catch (zitadelError: any) {
          // Zitadel authentication failed
          if (zitadelError.code === 'INVALID_CREDENTIALS' || zitadelError.code === 'USER_NOT_FOUND') {
            isPasswordValid = false;
          } else {
            // For other Zitadel errors, fallback to bcrypt if password hash exists
            LoggerService.warn('Zitadel authentication failed, falling back to bcrypt', {
              error: zitadelError.message,
              email,
              userId: user.id
            });
            
            if (user.passwordHash) {
              isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            } else {
              isPasswordValid = false;
            }
          }
        }
      } else {
        // No Zitadel ID - use bcrypt password verification (backward compatibility)
        if (!user.passwordHash) {
          // Try to find user in Zitadel and link them
          try {
            const zitadelUser = await zitadelApiService.getUserByEmail(email);
            if (zitadelUser) {
              // User exists in Zitadel but not linked - authenticate and link
              const zitadelAuth = await zitadelApiService.authenticateUser(email, password);
              isPasswordValid = true;
              
              // Link Zitadel ID to database user
              await UserService.updateUser(user.id, { zitadelId: zitadelAuth.userId });
              LoggerService.info('Linked Zitadel account to database user', {
                userId: user.id,
                zitadelId: zitadelAuth.userId,
                email
              });
            } else {
              // User not in Zitadel and no password hash - invalid
              LoggerService.logAuth('login_attempt', user.id, false);
              LoggerService.info('Login attempt failed - no password hash and not in Zitadel', { email, reason: 'NO_PASSWORD_HASH' });
              const { MetricsService } = await import('./metrics');
              MetricsService.recordAuthLoginFailure('no_password_hash');
              throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
            }
          } catch {
            // Zitadel lookup/auth failed - use bcrypt if available
            if (user.passwordHash) {
              isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            } else {
              isPasswordValid = false;
            }
          }
        } else {
          // Use bcrypt password verification
          isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        }
      }

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
          LoggerService.info('Account locked due to too many failed attempts', { email, attemptCount, wazuh_sent: true });
          
          // Send account lockout to Wazuh API (real-time, high severity)
          wazuhApiService.sendSecurityEvent({
            id: `auth-lockout-${Date.now()}`,
            type: 'account_locked',
            severity: 'high',
            title: 'Account Locked - Too Many Failed Login Attempts',
            description: `Account locked for user ${email} after ${attemptCount} failed login attempts`,
            source: 'auth_service',
            userId: user.id,
            timestamp: new Date(),
            metadata: { email, attemptCount, reason: 'too_many_attempts' }
          }).catch((error) => {
            LoggerService.error('Failed to send account lockout to Wazuh', {
              error: error instanceof Error ? error.message : String(error)
            });
          });
          
          const { MetricsService } = await import('./metrics');
          MetricsService.recordAuthLoginFailure('too_many_attempts');
          throw createError('Too many failed login attempts. Account locked for 15 minutes', 423, 'ACCOUNT_LOCKED');
        } else {
          await RedisService.setString(attemptKey, attemptCount.toString(), this.LOCKOUT_DURATION);
          LoggerService.logAuth('login_attempt', user.id, false);
          LoggerService.info('Login attempt failed', { email, attemptCount, wazuh_sent: true });
          
          // Send authentication failure to Wazuh API (real-time)
          // Only send if multiple attempts (potential brute force)
          if (attemptCount >= 3) {
            wazuhApiService.sendSecurityEvent({
              id: `auth-fail-${Date.now()}`,
              type: 'login_failure',
              severity: attemptCount >= 4 ? 'high' : 'medium',
              title: `Authentication Failure - Attempt ${attemptCount}`,
              description: `Failed login attempt ${attemptCount} for user ${email}`,
              source: 'auth_service',
              userId: user.id,
              timestamp: new Date(),
              metadata: { email, attemptCount, reason: 'invalid_password' }
            }).catch((error) => {
              LoggerService.error('Failed to send auth failure to Wazuh', {
                error: error instanceof Error ? error.message : String(error)
              });
            });
          }
          
          const { MetricsService } = await import('./metrics');
          MetricsService.recordAuthLoginFailure('invalid_password');
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

      // Get Zitadel OIDC token for the authenticated user
      // This replaces internal JWT generation - we use Zitadel tokens only
      let zitadelToken: { accessToken: string; expiresIn: number; tokenType: string };
      
      try {
        // If user has Zitadel ID, get token using their credentials
        if (user.zitadelId) {
          zitadelToken = await zitadelApiService.getUserToken(email, password);
        } else {
          // User not in Zitadel yet - this shouldn't happen after registration
          // but handle gracefully for backward compatibility
          LoggerService.warn('User does not have Zitadel ID, cannot get Zitadel token', {
            userId: user.id,
            email
          });
          throw createError('User not configured in Zitadel', 500, 'ZITADEL_NOT_CONFIGURED');
        }
      } catch (tokenError: any) {
        LoggerService.error('Failed to get Zitadel token after authentication', {
          error: tokenError.message,
          userId: user.id,
          email
        });
        throw createError('Failed to obtain authentication token', 500, 'TOKEN_ERROR');
      }

      // Update last login
      await UserService.updateLastLogin(user.id);

      // Log successful login
      LoggerService.logAuth('login_success', user.id, true);
      LoggerService.info('Login successful', { email, zitadelId: user.zitadelId });

      // Set httpOnly cookies if response object provided
      if (res) {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'strict' as const,
          maxAge: zitadelToken.expiresIn * 1000, // Convert to milliseconds
          path: '/'
        };

        res.cookie('accessToken', zitadelToken.accessToken, cookieOptions);
      }

      return {
        user: {
          ...user,
          passwordHash: undefined // Remove password hash from response
        } as User,
        accessToken: res ? undefined : zitadelToken.accessToken, // Don't return token if using cookies
        refreshToken: undefined, // Zitadel handles refresh via OIDC
        expiresIn: zitadelToken.expiresIn,
        tokenType: 'Bearer' as const
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
   * Uses DEFAULT_TENANT_SLUG (fallback: thaliumx-platform) as default if tenantId not provided
   */
  static async register(userData: { email: string; password: string; firstName?: string; lastName?: string; brokerCode?: string; tenantId?: string; [key: string]: any }): Promise<User> {
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

      // Get tenant ID - priority: provided tenantId > brokerCode > default tenant
      let tenantId = userData.tenantId;
      
      if (!tenantId && userData.brokerCode) {
        // If brokerCode provided, find or create broker tenant
        const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
        let tenant = await TenantModel.findOne({ where: { slug: userData.brokerCode } });
        
        if (!tenant) {
          // Create tenant if it doesn't exist (for broker signups)
          tenant = await TenantModel.create({
            name: `${userData.brokerCode} Broker`,
            slug: userData.brokerCode,
            tenantType: 'broker',
            isActive: true,
            settings: {}
          });
          LoggerService.info('Created new broker tenant', { brokerCode: userData.brokerCode, tenantId: tenant.id });
        }
        tenantId = tenant.id;
      }
      
      // If still no tenantId, use default tenant slug
      if (!tenantId) {
        const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG || 'thaliumx-platform';
        const TenantModel = DatabaseService.getModel('Tenant') as unknown as ModelCtor<TenantModelInstance>;
        const defaultTenant = await TenantModel.findOne({
          where: { slug: defaultTenantSlug }
        });
        
        if (defaultTenant) {
          tenantId = defaultTenant.id;
          LoggerService.debug('Using default tenant', { tenantId, slug: defaultTenantSlug });
        } else {
          LoggerService.warn('Default tenant not found, using first available tenant', { defaultTenantSlug });
          const firstTenant = await TenantModel.findOne({ where: { isActive: true } });
          if (firstTenant) {
            tenantId = firstTenant.id;
          } else {
            throw createError('No active tenant available', 500, 'NO_TENANT');
          }
        }
      }

      // Zitadel-first approach: Create user in Zitadel first, then in database
      let zitadelId: string | null = null;

      try {
        // Step 1: Create user in Zitadel via Management API
        const zitadelUser = await zitadelApiService.createUser(
          userData.email,
          userData.password,
          userData.firstName || '',
          userData.lastName || ''
        );
        
        zitadelId = zitadelUser.userId;

        LoggerService.info('User created in Zitadel', {
          email: userData.email,
          zitadelId: zitadelUser.userId
        });
      } catch (zitadelError: any) {
        // If Zitadel creation fails, log but don't fail registration
        // This allows fallback to database-only registration if Zitadel is unavailable
        LoggerService.error('Failed to create user in Zitadel, proceeding with database-only registration', {
          error: zitadelError.message,
          email: userData.email
        });
        
        // Only fail if it's a user already exists error (409)
        if (zitadelError.code === 'USER_ALREADY_EXISTS') {
          throw createError('User already exists', 409, 'USER_ALREADY_EXISTS');
        }
        
        // For other errors, continue with database registration (zitadelId will be null)
        // User can be linked to Zitadel later if needed
      }

      // Step 2: Create user in database with zitadel_id link
      const newUser = await UserService.createUser({
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        passwordHash, // Keep password hash for backward compatibility
        role: UserRole.USER,
        tenantId: tenantId,
        kycStatus: 'not_started' as any, // Changed from 'pending' to 'not_started' to match KYC service enum
        kycLevel: KYCLevel.L0,
        isActive: true,
        isVerified: false,
        mfaEnabled: false,
        permissions: [],
        zitadelId: zitadelId || undefined // Link to Zitadel user if created successfully
      } as any); // Type assertion needed for zitadelId field

      LoggerService.logAuth('user_registered', newUser.id, true);
      LoggerService.info('User registered successfully', {
        email: newUser.email,
        userId: newUser.id,
        zitadelId: zitadelId || 'none'
      });

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
   * @deprecated With Zitadel OIDC, token refresh should be handled via OIDC refresh flow
   * This method is kept for backward compatibility but should not be used with Zitadel tokens
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    // Token refresh is now handled by Zitadel OIDC flow
    // Frontend should use Zitadel SDK's refresh token mechanism
    throw createError(
      'Token refresh via this endpoint is deprecated. Use Zitadel OIDC refresh flow instead.',
      400,
      'DEPRECATED_REFRESH_METHOD'
    );
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
