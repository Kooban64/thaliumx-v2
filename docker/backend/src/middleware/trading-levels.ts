/**
 * Trading Level Middleware
 * 
 * Enforces trading restrictions based on user's KYC level.
 * 
 * KYC Levels:
 * - L0: Unverified - No trading allowed
 * - L1: Basic - Limited trading
 * - L2: Intermediate - Medium trading
 * - L3: Full - Unlimited trading
 * - INSTITUTIONAL: Institutional/KYB - Highest limits for businesses
 * 
 * IMPORTANT: This middleware now uses centralized KYC limits from kyc-limits.config.ts
 * All limits are in ZAR (South African Rand) to align with the KYC configuration.
 */

import type { Request, Response, NextFunction } from 'express';
import { createError } from '../utils';
import { 
  KYCLimitsConfig, 
  kycLimitsConfig, 
  getKYCLimits, 
  getCurrencySymbol,
  KYCLevelLimits 
} from '../config/kyc-limits.config';

export enum KYCLevel {
  L0 = 'L0',
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  INSTITUTIONAL = 'INSTITUTIONAL'
}

export interface TradingLimits {
  canTrade: boolean;
  maxDeposit: number;
  maxWithdraw: number;
  maxTrade: number;
  maxOrderCount: number;
  currency: string;
}

/**
 * Get trading limits from centralized KYC config
 * Maps KYC level limits to trading limits interface
 */
const getTradingLimitsFromConfig = (kycLevel: KYCLevel): TradingLimits => {
  const kycLimits = getKYCLimits(kycLevel);
  const currencySymbol = getCurrencySymbol();
  
  if (!kycLimits) {
    // Fallback to L0 (no trading) for unknown levels
    return {
      canTrade: false,
      maxDeposit: 0,
      maxWithdraw: 0,
      maxTrade: 0,
      maxOrderCount: 0,
      currency: 'ZAR'
    };
  }

  const maxDepositValue = kycLimits.maxDeposit ?? kycLimits.maxInvestment ?? 0;
  const maxWithdrawValue = kycLimits.maxWithdrawal ?? 0;
  const maxTradeValue = kycLimits.maxTrading ?? 0;
  const maxDailyTxValue = kycLimits.maxDailyTransactions ?? 0;
  
  // Determine if user can trade based on limits
  const canTrade = maxTradeValue > 0 || maxDepositValue > 0;
  
  // Map KYC limits to trading limits
  // maxDeposit from KYC -> maxDeposit for trading
  // maxWithdrawal from KYC -> maxWithdraw for trading
  // maxTrading from KYC -> maxTrade for trading
  // maxDailyTransactions from KYC -> maxOrderCount for trading
  return {
    canTrade,
    maxDeposit: maxDepositValue,
    maxWithdraw: maxWithdrawValue,
    maxTrade: maxTradeValue,
    maxOrderCount: maxDailyTxValue,
    currency: 'ZAR'
  };
};

/**
 * TRADING_LIMITS - Now dynamically generated from KYC config
 * All values are in ZAR to align with centralized configuration
 */
export const TRADING_LIMITS: Record<KYCLevel, TradingLimits> = {
  [KYCLevel.L0]: getTradingLimitsFromConfig(KYCLevel.L0),
  [KYCLevel.L1]: getTradingLimitsFromConfig(KYCLevel.L1),
  [KYCLevel.L2]: getTradingLimitsFromConfig(KYCLevel.L2),
  [KYCLevel.L3]: getTradingLimitsFromConfig(KYCLevel.L3),
  [KYCLevel.INSTITUTIONAL]: getTradingLimitsFromConfig(KYCLevel.INSTITUTIONAL)
};

/**
 * Middleware to check if user can trade based on KYC level
 */
