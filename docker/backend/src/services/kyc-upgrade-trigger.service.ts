/**
 * KYC Upgrade Trigger Service
 * 
 * Automatically triggers KYC/KYB/AML upgrades when users approach or exceed
 * their current KYC level limits.
 * 
 * Features:
 * - Monitors transaction volume against KYC level limits
 * - Triggers upgrade prompts at 80% threshold
 * - Blocks transactions at 100% threshold with upgrade requirement
 * - Automatically starts Ballerine workflows for upgrades
 * - Works across both presale and main platform (unified)
 */

import { LoggerService } from './logger';
import type { LimitStatus} from './transaction-volume-tracker.service';
import { TransactionVolumeTrackerService, TimePeriod } from './transaction-volume-tracker.service';
// TransactionType, EventStreamingService, ZitadelAttributesService imported but not used in this file
import { KYCService } from './kyc';
import type { Request } from 'express';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface UpgradeTriggerResult {
  shouldUpgrade: boolean;
  currentLevel: string;
  requiredLevel?: string;
  reason: string;
  limitStatus: LimitStatus;
  workflowTriggered?: boolean;
  workflowId?: string;
  message: string;
}

export interface UpgradeRecommendation {
  currentLevel: string;
  recommendedLevel: string;
  reason: string;
  benefits: string[];
  limitStatus: LimitStatus;
}

// =============================================================================
// KYC UPGRADE TRIGGER SERVICE
// =============================================================================

export class KYCUpgradeTriggerService {
  private static readonly WARNING_THRESHOLD = 0.80; // 80% - show upgrade prompt
  private static readonly BLOCK_THRESHOLD = 1.00;    // 100% - block transaction

