import {
  Home,
  Gauge,
  Users,
  Building2,
  Key,
  Shield,
  Workflow,
  FileText,
  CreditCard,
  AlertTriangle,
  LineChart,
  Activity,
} from 'lucide-react';
import type { NavigationConfig } from './types';

/**
 * Admin Dashboard Navigation Configuration
 * Based on PLATFORM_FEATURES_AND_MENU_STRUCTURE.md
 */
export const adminNavConfig: NavigationConfig = {
  items: [
    {
      id: 'admin-home',
      label: 'Home',
      href: '/admin',
      icon: Home,
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'admin-system',
      label: 'System',
      href: '/admin/system',
      icon: Gauge,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-system-health',
          label: 'System Health',
          href: '/admin/system/health',
          description: 'Service status & metrics',
        },
        {
          id: 'admin-system-info',
          label: 'System Info',
          href: '/admin/system/info',
          description: 'Node.js & OS metrics',
        },
        {
          id: 'admin-system-settings',
          label: 'Settings',
          href: '/admin/system/settings',
          description: 'Platform configuration',
        },
      ],
    },
    {
      id: 'admin-users',
      label: 'Users',
      href: '/admin/users',
      icon: Users,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-users-all',
          label: 'All Users',
          href: '/admin/users',
          description: 'Search & manage users',
        },
        {
          id: 'admin-users-roles',
          label: 'User Roles',
          href: '/admin/users/roles',
          description: 'Role assignment',
        },
        {
          id: 'admin-users-limits',
          label: 'User Limits',
          href: '/admin/users/limits',
          description: 'Transaction limits',
        },
      ],
    },
    {
      id: 'admin-brokers',
      label: 'Brokers',
      href: '/admin/brokers',
      icon: Building2,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-brokers-all',
          label: 'All Brokers',
          href: '/admin/brokers',
          description: 'Broker list & status',
        },
        {
          id: 'admin-brokers-onboard',
          label: 'Broker Onboarding',
          href: '/admin/brokers/onboard',
          description: 'Create new broker',
        },
        {
          id: 'admin-brokers-settings',
          label: 'Broker Settings',
          href: '/admin/brokers/settings',
          description: 'Configuration & limits',
        },
        {
          id: 'admin-brokers-analytics',
          label: 'Broker Analytics',
          href: '/admin/brokers/analytics',
          description: 'Metrics & reports',
        },
      ],
    },
    {
      id: 'admin-rbac',
      label: 'RBAC',
      href: '/admin/rbac',
      icon: Key,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-rbac-roles',
          label: 'Roles',
          href: '/admin/rbac/roles',
          description: 'Platform, broker, user roles',
        },
        {
          id: 'admin-rbac-permissions',
          label: 'Permissions',
          href: '/admin/rbac/permissions',
          description: 'Permission matrix',
        },
        {
          id: 'admin-rbac-assign',
          label: 'Role Assignment',
          href: '/admin/rbac/assign',
          description: 'Assign roles to users',
        },
      ],
    },
    {
      id: 'admin-policies',
      label: 'Policies',
      href: '/admin/policies',
      icon: Shield,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-policies-opa',
          label: 'OPA Policies',
          href: '/admin/policies/opa',
          description: 'AML, security, trading policies',
        },
        {
          id: 'admin-policies-test',
          label: 'Policy Testing',
          href: '/admin/policies/test',
          description: 'Test policy decisions',
        },
        {
          id: 'admin-policies-audit',
          label: 'Policy Audit',
          href: '/admin/policies/audit',
          description: 'Policy change history',
        },
      ],
    },
    {
      id: 'admin-workflows',
      label: 'Workflows',
      href: '/admin/workflows',
      icon: Workflow,
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'admin-compliance',
      label: 'Compliance',
      href: '/admin/compliance',
      icon: FileText,
      roles: ['admin', 'super_admin', 'platform_compliance'],
    },
    {
      id: 'admin-finance',
      label: 'Finance',
      href: '/admin/finance',
      icon: CreditCard,
      roles: ['admin', 'super_admin', 'platform_finance'],
      children: [
        {
          id: 'admin-finance-ledger',
          label: 'Multi-Tier Ledger',
          href: '/admin/finance/ledger',
          description: 'Platform, broker, user accounts',
        },
        {
          id: 'admin-finance-reconciliation',
          label: 'Fund Reconciliation',
          href: '/admin/finance/reconciliation',
          description: 'Reconciliation jobs',
        },
        {
          id: 'admin-finance-treasury',
          label: 'Treasury Management',
          href: '/admin/finance/treasury',
          description: 'Platform treasury',
        },
        {
          id: 'admin-finance-reports',
          label: 'Financial Reports',
          href: '/admin/finance/reports',
          description: 'Transaction & revenue reports',
        },
      ],
    },
    {
      id: 'admin-security',
      label: 'Security',
      href: '/admin/security',
      icon: AlertTriangle,
      roles: ['admin', 'super_admin', 'platform_security'],
      children: [
        {
          id: 'admin-security-oversight',
          label: 'Security Oversight',
          href: '/admin/security/oversight',
          description: 'Threat detection & events',
        },
        {
          id: 'admin-security-devices',
          label: 'Device Fingerprinting',
          href: '/admin/security/devices',
          description: 'Device management',
        },
        {
          id: 'admin-security-risk',
          label: 'Risk Management',
          href: '/admin/security/risk',
          description: 'Risk scoring & policies',
        },
      ],
    },
    {
      id: 'admin-analytics',
      label: 'Analytics',
      href: '/admin/analytics',
      icon: LineChart,
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'admin-limits',
      label: 'Limits',
      href: '/admin/limits',
      icon: Activity,
      roles: ['admin', 'super_admin'],
      children: [
        {
          id: 'admin-limits-kyc',
          label: 'KYC Level Limits',
          href: '/admin/limits/kyc',
          description: 'Configure default limits by KYC level',
        },
        {
          id: 'admin-limits-roles',
          label: 'Role-Based Limits',
          href: '/admin/limits/roles',
          description: 'Platform, broker, user role limits',
        },
        {
          id: 'admin-limits-overrides',
          label: 'User Overrides',
          href: '/admin/limits/overrides',
          description: 'User-specific limit overrides',
        },
        {
          id: 'admin-limits-history',
          label: 'Limit History',
          href: '/admin/limits/history',
          description: 'Limit changes & audit trail',
        },
      ],
    },
  ],
};
