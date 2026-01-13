/**
 * Permission System
 * Defines all permissions and role-to-permission mappings
 */

export type Permission = string;

/**
 * Permission Categories
 */
export const PermissionCategories = {
  SYSTEM: 'system',
  USER: 'user',
  TENANT: 'tenant',
  BROKER: 'broker',
  TRADING: 'trading',
  EXCHANGE: 'exchange',
  DEX: 'dex',
  NFT: 'nft',
  TOKEN: 'token',
  FINANCIAL: 'financial',
  KYC: 'kyc',
  COMPLIANCE: 'compliance',
  AUDIT: 'audit',
} as const;

/**
 * System Permissions
 */
export const SystemPermissions = {
  ADMIN_ACCESS: 'system:admin',
  CONFIG_READ: 'system:config:read',
  CONFIG_WRITE: 'system:config:write',
  HEALTH_READ: 'system:health:read',
} as const;

/**
 * User Management Permissions
 */
export const UserPermissions = {
  LIST: 'user:list',
  READ: 'user:read',
  CREATE: 'user:create',
  UPDATE: 'user:update',
  DELETE: 'user:delete',
  ASSIGN_ROLE: 'user:role:assign',
  REMOVE_ROLE: 'user:role:remove',
} as const;

/**
 * Tenant Management Permissions
 */
export const TenantPermissions = {
  LIST: 'tenant:list',
  READ: 'tenant:read',
  CREATE: 'tenant:create',
  UPDATE: 'tenant:update',
  DELETE: 'tenant:delete',
} as const;

/**
 * Broker Management Permissions
 */
export const BrokerPermissions = {
  LIST: 'broker:list',
  READ: 'broker:read',
  CREATE: 'broker:create',
  UPDATE: 'broker:update',
  DELETE: 'broker:delete',
  MANAGE_USERS: 'broker:users:manage',
} as const;

/**
 * Trading Permissions
 */
export const TradingPermissions = {
  ORDER_PLACE: 'trading:order:place',
  ORDER_CANCEL: 'trading:order:cancel',
  ORDER_VIEW: 'trading:order:view',
  ORDER_HISTORY: 'trading:order:history',
  MARGIN_TRADE: 'trading:margin:use',
  LEVERAGE_USE: 'trading:leverage:use',
} as const;

/**
 * Exchange Permissions
 */
export const ExchangePermissions = {
  CEX_ACCESS: 'exchange:cex:access',
  DEX_ACCESS: 'exchange:dex:access',
  OMNI_ACCESS: 'exchange:omni:access',
  MANAGE: 'exchange:manage',
} as const;

/**
 * Financial Permissions
 */
export const FinancialPermissions = {
  DEPOSIT: 'financial:deposit',
  WITHDRAW: 'financial:withdraw',
  TRANSFER: 'financial:transfer',
  VIEW_BALANCE: 'financial:balance:view',
  MANAGE_LEDGER: 'financial:ledger:manage',
} as const;

/**
 * KYC/KYB Permissions
 */
export const KYCPermissions = {
  VIEW: 'kyc:view',
  SUBMIT: 'kyc:submit',
  REVIEW: 'kyc:review',
  APPROVE: 'kyc:approve',
  REJECT: 'kyc:reject',
  MANAGE_LIMITS: 'kyc:limits:manage',
} as const;

/**
 * Compliance Permissions
 */
export const CompliancePermissions = {
  VIEW_REPORTS: 'compliance:reports:view',
  CREATE_REPORT: 'compliance:reports:create',
  MONITOR: 'compliance:monitor',
  SAR_FILE: 'compliance:sar:file',
} as const;

/**
 * Audit Permissions
 */
export const AuditPermissions = {
  VIEW_LOGS: 'audit:logs:view',
  EXPORT_LOGS: 'audit:logs:export',
  VIEW_AUDIT: 'audit:view',
} as const;

/**
 * All Permissions
 */
export const AllPermissions = {
  ...SystemPermissions,
  ...UserPermissions,
  ...TenantPermissions,
  ...BrokerPermissions,
  ...TradingPermissions,
  ...ExchangePermissions,
  ...FinancialPermissions,
  ...KYCPermissions,
  ...CompliancePermissions,
  ...AuditPermissions,
} as const;

/**
 * Role to Permission Mapping
 */
