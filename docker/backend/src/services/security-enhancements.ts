/**
 * Security Enhancements Service
 * 
 * Provides advanced security features:
 * - Key rotation mechanism for JWT signing keys
 * - MFA enforcement for high-value transactions (withdrawals/trading above threshold)
 * - Secure session management
 */

import * as crypto from 'crypto';
import { LoggerService } from './logger';

// Key rotation configuration
interface KeyRotationConfig {
  rotationIntervalMs: number; // How often to rotate keys (default: 24 hours)
  maxKeysInRotation: number; // Maximum old keys to keep for verification (default: 3)
  keySize: number; // Key size in bits (default: 256)
}

// JWT Key rotation store
class JWTKeyRotation {
  private currentKey: Buffer;
  private previousKeys: Map<string, { key: Buffer; expiresAt: Date }> = new Map();
  private lastRotation: Date = new Date();
  private config: KeyRotationConfig;
  
  constructor(config?: Partial<KeyRotationConfig>) {
    this.config = {
      rotationIntervalMs: config?.rotationIntervalMs || 24 * 60 * 60 * 1000, // 24 hours
      maxKeysInRotation: config?.maxKeysInRotation || 3,
      keySize: config?.keySize || 256,
    };
    this.currentKey = this.generateKey();
    LoggerService.info('JWT Key Rotation initialized', { 
      keySize: this.config.keySize,
      rotationInterval: `${this.config.rotationIntervalMs / (60 * 60 * 1000)}h`
    });
  }
  
  private generateKey(): Buffer {
    return crypto.randomBytes(this.config.keySize / 8);
  }
  
  /**
   * Check if key rotation is needed
   */
  public shouldRotate(): boolean {
    const now = new Date();
    const timeSinceLastRotation = now.getTime() - this.lastRotation.getTime();
    return timeSinceLastRotation >= this.config.rotationIntervalMs;
  }
  
  /**
   * Rotate to a new key
   */
  public rotate(): void {
    if (!this.shouldRotate()) {
      return;
    }
    
    // Store current key as previous key with expiration
    const oldKeyId = this.getKeyId(this.currentKey);
    const expiresAt = new Date(Date.now() + this.config.rotationIntervalMs);
    this.previousKeys.set(oldKeyId, { key: this.currentKey, expiresAt });
    
    // Prune old keys if we have too many
    if (this.previousKeys.size > this.config.maxKeysInRotation) {
      const sortedKeys = Array.from(this.previousKeys.entries())
        .sort((a, b) => a[1].expiresAt.getTime() - b[1].expiresAt.getTime());
      
      const keysToRemove = sortedKeys.slice(0, this.previousKeys.size - this.config.maxKeysInRotation);
      keysToRemove.forEach(([keyId]) => {
        this.previousKeys.delete(keyId);
        LoggerService.debug('Removed old JWT key', { keyId });
      });
    }
    
    // Generate new current key
    this.currentKey = this.generateKey();
    this.lastRotation = new Date();
    
    LoggerService.info('JWT keys rotated', { 
      previousKeyCount: this.previousKeys.size,
      lastRotation: this.lastRotation.toISOString()
    });
  }
  
  /**
   * Get key ID for a key
   */
  private getKeyId(key: Buffer): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
  }
  
  /**
   * Get current key ID
   */
  public getCurrentKeyId(): string {
    return this.getKeyId(this.currentKey);
  }
  
  /**
   * Get current key
   */
  public getCurrentKey(): Buffer {
    // Auto-rotate if needed
    if (this.shouldRotate()) {
      this.rotate();
    }
    return this.currentKey;
  }
  
  /**
   * Verify token with any valid key (current or previous)
   */
  public verifyWithKeys(token: string, callback: (err: Error | null, decoded?: any) => void): void {
    const jwt = require('jsonwebtoken');
    
    // Try current key first
    try {
      const decoded = jwt.verify(token, this.currentKey);
      callback(null, decoded);
      return;
    } catch (currentError: any) {
      // Try previous keys
      for (const [keyId, keyData] of this.previousKeys) {
        try {
          const decoded = jwt.verify(token, keyData.key);
          LoggerService.debug('Token verified with previous key', { keyId });
          callback(null, decoded);
          return;
        } catch (prevError) {
          // Continue to next key
        }
      }
    }
    
    callback(new Error('Invalid token'));
  }
  
  /**
   * Get key rotation status
   */
  public getStatus(): { currentKeyId: string; previousKeyCount: number; lastRotation: Date } {
    return {
      currentKeyId: this.getCurrentKeyId(),
      previousKeyCount: this.previousKeys.size,
      lastRotation: this.lastRotation,
    };
  }
}

// MFA enforcement thresholds
interface MFAThresholdConfig {
  withdrawalThreshold: number; // Minimum amount requiring MFA for withdrawal
  tradingThreshold: number; // Minimum amount requiring MFA for trading
  currency: string; // Currency code (e.g., 'USD', 'EUR')
}

// MFA enforcement service
class MFAEnforcementService {
  private config: MFAThresholdConfig;
  
  constructor(config?: Partial<MFAThresholdConfig>) {
    this.config = {
      withdrawalThreshold: config?.withdrawalThreshold || 1000,
      tradingThreshold: config?.tradingThreshold || 5000,
      currency: config?.currency || 'USD',
    };
    LoggerService.info('MFA Enforcement Service initialized', this.config);
  }
  
