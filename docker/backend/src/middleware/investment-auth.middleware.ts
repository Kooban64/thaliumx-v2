/**
 * Investment Authorization Middleware
 * 
 * Unified authorization middleware for investment flows (presale and token sale).
 * Combines:
 * - KYC limit checks (unified across presale and main platform)
 * - OPA policy evaluation for compliance
 * - Automatic KYC upgrade triggers
 * 
 * This middleware ensures all investment operations go through the same
 * authorization and compliance checks, providing a unified experience
 * across both presale and main trading platforms.
 */

import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';
import { AuthAttributesService } from '../services/zitadel-attributes.service';

export interface InvestmentAuthOptions {
  /** Type of limit to check ('investment' for presale/token sale investments) */
  limitType: 'investment' | 'trading' | 'withdrawal' | 'deposit';
  /** Whether to automatically trigger KYC upgrade workflows */
  autoTriggerUpgrade?: boolean;
  /** Resource type for OPA evaluation (e.g., 'presale', 'token_sale') */
  resourceType: string;
  /** Action for OPA evaluation (e.g., 'presale_investment', 'token_sale_investment') */
  action: string;
  /** Custom amount extractor function */
  amountExtractor?: (req: Request) => number;
  /** Whether to fail-secure (deny) or fail-open (allow) if OPA is unavailable */
  failSecure?: boolean;
}

/**
 * Investment authorization middleware factory
 * Creates middleware that enforces unified authorization for investment operations
 */
