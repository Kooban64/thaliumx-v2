/**
 * Session Service
 * 
 * Centralized session management using Redis.
 * Implements session lifecycle, concurrent session limits, and timeout policies.
 * 
 * Features:
 * - Session storage in Redis
 * - Concurrent session limits per user
 * - Session timeout policies
 * - Session invalidation
 * - Session activity tracking
 */

import { RedisService } from './redis';
import { LoggerService } from './logger';
// import { AuditLogService } from './audit-log.service'; // Use LoggerService.logAudit instead

export interface Session {
  id: string;
  userId: string;
  email: string;
  ip: string;
  userAgent?: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  mfaVerified: boolean;
  metadata?: Record<string, any>;
}

export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private static readonly DEFAULT_SESSION_TTL = parseInt(process.env.SESSION_TTL || '3600', 10); // 1 hour
  private static readonly MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10);
  private static readonly SESSION_INACTIVITY_TIMEOUT = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '1800', 10); // 30 minutes

  /**
   * Create a new session
   */
  public static async createSession(params: {
    userId: string;
    email: string;
    ip: string;
    userAgent?: string;
    mfaVerified?: boolean;
    metadata?: Record<string, any>;
  }): Promise<Session> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    const expiresAt = now + (this.DEFAULT_SESSION_TTL * 1000);

    const session: Session = {
      id: sessionId,
      userId: params.userId,
      email: params.email,
      ip: params.ip,
      userAgent: params.userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt,
      mfaVerified: params.mfaVerified || false,
      metadata: params.metadata || {},
    };

    // Check concurrent session limit
    const userSessions = await this.getUserSessions(params.userId);
    if (userSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
      // Remove oldest session
      const oldestSession = userSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldestSession) {
        await this.destroySession(oldestSession.id);
      }
    }

    // Store session
    await RedisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.DEFAULT_SESSION_TTL
    );

    // Add to user's session list
    await this.addUserSession(params.userId, sessionId);

    LoggerService.info('Session created', {
      sessionId,
      userId: params.userId,
      ip: params.ip,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  public static async getSession(sessionId: string): Promise<Session | null> {
    const sessionStr = await RedisService.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!sessionStr) {
      return null;
    }

    const session = JSON.parse(sessionStr as string) as Session;

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      await this.destroySession(sessionId);
      return null;
    }

    // Check inactivity timeout
    const inactivityTimeout = this.SESSION_INACTIVITY_TIMEOUT * 1000;
    if (Date.now() - session.lastActivity > inactivityTimeout) {
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  public static async updateActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.lastActivity = Date.now();
    await RedisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.DEFAULT_SESSION_TTL
    );
  }

  /**
   * Destroy session
   */
  public static async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await RedisService.del(`${this.SESSION_PREFIX}${sessionId}`);
      await this.removeUserSession(session.userId, sessionId);

      await LoggerService.logAudit('session_destroyed', 'security_event', { userId: session.userId }, {
        sessionId,
        ip: session.ip,
        result: 'success'
      });
    }
  }

  /**
   * Destroy all sessions for a user
   */
  public static async destroyAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    for (const session of sessions) {
      await this.destroySession(session.id);
    }

    await LoggerService.logAudit('all_sessions_destroyed', 'security_event', { userId }, {
      result: 'success'
    });
  }

  /**
   * Get all sessions for a user
   */
  public static async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIdsStr = await RedisService.get(`${this.USER_SESSIONS_PREFIX}${userId}`);
    if (!sessionIdsStr) {
      return [];
    }

    const sessionIds = JSON.parse(sessionIdsStr as string) as string[];
    const sessions: Session[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Add session to user's session list
   */
  private static async addUserSession(userId: string, sessionId: string): Promise<void> {
    const existingStr = await RedisService.get(`${this.USER_SESSIONS_PREFIX}${userId}`);
    const existing = existingStr ? JSON.parse(existingStr as string) as string[] : [];
    
    if (!existing.includes(sessionId)) {
      existing.push(sessionId);
      await RedisService.set(
        `${this.USER_SESSIONS_PREFIX}${userId}`,
        JSON.stringify(existing),
        this.DEFAULT_SESSION_TTL
      );
    }
  }

  /**
   * Remove session from user's session list
   */
  private static async removeUserSession(userId: string, sessionId: string): Promise<void> {
    const existingStr = await RedisService.get(`${this.USER_SESSIONS_PREFIX}${userId}`);
    if (!existingStr) {
      return;
    }

    const existing = JSON.parse(existingStr as string) as string[];
    const filtered = existing.filter(id => id !== sessionId);
    
    if (filtered.length === 0) {
      await RedisService.del(`${this.USER_SESSIONS_PREFIX}${userId}`);
    } else {
      await RedisService.set(
        `${this.USER_SESSIONS_PREFIX}${userId}`,
        JSON.stringify(filtered),
        this.DEFAULT_SESSION_TTL
      );
    }
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Cleanup expired sessions (should be run periodically)
   */
  public static async cleanupExpiredSessions(): Promise<number> {
    // In production, you'd scan Redis for expired sessions
    // For now, this is a placeholder
    LoggerService.debug('Cleaning up expired sessions');
    return 0;
  }
}
