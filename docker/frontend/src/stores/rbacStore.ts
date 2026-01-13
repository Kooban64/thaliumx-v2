import { create } from 'zustand';
import { useKYCStore } from './kycStore';
import { useConfigStore } from './configStore';
import { getPermissionsForRole } from '@/lib/rbac/permissions';
import { hasRole, hasPermission, hasKYCLevel, hasFeature, canAccess } from '@/lib/rbac/utils';
import type { AccessCheckOptions } from '@/lib/rbac/utils';
import type { KYCLevel } from './kycStore';
import { logApiError } from '@/lib/services/errorLogger';

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
      // TODO: Implement API call to fetch user roles
      // const response = await apiClient.get('/api/rbac/user-roles');
      // set({ userRoles: response.data.roles, userRole: response.data.primaryRole });
    } catch {
      logApiError(error, '/api/rbac/user-roles', 'GET', undefined, { component: 'rbacStore', action: 'fetchUserRoles' });
    }
  },

  fetchPermissions: async () => {
    try {
      // TODO: Implement API call to fetch user permissions
      // const response = await apiClient.get('/api/rbac/user-permissions');
      // set({ permissions: response.data.permissions });
    } catch {
      logApiError(error, '/api/rbac/user-permissions', 'GET', undefined, { component: 'rbacStore', action: 'fetchPermissions' });
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
