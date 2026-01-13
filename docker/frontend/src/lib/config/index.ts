/**
 * Configuration Management
 * Centralized configuration with environment variable support
 */

interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

interface FeatureFlags {
  trading: boolean;
  staking: boolean;
  nft: boolean;
  dex: boolean;
  presale: boolean;
  omniExchange: boolean;
}

interface LimitsConfig {
  kyc: {
    L0: {
      maxInvestment: number;
      maxTrading: number;
      maxWithdrawal: number;
      maxDeposit: number;
      maxDailyTransactions: number;
    };
    L1: {
      maxInvestment: number;
      maxTrading: number;
      maxWithdrawal: number;
      maxDeposit: number;
      maxDailyTransactions: number;
    };
    L2: {
      maxInvestment: number;
      maxTrading: number;
      maxWithdrawal: number;
      maxDeposit: number;
      maxDailyTransactions: number;
    };
    L3: {
      maxInvestment: number;
      maxTrading: number;
      maxWithdrawal: number;
      maxDeposit: number;
      maxDailyTransactions: number;
    };
    INSTITUTIONAL: {
      maxInvestment: number;
      maxTrading: number;
      maxWithdrawal: number;
      maxDeposit: number;
      maxDailyTransactions: number;
    };
  };
}

/**
 * Application Configuration
 * Can be overridden by admin via API
 */
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
    timeout: 30000,
  } as ApiConfig,

  features: {
    trading: true,
    staking: true,
    nft: true,
    dex: true,
    presale: true,
    omniExchange: true,
  } as FeatureFlags,

  limits: {
    kyc: {
      L0: {
        maxInvestment: 185000, // R185,000 (USD 10,000)
        maxTrading: 0,
        maxWithdrawal: 18500, // R18,500 (USD 1,000)
        maxDeposit: 185000,
        maxDailyTransactions: 5,
      },
      L1: {
        maxInvestment: 925000, // R925,000 (USD 50,000)
        maxTrading: 462500, // R462,500 (USD 25,000)
        maxWithdrawal: 92500, // R92,500 (USD 5,000)
        maxDeposit: 925000,
        maxDailyTransactions: 20,
      },
      L2: {
        maxInvestment: 4625000, // R4,625,000 (USD 250,000)
        maxTrading: 1850000, // R1,850,000 (USD 100,000)
        maxWithdrawal: 462500, // R462,500 (USD 25,000)
        maxDeposit: 4625000,
        maxDailyTransactions: 50,
      },
      L3: {
        maxInvestment: 18500000, // R18,500,000 (USD 1,000,000)
        maxTrading: 9250000, // R9,250,000 (USD 500,000)
        maxWithdrawal: 1850000, // R1,850,000 (USD 100,000)
        maxDeposit: 18500000,
        maxDailyTransactions: 100,
      },
      INSTITUTIONAL: {
        maxInvestment: 185000000, // R185,000,000 (USD 10,000,000)
        maxTrading: 92500000, // R92,500,000 (USD 5,000,000)
        maxWithdrawal: 18500000, // R18,500,000 (USD 1,000,000)
        maxDeposit: 185000000,
        maxDailyTransactions: 500,
      },
    },
  } as LimitsConfig,
};

/**
 * Update configuration (typically called by admin)
 */
export function updateConfig(updates: Partial<typeof config>) {
  Object.assign(config, updates);
}

/**
 * Get feature flag
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return config.features[feature] ?? false;
}

/**
 * Get KYC limits
 */
export function getKYCLimits(level: keyof LimitsConfig['kyc']) {
  return config.limits.kyc[level];
}
