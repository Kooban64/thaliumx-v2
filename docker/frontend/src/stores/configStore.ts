import { create } from 'zustand';

interface FeatureFlags {
  trading: boolean;
  staking: boolean;
  nft: boolean;
  dex: boolean;
  presale: boolean;
  [key: string]: boolean;
}

interface KYCLimits {
  maxInvestment?: number;
  maxTrading?: number;
  maxWithdrawal?: number;
  maxDeposit?: number;
  maxDailyTransactions?: number;
  [key: string]: unknown;
}

interface LimitsConfig {
  kyc: {
    L0: KYCLimits;
    L1: KYCLimits;
    L2: KYCLimits;
    L3: KYCLimits;
    INSTITUTIONAL: KYCLimits;
  };
  roles: {
    [role: string]: KYCLimits;
  };
}

interface ConfigState {
  features: FeatureFlags;
  limits: LimitsConfig | null;
  apiBaseUrl: string;
  setFeatures: (features: Partial<FeatureFlags>) => void;
  setLimits: (limits: LimitsConfig | null) => void;
  setApiBaseUrl: (url: string) => void;
}

/**
 * Config Store - Manages application configuration
 * Can be updated by admin to control limits, features, etc.
 */
export const useConfigStore = create<ConfigState>((set) => ({
  features: {
    trading: true,
    staking: true,
    nft: true,
    dex: true,
    presale: true,
  },
  limits: null,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  setFeatures: (features) =>
    set((state) => ({
      features: { ...state.features, ...features } as FeatureFlags,
    })),
  setLimits: (limits) => set({ limits }),
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
}));
