import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useWalletStore } from '@/stores/walletStore';
import type { Wallet, WalletBalance, Transaction, DepositRequest, WithdrawalRequest } from '@/types/wallet';

/**
 * useWallets - Get all wallets for current user
 */
export function useWallets() {
  return useQuery<Wallet[]>({
    queryKey: ['wallet', 'wallets'],
    queryFn: async () => {
      const response = await apiClient.get('/api/wallet/wallets');
      if (response.success && response.data) {
        const data = response.data as any;
        const wallets = data.data || data.wallets || [];
        useWalletStore.getState().setWallets(wallets);
        return wallets;
      }
      throw new Error(response.error || 'Failed to fetch wallets');
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * useWallet - Get specific wallet
 */
export function useWallet(walletId: string) {
  return useQuery<Wallet>({
    queryKey: ['wallet', 'wallets', walletId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/wallet/wallets/${walletId}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.wallet;
      }
      throw new Error(response.error || 'Failed to fetch wallet');
    },
    enabled: !!walletId,
    staleTime: 30 * 1000,
  });
}

/**
 * useWalletBalance - Get wallet balance
 */
export function useWalletBalance(walletId: string) {
  return useQuery<WalletBalance>({
    queryKey: ['wallet', 'balance', walletId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/wallet/wallets/${walletId}/balance`);
      if (response.success && response.data) {
        const data = response.data as any;
        const balance = data.data || data.balance;
        // Update store
        const balances = useWalletStore.getState().balances.filter((b) => b.walletId !== walletId);
        balances.push(balance);
        useWalletStore.getState().setBalances(balances);
        return balance;
      }
      throw new Error(response.error || 'Failed to fetch wallet balance');
    },
    enabled: !!walletId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

/**
 * useAllBalances - Get all wallet balances
 */
export function useAllBalances() {
  return useQuery<WalletBalance[]>({
    queryKey: ['wallet', 'balances'],
    queryFn: async () => {
      const response = await apiClient.get('/api/wallet/balances');
      if (response.success && response.data) {
        const data = response.data as any;
        const balances = data.data || data.balances || [];
        useWalletStore.getState().setBalances(balances);
        return balances;
      }
      throw new Error(response.error || 'Failed to fetch balances');
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * useTransactions - Get transactions
 */
export function useTransactions(walletId?: string) {
  return useQuery<Transaction[]>({
    queryKey: ['wallet', 'transactions', walletId],
    queryFn: async () => {
      let endpoint = '/api/wallet/transactions';
      if (walletId) {
        endpoint = `/api/wallet/wallets/${walletId}/transactions`;
      }
      
      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        const data = response.data as any;
        const transactions = data.data || data.transactions || [];
        useWalletStore.getState().setTransactions(transactions);
        return transactions;
      }
      throw new Error(response.error || 'Failed to fetch transactions');
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Refetch every 15 seconds
  });
}

/**
 * useDeposit - Deposit funds to wallet
 */
export function useDeposit() {
  const queryClient = useQueryClient();
  const { fetchAllBalances, fetchTransactions } = useWalletStore();

  return useMutation({
    mutationFn: async (request: DepositRequest) => {
      const response = await apiClient.post(`/api/wallet/wallets/${request.walletId}/deposit`, request);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.transaction;
      }
      throw new Error(response.error || 'Failed to deposit funds');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance', variables.walletId] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions', variables.walletId] });
      fetchAllBalances();
      fetchTransactions(variables.walletId);
    },
  });
}

/**
 * useWithdraw - Withdraw funds from wallet
 */
export function useWithdraw() {
  const queryClient = useQueryClient();
  const { fetchAllBalances, fetchTransactions } = useWalletStore();

  return useMutation({
    mutationFn: async (request: WithdrawalRequest) => {
      const response = await apiClient.post(`/api/wallet/wallets/${request.walletId}/withdraw`, request);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.transaction;
      }
      throw new Error(response.error || 'Failed to withdraw funds');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance', variables.walletId] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions', variables.walletId] });
      fetchAllBalances();
      fetchTransactions(variables.walletId);
    },
  });
}

/**
 * useCreateWallet - Create new wallet
 */
export function useCreateWallet() {
  const queryClient = useQueryClient();
  const { fetchWallets } = useWalletStore();

  return useMutation({
    mutationFn: async ({ walletType, currency }: { walletType: string; currency: string }) => {
      const response = await apiClient.post('/api/wallet/wallets', {
        walletType,
        currency,
      });
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.wallet;
      }
      throw new Error(response.error || 'Failed to create wallet');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'wallets'] });
      fetchWallets();
    },
  });
}