export const RolePermissions: Record<string, Permission[]> = {
  // Platform Roles
  super_admin: Object.values(AllPermissions),
  admin: [
    ...Object.values(SystemPermissions),
    ...Object.values(UserPermissions),
    ...Object.values(TenantPermissions),
    ...Object.values(BrokerPermissions),
    ...Object.values(TradingPermissions),
    ...Object.values(ExchangePermissions),
    ...Object.values(FinancialPermissions),
    ...Object.values(KYCPermissions),
    ...Object.values(CompliancePermissions),
    ...Object.values(AuditPermissions),
  ],
  platform_compliance: [
    ...Object.values(KYCPermissions),
    ...Object.values(CompliancePermissions),
    ...Object.values(AuditPermissions),
    UserPermissions.READ,
  ],
  platform_finance: [
    ...Object.values(FinancialPermissions),
    UserPermissions.READ,
    TradingPermissions.ORDER_VIEW,
  ],
  platform_operations: [
    SystemPermissions.HEALTH_READ,
    SystemPermissions.CONFIG_READ,
    UserPermissions.READ,
  ],
  platform_security: [
    SystemPermissions.HEALTH_READ,
    ...Object.values(AuditPermissions),
    UserPermissions.READ,
  ],
  platform_support: [
    UserPermissions.READ,
    UserPermissions.UPDATE,
    TradingPermissions.ORDER_VIEW,
  ],

  // Broker Roles
  broker_admin: [
    ...Object.values(BrokerPermissions),
    ...Object.values(UserPermissions),
    TradingPermissions.ORDER_VIEW,
    FinancialPermissions.VIEW_BALANCE,
  ],
  broker_compliance: [
    BrokerPermissions.READ,
    ...Object.values(KYCPermissions),
    ...Object.values(CompliancePermissions),
    UserPermissions.READ,
  ],
  broker_finance: [
    BrokerPermissions.READ,
    ...Object.values(FinancialPermissions),
    UserPermissions.READ,
  ],
  broker_operations: [
    BrokerPermissions.READ,
    TradingPermissions.ORDER_VIEW,
    UserPermissions.READ,
  ],
  broker_trading: [
    BrokerPermissions.READ,
    ...Object.values(TradingPermissions),
    UserPermissions.READ,
  ],
  broker_support: [
    BrokerPermissions.READ,
    UserPermissions.READ,
    UserPermissions.UPDATE,
  ],

  // End User Roles
  user: [
    TradingPermissions.ORDER_PLACE,
    TradingPermissions.ORDER_CANCEL,
    TradingPermissions.ORDER_VIEW,
    TradingPermissions.ORDER_HISTORY,
    ExchangePermissions.CEX_ACCESS,
    ExchangePermissions.DEX_ACCESS,
    ExchangePermissions.OMNI_ACCESS,
    FinancialPermissions.DEPOSIT,
    FinancialPermissions.WITHDRAW,
    FinancialPermissions.VIEW_BALANCE,
    KYCPermissions.VIEW,
    KYCPermissions.SUBMIT,
  ],
  user_trader: [
    TradingPermissions.ORDER_PLACE,
    TradingPermissions.ORDER_CANCEL,
    TradingPermissions.ORDER_VIEW,
    TradingPermissions.ORDER_HISTORY,
    TradingPermissions.MARGIN_TRADE,
    TradingPermissions.LEVERAGE_USE,
    ExchangePermissions.CEX_ACCESS,
    ExchangePermissions.DEX_ACCESS,
    ExchangePermissions.OMNI_ACCESS,
    FinancialPermissions.DEPOSIT,
    FinancialPermissions.WITHDRAW,
    FinancialPermissions.VIEW_BALANCE,
    KYCPermissions.VIEW,
    KYCPermissions.SUBMIT,
  ],
  user_analyst: [
    TradingPermissions.ORDER_VIEW,
    TradingPermissions.ORDER_HISTORY,
    ExchangePermissions.CEX_ACCESS,
    ExchangePermissions.DEX_ACCESS,
    ExchangePermissions.OMNI_ACCESS,
    FinancialPermissions.VIEW_BALANCE,
    KYCPermissions.VIEW,
  ],
  user_viewer: [
    TradingPermissions.ORDER_VIEW,
    FinancialPermissions.VIEW_BALANCE,
  ],
};

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: string): Permission[] {
  return RolePermissions[role.toLowerCase()] || [];
}

/**
 * Check if permission is valid
 */
export function isValidPermission(permission: string): boolean {
  return Object.values(AllPermissions).includes(permission as any);
}

/**
 * Parse permission string (resource:action format)
 */
export function parsePermission(permission: string): { resource: string; action: string } | null {
  const parts = permission.split(':');
  if (parts.length < 2 || !parts[0]) return null;
  
  return {
    resource: parts[0],
    action: parts.slice(1).join(':'),
  };
}
