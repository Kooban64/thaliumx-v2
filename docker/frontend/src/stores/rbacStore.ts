import { create } from 'zustand';
import { useKYCStore } from './kycStore';
import { useConfigStore } from './configStore';
import { useAuthStore } from './authStore';
import { getPermissionsForRole } from '@/lib/rbac/permissions';
import { hasRole, hasPermission, hasKYCLevel, hasFeature, canAccess } from '@/lib/rbac/utils';
import type { AccessCheckOptions } from '@/lib/rbac/utils';
import type { KYCLevel } from './kycStore';
import { logApiError } from '@/lib/services/errorLogger';
import apiClient from '@/lib/api/client';

interface RBACState {
  // User roles and permissions
  userRole: string | null;
  userRoles: string[];
  permissions: string[];
  
  // Actions
  setUserRole: (role: string | null) => void;
  setUserRoles: (roles: string[]) => void;
  setPermissions: (permissions: string[]) => void;
  
  // Permission checking
  checkRole: (requiredRoles: string | string[]) => boolean;
  checkPermission: (permission: string) => boolean;
  checkKYCLevel: (requiredLevel: KYCLevel) => boolean;
  checkFeature: (featureName: string) => boolean;
  checkAccess: (options: AccessCheckOptions) => boolean;
  
  // Fetch methods (to be implemented with API)
  fetchUserRoles: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  
  // Clear state
  clear: () => void;
}

/**
 * RBAC Store - Manages role-based access control state
 * Integrates with auth, KYC, and config stores
 */
export const useRBACStore = create<RBACState>((set, get) => ({
  userRole: null,
  userRoles: [],
  permissions: [],

  setUserRole: (role) => {
    set({ userRole: role });
    // Auto-update permissions when role changes
    if (role) {
      const rolePermissions = getPermissionsForRole(role);
      set({ permissions: rolePermissions });
    }
  },

  setUserRoles: (roles) => set({ userRoles: roles }),

  setPermissions: (permissions) => set({ permissions }),

  checkRole: (requiredRoles) => {
    const { userRole } = get();
    return hasRole(userRole, requiredRoles);
  },

  checkPermission: (permission) => {
    const { userRole, permissions } = get();
    return hasPermission(userRole, permissions, permission);
  },

  checkKYCLevel: (requiredLevel) => {
    const kycLevel = useKYCStore.getState().level;
    return hasKYCLevel(kycLevel, requiredLevel);
  },

  checkFeature: (featureName) => {
    const features = useConfigStore.getState().features;
    return hasFeature(features, featureName);
  },

  checkAccess: (options) => {
    const { userRole, permissions } = get();
    const kycLevel = useKYCStore.getState().level;
    const features = useConfigStore.getState().features;
    
    return canAccess(userRole, permissions, kycLevel, features, options);
  },

  fetchUserRoles: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user || !user.id) {
        console.warn('Cannot fetch user roles: user not authenticated');
        return;
      }

      const response = await apiClient.get(`/api/rbac/users/${user.id}/roles`);

      if (response.success && response.data) {
        const data = response.data as any;
        const userRoles = Array.isArray(data) ? data : data.roles || [];
        const roleNames = userRoles.map((ur: any) => ur.roleName || ur.roleId);
        const primaryRole = roleNames[0] || null;

        set({ 
          userRoles: roleNames,
          userRole: primaryRole 
        });
      }
    } catch (error) {
      logApiError(error, '/api/rbac/users/:userId/roles', 'GET', undefined, { component: 'rbacStore', action: 'fetchUserRoles' });
    }
  },

  fetchPermissions: async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user || !user.id) {
        console.warn('Cannot fetch user permissions: user not authenticated');
        return;
      }

      const response = await apiClient.get(`/api/rbac/users/${user.id}/permissions`);

      if (response.success && response.data) {
        const data = response.data as any;
        const permissions = data.permissions || [];
        set({ permissions });
      }
    } catch (error) {
      logApiError(error, '/api/rbac/users/:userId/permissions', 'GET', undefined, { component: 'rbacStore', action: 'fetchPermissions' });
    }
  },

  clear: () => {
    set({
      userRole: null,
      userRoles: [],
      permissions: [],
    });
  },
}));
