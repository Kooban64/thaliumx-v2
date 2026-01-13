import {
  Home,
  BarChart3,
  Wallet,
  DollarSign,
  TrendingUp,
  Activity,
  FileText,
  LineChart,
  Settings,
  HelpCircle,
  Zap,
} from 'lucide-react';
import type { NavigationConfig } from './types';

/**
 * User Dashboard Navigation Configuration
 * Based on PLATFORM_FEATURES_AND_MENU_STRUCTURE.md
 */
export const userNavConfig: NavigationConfig = {
  items: [
    {
      id: 'home',
      label: 'Home',
      href: '/',
      icon: Home,
    },
    {
      id: 'trading',
      label: 'Trading',
      href: '/dashboard/trading',
      icon: BarChart3,
      featureFlag: 'trading',
      children: [
        {
          id: 'trading-spot',
          label: 'Spot Trading',
          href: '/dashboard/trading',
          description: 'Buy and sell cryptocurrencies',
          kycLevels: ['L1', 'L2', 'L3', 'INSTITUTIONAL'],
        },
        {
          id: 'trading-advanced',
          label: 'Advanced Trading',
          href: '/dashboard/trading/advanced',
          description: 'Margin, futures, options',
          kycLevels: ['L2', 'L3', 'INSTITUTIONAL'],
        },
        {
          id: 'trading-cex',
          label: 'Native CEX',
          href: '/dashboard/trading/cex',
          description: 'Platform exchange',
          kycLevels: ['L1', 'L2', 'L3', 'INSTITUTIONAL'],
        },
        {
          id: 'trading-omni',
          label: 'Omni-Exchange',
          href: '/dashboard/trading/omni',
          description: 'Multi-exchange aggregator',
          kycLevels: ['L1', 'L2', 'L3', 'INSTITUTIONAL'],
          featureFlag: 'omniExchange',
        },
        {
          id: 'trading-dex',
          label: 'DEX',
          href: '/dashboard/trading/dex',
          description: 'Decentralized exchange',
          kycLevels: ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'],
        },
        {
          id: 'trading-history',
          label: 'Trading History',
          href: '/dashboard/trading/history',
          description: 'View past trades',
        },
      ],
    },
    {
      id: 'wallet',
      label: 'Wallet',
      href: '/dashboard/wallet',
      icon: Wallet,
      children: [
        {
          id: 'wallet-hot',
          label: 'Hot Wallet',
          href: '/dashboard/wallet/hot',
          description: 'Platform wallet',
        },
        {
          id: 'wallet-web3',
          label: 'Web3 Wallet',
          href: '/dashboard/wallet/web3',
          description: 'Connected wallets',
        },
        {
          id: 'wallet-fiat',
          label: 'FIAT Wallet',
          href: '/dashboard/wallet/fiat',
          description: 'Deposit & withdraw',
        },
      ],
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      href: '/dashboard/portfolio',
      icon: DollarSign,
    },
    {
      id: 'presale',
      label: 'Presale',
      href: '/token-presale',
      icon: TrendingUp,
      featureFlag: 'presale',
    },
    {
      id: 'staking',
      label: 'Staking',
      href: '/dashboard/staking',
      icon: Activity,
      featureFlag: 'staking',
    },
    {
      id: 'nft',
      label: 'NFT',
      href: '/dashboard/nft',
      icon: FileText,
      featureFlag: 'nft',
    },
    {
      id: 'dex',
      label: 'DEX',
      href: '/dashboard/dex',
      icon: Zap,
      featureFlag: 'dex',
    },
    {
      id: 'market',
      label: 'Market Data',
      href: '/dashboard/market',
      icon: LineChart,
    },
    {
      id: 'account',
      label: 'Account',
      href: '/dashboard/account',
      icon: Settings,
      children: [
        {
          id: 'account-profile',
          label: 'Profile',
          href: '/dashboard/account/profile',
          description: 'Personal information',
        },
        {
          id: 'account-kyc',
          label: 'KYC Status',
          href: '/dashboard/account/kyc',
          description: 'Verification level',
        },
        {
          id: 'account-limits',
          label: 'Transaction Limits',
          href: '/dashboard/account/limits',
          description: 'View your limits',
        },
        {
          id: 'account-api-keys',
          label: 'API Keys',
          href: '/dashboard/account/api-keys',
          description: 'Manage API access',
          kycLevels: ['L1', 'L2', 'L3', 'INSTITUTIONAL'],
        },
        {
          id: 'account-security',
          label: 'Security',
          href: '/dashboard/account/security',
          description: '2FA, devices, history',
        },
        {
          id: 'account-notifications',
          label: 'Notifications',
          href: '/dashboard/account/notifications',
          description: 'Alert preferences',
        },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      href: '/support',
      icon: HelpCircle,
    },
  ],
};
