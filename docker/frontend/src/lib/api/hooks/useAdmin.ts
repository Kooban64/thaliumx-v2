import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

/**
 * useAdminDashboard - Get admin dashboard data
 */
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/dashboard');
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
  return useQuery({
    queryKey: ['admin', 'system', 'health'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/health');
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
  return useQuery({
    queryKey: ['admin', 'system', 'info'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/system/info');
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
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.kycLevel) params.append('kycLevel', filters.kycLevel);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await apiClient.get(`/api/admin/users?${params.toString()}`);
      if (response.success && response.data) {
        const data = response.data as any;
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
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/admin/users/${userId}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.user;
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
  return useQuery({
    queryKey: ['admin', 'users', userId, 'limits'],
    queryFn: async () => {
      const response = await apiClient.get(`/api/admin/user-limits/${userId}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.limits;
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
    mutationFn: async ({ userId, limits }: { userId: string; limits: any }) => {
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
  return useQuery({
    queryKey: ['admin', 'brokers'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/brokers');
      if (response.success && response.data) {
        const data = response.data as any;
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
  return useQuery({
    queryKey: ['admin', 'brokers', brokerId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/admin/brokers/${brokerId}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.broker;
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
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      const response = await apiClient.get(`/api/admin/audit-logs?${params.toString()}`);
      if (response.success && response.data) {
        const data = response.data as any;
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