export const requireTradingLevel = (requiredLevel: KYCLevel = KYCLevel.L1) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        throw createError('Authentication required', 401, 'UNAUTHORIZED');
      }

      // Get user's KYC level, default to L0 if not set
      const kycLevel = (user.kycLevel || KYCLevel.L0) as KYCLevel;
      
      // Validate KYC level is supported
      if (!Object.values(KYCLevel).includes(kycLevel)) {
        throw createError('Invalid KYC level', 400, 'INVALID_KYC_LEVEL');
      }

      const limits = TRADING_LIMITS[kycLevel];

      // Check if user can trade at all
      if (!limits.canTrade) {
        throw createError(
          'Email verification required before trading. Please verify your email address.',
          403,
          'KYC_REQUIRED'
        );
      }

      // Check minimum level requirement
      const levelOrder = [
        KYCLevel.L0, 
        KYCLevel.L1, 
        KYCLevel.L2, 
        KYCLevel.L3,
        KYCLevel.INSTITUTIONAL
      ];
      const currentLevelIndex = levelOrder.indexOf(kycLevel);
      const requiredLevelIndex = levelOrder.indexOf(requiredLevel);

      if (currentLevelIndex < requiredLevelIndex) {
        throw createError(
          `Higher KYC level required. Current: ${kycLevel}, Required: ${requiredLevel}`,
          403,
          'INSUFFICIENT_KYC_LEVEL'
        );
      }

      // Attach trading limits to request for downstream use
      (req as any).tradingLimits = limits;
      (req as any).kycLevel = kycLevel;
      (req as any).currency = limits.currency;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check specific trading limits for a transaction
 */
export const checkTradingLimit = (type: 'deposit' | 'withdraw' | 'trade') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limits = (req as any).tradingLimits;
      const amount = parseFloat(req.body?.amount || req.body?.value || '0');

      if (!limits) {
        throw createError('Trading limits not loaded', 500, 'INTERNAL_ERROR');
      }

      let maxAllowed: number;
      let limitType: string;
      
      switch (type) {
        case 'deposit':
          maxAllowed = limits.maxDeposit;
          limitType = 'deposit';
          break;
        case 'withdraw':
          maxAllowed = limits.maxWithdraw;
          limitType = 'withdrawal';
          break;
        case 'trade':
          maxAllowed = limits.maxTrade;
          limitType = 'trading';
          break;
        default:
          maxAllowed = 0;
          limitType = 'transaction';
      }

      // Check for unlimited trading
      if (!isFinite(maxAllowed)) {
        next();
        return;
      }

      if (amount > maxAllowed) {
        throw createError(
          `Amount exceeds ${limitType} limit. Maximum allowed: ${limits.currency} ${maxAllowed.toLocaleString()}`,
          400,
          'AMOUNT_EXCEEDS_LIMIT'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Get trading limits for a user based on their KYC level
 * @param kycLevel - The user's KYC level
 * @returns Trading limits in ZAR
 */
export const getTradingLimits = (kycLevel: KYCLevel): TradingLimits => {
  if (!Object.values(KYCLevel).includes(kycLevel)) {
    return TRADING_LIMITS[KYCLevel.L0];
  }
  return TRADING_LIMITS[kycLevel];
};

/**
 * Get the currency symbol used for trading limits
 */
export const getTradingCurrencySymbol = (): string => {
  return getCurrencySymbol();
};

/**
 * Get the currency code used for trading limits
 */
export const getTradingCurrency = (): string => {
  return 'ZAR';
};

/**
 * Refresh trading limits from config (useful for testing or config updates)
 */
export const refreshTradingLimits = (): void => {
  TRADING_LIMITS[KYCLevel.L0] = getTradingLimitsFromConfig(KYCLevel.L0);
  TRADING_LIMITS[KYCLevel.L1] = getTradingLimitsFromConfig(KYCLevel.L1);
  TRADING_LIMITS[KYCLevel.L2] = getTradingLimitsFromConfig(KYCLevel.L2);
  TRADING_LIMITS[KYCLevel.L3] = getTradingLimitsFromConfig(KYCLevel.L3);
  TRADING_LIMITS[KYCLevel.INSTITUTIONAL] = getTradingLimitsFromConfig(KYCLevel.INSTITUTIONAL);
};
