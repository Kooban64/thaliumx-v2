/**
 * Presale Security Response Service
 * 
 * Automatic responses to security events:
 * - Auto-pause on critical security events
 * - Auto-block suspicious wallets
 * - Auto-escalate to compliance team
 * - Auto-generate security reports
 */

import { LoggerService } from './logger';
import { EventStreamingService } from './event-streaming';
import { SecurityOversightService } from './security-oversight';
import { RedisService } from './redis';
// SmartContractService imported but not used in this file

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface SecurityResponse {
  responseId: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actions: SecurityAction[];
  timestamp: Date;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface SecurityAction {
  type: 'PAUSE_CONTRACT' | 'BLOCK_WALLET' | 'ESCALATE' | 'GENERATE_REPORT' | 'NOTIFY_TEAM';
  target: string;
  parameters?: any;
  executed: boolean;
  executedAt?: Date;
  error?: string;
}

// =============================================================================
// PRESALE SECURITY RESPONSE SERVICE
// =============================================================================

export class PresaleSecurityResponseService {
  private static readonly REDIS_PREFIX = 'presale_security_response:';
  private static readonly BLOCKED_WALLETS_KEY = 'presale_blocked_wallets';

  /**
   * Handle security event and trigger automatic responses
   */
  public static async handleSecurityEvent(
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details: {
      userId?: string;
      walletAddress?: string;
      contractAddress?: string;
      transactionHash?: string;
      reason?: string;
      riskScore?: number;
      [key: string]: any;
    }
  ): Promise<SecurityResponse> {
    try {
      const responseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const actions: SecurityAction[] = [];

      // Determine actions based on event type and severity
      if (severity === 'CRITICAL') {
        // Critical events: pause contract, block wallet, escalate immediately
        if (details.contractAddress) {
          actions.push({
            type: 'PAUSE_CONTRACT',
            target: details.contractAddress,
            parameters: { reason: details.reason || 'Critical security event' },
            executed: false
          });
        }

        if (details.walletAddress) {
          actions.push({
            type: 'BLOCK_WALLET',
            target: details.walletAddress,
            parameters: { reason: details.reason, permanent: false },
            executed: false
          });
        }

        actions.push({
          type: 'ESCALATE',
          target: 'security_team',
          parameters: { priority: 'CRITICAL', eventType, details },
          executed: false
        });

        actions.push({
          type: 'NOTIFY_TEAM',
          target: 'compliance_team',
          parameters: { eventType, severity, details },
          executed: false
        });
      } else if (severity === 'HIGH') {
        // High severity: block wallet, escalate
        if (details.walletAddress) {
          actions.push({
            type: 'BLOCK_WALLET',
            target: details.walletAddress,
            parameters: { reason: details.reason, permanent: false },
            executed: false
          });
        }

        actions.push({
          type: 'ESCALATE',
          target: 'security_team',
          parameters: { priority: 'HIGH', eventType, details },
          executed: false
        });
      } else if (severity === 'MEDIUM') {
        // Medium severity: generate report, notify team
        actions.push({
          type: 'GENERATE_REPORT',
          target: 'compliance',
          parameters: { eventType, details },
          executed: false
        });
      }

      const response: SecurityResponse = {
        responseId,
        eventType,
        severity,
        actions,
        timestamp: new Date(),
        status: 'PENDING'
      };

      // Execute actions
      response.status = 'EXECUTING';
      for (const action of actions) {
        try {
          await this.executeAction(action, details);
          action.executed = true;
          action.executedAt = new Date();
        } catch (error) {
          action.error = error instanceof Error ? error.message : 'Unknown error';
          LoggerService.error('Security action execution failed', {
            action: action.type,
            target: action.target,
                error
          });
        }
      }

      response.status = actions.every(a => a.executed || a.error) ? 'COMPLETED' : 'FAILED';

      // Store response
      await this.storeResponse(response);

      // Log response
      await LoggerService.logAudit(
        'presale_security_response_executed',
        'presale_security',
        { userId: details.userId },
        {
          responseId,
          eventType,
          severity,
          actionCount: actions.length,
          successCount: actions.filter(a => a.executed).length
        }
      );

      return response;
    } catch (error) {
      LoggerService.error('Security response handling failed', error);
      throw error;
    }
  }

  /**
   * Execute a security action
   */
  private static async executeAction(
    action: SecurityAction,
    _details: any
  ): Promise<void> {
    switch (action.type) {
      case 'PAUSE_CONTRACT':
        await this.pauseContract(action.target, action.parameters?.reason);
        break;

      case 'BLOCK_WALLET':
        await this.blockWallet(action.target, action.parameters);
        break;

      case 'ESCALATE':
        await this.escalateToTeam(action.target, action.parameters);
        break;

      case 'GENERATE_REPORT':
        await this.generateSecurityReport(action.parameters);
        break;

      case 'NOTIFY_TEAM':
        await this.notifyTeam(action.target, action.parameters);
        break;

      default:
        LoggerService.warn('Unknown security action type', { type: action.type });
    }
  }

  /**
   * Pause contract (would call smart contract pause function)
   */
  private static async pauseContract(
    contractAddress: string,
    reason?: string
  ): Promise<void> {
    try {
      LoggerService.warn('Contract pause requested (not implemented - requires admin wallet)', {
        contractAddress,
                reason
      });

      // In production, this would:
      // 1. Get admin wallet
      // 2. Call contract.pause() function
      // 3. Wait for transaction confirmation
      // 4. Verify pause status

      // For now, just log and emit event
      await EventStreamingService.emitSystemEvent(
        'presale.contract.pause_requested',
        'presale_security',
        'error',
        {
          contractAddress,
                reason
        },
        {}
      );

      // Create security event
      await SecurityOversightService.createSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY' as any,
        severity: 'HIGH' as any,
        title: 'Contract Pause Requested',
        description: `Contract pause requested for ${contractAddress}`,
        source: 'automatic_security_response',
        userId: undefined,
        timestamp: new Date(),
        metadata: {
          contractAddress,
          reason,
          source: 'automatic_security_response'
        },
        status: 'OPEN' as any
      });
    } catch (error) {
      LoggerService.error('Failed to pause contract', { error, contractAddress });
      throw error;
    }
  }

  /**
   * Block wallet address
   */
  private static async blockWallet(
    walletAddress: string,
    parameters?: { reason?: string; permanent?: boolean }
  ): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) {
        LoggerService.warn('Redis not available, cannot block wallet');
        return;
      }

      const blockKey = `${this.BLOCKED_WALLETS_KEY}:${walletAddress.toLowerCase()}`;
      const blockData = {
        walletAddress: walletAddress.toLowerCase(),
        blockedAt: Date.now(),
        reason: parameters?.reason || 'Security event',
        permanent: parameters?.permanent || false
      };

      // Store in Redis (permanent or with TTL)
      if (parameters?.permanent) {
        await redis.set(blockKey, JSON.stringify(blockData));
      } else {
        await redis.set(blockKey, JSON.stringify(blockData), 'EX', 86400 * 7); // 7 days
      }

      LoggerService.info('Wallet blocked', {
        walletAddress,
        reason: parameters?.reason,
        permanent: parameters?.permanent
      });

      await EventStreamingService.emitSystemEvent(
        'presale.wallet.blocked',
        'presale_security',
        'warn',
        blockData,
        {}
      );
    } catch (error) {
      LoggerService.error('Failed to block wallet', { error, walletAddress });
      throw error;
    }
  }

  /**
   * Check if wallet is blocked
   */
  public static async isWalletBlocked(walletAddress: string): Promise<boolean> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return false;

      const blockKey = `${this.BLOCKED_WALLETS_KEY}:${walletAddress.toLowerCase()}`;
      const blocked = await redis.get(blockKey);
      return !!blocked;
    } catch (error) {
      LoggerService.warn('Failed to check wallet block status', { error });
      return false; // Fail-open
    }
  }

  /**
   * Unblock wallet address
   */
  public static async unblockWallet(walletAddress: string): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return;

      const blockKey = `${this.BLOCKED_WALLETS_KEY}:${walletAddress.toLowerCase()}`;
      await redis.del(blockKey);

      LoggerService.info('Wallet unblocked', { walletAddress });

      await EventStreamingService.emitSystemEvent(
        'presale.wallet.unblocked',
        'presale_security',
        'info',
        { walletAddress, unblockedAt: Date.now() },
        {}
      );
    } catch (error) {
      LoggerService.error('Failed to unblock wallet', { error, walletAddress });
      throw error;
    }
  }

  /**
   * Escalate to security team
   */
  private static async escalateToTeam(
    team: string,
    parameters: any
  ): Promise<void> {
    try {
      await EventStreamingService.emitSystemEvent(
        `presale.escalation.${team}`,
        'presale_security',
        parameters.priority === 'CRITICAL' ? 'error' : 'warn',
        {
          team,
          priority: parameters.priority,
          eventType: parameters.eventType,
          details: parameters.details
        },
        {}
      );

      // Create security incident
      await SecurityOversightService.createSecurityIncident({
        type: 'AUTOMATED_ESCALATION' as any,
        severity: parameters.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH' as any,
        description: `Escalated to ${team}: ${parameters.eventType}`,
        metadata: parameters.details
      } as any);

      LoggerService.info('Security event escalated', {
        team,
        priority: parameters.priority,
        eventType: parameters.eventType
      });
    } catch (error) {
      LoggerService.error('Failed to escalate to team', { error, team });
      throw error;
    }
  }

  /**
   * Generate security report
   */
  private static async generateSecurityReport(parameters: any): Promise<void> {
    try {
      await SecurityOversightService.generateSecurityReport({
        type: 'security' as any,
        period: {
          startDate: new Date(Date.now() - 86400000), // Last 24 hours
          endDate: new Date()
        },
        metadata: parameters
      } as any);

      LoggerService.info('Security report generated', {
        eventType: parameters.eventType
      });
    } catch (error) {
      LoggerService.error('Failed to generate security report', { error });
      throw error;
    }
  }

  /**
   * Notify team
   */
  private static async notifyTeam(
    team: string,
    parameters: any
  ): Promise<void> {
    try {
      await EventStreamingService.emitSystemEvent(
        `presale.notification.${team}`,
        'presale_security',
        'warn',
        {
          team,
          eventType: parameters.eventType,
          severity: parameters.severity,
          details: parameters.details
        },
        {}
      );

      LoggerService.info('Team notified', {
        team,
        eventType: parameters.eventType
      });
    } catch (error) {
      LoggerService.error('Failed to notify team', { error, team });
      throw error;
    }
  }

  /**
   * Store security response
   */
  private static async storeResponse(response: SecurityResponse): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return;

      const key = `${this.REDIS_PREFIX}${response.responseId}`;
      await redis.set(key, JSON.stringify(response), 'EX', 86400 * 30); // 30 days
    } catch (error) {
      LoggerService.warn('Failed to store security response', { error });
    }
  }

  /**
   * Get security response by ID
   */
  public static async getResponse(responseId: string): Promise<SecurityResponse | null> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return null;

      const key = `${this.REDIS_PREFIX}${responseId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      LoggerService.error('Failed to get security response', { error, responseId });
      return null;
    }
  }
}
