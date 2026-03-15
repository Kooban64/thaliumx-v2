/**
 * API Key Validation Service
 * 
 * Provides secure API key validation against the database.
 * 
 * Features:
 * - Validates API keys against stored hashes
 * - Checks key status (active, revoked, expired)
 * - Records last usage information
 * - Returns appropriate error responses
 * - Caches validated keys for performance
 * 
 * Security:
 * - Keys are stored as SHA-256 hashes, never in plaintext
 * - Rate limiting per key
 * - Usage tracking for audit purposes
 * 
 * Error Codes:
 * - MISSING_API_KEY: No API key provided
 * - INVALID_API_KEY: Key not found or hash mismatch
 * - REVOKED_API_KEY: Key has been revoked
 * - EXPIRED_API_KEY: Key has expired
 * - SUSPENDED_API_KEY: Key has been suspended
 */

import { createError } from '../utils';
import { LoggerService } from './logger';
import { DatabaseService } from './database';
import * as crypto from 'crypto';

interface ValidatedApiKey {
  id: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  userId: string;
  tenantId: string | null;
  brokerId: string | null;
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  expiresAt: Date | null;
  rateLimit: number;
  metadata: Record<string, any>;
}

// Cache for validated API keys (short TTL to reduce DB load)
const apiKeyCache = new Map<string, { key: ValidatedApiKey; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache
const MAX_CACHE_SIZE = 1000;

export class ApiKeyService {
  /**
   * Hash an API key using SHA-256
   * 
   * @param apiKey - The plaintext API key
   * @returns The SHA-256 hash of the key
   */
  public static hashKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Get the prefix of an API key for display purposes
   * 
   * @param apiKey - The plaintext API key
   * @returns First 8 characters of the key
   */
  public static getKeyPrefix(apiKey: string): string {
    return apiKey.substring(0, 8);
  }

  /**
   * Validate an API key
   * 
   * @param apiKey - The API key to validate
   * @param ipAddress - Optional IP address for usage tracking
   * @returns The validated API key data if successful
   * @throws Error with appropriate code if validation fails
   */
  public static async validateKey(apiKey: string, ipAddress?: string): Promise<ValidatedApiKey> {
    if (!apiKey) {
      throw createError('API key required', 401, 'MISSING_API_KEY');
    }

    // Check cache first
    const keyHash = this.hashKey(apiKey);
    const cached = apiKeyCache.get(keyHash);
    
    if (cached && cached.expiresAt > Date.now()) {
      // Update last used asynchronously (fire and forget)
      this.updateLastUsed(cached.key.id, ipAddress).catch(() => {});
      return cached.key;
    }

    try {
      const ApiKeyModel = DatabaseService.getModel('ApiKey');
      
      // Find the API key by hash
      const apiKeyRecord = await ApiKeyModel.findOne({
        where: { keyHash }
      });

      if (!apiKeyRecord) {
        LoggerService.warn('API key not found', {
          keyPrefix: this.getKeyPrefix(apiKey),
          ip: ipAddress
        });
        throw createError('Invalid API key', 401, 'INVALID_API_KEY');
      }

      const keyData = apiKeyRecord.toJSON() as any;

      // Check if key is revoked
      if (keyData.status === 'revoked') {
        LoggerService.warn('Revoked API key attempt', {
          keyId: keyData.id,
          keyPrefix: keyData.keyPrefix,
          userId: keyData.userId,
          ip: ipAddress
        });
        throw createError('API key has been revoked', 401, 'REVOKED_API_KEY');
      }

      // Check if key is expired
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        LoggerService.warn('Expired API key attempt', {
          keyId: keyData.id,
          keyPrefix: keyData.keyPrefix,
          userId: keyData.userId,
          expiresAt: keyData.expiresAt,
          ip: ipAddress
        });
        
        // Update status to expired
        await apiKeyRecord.update({ status: 'expired' });
        
        throw createError('API key has expired', 401, 'EXPIRED_API_KEY');
      }

      // Build validated key object
      const validatedKey: ValidatedApiKey = {
        id: keyData.id,
        keyHash: keyData.keyHash,
        keyPrefix: keyData.keyPrefix,
        name: keyData.name,
        userId: keyData.userId,
        tenantId: keyData.tenantId,
        brokerId: keyData.brokerId,
        scopes: keyData.scopes || [],
        status: keyData.status,
        expiresAt: keyData.expiresAt,
        rateLimit: keyData.rateLimit || 100,
        metadata: keyData.metadata || {}
      };

      // Cache the validated key
      this.setCache(keyHash, validatedKey);

      // Update last used asynchronously (fire and forget)
      this.updateLastUsed(keyData.id, ipAddress).catch(() => {});

      // Log successful validation
      LoggerService.debug('API key validated successfully', {
        keyId: keyData.id,
        keyPrefix: keyData.keyPrefix,
        userId: keyData.userId
      });

      return validatedKey;

    } catch (error: any) {
      // If it's already a known error, re-throw
      if (error.statusCode === 401) {
        throw error;
      }
      
      LoggerService.error('API key validation error', {
        error: error.message,
        keyPrefix: this.getKeyPrefix(apiKey)
      });
      throw createError('Failed to validate API key', 500, 'VALIDATION_ERROR');
    }
  }

  /**
   * Update last used information for an API key
   * 
   * @param keyId - The API key ID
   * @param ipAddress - Optional IP address
   */
  private static async updateLastUsed(keyId: string, ipAddress?: string): Promise<void> {
    try {
      const ApiKeyModel = DatabaseService.getModel('ApiKey');
      await ApiKeyModel.update(
        {
          lastUsedAt: new Date(),
          ...(ipAddress && { lastUsedIp: ipAddress })
        },
        { where: { id: keyId } }
      );
    } catch (error) {
      // Log but don't fail - this is non-critical
      LoggerService.debug('Failed to update API key last used', { keyId, error });
    }
  }

  /**
   * Cache a validated API key
   * 
   * @param keyHash - The hash of the key
   * @param keyData - The validated key data
   */
  private static setCache(keyHash: string, keyData: ValidatedApiKey): void {
    // Evict oldest entries if cache is full
    if (apiKeyCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = apiKeyCache.keys().next().value;
      if (oldestKey) {
        apiKeyCache.delete(oldestKey);
      }
    }

    apiKeyCache.set(keyHash, {
      key: keyData,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  /**
   * Invalidate cache for a specific key
   * 
   * @param apiKey - The API key to invalidate
   */
  public static invalidateCache(apiKey: string): void {
    const keyHash = this.hashKey(apiKey);
    apiKeyCache.delete(keyHash);
  }

  /**
   * Clear all cached API keys
   */
  public static clearCache(): void {
    apiKeyCache.clear();
  }

  /**
   * Get cache statistics
   */
  public static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: apiKeyCache.size,
      maxSize: MAX_CACHE_SIZE
    };
  }

  /**
   * Create a new API key
   * 
   * @param options - Options for creating the key
   * @returns The generated API key (plaintext - only shown once)
   */
  public static async createKey(options: {
    name: string;
    userId: string;
    tenantId?: string;
    brokerId?: string;
    scopes?: string[];
    expiresAt?: Date;
    rateLimit?: number;
    metadata?: Record<string, any>;
  }): Promise<{ apiKey: string; keyId: string }> {
    // Generate a secure random API key
    const apiKey = `tx_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(apiKey);
    const keyPrefix = this.getKeyPrefix(apiKey);

    try {
      const ApiKeyModel = DatabaseService.getModel('ApiKey');
      
      const keyRecord = await ApiKeyModel.create({
        keyHash,
        keyPrefix,
        name: options.name,
        userId: options.userId,
        tenantId: options.tenantId || null,
        brokerId: options.brokerId || null,
        scopes: options.scopes || [],
        status: 'active',
        expiresAt: options.expiresAt || null,
        rateLimit: options.rateLimit || 100,
        metadata: options.metadata || {}
      });

      const keyId = (keyRecord as any).id;

      LoggerService.info('API key created', {
        keyId,
        keyPrefix,
        userId: options.userId,
        tenantId: options.tenantId
      });

      return {
        apiKey,
        keyId
      };
    } catch (error: any) {
      LoggerService.error('Failed to create API key', {
        error: error.message,
        userId: options.userId
      });
      throw createError('Failed to create API key', 500, 'CREATE_KEY_ERROR');
    }
  }

  /**
   * Revoke an API key
   * 
   * @param keyId - The ID of the key to revoke
   * @param revokedBy - User ID who revoked the key
   */
  public static async revokeKey(keyId: string, revokedBy: string): Promise<void> {
    try {
      const ApiKeyModel = DatabaseService.getModel('ApiKey');
      
      const keyRecord = await ApiKeyModel.findByPk(keyId);
      
      if (!keyRecord) {
        throw createError('API key not found', 404, 'KEY_NOT_FOUND');
      }

      await keyRecord.update({ status: 'revoked' });

      // Invalidate cache if present
      const keyData = keyRecord.toJSON();
      const keyHash = keyData.keyHash;
      apiKeyCache.delete(keyHash);

      LoggerService.info('API key revoked', {
        keyId,
        revokedBy
      });
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      LoggerService.error('Failed to revoke API key', {
        keyId,
        error: error.message
      });
      throw createError('Failed to revoke API key', 500, 'REVOKE_KEY_ERROR');
    }
  }

  /**
   * Get API keys for a user
   * 
   * @param userId - The user ID
   * @returns Array of API key metadata (without the actual key)
   */
  public static async getKeysForUser(userId: string): Promise<Array<{
    id: string;
    keyPrefix: string;
    name: string;
    scopes: string[];
    status: string;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    rateLimit: number;
    createdAt: Date;
  }>> {
    try {
      const ApiKeyModel = DatabaseService.getModel('ApiKey');
      
      const keys = await ApiKeyModel.findAll({
        where: { userId },
        attributes: [
          'id', 'keyPrefix', 'name', 'scopes', 'status', 
          'expiresAt', 'lastUsedAt', 'rateLimit', 'createdAt'
        ],
        order: [['createdAt', 'DESC']]
      });

      return keys.map(key => key.toJSON());
    } catch (error: any) {
      LoggerService.error('Failed to get API keys', {
        userId,
        error: error.message
      });
      throw createError('Failed to get API keys', 500, 'GET_KEYS_ERROR');
    }
  }

  /**
   * Check if an API key has a specific scope
   * 
   * @param apiKey - The API key to check
   * @param scope - The scope to check for
   * @returns True if the key has the scope
   */
  public static async hasScope(apiKey: string, scope: string): Promise<boolean> {
    try {
      const validatedKey = await this.validateKey(apiKey);
      return validatedKey.scopes.includes(scope) || validatedKey.scopes.includes('*');
    } catch {
      return false;
    }
  }
}