export function investmentAuth(options: InvestmentAuthOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check authentication
      const user = req.user as any;
      if (!user) {
        await LoggerService.logAudit('investment_auth_denied', 'investment_auth', { userId: undefined }, {
          reason: 'not_authenticated',
          resourceType: options.resourceType,
          action: options.action,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        return;
      }

      const userId = user.id || user.userId;
      const tenantId = user.tenantId || req.headers['x-tenant-id'] as string || 
        process.env.DEFAULT_TENANT_ID || '10000000-0000-0000-0000-000000000000';

      // Extract investment amount
      const amountExtractor = options.amountExtractor || ((req: Request) => 
        req.body?.amount || req.body?.investmentAmountUSD || req.body?.investmentAmount || 0
      );
      const amount = amountExtractor(req);

      if (amount <= 0) {
        next(createError('Invalid investment amount', 400, 'INVALID_AMOUNT'));
        return;
      }

      // Extract auth context for OPA
      const authContext = AuthAttributesService.extractFromRequest(req);

      // Step 0: Check if wallet is blocked (if wallet address provided)
      const walletAddress = req.body?.walletAddress || req.body?.address;
      if (walletAddress) {
        try {
          const { PresaleSecurityResponseService } = await import('../services/presale-security-response.service');
          const isBlocked = await PresaleSecurityResponseService.isWalletBlocked(walletAddress);
          if (isBlocked) {
            await LoggerService.logAudit('investment_blocked_wallet', 'investment_auth', { userId }, {
              walletAddress,
              resourceType: options.resourceType,
              action: options.action,
                amount
            });
            next(createError(
              'Wallet address is blocked from making investments',
              403,
              'WALLET_BLOCKED'
            ));
            return;
          }
        } catch (blockCheckError) {
          LoggerService.warn('Wallet block check failed, continuing (fail-open)', { error: blockCheckError });
        }
      }

      // Step 1: Check KYC upgrade requirements (unified limit checks)
      const { KYCUpgradeTriggerService } = await import('../services/kyc-upgrade-trigger.service');
      const { TimePeriod } = await import('../services/transaction-volume-tracker.service');
      const upgradeCheck = await KYCUpgradeTriggerService.checkAndTriggerUpgrade(
        userId,
        tenantId,
        options.limitType,
        amount,
        TimePeriod.TOTAL,
        options.autoTriggerUpgrade !== false,
        req // Pass request for auth context
      );

      // Block if limit exceeded
      if (upgradeCheck.shouldUpgrade && !upgradeCheck.limitStatus.canProceed) {
        const errorMessage = upgradeCheck.message || 
          `Investment limit exceeded. Current usage: ${upgradeCheck.limitStatus.current.toFixed(2)}, Limit: ${upgradeCheck.limitStatus.limit.toFixed(2)}. Please upgrade to KYC level ${upgradeCheck.requiredLevel}`;

        await LoggerService.logAudit('investment_blocked_kyc_limit', 'investment_auth', { userId, tenantId }, {
          amount,
          currentLevel: upgradeCheck.currentLevel,
          requiredLevel: upgradeCheck.requiredLevel,
          limitStatus: upgradeCheck.limitStatus,
          workflowTriggered: upgradeCheck.workflowTriggered,
          resourceType: options.resourceType,
          action: options.action,
        });

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

      // Step 2: Evaluate OPA policy (centralized compliance decision)
      try {
        const { OPAInputBuilder } = await import('../services/opa-input-builder');
        const { opaService: opaServiceInstance } = await import('../services/opa');
        const resourceId = req.body?.presaleId || req.body?.phaseId || req.params?.id;
        const opaInput = await OPAInputBuilder.buildFromRequest(
          req,
          options.resourceType,
          options.action,
          resourceId,
          {
            transaction: {
              amount,
              type: options.limitType,
              currency: req.body?.currency || 'USD'
            },
            user: {
              organization_id: authContext.organizationId,
              client_id: authContext.clientId,
              auth_roles: authContext.roles
            }
          }
        );

        const opaDecisions = await opaServiceInstance.evaluateAMLPolicy(opaInput);

        // Check if OPA denies the investment
        const denied = opaDecisions.some((d: any) => d.allowed === false);
        if (denied) {
          const denialDecision = opaDecisions.find((d: any) => d.allowed === false);
          const denialReason = denialDecision?.reason || 'Investment denied by compliance policy';
          const ruleId = denialDecision?.rule_id || 'OPA-DENY';

          await LoggerService.logAudit('investment_blocked_opa_policy', 'investment_auth', { userId, tenantId }, {
            amount,
            resourceType: options.resourceType,
            action: options.action,
            denialReason,
            ruleId,
            opaDecisions,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });

          // Check if OPA suggests KYC upgrade
          const upgradeAction = denialDecision?.actions?.find((a: any) =>
            a.type === 'upgrade_required' || a.type === 'upgrade_prompt' || a.type === 'trigger_workflow'
          );

          if (upgradeAction && upgradeAction.parameters?.required_level) {
            const { KYCUpgradeTriggerService: KYCUpgradeTriggerService2 } = await import('../services/kyc-upgrade-trigger.service');
            await KYCUpgradeTriggerService2.triggerUpgradeWorkflow({
              userId,
              tenantId,
              fromLevel: upgradeCheck.currentLevel,
              toLevel: upgradeAction.parameters.required_level,
              reason: `OPA policy requires KYC level ${upgradeAction.parameters.required_level}: ${denialReason}`,
              triggerType: 'blocking',
              metadata: {
                opaRuleId: ruleId,
                opaDenialReason: denialReason,
                resourceType: options.resourceType,
                action: options.action
              }
            }, req);
          }

          const error = createError(denialReason, 403, 'INVESTMENT_DENIED_BY_POLICY');
          (error as any).details = {
            ruleId,
            opaDecision: denialDecision,
            upgradeRequired: !!upgradeAction
          };
          next(error);
          return;
        }

        // OPA approved - log success
        await LoggerService.logAudit('investment_approved_opa_policy', 'investment_auth', { userId, tenantId }, {
          amount,
          resourceType: options.resourceType,
          action: options.action,
          opaDecisions,
        });

      } catch (opaError) {
        // If OPA evaluation fails, handle based on fail-secure setting
        LoggerService.warn('OPA evaluation failed in investment auth', {
          error: opaError,
          userId,
          tenantId,
          resourceType: options.resourceType,
          action: options.action,
        });

        if (options.failSecure !== false) {
          // Fail-secure: deny if OPA unavailable
          await LoggerService.logAudit('opa_evaluation_failed', 'investment_auth', { userId, tenantId }, {
            amount,
            resourceType: options.resourceType,
            action: options.action,
            error: opaError instanceof Error ? opaError.message : 'unknown_error',
          });

          next(createError(
            'Compliance check unavailable. Please try again later.',
            503,
            'OPA_UNAVAILABLE'
          ));
          return;
        } else {
          // Fail-open: allow if OPA unavailable (not recommended for production)
          await LoggerService.logAudit('opa_evaluation_failed_allow', 'investment_auth', { userId, tenantId }, {
            amount,
            resourceType: options.resourceType,
            action: options.action,
            error: opaError instanceof Error ? opaError.message : 'unknown_error',
          });
        }
      }

      // Add upgrade recommendation headers if approaching limit
      if (upgradeCheck.limitStatus.status === 'approaching_limit') {
        res.setHeader('X-KYC-Upgrade-Recommended', 'true');
        res.setHeader('X-KYC-Current-Level', upgradeCheck.currentLevel);
        res.setHeader('X-KYC-Recommended-Level', upgradeCheck.requiredLevel || '');
        res.setHeader('X-KYC-Usage-Percentage', upgradeCheck.limitStatus.percentage.toFixed(1));
      }

      // Authorization granted
      next();
    } catch (error) {
      LoggerService.error('Investment authorization middleware error', error);
      
      await LoggerService.logAudit('investment_auth_error', 'investment_auth', { 
        userId: (req.user as any)?.id || (req.user as any)?.userId 
      }, {
        error: error instanceof Error ? error.message : 'unknown_error',
        resourceType: options.resourceType,
        action: options.action,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      next(createError('Authorization check failed', 500, 'AUTHORIZATION_ERROR'));
    }
  };
}
