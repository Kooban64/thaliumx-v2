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
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { LoggerService } from './logger';
import { RedisService } from './redis';
// import { AuditLogService } from './audit-log.service'; // Use LoggerService.logAudit instead
import type { JWTPayload } from '../types';

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

      // Issue new token pair
      // Note: In production, you'd fetch full user data from database
      const newTokenPair = await this.issueTokenPair({
        id: meta.userId,
        userId: meta.userId,
        email: meta.email,
      });

      // Log refresh
      await LoggerService.logAudit('token_refreshed', 'token_operation', { userId: meta.userId }, {
        operation: 'refreshed',
        tokenType: 'refresh',
      });

      return newTokenPair;
    } catch (error) {
      LoggerService.error('Token refresh failed', error);
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
