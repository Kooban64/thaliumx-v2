import {
  Home,
  Users,
  BarChart3,
  CreditCard,
  Shield,
  Settings,
  LineChart,
} from 'lucide-react';
import type { NavigationConfig } from './types';

/**
 * Broker Dashboard Navigation Configuration
 * Based on PLATFORM_FEATURES_AND_MENU_STRUCTURE.md
 */
export const brokerNavConfig: NavigationConfig = {
  items: [
    {
      id: 'broker-home',
      label: 'Home',
      href: '/broker',
      icon: Home,
      roles: ['broker_admin', 'broker_compliance', 'broker_finance', 'broker_operations'],
    },
    {
      id: 'broker-users',
      label: 'Users',
      href: '/broker/users',
      icon: Users,
      roles: ['broker_admin', 'broker_compliance'],
      children: [
        {
          id: 'broker-users-all',
          label: 'Broker Users',
          href: '/broker/users',
          description: 'User list & details',
        },
        {
          id: 'broker-users-kyc',
          label: 'KYC Management',
          href: '/broker/users/kyc',
          description: 'Pending reviews & approvals',
        },
        {
          id: 'broker-users-limits',
          label: 'User Limits',
          href: '/broker/users/limits',
          description: 'Transaction limits & access',
        },
      ],
    },
    {
      id: 'broker-trading',
      label: 'Trading',
      href: '/broker/trading',
      icon: BarChart3,
      roles: ['broker_admin', 'broker_trading'],
      children: [
        {
          id: 'broker-trading-orders',
          label: 'Order Management',
          href: '/broker/trading/orders',
          description: 'Active orders & history',
        },
        {
          id: 'broker-trading-market',
          label: 'Market Data',
          href: '/broker/trading/market',
          description: 'Trading pairs & analytics',
        },
        {
          id: 'broker-trading-config',
          label: 'Trading Configuration',
          href: '/broker/trading/config',
          description: 'Trading pairs & rules',
        },
      ],
    },
    {
      id: 'broker-finance',
      label: 'Finance',
      href: '/broker/finance',
      icon: CreditCard,
      roles: ['broker_admin', 'broker_finance'],
      children: [
        {
          id: 'broker-finance-ledger',
          label: 'Broker Ledger',
          href: '/broker/finance/ledger',
          description: 'Account balances',
        },
        {
          id: 'broker-finance-reconciliation',
          label: 'Fund Reconciliation',
          href: '/broker/finance/reconciliation',
          description: 'Reconciliation reports',
        },
        {
          id: 'broker-finance-reports',
          label: 'Financial Reports',
          href: '/broker/finance/reports',
          description: 'Revenue & transaction reports',
        },
      ],
    },
    {
      id: 'broker-compliance',
      label: 'Compliance',
      href: '/broker/compliance',
      icon: Shield,
      roles: ['broker_admin', 'broker_compliance'],
      children: [
        {
          id: 'broker-compliance-dashboard',
          label: 'Compliance Dashboard',
          href: '/broker/compliance',
          description: 'KYC status & risk assessment',
        },
        {
          id: 'broker-compliance-monitoring',
          label: 'Transaction Monitoring',
          href: '/broker/compliance/monitoring',
          description: 'Suspicious transactions',
        },
        {
          id: 'broker-compliance-audit',
          label: 'Audit Logs',
          href: '/broker/compliance/audit',
          description: 'Broker events',
        },
      ],
    },
    {
      id: 'broker-settings',
      label: 'Settings',
      href: '/broker/settings',
      icon: Settings,
      roles: ['broker_admin'],
      children: [
        {
          id: 'broker-settings-config',
          label: 'Configuration',
          href: '/broker/settings/config',
          description: 'Broker details & features',
        },
        {
          id: 'broker-settings-branding',
          label: 'Branding',
          href: '/broker/settings/branding',
          description: 'Logo & colors',
        },
        {
          id: 'broker-settings-limits',
          label: 'Limits & Controls',
          href: '/broker/settings/limits',
          description: 'Transaction limits',
        },
      ],
    },
    {
      id: 'broker-analytics',
      label: 'Analytics',
      href: '/broker/analytics',
      icon: LineChart,
      roles: ['broker_admin', 'broker_operations'],
    },
  ],
};
