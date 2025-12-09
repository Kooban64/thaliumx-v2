/**
 * KYC Level Limits Configuration
 * 
 * This file provides configurable KYC level limits that can be overridden
 * via environment variables or a configuration file.
 * 
 * Environment Variable Format:
 * - KYC_L0_MAX_INVESTMENT=10000
 * - KYC_L0_MAX_TRADING=0
 * - KYC_L0_MAX_WITHDRAWAL=1000
 * - KYC_L1_MAX_INVESTMENT=50000
 * - etc.
 * 
 * Or use JSON configuration:
 * - KYC_LIMITS_JSON='{"L0":{"maxInvestment":10000,"maxTrading":0,"maxWithdrawal":1000},...}'
 */

import { LoggerService } from '../services/logger';

// =============================================================================
// CURRENCY CONFIGURATION
// =============================================================================

export interface CurrencyConfig {
  code: string;           // ISO 4217 currency code (e.g., 'ZAR', 'USD')
  symbol: string;         // Currency symbol (e.g., 'R', '$')
  name: string;           // Full currency name
  decimals: number;       // Number of decimal places
  locale: string;         // Locale for formatting (e.g., 'en-ZA')
}

// Default currency configuration - South African Rand
const DEFAULT_CURRENCY: CurrencyConfig = {
  code: process.env.CURRENCY_CODE || 'ZAR',
  symbol: process.env.CURRENCY_SYMBOL || 'R',
  name: process.env.CURRENCY_NAME || 'South African Rand',
  decimals: parseInt(process.env.CURRENCY_DECIMALS || '2', 10),
  locale: process.env.CURRENCY_LOCALE || 'en-ZA'
};

// =============================================================================
// KYC LEVEL LIMITS CONFIGURATION
// =============================================================================

export interface KYCLevelLimits {
  maxInvestment: number;      // Maximum investment amount
  maxTrading: number;         // Maximum trading volume
  maxWithdrawal: number;      // Maximum withdrawal amount
  maxDeposit?: number;        // Maximum deposit amount (optional)
  maxDailyTransactions?: number; // Maximum daily transactions (optional)
}

export interface KYCLevelConfig {
  name: string;
  description: string;
  requirements: string[];
  documents: string[];
  sanctionsCheck: boolean;
  pepCheck: boolean;
  faceVerification: boolean;
  ongoingMonitoring: boolean;
  limits: KYCLevelLimits;
}

// Default KYC level configurations (in base currency - ZAR by default)
// Note: These values are in the configured currency (default: ZAR)
// Conversion factor from USD to ZAR is approximately 18.5 (as of 2024)
const USD_TO_ZAR = parseFloat(process.env.USD_TO_ZAR_RATE || '18.5');

