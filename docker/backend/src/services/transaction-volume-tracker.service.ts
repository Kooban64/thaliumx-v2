/**
 * Unified Transaction Volume Tracker Service
 * 
 * Tracks cumulative transaction volumes across BOTH presale and main platform
 * for unified KYC level limit enforcement.
 * 
 * Features:
 * - Tracks investment volumes (presale + token sale)
 * - Tracks trading volumes (main platform)
 * - Tracks withdrawals/deposits (main platform)
 * - Calculates cumulative usage against KYC level limits
 * - Redis-backed for fast lookups
 * - Tenant-scoped for multi-tenancy
 */

import { LoggerService } from './logger';
import { RedisService } from './redis';
import { kycLimitsConfig, KYCLevelLimits, KYCLevelConfig } from '../config/kyc-limits.config';
import { KYCService } from './kyc';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface VolumeBreakdown {
  presale: number;        // Presale investments
  tokenSale: number;      // Token sale investments
  mainPlatform: number;   // Main platform trading/withdrawals
  total: number;          // Cumulative total
}

export interface LimitStatus {
  current: number;        // Current usage
  limit: number;          // KYC level limit
  remaining: number;       // Remaining capacity
  percentage: number;     // Usage percentage (0-100)
  status: 'within_limit' | 'approaching_limit' | 'at_limit' | 'exceeded';
  breakdown: VolumeBreakdown;
  canProceed: boolean;   // Whether transaction can proceed
  upgradeRequired?: boolean; // Whether KYC upgrade is required
  upgradeRecommended?: boolean; // Whether upgrade is recommended (80% threshold)
}

export enum TransactionType {
  INVESTMENT = 'investment',      // Presale or token sale investment
  TRADING = 'trading',            // Main platform trading
  WITHDRAWAL = 'withdrawal',      // Main platform withdrawal
  DEPOSIT = 'deposit'             // Main platform deposit
}

export enum TimePeriod {
  DAILY = 'daily',
  MONTHLY = 'monthly',
  TOTAL = 'total'                 // All-time cumulative
}

// =============================================================================
// TRANSACTION VOLUME TRACKER SERVICE
// =============================================================================

export class TransactionVolumeTrackerService {
  private static readonly REDIS_PREFIX = 'volume:';
  private static readonly WARNING_THRESHOLD = 0.80; // 80% - show upgrade prompt
  private static readonly BLOCK_THRESHOLD = 1.00;    // 100% - block transaction

