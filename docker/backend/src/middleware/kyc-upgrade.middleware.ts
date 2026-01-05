/**
 * KYC Upgrade Middleware
 * 
 * Automatically checks and triggers KYC upgrades when users approach or exceed limits.
 * Wraps existing KYCUpgradeTriggerService to provide middleware interface.
 * 
 * NOTE: This middleware wraps existing service logic - no duplication.
 */

import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';

export interface KYCUpgradeMiddlewareOptions {
  limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit';
  autoTrigger?: boolean;
  amountExtractor?: (req: Request) => number;
  errorMessage?: string;
}

export function kycUpgradeMiddleware(options: KYCUpgradeMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as any;
      if (!user) {
        next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        return;
      }

      const userId = user.id || user.userId;
      const tenantId = user.tenantId || req.headers['x-tenant-id'] as string || 
        process.env.DEFAULT_TENANT_ID || '10000000-0000-0000-0000-000000000000';

      const amountExtractor = options.amountExtractor || ((req: Request) => 
        req.body?.amount || req.body?.investmentAmountUSD || req.body?.investmentAmount || 0
      );
      const amount = amountExtractor(req);

      if (amount <= 0) {
        next();
        return;
      }

      const { KYCUpgradeTriggerService } = await import('../services/kyc-upgrade-trigger.service');
      const { TimePeriod } = await import('../services/transaction-volume-tracker.service');

      const upgradeCheck = await KYCUpgradeTriggerService.checkAndTriggerUpgrade(
        userId,
        tenantId,
        options.limitType,
        amount,
        TimePeriod.TOTAL,
        options.autoTrigger !== false,
        req // Pass request for Zitadel context
      );

      if (upgradeCheck.shouldUpgrade && !upgradeCheck.limitStatus.canProceed) {
        const errorMessage = options.errorMessage || upgradeCheck.message || 
          `Transaction limit exceeded. Please upgrade to KYC level ${upgradeCheck.requiredLevel}`;

        await LoggerService.logAudit(
          `${options.limitType}_blocked_kyc_limit`,
          options.limitType,
          { userId, tenantId },
          {
            amount,
            currentLevel: upgradeCheck.currentLevel,
            requiredLevel: upgradeCheck.requiredLevel,
            limitStatus: upgradeCheck.limitStatus,
            workflowTriggered: upgradeCheck.workflowTriggered
          }
        );

        const error = createError(errorMessage, 403, 'KYC_LIMIT_EXCEEDED');
        (error as any).details = {
          currentLevel: upgradeCheck.currentLevel,
          requiredLevel: upgradeCheck.requiredLevel,
          limitStatus: upgradeCheck.limitStatus,
          workflowTriggered: upgradeCheck.workflowTriggered,
          workflowId: upgradeCheck.workflowId
        };
        next(error);
        return;
      }

      if (upgradeCheck.limitStatus.status === 'approaching_limit') {
        res.setHeader('X-KYC-Upgrade-Recommended', 'true');
        res.setHeader('X-KYC-Current-Level', upgradeCheck.currentLevel);
        res.setHeader('X-KYC-Recommended-Level', upgradeCheck.requiredLevel || '');
        res.setHeader('X-KYC-Usage-Percentage', upgradeCheck.limitStatus.percentage.toFixed(1));
      }

      next();
    } catch (error) {
      LoggerService.error('KYC upgrade middleware failed:', error);
      next(createError(
        'Unable to verify transaction limits. Please contact support.',
        500,
        'KYC_CHECK_FAILED'
      ));
    }
  };
}