  /**
   * Check if MFA is required for a withdrawal
   */
  public requiresMFAForWithdrawal(amount: number): boolean {
    return amount >= this.config.withdrawalThreshold;
  }
  
  /**
   * Check if MFA is required for a trade
   */
  public requiresMFAForTrade(amount: number): boolean {
    return amount >= this.config.tradingThreshold;
  }
  
  /**
   * Validate MFA requirement for an operation
   */
  public validateMFARequirement(
    operation: 'withdrawal' | 'trade',
    amount: number,
    userMFAEnabled: boolean
  ): { requiresMFA: boolean; reason?: string } {
    const threshold = operation === 'withdrawal' 
      ? this.config.withdrawalThreshold 
      : this.config.tradingThreshold;
    
    if (amount < threshold) {
      return { requiresMFA: false };
    }
    
    if (!userMFAEnabled) {
      return { 
        requiresMFA: true, 
        reason: `MFA is required for ${operation}s above ${threshold} ${this.config.currency}` 
      };
    }
    
    return { requiresMFA: true };
  }
  
  /**
   * Update thresholds
   */
  public updateThresholds(withdrawalThreshold?: number, tradingThreshold?: number): void {
    if (withdrawalThreshold !== undefined) {
      this.config.withdrawalThreshold = withdrawalThreshold;
    }
    if (tradingThreshold !== undefined) {
      this.config.tradingThreshold = tradingThreshold;
    }
    LoggerService.info('MFA thresholds updated', this.config);
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): MFAThresholdConfig {
    return { ...this.config };
  }
}

// Session management
interface SessionConfig {
  maxSessionsPerUser: number; // Maximum concurrent sessions
  sessionTimeoutMs: number; // Session timeout (default: 24 hours)
  absoluteTimeoutMs: number; // Absolute session timeout (force logout after this)
}

interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

class SecureSessionManager {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private config: SessionConfig;
  
  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      maxSessionsPerUser: config?.maxSessionsPerUser || 5,
      sessionTimeoutMs: config?.sessionTimeoutMs || 24 * 60 * 60 * 1000, // 24 hours
      absoluteTimeoutMs: config?.absoluteTimeoutMs || 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    LoggerService.info('Secure Session Manager initialized', this.config);
  }
  
  /**
   * Create a new session
   */
  public createSession(
    userId: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Session {
    // Check max sessions per user
    const userSessionIds = this.userSessions.get(userId) || new Set();
    if (userSessionIds.size >= this.config.maxSessionsPerUser) {
      // Remove oldest session
      const sortedIds = Array.from(userSessionIds).sort((a, b) => {
        const sessionA = this.sessions.get(a);
        const sessionB = this.sessions.get(b);
        if (!sessionA || !sessionB) return 0;
        return sessionA.createdAt.getTime() - sessionB.createdAt.getTime();
      });
      const oldestId = sortedIds[0];
      if (oldestId) {
        this.revokeSession(oldestId);
      }
    }
    
    const now = new Date();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTimeoutMs),
      absoluteExpiresAt: new Date(now.getTime() + this.config.absoluteTimeoutMs),
      ipAddress,
      userAgent,
    };
    
    this.sessions.set(session.id, session);
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(session.id);
    
    LoggerService.debug('Session created', { 
      sessionId: session.id, 
      userId,
      activeSessions: userSessionIds.size + 1 
    });
    
    return session;
  }
  
  /**
   * Validate and refresh session
   */
  public validateSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    const now = new Date();
    
    // Check if session expired
    if (now > session.expiresAt || now > session.absoluteExpiresAt) {
      this.revokeSession(sessionId);
      return null;
    }
    
    // Update last activity
    session.lastActivity = now;
    session.expiresAt = new Date(now.getTime() + this.config.sessionTimeoutMs);
    
    return session;
  }
  
  /**
   * Revoke a session
   */
  public revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }
    
    this.sessions.delete(sessionId);
    LoggerService.debug('Session revoked', { sessionId, userId: session.userId });
    
    return true;
  }
  
  /**
   * Revoke all sessions for a user
   */
  public revokeAllUserSessions(userId: string): number {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return 0;
    }
    
    let count = 0;
    userSessionIds.forEach(sessionId => {
      this.sessions.delete(sessionId);
      count++;
    });
    
    this.userSessions.delete(userId);
    LoggerService.info('All sessions revoked for user', { userId, count });
    
    return count;
  }
  
  /**
   * Get all active sessions for a user
   */
  public getUserSessions(userId: string): Session[] {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return [];
    }
    
    return Array.from(userSessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined && s.expiresAt > new Date());
  }
  
  /**
   * Get session statistics
   */
  public getStats(): { totalSessions: number; totalUsers: number } {
    return {
      totalSessions: this.sessions.size,
      totalUsers: this.userSessions.size,
    };
  }
}

// Export singleton instances
export const jwtKeyRotation = new JWTKeyRotation();
export const mfaEnforcementService = new MFAEnforcementService();
export const secureSessionManager = new SecureSessionManager();

// Export classes for testing
export { JWTKeyRotation, MFAEnforcementService, SecureSessionManager };
export type { KeyRotationConfig, MFAThresholdConfig, SessionConfig, Session };
