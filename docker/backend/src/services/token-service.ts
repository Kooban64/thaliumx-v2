/**
 * Token Service
 * 
 * Handles access token and refresh token issuance, validation, and rotation.
 * Implements secure token management for financial services compliance.
 * 
 * Features:
 * - Access token issuance with configurable expiration
 * - Refresh token rotation (security best practice)
 * - Token revocation support
 * - Secure token storage (hashed refresh tokens)
 * - Token blacklisting
 * - Periodic user data refresh from database on token refresh
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { LoggerService } from './logger';
import { RedisService } from './redis';
import type { JWTPayload } from '../types';
import { DatabaseService } from './database';
import type { Model, ModelCtor } from 'sequelize';

// User model type for database queries
type UserModelInstance = Model & {
  id: string;
  email: string;
  role: string;
  roles: string[];
  tenantId: string;
  brokerId?: string;
  brokerSlug?: string;
  channel: 'direct' | 'broker';
  customerId?: string;
  mandateScopes?: string[];
  permissions: any[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
  isActive: boolean;
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export class TokenService {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'change-me-in-production';
  private static readonly REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'change-me-in-production';
  private static readonly ACCESS_TOKEN_EXPIRY = parseInt(process.env.ACCESS_TOKEN_EXPIRY || '900', 10); // 15 minutes default
  private static readonly REFRESH_TOKEN_EXPIRY = parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800', 10); // 7 days default
  private static readonly TOKEN_ISSUER = process.env.TOKEN_ISSUER || 'thaliumx-platform';
  private static readonly TOKEN_AUDIENCE = process.env.TOKEN_AUDIENCE || 'thaliumx-api';

  /**
   * Issue access and refresh token pair
   */
  public static async issueTokenPair(user: {
    id: string;
    userId: string;
    email: string;
    role?: string;
    roles?: string[];
    tenantId?: string;
    brokerId?: string;
    brokerSlug?: string;
    channel?: 'direct' | 'broker';
    customerId?: string;
    mandateScopes?: string[];
    sessionType?: string;
    authProvider?: 'authentik' | 'internal-jwt';
    permissions?: string[];
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
  }): Promise<TokenPair> {
    const tokenId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Build access token payload
    const accessTokenPayload: JWTPayload & { mfa_enabled?: boolean; mfa_verified?: boolean } = {
      id: user.id,
      userId: user.userId || user.id,
      email: user.email,
      role: (user.role || 'user') as any,
      roles: (user.roles || []) as any[],
      tenantId: user.tenantId || '',
      brokerId: user.brokerId || '',
      brokerSlug: user.brokerSlug,
      channel: user.channel || (user.brokerId ? 'broker' : 'direct'),
      customerId: user.customerId,
      mandateScopes: user.mandateScopes || [],
      sessionType: user.sessionType,
      authProvider: user.authProvider || 'internal-jwt',
      permissions: (user.permissions || []) as any[],
      mfa_enabled: user.mfaEnabled || false,
      mfa_verified: user.mfaVerified || false,
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRY,
    };

    // Build refresh token payload
    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.userId || user.id,
      tokenId,
      type: 'refresh',
      iat: now,
      exp: now + this.REFRESH_TOKEN_EXPIRY,
    };

    // Sign tokens
    const accessToken = jwt.sign(accessTokenPayload, this.ACCESS_TOKEN_SECRET, {
      issuer: this.TOKEN_ISSUER,
      audience: this.TOKEN_AUDIENCE,
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.REFRESH_TOKEN_SECRET, {
      issuer: this.TOKEN_ISSUER,
      audience: this.TOKEN_AUDIENCE,
      algorithm: 'HS256',
    });

    // Store refresh token hash in Redis (for revocation)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await RedisService.set(
      `refresh_token:${tokenId}`,
      refreshTokenHash,
      this.REFRESH_TOKEN_EXPIRY
    );

    // Store token metadata
    await RedisService.set(
      `refresh_token_meta:${tokenId}`,
      JSON.stringify({
        userId: user.userId || user.id,
        email: user.email,
        issuedAt: now,
        expiresAt: now + this.REFRESH_TOKEN_EXPIRY,
      }),
      this.REFRESH_TOKEN_EXPIRY
    );

    // Log token issuance
    await LoggerService.logAudit('token_issued', 'token_operation', { userId: user.userId || user.id }, {
      operation: 'issued',
      tokenType: 'access',
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiresIn: this.REFRESH_TOKEN_EXPIRY,
    };
  }

  /**
   * Refresh access token using refresh token
   * Periodically fetches fresh user data from database to ensure permissions are up-to-date
   */
  public static async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.REFRESH_TOKEN_SECRET, {
        issuer: this.TOKEN_ISSUER,
        audience: this.TOKEN_AUDIENCE,
      }) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is revoked
      const tokenId = decoded.tokenId;
      const storedHash = await RedisService.get(`refresh_token:${tokenId}`);
      if (!storedHash) {
        throw new Error('Refresh token not found or revoked');
      }

      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      if (storedHash !== refreshTokenHash) {
        throw new Error('Refresh token mismatch');
      }

      // Get user metadata
      const metaStr = await RedisService.get(`refresh_token_meta:${tokenId}`);
      if (!metaStr) {
        throw new Error('Token metadata not found');
      }

      const meta = JSON.parse(metaStr as string);

      // Revoke old refresh token (rotation)
      await this.revokeRefreshToken(tokenId);

      // Fetch fresh user data from database to ensure permissions are up-to-date
      const freshUserData = await this.fetchFreshUserData(meta.userId);

      // Issue new token pair with fresh user data
      const newTokenPair = await this.issueTokenPair({
        id: freshUserData.id,
        userId: freshUserData.id,
        email: freshUserData.email,
        role: freshUserData.role,
        roles: freshUserData.roles,
        tenantId: freshUserData.tenantId,
        brokerId: freshUserData.brokerId,
        brokerSlug: freshUserData.brokerSlug,
        channel: freshUserData.channel,
        customerId: freshUserData.customerId,
        mandateScopes: freshUserData.mandateScopes,
        permissions: freshUserData.permissions,
        mfaEnabled: freshUserData.mfaEnabled,
        mfaVerified: freshUserData.mfaVerified
      });

      // Log refresh with audit
      await LoggerService.logAudit('token_refreshed', 'token_operation', { userId: meta.userId }, {
        operation: 'refreshed',
        tokenType: 'refresh',
        permissionsRefreshed: true
      });

      return newTokenPair;
    } catch (error) {
      LoggerService.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Fetch fresh user data from database
   * This ensures that token permissions are always up-to-date
   * including role changes, permission updates, and tenant assignments
   */
  private static async fetchFreshUserData(userId: string): Promise<{
    id: string;
    email: string;
    role: string;
    roles: string[];
    tenantId: string;
    brokerId?: string;
    brokerSlug?: string;
    channel: 'direct' | 'broker';
    customerId?: string;
    mandateScopes?: string[];
    permissions: string[];
    mfaEnabled: boolean;
    mfaVerified: boolean;
  }> {
    try {
      const UserModel = DatabaseService.getModel('User') as unknown as ModelCtor<UserModelInstance>;
      const user = await UserModel.findByPk(userId, {
        attributes: [
          'id', 'email', 'role', 'roles', 'tenantId', 'brokerId', 'brokerSlug',
          'channel', 'customerId', 'mandateScopes', 'permissions', 'mfaEnabled', 'mfaVerified'
        ]
      });

      if (!user) {
        throw new Error('User not found during token refresh');
      }

      const userData = user.toJSON();

      // Convert permissions to string array
      const permissionStrings = (userData.permissions || []).map((p: any) => 
        typeof p === 'string' ? p : `${p.resource}:${p.action}`
      );

      // Determine channel based on role and tenant
      const normalizedRole = String(userData.role || 'user').replace(/-/g, '_');
      const isBrokerRole = normalizedRole.startsWith('broker_');
      const channel = isBrokerRole ? 'broker' : (userData.channel || 'direct');
      const brokerId = isBrokerRole ? userData.tenantId : userData.brokerId;

      return {
        id: userData.id,
        email: userData.email,
        role: userData.role || 'user',
        roles: userData.roles || [userData.role || 'user'],
        tenantId: userData.tenantId || '',
        brokerId: brokerId,
        brokerSlug: userData.brokerSlug,
        channel,
        customerId: userData.customerId,
        mandateScopes: userData.mandateScopes || [],
        permissions: permissionStrings,
        mfaEnabled: userData.mfaEnabled || false,
        mfaVerified: userData.mfaVerified || false
      };
    } catch (error) {
      LoggerService.error('Failed to fetch fresh user data during token refresh', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }

  /**
   * Revoke refresh token
   */
  public static async revokeRefreshToken(tokenId: string): Promise<void> {
    await RedisService.del(`refresh_token:${tokenId}`);
    await RedisService.del(`refresh_token_meta:${tokenId}`);

    // Log revocation
    const metaStr = await RedisService.get(`refresh_token_meta:${tokenId}`);
    if (metaStr) {
      const meta = JSON.parse(metaStr as string);
      await LoggerService.logAudit('token_revoked', 'token_operation', { userId: meta.userId }, {
        operation: 'revoked',
        tokenType: 'refresh',
        reason: 'Token rotation or user logout',
      });
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  public static async revokeAllUserTokens(userId: string): Promise<void> {
    // In production, you'd maintain an index of token IDs per user
    // For now, this is a placeholder - you'd need to scan Redis keys
    LoggerService.info('Revoking all tokens for user', { userId });
    
    await LoggerService.logAudit('token_revoked_all', 'token_operation', { userId }, {
      operation: 'revoked',
      tokenType: 'refresh',
      reason: 'All tokens revoked (user action)',
    });
  }

  /**
   * Verify access token
   */
  public static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
      issuer: this.TOKEN_ISSUER,
      audience: this.TOKEN_AUDIENCE,
      algorithms: ['HS256'],
    }) as JWTPayload;
  }

  /**
   * Check if token is blacklisted
   */
  public static async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const blacklisted = await RedisService.get(`blacklisted_token:${tokenId}`);
    return !!blacklisted;
  }

  /**
   * Blacklist a token (for logout)
   */
  public static async blacklistToken(tokenId: string, expiresIn: number): Promise<void> {
    await RedisService.set(`blacklisted_token:${tokenId}`, '1', expiresIn);
  }
}
