'use client';

import { useMemo } from 'react';
import type { NavItem } from '@/config/nav/types';
import { useUserStore } from '@/stores/userStore';
import { useKYCStore } from '@/stores/kycStore';
import { useConfigStore } from '@/stores/configStore';
import { isFeatureEnabled } from '@/lib/config';

/**
 * useMenuFilter - Hook to filter navigation items based on user context
 * Filters by role, KYC level, permissions, and feature flags
 */
export function useMenuFilter() {
  const { profile } = useUserStore();
  const { level: kycLevel } = useKYCStore();
  const { features } = useConfigStore();

  const filterItems = useMemo(
    () => (items: NavItem[]): NavItem[] => {
      const filtered: NavItem[] = [];
      
      for (const item of items) {
        // Check if item should be visible
        if (!shouldShowItem(item, profile, kycLevel, features)) {
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
    [profile, kycLevel, features]
  );

  return { filterItems };
}

/**
 * Check if a navigation item should be shown
 */
function shouldShowItem(
  item: NavItem,
  profile: any,
  kycLevel: string | null,
  _features: Record<string, boolean>
): boolean {
  // Check if disabled
  if (item.disabled) {
    return false;
  }

  // Check role requirements
  if (item.roles && item.roles.length > 0) {
    if (!profile?.role || !item.roles.includes(profile.role)) {
      return false;
    }
  }

  // Check KYC level requirements
  if (item.kycLevels && item.kycLevels.length > 0) {
    if (!kycLevel || !item.kycLevels.includes(kycLevel as any)) {
      return false;
    }
  }

  // Check feature flags
  if (item.featureFlag) {
    if (!isFeatureEnabled(item.featureFlag as any)) {
      return false;
    }
  }

  // Check permissions (if implemented)
  if (item.permissions && item.permissions.length > 0) {
    // TODO: Implement permission checking when permission system is ready
    // For now, allow all items
  }

  return true;
}
