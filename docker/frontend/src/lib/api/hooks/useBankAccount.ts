import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import type { BankAccount } from '@/types/wallet';

interface BankAccountListPayload {
  data?: BankAccount[];
  bankAccounts?: BankAccount[];
}

interface BankAccountPayload {
  data?: BankAccount;
  bankAccount?: BankAccount;
}

/**
 * useBankAccounts - Get all bank accounts for current user
 */
export function useBankAccounts() {
  return useQuery<BankAccount[]>({
    queryKey: ['wallet', 'bank-accounts'],
    queryFn: async () => {
      const response = await apiClient.get<BankAccountListPayload>('/api/wallet/bank-accounts');
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.bankAccounts || [];
      }
      throw new Error(response.error || 'Failed to fetch bank accounts');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useAddBankAccount - Add a new bank account
 */
export function useAddBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountData: Omit<BankAccount, 'id' | 'userId' | 'createdAt' | 'isVerified' | 'isDefault'>) => {
      const response = await apiClient.post<BankAccountPayload>('/api/wallet/bank-accounts', accountData);
      if (response.success && response.data) {
        const data = response.data;
        const bankAccount = data.data || data.bankAccount;
        if (bankAccount) {
          return bankAccount;
        }
      }
      throw new Error(response.error || 'Failed to add bank account');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bank-accounts'] });
    },
  });
}

/**
 * useRemoveBankAccount - Remove a bank account
 */
export function useRemoveBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiClient.delete(`/api/wallet/bank-accounts/${accountId}`);
      if (response.success) {
        return true;
      }
      throw new Error(response.error || 'Failed to remove bank account');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bank-accounts'] });
    },
  });
}