const DEFAULT_KYC_LIMITS: Record<string, KYCLevelConfig> = {
  L0: {
    name: 'Web3 Basic',
    description: 'Basic Web3 wallet verification',
    requirements: ['web3_wallet_connection'],
    documents: [],
    sanctionsCheck: false,
    pepCheck: false,
    faceVerification: false,
    ongoingMonitoring: false,
    limits: {
      maxInvestment: parseFloat(process.env.KYC_L0_MAX_INVESTMENT || String(10000 * USD_TO_ZAR)),  // R185,000
      maxTrading: parseFloat(process.env.KYC_L0_MAX_TRADING || '0'),
      maxWithdrawal: parseFloat(process.env.KYC_L0_MAX_WITHDRAWAL || String(1000 * USD_TO_ZAR)),  // R18,500
      maxDeposit: parseFloat(process.env.KYC_L0_MAX_DEPOSIT || String(10000 * USD_TO_ZAR)),
      maxDailyTransactions: parseInt(process.env.KYC_L0_MAX_DAILY_TX || '5', 10)
    }
  },
  L1: {
    name: 'Basic Verification',
    description: 'Email and phone verification required',
    requirements: ['email_verified', 'phone_verified'],
    documents: [],
    sanctionsCheck: true,
    pepCheck: false,
    faceVerification: false,
    ongoingMonitoring: false,
    limits: {
      maxInvestment: parseFloat(process.env.KYC_L1_MAX_INVESTMENT || String(50000 * USD_TO_ZAR)),  // R925,000
      maxTrading: parseFloat(process.env.KYC_L1_MAX_TRADING || String(25000 * USD_TO_ZAR)),        // R462,500
      maxWithdrawal: parseFloat(process.env.KYC_L1_MAX_WITHDRAWAL || String(5000 * USD_TO_ZAR)),   // R92,500
      maxDeposit: parseFloat(process.env.KYC_L1_MAX_DEPOSIT || String(50000 * USD_TO_ZAR)),
      maxDailyTransactions: parseInt(process.env.KYC_L1_MAX_DAILY_TX || '20', 10)
    }
  },
  L2: {
    name: 'Identity Verified',
    description: 'Government ID, address, and biometric verification required',
    requirements: ['email_verified', 'phone_verified', 'identity_document', 'proof_of_address', 'biometric'],
    documents: ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'BIOMETRIC_DATA'],
    sanctionsCheck: true,
    pepCheck: true,
    faceVerification: true,
    ongoingMonitoring: true,
    limits: {
      maxInvestment: parseFloat(process.env.KYC_L2_MAX_INVESTMENT || String(250000 * USD_TO_ZAR)),  // R4,625,000
      maxTrading: parseFloat(process.env.KYC_L2_MAX_TRADING || String(100000 * USD_TO_ZAR)),        // R1,850,000
      maxWithdrawal: parseFloat(process.env.KYC_L2_MAX_WITHDRAWAL || String(25000 * USD_TO_ZAR)),   // R462,500
      maxDeposit: parseFloat(process.env.KYC_L2_MAX_DEPOSIT || String(250000 * USD_TO_ZAR)),
      maxDailyTransactions: parseInt(process.env.KYC_L2_MAX_DAILY_TX || '50', 10)
    }
  },
  L3: {
    name: 'Enhanced Verification',
    description: 'Full due diligence and source of funds verification',
    requirements: ['email_verified', 'phone_verified', 'identity_document', 'proof_of_address', 'biometric', 'source_of_funds', 'enhanced_screening'],
    documents: ['PASSPORT', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME', 'SOURCE_OF_FUNDS', 'BIOMETRIC_DATA'],
    sanctionsCheck: true,
    pepCheck: true,
    faceVerification: true,
    ongoingMonitoring: true,
    limits: {
      maxInvestment: parseFloat(process.env.KYC_L3_MAX_INVESTMENT || String(1000000 * USD_TO_ZAR)),  // R18,500,000
      maxTrading: parseFloat(process.env.KYC_L3_MAX_TRADING || String(500000 * USD_TO_ZAR)),         // R9,250,000
      maxWithdrawal: parseFloat(process.env.KYC_L3_MAX_WITHDRAWAL || String(100000 * USD_TO_ZAR)),   // R1,850,000
      maxDeposit: parseFloat(process.env.KYC_L3_MAX_DEPOSIT || String(1000000 * USD_TO_ZAR)),
      maxDailyTransactions: parseInt(process.env.KYC_L3_MAX_DAILY_TX || '100', 10)
    }
  },
  INSTITUTIONAL: {
    name: 'Institutional/KYB Verification',
    description: 'Full institutional/KYB verification for businesses',
    requirements: ['business_registration', 'incorporation_documents', 'ownership_structure', 'authorized_signatories', 'source_of_funds', 'enhanced_screening', 'regulatory_licenses'],
    documents: ['BUSINESS_LICENSE', 'ARTICLES_OF_INCORPORATION', 'CERTIFICATE_OF_INCORPORATION', 'BANK_STATEMENT', 'PROOF_OF_ADDRESS'],
    sanctionsCheck: true,
    pepCheck: true,
    faceVerification: true,
    ongoingMonitoring: true,
    limits: {
      maxInvestment: parseFloat(process.env.KYC_INSTITUTIONAL_MAX_INVESTMENT || String(10000000 * USD_TO_ZAR)),  // R185,000,000
      maxTrading: parseFloat(process.env.KYC_INSTITUTIONAL_MAX_TRADING || String(5000000 * USD_TO_ZAR)),         // R92,500,000
      maxWithdrawal: parseFloat(process.env.KYC_INSTITUTIONAL_MAX_WITHDRAWAL || String(1000000 * USD_TO_ZAR)),   // R18,500,000
      maxDeposit: parseFloat(process.env.KYC_INSTITUTIONAL_MAX_DEPOSIT || String(10000000 * USD_TO_ZAR)),
      maxDailyTransactions: parseInt(process.env.KYC_INSTITUTIONAL_MAX_DAILY_TX || '500', 10)
    }
  }
};

