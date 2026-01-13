import { create } from 'zustand';
import type { Wallet, WalletBalance, Transaction } from '@/types/wallet';

interface WalletState {
  // Wallets
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  balances: WalletBalance[];
  
  // Transactions
  transactions: Transaction[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setWallets: (wallets: Wallet[]) => void;
  setSelectedWallet: (wallet: Wallet | null) => void;
  setBalances: (balances: WalletBalance[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Wallet operations
  fetchWallets: () => Promise<void>;
  fetchWalletBalance: (walletId: string) => Promise<WalletBalance | null>;
  fetchAllBalances: () => Promise<void>;
  fetchTransactions: (walletId?: string) => Promise<void>;
  
  // Clear state
  clear: () => void;
}

const initialState = {
  wallets: [],
  selectedWallet: null,
  balances: [],
  transactions: [],
  isLoading: false,
  error: null,
};

/**
 * Wallet Store - Manages wallet state and operations
 */
export const useWalletStore = create<WalletState>((set) => ({
  ...initialState,

  setWallets: (wallets) => set({ wallets }),

  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),

  setBalances: (balances) => set({ balances }),

  setTransactions: (transactions) => set({ transactions }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  fetchWallets: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/wallet/wallets');
      if (!response.ok) {
        throw new Error('Failed to fetch wallets');
      }
      
      const data = await response.json();
      const wallets = data.data || data.wallets || [];
      set({ wallets, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch wallets';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchWalletBalance: async (walletId: string) => {
    try {
      const response = await fetch(`/api/wallet/wallets/${walletId}/balance`);
      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }
      
      const data = await response.json();
      const balance = data.data || data.balance;
      
      // Update balances array
      set((state) => {
        const updatedBalances = state.balances.filter((b) => b.walletId !== walletId);
        updatedBalances.push(balance);
        return { balances: updatedBalances };
      });
      
      return balance;
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch wallet balance';
      set({ error: errorMessage });
      return null;
    }
  },

  fetchAllBalances: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/wallet/balances');
      if (!response.ok) {
        throw new Error('Failed to fetch balances');
      }
      
      const data = await response.json();
      const balances = data.data || data.balances || [];
      set({ balances, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch balances';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchTransactions: async (walletId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let endpoint = '/api/wallet/transactions';
      if (walletId) {
        endpoint = `/api/wallet/wallets/${walletId}/transactions`;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const data = await response.json();
      const transactions = data.data || data.transactions || [];
      set({ transactions, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transactions';
      set({ error: errorMessage, isLoading: false });
    }
  },

  clear: () => set(initialState),
}));
