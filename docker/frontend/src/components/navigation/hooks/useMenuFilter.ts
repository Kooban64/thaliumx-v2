'use client';

import { useMemo } from 'react';
import type { NavItem } from '@/config/nav/types';
import type { KYCLevel as NavKYCLevel } from '@/config/nav/types';
import { useUserStore } from '@/stores/userStore';
import type { UserProfile } from '@/stores/userStore';
import { useKYCStore } from '@/stores/kycStore';
import { useConfigStore } from '@/stores/configStore';
import { useRBACStore } from '@/stores/rbacStore';
import { isFeatureEnabled } from '@/lib/config';

/**
 * useMenuFilter - Hook to filter navigation items based on user context
 * Filters by role, KYC level, permissions, and feature flags
 */
export function useMenuFilter() {
  const { profile } = useUserStore();
  const { level: kycLevel } = useKYCStore();
  const { features } = useConfigStore();
  const rbacStore = useRBACStore();

  const filterItems = useMemo(
    () => (items: NavItem[]): NavItem[] => {
      const filtered: NavItem[] = [];
      
      for (const item of items) {
        // Check if item should be visible
        if (!shouldShowItem(item, profile, kycLevel, features, rbacStore)) {
          continue;
        }

        // Filter children recursively
        const filteredChildren = item.children
          ? filterItems(item.children)
          : undefined;

        // Add item with filtered children
        filtered.push({
          ...item,
          children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
        });
      }
      
      return filtered;
    },
    [profile, kycLevel, features, rbacStore]
  );

  return { filterItems };
}

/**
 * Check if a navigation item should be shown
 */
function shouldShowItem(
  item: NavItem,
  profile: UserProfile | null,
  kycLevel: string | null,
  _features: Record<string, boolean>,
  rbacStore: ReturnType<typeof useRBACStore.getState>
): boolean {
  // Check if disabled
  if (item.disabled) {
    return false;
  }

  // Check role requirements
  if (item.roles && item.roles.length > 0) {
    const userRole = profile?.role || rbacStore.userRole;
    if (!userRole || !item.roles.includes(userRole)) {
      return false;
    }
  }

  // Check KYC level requirements
  if (item.kycLevels && item.kycLevels.length > 0) {
    const typedKycLevel = kycLevel as NavKYCLevel | null;
    if (!typedKycLevel || !item.kycLevels.includes(typedKycLevel)) {
      return false;
    }
  }

  // Check feature flags
  if (item.featureFlag) {
    if (!isFeatureEnabled(item.featureFlag as Parameters<typeof isFeatureEnabled>[0])) {
      return false;
    }
  }

  // Check permissions (handle gracefully if RBAC not initialized)
  if (item.permissions && item.permissions.length > 0) {
    try {
      const hasRequiredPermission = item.permissions.some((permission) =>
        rbacStore.checkPermission(permission)
      );
      if (!hasRequiredPermission) {
        return false;
      }
    } catch {
      // If permission check fails (RBAC not initialized), allow item if no role requirement
      // This prevents menu from being empty during initialization
      if (item.roles && item.roles.length > 0) {
        return false; // Has role requirement, so hide if permission check fails
      }
      // No role requirement, allow item (will be filtered by role check above if needed)
    }
  }

  return true;
}