// =============================================================================
// ROLE TRANSACTION LIMITS CONFIGURATION
// =============================================================================

export interface RoleTransactionLimits {
  maxDailyVolume: number;
  maxMonthlyVolume: number;
  maxSingleTransaction: number;
  maxWithdrawalDaily: number;
  maxWithdrawalMonthly: number;
  maxDepositDaily: number;
  maxDepositMonthly: number;
  currencies: string[];
}

// Default role transaction limits (in base currency - ZAR by default)
const DEFAULT_ROLE_LIMITS: Record<string, RoleTransactionLimits> = {
  'broker-admin': {
    maxDailyVolume: parseFloat(process.env.ROLE_BROKER_ADMIN_DAILY_VOLUME || String(1000000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_BROKER_ADMIN_MONTHLY_VOLUME || String(10000000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_BROKER_ADMIN_SINGLE_TX || String(100000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_BROKER_ADMIN_WITHDRAWAL_DAILY || String(500000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_BROKER_ADMIN_WITHDRAWAL_MONTHLY || String(5000000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_BROKER_ADMIN_DEPOSIT_DAILY || String(1000000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_BROKER_ADMIN_DEPOSIT_MONTHLY || String(10000000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_BROKER_ADMIN_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  },
  'broker-finance': {
    maxDailyVolume: parseFloat(process.env.ROLE_BROKER_FINANCE_DAILY_VOLUME || String(500000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_BROKER_FINANCE_MONTHLY_VOLUME || String(5000000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_BROKER_FINANCE_SINGLE_TX || String(50000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_BROKER_FINANCE_WITHDRAWAL_DAILY || String(250000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_BROKER_FINANCE_WITHDRAWAL_MONTHLY || String(2500000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_BROKER_FINANCE_DEPOSIT_DAILY || String(500000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_BROKER_FINANCE_DEPOSIT_MONTHLY || String(5000000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_BROKER_FINANCE_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  },
  'broker-ops': {
    maxDailyVolume: parseFloat(process.env.ROLE_BROKER_OPS_DAILY_VOLUME || String(100000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_BROKER_OPS_MONTHLY_VOLUME || String(1000000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_BROKER_OPS_SINGLE_TX || String(10000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_BROKER_OPS_WITHDRAWAL_DAILY || String(50000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_BROKER_OPS_WITHDRAWAL_MONTHLY || String(500000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_BROKER_OPS_DEPOSIT_DAILY || String(100000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_BROKER_OPS_DEPOSIT_MONTHLY || String(1000000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_BROKER_OPS_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  },
  'user-trader': {
    maxDailyVolume: parseFloat(process.env.ROLE_USER_TRADER_DAILY_VOLUME || String(10000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_USER_TRADER_MONTHLY_VOLUME || String(100000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_USER_TRADER_SINGLE_TX || String(1000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_USER_TRADER_WITHDRAWAL_DAILY || String(5000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_USER_TRADER_WITHDRAWAL_MONTHLY || String(50000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_USER_TRADER_DEPOSIT_DAILY || String(10000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_USER_TRADER_DEPOSIT_MONTHLY || String(100000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_USER_TRADER_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  },
  'user-institutional': {
    maxDailyVolume: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_DAILY_VOLUME || String(100000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_MONTHLY_VOLUME || String(1000000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_SINGLE_TX || String(10000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_WITHDRAWAL_DAILY || String(50000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_WITHDRAWAL_MONTHLY || String(500000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_DEPOSIT_DAILY || String(100000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_USER_INSTITUTIONAL_DEPOSIT_MONTHLY || String(1000000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_USER_INSTITUTIONAL_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  },
  'user-vip': {
    maxDailyVolume: parseFloat(process.env.ROLE_USER_VIP_DAILY_VOLUME || String(50000 * USD_TO_ZAR)),
    maxMonthlyVolume: parseFloat(process.env.ROLE_USER_VIP_MONTHLY_VOLUME || String(500000 * USD_TO_ZAR)),
    maxSingleTransaction: parseFloat(process.env.ROLE_USER_VIP_SINGLE_TX || String(5000 * USD_TO_ZAR)),
    maxWithdrawalDaily: parseFloat(process.env.ROLE_USER_VIP_WITHDRAWAL_DAILY || String(25000 * USD_TO_ZAR)),
    maxWithdrawalMonthly: parseFloat(process.env.ROLE_USER_VIP_WITHDRAWAL_MONTHLY || String(250000 * USD_TO_ZAR)),
    maxDepositDaily: parseFloat(process.env.ROLE_USER_VIP_DEPOSIT_DAILY || String(50000 * USD_TO_ZAR)),
    maxDepositMonthly: parseFloat(process.env.ROLE_USER_VIP_DEPOSIT_MONTHLY || String(500000 * USD_TO_ZAR)),
    currencies: (process.env.ROLE_USER_VIP_CURRENCIES || 'ZAR,USD,EUR,BTC,ETH,THAL').split(',')
  }
};

// =============================================================================
// CONFIGURATION SERVICE
// =============================================================================

export class KYCLimitsConfig {
  private static instance: KYCLimitsConfig;
  private kycLimits: Record<string, KYCLevelConfig>;
  private roleLimits: Record<string, RoleTransactionLimits>;
  private currency: CurrencyConfig;
  private initialized: boolean = false;

  private constructor() {
    this.kycLimits = { ...DEFAULT_KYC_LIMITS };
    this.roleLimits = { ...DEFAULT_ROLE_LIMITS };
    this.currency = { ...DEFAULT_CURRENCY };
  }

  public static getInstance(): KYCLimitsConfig {
    if (!KYCLimitsConfig.instance) {
      KYCLimitsConfig.instance = new KYCLimitsConfig();
    }
    return KYCLimitsConfig.instance;
  }

  /**
   * Initialize configuration from environment or JSON config
   */
  public initialize(): void {
    if (this.initialized) return;

    try {
      // Try to load from JSON environment variable first
      const kycLimitsJson = process.env.KYC_LIMITS_JSON;
      if (kycLimitsJson) {
        const parsed = JSON.parse(kycLimitsJson);
        this.mergeKYCLimits(parsed);
        LoggerService.info('KYC limits loaded from KYC_LIMITS_JSON');
      }

      const roleLimitsJson = process.env.ROLE_LIMITS_JSON;
      if (roleLimitsJson) {
        const parsed = JSON.parse(roleLimitsJson);
        this.mergeRoleLimits(parsed);
        LoggerService.info('Role limits loaded from ROLE_LIMITS_JSON');
      }

      // Load currency configuration
      this.currency = {
        code: process.env.CURRENCY_CODE || DEFAULT_CURRENCY.code,
        symbol: process.env.CURRENCY_SYMBOL || DEFAULT_CURRENCY.symbol,
        name: process.env.CURRENCY_NAME || DEFAULT_CURRENCY.name,
        decimals: parseInt(process.env.CURRENCY_DECIMALS || String(DEFAULT_CURRENCY.decimals), 10),
        locale: process.env.CURRENCY_LOCALE || DEFAULT_CURRENCY.locale
      };

      this.initialized = true;
      LoggerService.info('KYC Limits Configuration initialized', {
        currency: this.currency.code,
        symbol: this.currency.symbol,
        kycLevels: Object.keys(this.kycLimits),
        roles: Object.keys(this.roleLimits)
      });

    } catch (error) {
      LoggerService.error('Failed to initialize KYC limits configuration:', error);
      // Use defaults on error
      this.initialized = true;
    }
  }

  /**
   * Merge custom KYC limits with defaults
   */
  private mergeKYCLimits(custom: Record<string, Partial<KYCLevelConfig>>): void {
    for (const [level, config] of Object.entries(custom)) {
      if (this.kycLimits[level]) {
        this.kycLimits[level] = {
          ...this.kycLimits[level],
          ...config,
          limits: {
            ...this.kycLimits[level].limits,
            ...(config.limits || {})
          }
        };
      } else {
        LoggerService.warn(`Unknown KYC level in configuration: ${level}`);
      }
    }
  }

  /**
   * Merge custom role limits with defaults
   */
  private mergeRoleLimits(custom: Record<string, Partial<RoleTransactionLimits>>): void {
    for (const [role, limits] of Object.entries(custom)) {
      if (this.roleLimits[role]) {
        this.roleLimits[role] = {
          ...this.roleLimits[role],
          ...limits
        };
      } else {
        // Allow adding new roles
        this.roleLimits[role] = limits as RoleTransactionLimits;
      }
    }
  }

  // =============================================================================
  // GETTERS
  // =============================================================================

  /**
   * Get currency configuration
   */
  public getCurrency(): CurrencyConfig {
    return { ...this.currency };
  }

  /**
   * Get KYC level configuration
   */
  public getKYCLevelConfig(level: string): KYCLevelConfig | undefined {
    return this.kycLimits[level] ? { ...this.kycLimits[level] } : undefined;
  }

  /**
   * Get all KYC level configurations
   */
  public getAllKYCLevelConfigs(): Record<string, KYCLevelConfig> {
    return { ...this.kycLimits };
  }

  /**
   * Get KYC level limits only
   */
  public getKYCLevelLimits(level: string): KYCLevelLimits | undefined {
    return this.kycLimits[level]?.limits ? { ...this.kycLimits[level].limits } : undefined;
  }

  /**
   * Get role transaction limits
   */
  public getRoleLimits(role: string): RoleTransactionLimits | undefined {
    return this.roleLimits[role] ? { ...this.roleLimits[role] } : undefined;
  }

  /**
   * Get all role limits
   */
  public getAllRoleLimits(): Record<string, RoleTransactionLimits> {
    return { ...this.roleLimits };
  }

  // =============================================================================
  // SETTERS (for runtime updates)
  // =============================================================================

  /**
   * Update KYC level limits at runtime
   */
  public updateKYCLevelLimits(level: string, limits: Partial<KYCLevelLimits>): boolean {
    if (!this.kycLimits[level]) {
      LoggerService.warn(`Cannot update unknown KYC level: ${level}`);
      return false;
    }

    this.kycLimits[level].limits = {
      ...this.kycLimits[level].limits,
      ...limits
    };

    LoggerService.info(`KYC level ${level} limits updated`, { limits: this.kycLimits[level].limits });
    return true;
  }

  /**
   * Update role transaction limits at runtime
   */
  public updateRoleLimits(role: string, limits: Partial<RoleTransactionLimits>): boolean {
    if (!this.roleLimits[role]) {
      LoggerService.warn(`Cannot update unknown role: ${role}`);
      return false;
    }

    this.roleLimits[role] = {
      ...this.roleLimits[role],
      ...limits
    };

    LoggerService.info(`Role ${role} limits updated`, { limits: this.roleLimits[role] });
    return true;
  }

  /**
   * Update currency configuration at runtime
   */
  public updateCurrency(config: Partial<CurrencyConfig>): void {
    this.currency = {
      ...this.currency,
      ...config
    };
    LoggerService.info('Currency configuration updated', { currency: this.currency });
  }

  // =============================================================================
  // FORMATTING HELPERS
  // =============================================================================

  /**
   * Format amount with currency symbol
   */
  public formatAmount(amount: number): string {
    return new Intl.NumberFormat(this.currency.locale, {
      style: 'currency',
      currency: this.currency.code,
      minimumFractionDigits: this.currency.decimals,
      maximumFractionDigits: this.currency.decimals
    }).format(amount);
  }

  /**
   * Format amount with symbol only (no locale formatting)
   */
  public formatAmountSimple(amount: number): string {
    return `${this.currency.symbol}${amount.toFixed(this.currency.decimals)}`;
  }

  /**
   * Get currency symbol
   */
  public getCurrencySymbol(): string {
    return this.currency.symbol;
  }

  /**
   * Get currency code
   */
  public getCurrencyCode(): string {
    return this.currency.code;
  }
}

// Export singleton instance
export const kycLimitsConfig = KYCLimitsConfig.getInstance();

// Export helper functions
export function getCurrencySymbol(): string {
  return kycLimitsConfig.getCurrencySymbol();
}

export function getCurrencyCode(): string {
  return kycLimitsConfig.getCurrencyCode();
}

export function formatCurrency(amount: number): string {
  return kycLimitsConfig.formatAmount(amount);
}

export function getKYCLimits(level: string): KYCLevelLimits | undefined {
  return kycLimitsConfig.getKYCLevelLimits(level);
}

export function getRoleLimits(role: string): RoleTransactionLimits | undefined {
  return kycLimitsConfig.getRoleLimits(role);
}