  /**
   * Track a transaction volume
   */
  public static async trackTransaction(
    userId: string,
    tenantId: string,
    transactionType: TransactionType,
    amount: number,
    period: TimePeriod = TimePeriod.TOTAL
  ): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) {
        LoggerService.warn('Redis not available, skipping volume tracking');
        return;
      }

      const date = new Date();
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      // Build Redis keys
      const keys = {
        daily: `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:daily:${dateKey}`,
        monthly: `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:monthly:${monthKey}`,
        total: `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:total`
      };

      // Update volumes atomically
      const pipeline = redis.pipeline();
      
      if (period === TimePeriod.DAILY || period === TimePeriod.TOTAL) {
        pipeline.incrbyfloat(keys.daily, amount);
        pipeline.expire(keys.daily, 86400 * 2); // Expire after 2 days
      }
      
      if (period === TimePeriod.MONTHLY || period === TimePeriod.TOTAL) {
        pipeline.incrbyfloat(keys.monthly, amount);
        pipeline.expire(keys.monthly, 86400 * 32); // Expire after 32 days
      }
      
      if (period === TimePeriod.TOTAL) {
        pipeline.incrbyfloat(keys.total, amount);
      }

      await pipeline.exec();

      LoggerService.debug('Transaction volume tracked', {
        userId,
        tenantId,
        transactionType,
        amount,
        period
      });
    } catch (error) {
      LoggerService.error('Failed to track transaction volume:', error);
      // Don't throw - volume tracking is non-blocking
    }
  }

  /**
   * Get cumulative usage for a limit type
   */
  public static async getCumulativeUsage(
    userId: string,
    tenantId: string,
    limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit',
    period: TimePeriod = TimePeriod.TOTAL
  ): Promise<VolumeBreakdown> {
    try {
      const redis = RedisService.getClient();
      if (!redis) {
        LoggerService.warn('Redis not available, returning zero usage');
        return { presale: 0, tokenSale: 0, mainPlatform: 0, total: 0 };
      }

      const date = new Date();
      const dateKey = date.toISOString().split('T')[0];
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Build keys based on period
      let keys: string[] = [];
      if (period === TimePeriod.DAILY) {
        keys = [
          `${this.REDIS_PREFIX}${tenantId}:${userId}:investment:daily:${dateKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:trading:daily:${dateKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:withdrawal:daily:${dateKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:deposit:daily:${dateKey}`
        ];
      } else if (period === TimePeriod.MONTHLY) {
        keys = [
          `${this.REDIS_PREFIX}${tenantId}:${userId}:investment:monthly:${monthKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:trading:monthly:${monthKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:withdrawal:monthly:${monthKey}`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:deposit:monthly:${monthKey}`
        ];
      } else {
        keys = [
          `${this.REDIS_PREFIX}${tenantId}:${userId}:investment:total`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:trading:total`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:withdrawal:total`,
          `${this.REDIS_PREFIX}${tenantId}:${userId}:deposit:total`
        ];
      }

      // Fetch all values
      const values = await redis.mget(...keys);
      const investmentTotal = parseFloat(values[0] || '0');
      const tradingTotal = parseFloat(values[1] || '0');
      const withdrawalTotal = parseFloat(values[2] || '0');
      const depositTotal = parseFloat(values[3] || '0');

      // For investment limit type, combine presale + token sale
      // For trading limit type, use trading volume
      // For withdrawal limit type, use withdrawal volume
      let presale = 0;
      let tokenSale = 0;
      let mainPlatform = 0;

      if (limitType === 'investment') {
        // Investment includes both presale and token sale
        // For now, we'll need to track them separately in the future
        // For now, assume all investment is presale (can be enhanced)
        presale = investmentTotal;
        tokenSale = 0; // TODO: Track token sale separately
        mainPlatform = 0;
      } else if (limitType === 'trading') {
        presale = 0;
        tokenSale = 0;
        mainPlatform = tradingTotal;
      } else if (limitType === 'withdrawal') {
        presale = 0;
        tokenSale = 0;
        mainPlatform = withdrawalTotal;
      } else if (limitType === 'deposit') {
        presale = 0;
        tokenSale = 0;
        mainPlatform = depositTotal;
      }

      return {
        presale,
        tokenSale,
        mainPlatform,
        total: presale + tokenSale + mainPlatform
      };
    } catch (error) {
      LoggerService.error('Failed to get cumulative usage:', error);
      return { presale: 0, tokenSale: 0, mainPlatform: 0, total: 0 };
    }
  }

  /**
   * Check limit status for a transaction
   */
  public static async checkLimit(
    userId: string,
    tenantId: string,
    limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit',
    amount: number,
    period: TimePeriod = TimePeriod.TOTAL
  ): Promise<LimitStatus> {
    try {
      // Get user's KYC level (unified across both platforms)
      let kycLevel: string = 'L0';
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        kycLevel = kycStatus.kycLevel;
      } catch (error) {
        LoggerService.warn('KYC status not found, defaulting to L0', { userId });
        kycLevel = 'L0';
      }

      // Get KYC level limits
      const limitsConfig = kycLimitsConfig[kycLevel as keyof typeof kycLimitsConfig];
      if (!limitsConfig) {
        LoggerService.warn('KYC level limits not found', { kycLevel });
        return {
          current: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          status: 'exceeded',
          breakdown: { presale: 0, tokenSale: 0, mainPlatform: 0, total: 0 },
          canProceed: false,
          upgradeRequired: true
        };
      }

      // Get current cumulative usage
      const breakdown = await this.getCumulativeUsage(userId, tenantId, limitType, period);
      const current = breakdown.total;

      // Get limit based on type
      const limits = (limitsConfig as unknown as KYCLevelConfig).limits;
      let limit = 0;
      if (limitType === 'investment') {
        limit = limits.maxInvestment;
      } else if (limitType === 'trading') {
        limit = limits.maxTrading;
      } else if (limitType === 'withdrawal') {
        limit = limits.maxWithdrawal;
      } else if (limitType === 'deposit') {
        limit = limits.maxDeposit || Infinity;
      }

      // Calculate projected usage
      const projected = current + amount;
      const percentage = limit > 0 ? (projected / limit) * 100 : 0;

      // Determine status
      let status: 'within_limit' | 'approaching_limit' | 'at_limit' | 'exceeded';
      let canProceed = true;
      let upgradeRequired = false;
      let upgradeRecommended = false;

      if (projected > limit) {
        status = 'exceeded';
        canProceed = false;
        upgradeRequired = true;
      } else if (percentage >= this.BLOCK_THRESHOLD * 100) {
        status = 'at_limit';
        canProceed = false;
        upgradeRequired = true;
      } else if (percentage >= this.WARNING_THRESHOLD * 100) {
        status = 'approaching_limit';
        canProceed = true;
        upgradeRecommended = true;
      } else {
        status = 'within_limit';
        canProceed = true;
      }

      return {
        current,
        limit,
        remaining: Math.max(0, limit - projected),
        percentage,
        status,
        breakdown,
        canProceed,
        upgradeRequired,
        upgradeRecommended
      };
    } catch (error) {
      LoggerService.error('Failed to check limit:', error);
      // Fail-secure: deny transaction if check fails
      return {
        current: 0,
        limit: 0,
        remaining: 0,
        percentage: 0,
        status: 'exceeded',
        breakdown: { presale: 0, tokenSale: 0, mainPlatform: 0, total: 0 },
        canProceed: false,
        upgradeRequired: true
      };
    }
  }

  /**
   * Reset volume tracking for a user (admin function)
   */
  public static async resetVolume(
    userId: string,
    tenantId: string,
    transactionType?: TransactionType,
    period?: TimePeriod
  ): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) {
        return;
      }

      const date = new Date();
      const dateKey = date.toISOString().split('T')[0];
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (transactionType && period) {
        // Reset specific type and period
        let key = '';
        if (period === TimePeriod.DAILY) {
          key = `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:daily:${dateKey}`;
        } else if (period === TimePeriod.MONTHLY) {
          key = `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:monthly:${monthKey}`;
        } else {
          key = `${this.REDIS_PREFIX}${tenantId}:${userId}:${transactionType}:total`;
        }
        await redis.del(key);
      } else {
        // Reset all volumes for user
        const pattern = `${this.REDIS_PREFIX}${tenantId}:${userId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }

      LoggerService.info('Volume tracking reset', { userId, tenantId, transactionType, period });
    } catch (error) {
      LoggerService.error('Failed to reset volume:', error);
      throw error;
    }
  }
}
