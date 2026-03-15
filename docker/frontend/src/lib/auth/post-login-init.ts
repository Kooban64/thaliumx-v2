'use client';

import { getAuthToken } from './backend-auth';
import { useUserStore } from '@/stores/userStore';
import type { UserProfile } from '@/stores/userStore';
import { useRBACStore } from '@/stores/rbacStore';
import { useKYCStore, type KYCLevel } from '@/stores/kycStore';
import { useConfigStore } from '@/stores/configStore';
import apiClient from '@/lib/api/client';
import { logApiError } from '@/lib/services/errorLogger';

type ProfileResponse = {
  user?: Partial<UserProfile>;
} & Partial<UserProfile>;

type FeatureFlagsPayload = Record<string, boolean>;

const VALID_KYC_LEVELS: readonly KYCLevel[] = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'] as const;
const VALID_KYC_STATUSES = ['pending', 'approved', 'rejected', 'in_review'] as const;
type KYCStatus = (typeof VALID_KYC_STATUSES)[number];

function toUserProfile(payload: ProfileResponse): UserProfile | null {
  const raw = payload.user ?? payload;

  if (!raw || typeof raw !== 'object' || !raw.id || !raw.email) {
    return null;
  }

  return {
    ...(raw as UserProfile),
    id: String(raw.id),
    email: String(raw.email),
    role: typeof raw.role === 'string' && raw.role.length > 0 ? raw.role : 'user',
  };
}

/**
 * Post-Login Initialization Service
 * 
 * Initializes all stores after successful login:
 * - User profile in userStore
 * - Roles and permissions in rbacStore
 * - KYC level in kycStore
 * - Features in configStore
 * 
 * Returns user profile for immediate use in redirect logic
 */
export async function initializePostLogin(): Promise<UserProfile | null> {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('No token available for post-login initialization');
      return null;
    }

    // Fetch user profile
    const profileResponse = await apiClient.get<ProfileResponse>('/api/auth/profile');
    if (!profileResponse.success || !profileResponse.data) {
      console.warn('Failed to fetch user profile');
      return null;
    }

    const user = toUserProfile(profileResponse.data);
    if (!user) {
      console.warn('No user data in profile response');
      return null;
    }

    // Store user profile in userStore
    useUserStore.getState().setProfile(user);

    // Initialize RBAC store
    try {
      if (user.id) {
        await useRBACStore.getState().fetchUserRoles();
        await useRBACStore.getState().fetchPermissions();
        
        // Also set role directly from profile if RBAC fetch fails
        const rbacState = useRBACStore.getState();
        if (!rbacState.userRole && user.role) {
          rbacState.setUserRole(user.role);
        }
      }
    } catch (rbacError) {
      // Fallback: set role from profile
      if (user.role) {
        useRBACStore.getState().setUserRole(user.role);
      }
      logApiError(rbacError, '/api/rbac', 'POST_LOGIN_INIT');
    }

    // Initialize KYC store
    try {
      if (user.kycLevel && VALID_KYC_LEVELS.includes(user.kycLevel as KYCLevel)) {
        useKYCStore.getState().setLevel(user.kycLevel as KYCLevel);
      }
      if (user.kycStatus && VALID_KYC_STATUSES.includes(user.kycStatus as KYCStatus)) {
        useKYCStore.getState().setStatus(user.kycStatus as KYCStatus);
      }
    } catch (kycError) {
      logApiError(kycError, '/api/kyc', 'POST_LOGIN_INIT');
    }

    // Initialize config store (features)
    try {
      const configResponse = await apiClient.get<FeatureFlagsPayload>('/api/config/features');
      if (configResponse.success && configResponse.data) {
        useConfigStore.getState().setFeatures(configResponse.data);
      }
    } catch (configError) {
      // Config fetch is optional, just log
      logApiError(configError, '/api/config/features', 'POST_LOGIN_INIT');
    }

    return user;
  } catch (error) {
    logApiError(error, '/api/auth/profile', 'POST_LOGIN_INIT');
    return null;
  }
}
