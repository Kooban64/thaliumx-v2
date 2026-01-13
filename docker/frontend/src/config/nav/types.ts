import { LucideIcon } from 'lucide-react';

/**
 * Navigation Configuration Types
 * Defines the structure for navigation menu items
 */

export type KYCLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'INSTITUTIONAL';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  badge?: string | number;
  description?: string;
  children?: NavItem[];
  roles?: string[];
  kycLevels?: KYCLevel[];
  permissions?: string[];
  featureFlag?: string;
  external?: boolean;
  disabled?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  roles?: string[];
  collapsed?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

export interface NavigationConfig {
  items: NavItem[];
  groups?: NavGroup[];
}
