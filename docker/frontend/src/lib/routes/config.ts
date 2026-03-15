/**
 * Route Configuration
 * Centralized route definitions for the application
 */

export const routes = {
  public: {
    home: '/',
    login: '/login',
    register: '/register',
    landing: '/landing',
  },
  dashboard: {
    home: '/dashboard',
    trading: '/dashboard/trading',
    tradingAdvanced: '/dashboard/trading/advanced',
    tradingCEX: '/dashboard/trading/cex',
    tradingOmni: '/dashboard/trading/omni',
    tradingDEX: '/dashboard/trading/dex',
    tradingHistory: '/dashboard/trading/history',
    wallet: '/dashboard/wallet',
    walletHot: '/dashboard/wallet/hot',
    walletWeb3: '/dashboard/wallet/web3',
    walletFiat: '/dashboard/wallet/fiat',
    portfolio: '/dashboard/portfolio',
    staking: '/dashboard/staking',
    nft: '/dashboard/nft',
    dex: '/dashboard/dex',
    market: '/dashboard/market',
    account: '/dashboard/account',
    accountProfile: '/dashboard/account/profile',
    accountKYC: '/dashboard/account/kyc',
    accountLimits: '/dashboard/account/limits',
    accountAPIKeys: '/dashboard/account/api-keys',
    accountSecurity: '/dashboard/account/security',
    accountNotifications: '/dashboard/account/notifications',
  },
  admin: {
    home: '/admin',
    system: '/admin/system',
    systemHealth: '/admin/system/health',
    systemInfo: '/admin/system/info',
    systemSettings: '/admin/system/settings',
    users: '/admin/users',
    usersRoles: '/admin/users/roles',
    usersLimits: '/admin/users/limits',
    brokers: '/admin/brokers',
    brokersOnboard: '/admin/brokers/onboard',
    brokersSettings: '/admin/brokers/settings',
    brokersAnalytics: '/admin/brokers/analytics',
    rbac: '/admin/rbac',
    rbacRoles: '/admin/rbac/roles',
    rbacPermissions: '/admin/rbac/permissions',
    rbacAssign: '/admin/rbac/assign',
    policies: '/admin/policies',
    policiesOPA: '/admin/policies/opa',
    policiesTest: '/admin/policies/test',
    policiesAudit: '/admin/policies/audit',
    workflows: '/admin/workflows',
    compliance: '/admin/compliance',
    finance: '/admin/finance',
    financeLedger: '/admin/finance/ledger',
    financeReconciliation: '/admin/finance/reconciliation',
    financeTreasury: '/admin/finance/treasury',
    financeReports: '/admin/finance/reports',
    security: '/admin/security',
    securityOversight: '/admin/security/oversight',
    securityDevices: '/admin/security/devices',
    securityRisk: '/admin/security/risk',
    analytics: '/admin/analytics',
    limits: '/admin/limits',
    limitsKYC: '/admin/limits/kyc',
    limitsRoles: '/admin/limits/roles',
    limitsOverrides: '/admin/limits/overrides',
    limitsHistory: '/admin/limits/history',
  },
  broker: {
    home: '/broker',
    users: '/broker/users',
    usersKYC: '/broker/users/kyc',
    usersLimits: '/broker/users/limits',
    trading: '/broker/trading',
    tradingOrders: '/broker/trading/orders',
    tradingMarket: '/broker/trading/market',
    tradingConfig: '/broker/trading/config',
    finance: '/broker/finance',
    financeLedger: '/broker/finance/ledger',
    financeReconciliation: '/broker/finance/reconciliation',
    financeReports: '/broker/finance/reports',
    compliance: '/broker/compliance',
    complianceMonitoring: '/broker/compliance/monitoring',
    complianceAudit: '/broker/compliance/audit',
    settings: '/broker/settings',
    settingsConfig: '/broker/settings/config',
    settingsBranding: '/broker/settings/branding',
    settingsLimits: '/broker/settings/limits',
    analytics: '/broker/analytics',
  },
  presale: '/token-presale',
  support: '/support',
} as const;

/**
 * Check if a route requires authentication
 */
export function requiresAuth(path: string): boolean {
  return (
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/broker') ||
    path.startsWith('/account')
  );
}

/**
 * Check if a route requires a specific role
 */
export function requiresRole(path: string, role: string): boolean {
  const normalizedRole = role?.toLowerCase().replace(/-/g, '_');
  if (path.startsWith('/admin')) {
    return (
      normalizedRole === 'admin' ||
      normalizedRole === 'super_admin' ||
      normalizedRole === 'platform_admin' ||
      normalizedRole === 'master_system_admin'
    );
  }
  if (path.startsWith('/broker')) {
    return normalizedRole === 'broker_admin' || normalizedRole?.startsWith('broker_') || false;
  }
  return true;
}

/**
 * Get redirect path based on user role
 */
export function getRedirectPath(role?: string): string {
  const normalizedRole = role?.toLowerCase().replace(/-/g, '_');
  if (
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'master_system_admin'
  ) {
    return routes.admin.home;
  }
  if (normalizedRole === 'broker_admin' || normalizedRole?.startsWith('broker_')) {
    return routes.broker.home;
  }
  return routes.dashboard.home;
}