  /**
   * Check if user needs KYC upgrade for a transaction
   */
  public static async checkUpgradeRequired(
    userId: string,
    tenantId: string,
    limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit',
    amount: number,
    period: TimePeriod = TimePeriod.TOTAL
  ): Promise<UpgradeTriggerResult> {
    try {
      // Get current KYC level
      let currentLevel = 'L0';
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        currentLevel = kycStatus.kycLevel;
      } catch {
        LoggerService.warn('KYC status not found, defaulting to L0', { userId });
        currentLevel = 'L0';
      }

      // Check limit status
      const limitStatus = await TransactionVolumeTrackerService.checkLimit(
        userId,
        tenantId,
        limitType,
        amount,
                period
      );

      // Determine if upgrade is needed
      let shouldUpgrade = false;
      let reason = '';
      let requiredLevel: string | undefined;
      let message = '';

      if (limitStatus.status === 'exceeded' || limitStatus.status === 'at_limit') {
        shouldUpgrade = true;
        reason = `Transaction would exceed ${limitType} limit for KYC level ${currentLevel}`;
        requiredLevel = this.getNextKYCLevel(currentLevel);
        message = `Your ${limitType} limit has been reached. Please upgrade to KYC level ${requiredLevel} to continue.`;
      } else if (limitStatus.status === 'approaching_limit') {
        shouldUpgrade = false; // Not required, but recommended
        reason = `Approaching ${limitType} limit for KYC level ${currentLevel} (${limitStatus.percentage.toFixed(1)}% used)`;
        requiredLevel = this.getNextKYCLevel(currentLevel);
        message = `You're approaching your ${limitType} limit. Consider upgrading to KYC level ${requiredLevel} for higher limits.`;
      } else {
        shouldUpgrade = false;
        reason = `Within ${limitType} limit for KYC level ${currentLevel}`;
        message = 'Transaction is within your current limits.';
      }

      return {
        shouldUpgrade,
        currentLevel,
        requiredLevel,
        reason,
        limitStatus,
                message
      };
    } catch (error) {
      LoggerService.error('Failed to check upgrade requirement:', error);
      // Fail-secure: require upgrade if check fails
      return {
        shouldUpgrade: true,
        currentLevel: 'L0',
        requiredLevel: 'L1',
        reason: 'Unable to verify limit status',
        limitStatus: {
          current: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          status: 'exceeded',
          breakdown: { presale: 0, tokenSale: 0, mainPlatform: 0, total: 0 },
          canProceed: false,
          upgradeRequired: true
        },
        message: 'Unable to verify transaction limits. Please contact support.'
      };
    }
  }

  /**
   * Get upgrade recommendation (for proactive prompts)
   */
  public static async getUpgradeRecommendation(
    userId: string,
    tenantId: string,
    limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit'
  ): Promise<UpgradeRecommendation | null> {
    try {
      // Get current KYC level
      let currentLevel = 'L0';
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        currentLevel = kycStatus.kycLevel;
      } catch {
        LoggerService.warn('KYC status not found', { userId });
        return null;
      }

      // Check current usage (without new transaction)
      const limitStatus = await TransactionVolumeTrackerService.checkLimit(
        userId,
        tenantId,
        limitType,
        0, // No new transaction, just check current status
        TimePeriod.TOTAL
      );

      // Only recommend if approaching limit (80%+)
      if (limitStatus.percentage < this.WARNING_THRESHOLD * 100) {
        return null; // Not close enough to recommend
      }

      const recommendedLevel = this.getNextKYCLevel(currentLevel);
      if (!recommendedLevel) {
        return null; // Already at highest level
      }

      const benefits = this.getLevelBenefits(recommendedLevel);

      return {
        currentLevel,
        recommendedLevel,
        reason: `You've used ${limitStatus.percentage.toFixed(1)}% of your ${limitType} limit`,
        benefits,
                limitStatus
      };
    } catch (error) {
      LoggerService.error('Failed to get upgrade recommendation:', error);
      return null;
    }
  }

  /**
   * Trigger automatic KYC upgrade workflow
   */
  public static async triggerUpgradeWorkflow(
    request: {
      userId: string;
      tenantId: string;
      fromLevel: string;
      toLevel: string;
      reason: string;
      triggerType?: 'proactive' | 'blocking' | 'manual';
      metadata?: Record<string, any>;
      brokerId?: string;
    },
    _req?: Request
  ): Promise<{ workflowTriggered: boolean; workflowId?: string; message: string }> {
    const { userId, tenantId, fromLevel, toLevel, reason, triggerType = 'blocking', metadata: _metadata = {}, brokerId: _brokerId } = request;
    try {
      // Import KYCWorkflowTriggerService dynamically to avoid circular dependencies
      const { KYCWorkflowTriggerService } = await import('./kyc-workflow-trigger.service');
      
      const result = await KYCWorkflowTriggerService.triggerUpgradeWorkflow({
        userId,
        tenantId,
        fromLevel,
        toLevel,
        reason,
        triggerType,
        metadata: {
          triggeredAt: new Date().toISOString(),
                reason
        }
      });

      return {
        workflowTriggered: result.success,
        workflowId: result.workflowId,
        message: result.message
      };
    } catch (error) {
      LoggerService.error('Failed to trigger upgrade workflow:', error);
      return {
        workflowTriggered: false,
        message: 'Failed to initiate KYC upgrade workflow. Please contact support.'
      };
    }
  }

  /**
   * Get next KYC level
   */
  private static getNextKYCLevel(currentLevel: string): string | undefined {
    const levels = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'];
    const currentIndex = levels.indexOf(currentLevel);
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
      return undefined; // Already at highest level or invalid level
    }
    return levels[currentIndex + 1];
  }

  /**
   * Get benefits of upgrading to a level
   */
  private static getLevelBenefits(level: string): string[] {
    const benefits: Record<string, string[]> = {
      L1: [
        'Higher investment limits',
        'Access to more trading pairs',
        'Faster withdrawal processing'
      ],
      L2: [
        'Significantly higher investment limits',
        'Access to advanced trading features',
        'Priority customer support',
        'Lower trading fees'
      ],
      L3: [
        'Maximum investment limits',
        'Access to institutional features',
        'Dedicated account manager',
        'Custom trading solutions'
      ],
      INSTITUTIONAL: [
        'Unlimited investment capacity',
        'Full platform access',
        'Custom compliance solutions',
        'White-glove service'
      ]
    };

    return benefits[level] || [];
  }

  /**
   * Check and trigger upgrade if needed (called before transaction)
   */
  public static async checkAndTriggerUpgrade(
    userId: string,
    tenantId: string,
    limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit',
    amount: number,
    period: TimePeriod = TimePeriod.TOTAL,
    autoTrigger: boolean = false, // Whether to automatically start workflow
    req?: Request // Optional request for Zitadel context
  ): Promise<UpgradeTriggerResult> {
    const result = await this.checkUpgradeRequired(userId, tenantId, limitType, amount, period);

    // If upgrade is required and auto-trigger is enabled, start workflow
    if (result.shouldUpgrade && result.requiredLevel && autoTrigger) {
      const workflowResult = await this.triggerUpgradeWorkflow({
        userId,
        tenantId,
        fromLevel: result.currentLevel,
        toLevel: result.requiredLevel,
        reason: result.reason,
        triggerType: 'blocking'
      }, req);
      result.workflowTriggered = workflowResult.workflowTriggered;
      result.workflowId = workflowResult.workflowTriggered ? 'pending' : undefined;
      result.message = workflowResult.message;
    }

    return result;
  }
}
