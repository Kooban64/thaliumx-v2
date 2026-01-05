/**
 * OPA Input Builder Service
 * 
 * Builds comprehensive input for OPA policy evaluation from Express request context.
 * Enhances input with unified transaction volume data for progressive compliance checks.
 */

import type { Request } from 'express';
import { LoggerService } from './logger';
import { TransactionVolumeTrackerService, TimePeriod } from './transaction-volume-tracker.service';
import { KYCService } from './kyc';
import { RoleMapperService } from './role-mapper';
import { ZitadelAttributesService } from './zitadel-attributes.service';

export interface OPAInput {
  action: string;
  user: {
    id: string;
    email?: string;
    role?: string;
    roles?: string[];
    tenantId?: string;
    brokerId?: string;
    kyc_level?: string;
    kyc_limit?: number;
    kyc_usage?: number;
    kyc_usage_percentage?: number;
    required_kyc_level?: string;
    workflow_url?: string;
    [key: string]: any;
  };
  resource?: {
    type?: string;
    id?: string;
    [key: string]: any;
  };
  transaction?: {
    amount?: number;
    currency?: string;
    type?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class OPAInputBuilder {
  public static async buildFromRequest(
    req: Request,
    resourceType?: string,
    action?: string,
    resourceId?: string,
    additionalContext?: Record<string, any>
  ): Promise<OPAInput> {
    const user = req.user as any;
    const userId = user?.id || user?.userId;
    const tenantId = user?.tenantId || req.headers['x-tenant-id'] as string || 
      process.env.DEFAULT_TENANT_ID || '10000000-0000-0000-0000-000000000000';

    const resolvedAction = action || this.extractAction(req);
    const resolvedResourceType = resourceType || this.extractResourceType(req);

    // Extract Zitadel attributes
    const zitadelContext = ZitadelAttributesService.extractFromRequest(req);

    const input: OPAInput = {
      action: resolvedAction,
      user: {
        id: userId,
        email: user?.email,
        role: user?.role,
        roles: zitadelContext.normalizedRoles.length > 0 ? zitadelContext.normalizedRoles : (Array.isArray(user?.roles) ? user?.roles : (user?.role ? [user.role] : [])),
        tenantId,
        brokerId: zitadelContext.brokerId || user?.brokerId,
        organization_id: zitadelContext.organizationId,
        zitadel_project_id: zitadelContext.projectId,
        zitadel_roles: zitadelContext.roles,
        metadata: zitadelContext.metadata,
        custom_claims: zitadelContext.customClaims,
        authenticated: !!user,
        ...additionalContext?.user
      },
      resource: {
        type: resolvedResourceType,
        id: resourceId,
        ...additionalContext?.resource
      },
      transaction: {
        amount: req.body?.amount || req.body?.investmentAmountUSD || req.body?.investmentAmount || 0,
        currency: req.body?.currency || 'USD',
        type: resolvedAction,
        ...additionalContext?.transaction
      },
      ...additionalContext
    };

    // Enhance with KYC level and limit data for investment/trading/withdrawal actions
    if (resolvedAction === 'investment' || resolvedAction === 'trading' || resolvedAction === 'withdrawal' || 
        resolvedAction === 'presale_investment' || resolvedAction === 'token_sale_investment') {
      try {
        let kycLevel = 'L0';
        try {
          const kycStatus = await KYCService.getKYCStatus(userId);
          kycLevel = kycStatus.kycLevel;
          input.user.kyc_level = kycLevel;
        } catch (error) {
          LoggerService.warn('Could not fetch KYC status for OPA input', { userId, error });
        }

        const transactionAmount = input.transaction?.amount || 0;
        const limitType = resolvedAction === 'investment' || resolvedAction === 'presale_investment' || resolvedAction === 'token_sale_investment'
          ? 'investment'
          : resolvedAction === 'trading'
          ? 'trading'
          : 'withdrawal';

        try {
          const limitStatus = await TransactionVolumeTrackerService.checkLimit(
            userId,
            tenantId,
            limitType,
            transactionAmount,
            TimePeriod.TOTAL
          );

          input.user.kyc_limit = limitStatus.limit;
          input.user.kyc_usage = limitStatus.current;
          input.user.kyc_usage_percentage = limitStatus.percentage;
          
          if (limitStatus.upgradeRequired && limitStatus.status !== 'within_limit') {
            const { KYCUpgradeTriggerService } = await import('./kyc-upgrade-trigger.service');
            const upgradeCheck = await KYCUpgradeTriggerService.checkUpgradeRequired(
              userId,
              tenantId,
              limitType,
              transactionAmount,
              TimePeriod.TOTAL
            );
            
            if (upgradeCheck.requiredLevel) {
              input.user.required_kyc_level = upgradeCheck.requiredLevel;
            }
          }
        } catch (error) {
          LoggerService.warn('Could not fetch limit status for OPA input', { userId, error });
        }
      } catch (error) {
        LoggerService.warn('Failed to enhance OPA input with KYC data', { userId, error });
      }
    }

    // Normalize user roles
    if (input.user.roles && input.user.roles.length > 0) {
      input.user.roles = RoleMapperService.normalizeRoles(input.user.roles);
      if (!input.user.role && input.user.roles && input.user.roles.length > 0) {
        input.user.role = input.user.roles[0];
      }
    }

    return input;
  }

  public static extractResourceType(req: Request): string {
    const path = req.path;
    if (path.includes('/users')) return 'user';
    if (path.includes('/orders')) return 'order';
    if (path.includes('/transactions')) return 'transaction';
    if (path.includes('/investments')) return 'investment';
    if (path.includes('/presale')) return 'presale';
    if (path.includes('/token-sale')) return 'token_sale';
    if (path.includes('/trading')) return 'trading';
    if (path.includes('/wallets')) return 'wallet';
    return 'resource';
  }

  public static extractAction(req: Request): string {
    const method = req.method.toUpperCase();
    if (method === 'GET') return 'read';
    if (method === 'POST') {
      if (req.path.includes('/investments') || req.path.includes('/invest')) return 'investment';
      if (req.path.includes('/trade') || req.path.includes('/orders')) return 'trading';
      if (req.path.includes('/withdraw')) return 'withdrawal';
      return 'create';
    }
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'unknown';
  }
}
