import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

// Types for limit management
export interface KYCLimits {
  maxInvestment?: number;
  maxTrading?: number;
  maxWithdrawal?: number;
  maxDeposit?: number;
  maxDailyTransactions?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface RoleLimits {
  maxDailyVolume?: number;
  maxMonthlyVolume?: number;
  maxSingleTransaction?: number;
  maxWithdrawalDaily?: number;
  maxWithdrawalMonthly?: number;
  maxDepositDaily?: number;
  maxDepositMonthly?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface UserOverride {
  id: string;
  userId: string;
  type: 'temporary' | 'permanent';
  limits: KYCLimits;
  expiresAt?: string;
  reason: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LimitChange {
  id: string;
  type: 'kyc' | 'role' | 'user_override';
  target: string; // KYC level, role, or userId
  changes: Record<string, { before: unknown; after: unknown }>;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

/**
 * useKYCLimits - Fetch KYC level limits
 */
export function useKYCLimits(level?: string) {
  return useQuery({
    queryKey: ['limits', 'kyc', level],
    queryFn: async () => {
      const endpoint = level 
        ? `/api/admin/limits/kyc/${level}`
        : '/api/admin/limits/kyc';
      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        return response.data as Record<string, KYCLimits>;
      }
      throw new Error('Failed to fetch KYC limits');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateKYCLimits - Update KYC level limits
 */
export function useUpdateKYCLimits() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ level, limits }: { level: string; limits: KYCLimits }) => {
      const response = await apiClient.put(`/api/admin/limits/kyc/${level}`, limits);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update KYC limits');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limits', 'kyc'] });
    },
  });
}

/**
 * useRoleLimits - Fetch role-based limits
 */
export function useRoleLimits(role?: string) {
  return useQuery({
    queryKey: ['limits', 'roles', role],
    queryFn: async () => {
      const endpoint = role
        ? `/api/admin/limits/roles/${role}`
        : '/api/admin/limits/roles';
      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        return response.data as Record<string, RoleLimits>;
      }
      throw new Error('Failed to fetch role limits');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUpdateRoleLimits - Update role-based limits
 */
export function useUpdateRoleLimits() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ role, limits }: { role: string; limits: RoleLimits }) => {
      const response = await apiClient.put(`/api/admin/limits/roles/${role}`, limits);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update role limits');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limits', 'roles'] });
    },
  });
}

/**
 * useUserOverrides - Fetch user-specific limit overrides
 */
export function useUserOverrides(userId: string) {
  return useQuery({
    queryKey: ['limits', 'users', userId, 'overrides'],
    queryFn: async () => {
      const response = await apiClient.get(`/api/admin/limits/users/${userId}`);
      if (response.success && response.data) {
        return response.data as UserOverride[];
      }
      throw new Error('Failed to fetch user overrides');
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * useCreateUserOverride - Create user limit override
 */
export function useCreateUserOverride() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, override }: { userId: string; override: Omit<UserOverride, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const response = await apiClient.post(`/api/admin/limits/users/${userId}/override`, override);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to create user override');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['limits', 'users', variables.userId] });
    },
  });
}

/**
 * useDeleteUserOverride - Delete user limit override
 */
export function useDeleteUserOverride() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, overrideId }: { userId: string; overrideId: string }) => {
      const response = await apiClient.delete(`/api/admin/limits/users/${userId}/override/${overrideId}`);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to delete user override');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['limits', 'users', variables.userId] });
    },
  });
}

/**
 * useLimitHistory - Fetch limit change history
 */
export function useLimitHistory(params?: { 
  type?: 'kyc' | 'role' | 'user_override';
  target?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['limits', 'history', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.target) queryParams.append('target', params.target);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const response = await apiClient.get(`/api/admin/limits/history?${queryParams.toString()}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return {
          data: data.data || data || [],
          pagination: data.pagination,
        };
      }
      throw new Error('Failed to fetch limit history');
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * useValidateLimits - Validate limit changes
 */
export function useValidateLimits() {
  return useMutation({
    mutationFn: async (limits: { type: 'kyc' | 'role'; target: string; limits: KYCLimits | RoleLimits }) => {
      const response = await apiClient.post('/api/admin/limits/validate', limits);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Limit validation failed');
    },
  });
}
