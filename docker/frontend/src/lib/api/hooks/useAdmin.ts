import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

export interface AdminUser {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  kycLevel?: string;
  kycStatus?: string;
  isActive?: boolean;
  status?: string;
  tenantId?: string;
  brokerId?: string;
  createdAt?: string;
  lastLogin?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  notificationsEnabled?: boolean;
  preferences?: Record<string, unknown>;
}

export interface AdminBroker {
  id: string;
  brokerId?: string;
  name?: string;
  brokerName?: string;
  email?: string;
  contactPerson?: string;
  status?: string;
  createdAt?: string;
  userCount?: number;
  activeUserCount?: number;
  transactionCount?: number;
  totalVolume?: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action?: string;
  category?: string;
  timestamp?: string;
  createdAt?: string;
  resource?: string;
  status?: 'success' | 'error' | 'pending' | string;
  changes?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

interface ListPayload<T> {
  data?: T[];
  users?: T[];
  brokers?: T[];
  logs?: T[];
}

/**
 * useAdminDashboard - Get admin dashboard data
 */
export function useAdminDashboard() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.get<Record<string, unknown>>('/api/admin/dashboard');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch admin dashboard data');
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * useSystemHealth - Get system health status
 */
export function useSystemHealth() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['admin', 'system', 'health'],
    queryFn: async () => {
      const response = await apiClient.get<Record<string, unknown>>('/api/admin/health');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch system health');
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

/**
 * useSystemInfo - Get system information
 */
export function useSystemInfo() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['admin', 'system', 'info'],
    queryFn: async () => {
      const response = await apiClient.get<Record<string, unknown>>('/api/admin/system/info');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch system info');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useUsers - Get all users (admin)
 */
export function useUsers(filters?: { role?: string; kycLevel?: string; search?: string }) {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.kycLevel) params.append('kycLevel', filters.kycLevel);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await apiClient.get<ListPayload<AdminUser>>(`/api/admin/users?${params.toString()}`);
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.users || [];
      }
      throw new Error(response.error || 'Failed to fetch users');
    },
    staleTime: 30 * 1000,
  });
}

/**
 * useUser - Get specific user (admin)
 */
export function useUser(userId: string) {
  return useQuery<AdminUser | null>({
    queryKey: ['admin', 'users', userId],
    queryFn: async () => {
      const response = await apiClient.get<{ data?: AdminUser; user?: AdminUser }>(`/api/admin/users/${userId}`);
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.user || null;
      }
      throw new Error(response.error || 'Failed to fetch user');
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * useUserLimits - Get user limits (admin)
 */
export function useUserLimits(userId: string) {
  return useQuery<Record<string, unknown> | null>({
    queryKey: ['admin', 'users', userId, 'limits'],
    queryFn: async () => {
      const response = await apiClient.get<{ data?: Record<string, unknown>; limits?: Record<string, unknown> }>(`/api/admin/user-limits/${userId}`);
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.limits || null;
      }
      throw new Error(response.error || 'Failed to fetch user limits');
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * useUpdateUserLimits - Update user limits (admin)
 */
export function useUpdateUserLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, limits }: { userId: string; limits: unknown }) => {
      const response = await apiClient.put(`/api/admin/user-limits/${userId}`, limits);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update user limits');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.userId, 'limits'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.userId] });
    },
  });
}

/**
 * useBrokers - Get all brokers (admin)
 */
export function useBrokers() {
  return useQuery<AdminBroker[]>({
    queryKey: ['admin', 'brokers'],
    queryFn: async () => {
      const response = await apiClient.get<ListPayload<AdminBroker>>('/api/admin/brokers');
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.brokers || [];
      }
      throw new Error(response.error || 'Failed to fetch brokers');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useBroker - Get specific broker (admin)
 */
export function useBroker(brokerId: string) {
  return useQuery<AdminBroker | null>({
    queryKey: ['admin', 'brokers', brokerId],
    queryFn: async () => {
      const response = await apiClient.get<{ data?: AdminBroker; broker?: AdminBroker }>(`/api/admin/brokers/${brokerId}`);
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.broker || null;
      }
      throw new Error(response.error || 'Failed to fetch broker');
    },
    enabled: !!brokerId,
    staleTime: 60 * 1000,
  });
}

/**
 * useAuditLogs - Get audit logs (admin)
 */
export function useAuditLogs(filters?: { 
  userId?: string; 
  action?: string; 
  startDate?: string; 
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<AuditLog[]>({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      const response = await apiClient.get<ListPayload<AuditLog>>(`/api/admin/audit-logs?${params.toString()}`);
      if (response.success && response.data) {
        const data = response.data;
        return data.data || data.logs || [];
      }
      throw new Error(response.error || 'Failed to fetch audit logs');
    },
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * useAdminAssignRole - Assign role to user (admin) - Admin-specific version
 */
export function useAdminAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiClient.post('/api/rbac/assign-role', { userId, role });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to assign role');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}
