import { create } from 'zustand';

export type KYCLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'INSTITUTIONAL';

interface KYCLimits {
  maxInvestment: number;
  maxTrading: number;
  maxWithdrawal: number;
  maxDeposit: number;
  maxDailyTransactions: number;
}

interface KYCState {
  level: KYCLevel | null;
  status: 'pending' | 'approved' | 'rejected' | 'in_review' | null;
  limits: KYCLimits | null;
  setLevel: (level: KYCLevel | null) => void;
  setStatus: (status: KYCState['status']) => void;
  setLimits: (limits: KYCLimits | null) => void;
  clear: () => void;
}

/**
 * KYC Store - Manages KYC level and limits state
 */
export const useKYCStore = create<KYCState>((set) => ({
  level: null,
  status: null,
  limits: null,
  setLevel: (level) => set({ level }),
  setStatus: (status) => set({ status }),
  setLimits: (limits) => set({ limits }),
  clear: () => set({ level: null, status: null, limits: null }),
}));
