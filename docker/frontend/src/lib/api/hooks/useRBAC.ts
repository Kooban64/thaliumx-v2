import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useRBACStore } from '@/stores/rbacStore';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface UserRole {
  userId: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  assignedAt: string;
}

interface RolesPayload {
  data?: Role[];
  roles?: Role[];
}

interface UserRolesPayload {
  data?: UserRole[];
  roles?: UserRole[];
}

interface PermissionsPayload {
  data?: string[];
  permissions?: string[];
}

/**
 * useRoles - Get all roles
 */
export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['rbac', 'roles'],
    queryFn: async () => {
      const response = await apiClient.get<RolesPayload>('/api/rbac/roles');
      if (response.success && response.data) {
        return response.data.data || response.data.roles || [];
      }
      throw new Error('Failed to fetch roles');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * useUserRoles - Get user roles
 */
export function useUserRoles(userId?: string) {
  return useQuery<UserRole[]>({
    queryKey: ['rbac', 'user-roles', userId],
    queryFn: async () => {
      const targetUserId = userId || 'current';
      const response = await apiClient.get<UserRolesPayload>(`/api/rbac/user-roles/${targetUserId}`);
      if (response.success && response.data) {
        return response.data.data || response.data.roles || [];
      }
      throw new Error('Failed to fetch user roles');
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * useAssignRole - Assign role to user
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const response = await apiClient.post('/api/rbac/assign-role', { userId, roleId });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to assign role');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'user-roles', variables.userId] });
      // Refresh user roles after assignment
      queryClient.invalidateQueries({ queryKey: ['rbac', 'user-roles'] });
    },
  });
}

/**
 * useUserPermissions - Get user permissions
 */
export function useUserPermissions(userId?: string) {
  return useQuery<string[]>({
    queryKey: ['rbac', 'user-permissions', userId],
    queryFn: async () => {
      const targetUserId = userId || 'current';
      const response = await apiClient.get<PermissionsPayload>(`/api/rbac/user-permissions/${targetUserId}`);
      if (response.success && response.data) {
        const permissions = response.data.data || response.data.permissions || [];
        // Update store
        useRBACStore.getState().setPermissions(permissions);
        return permissions;
      }
      throw new Error('Failed to fetch user permissions');
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
