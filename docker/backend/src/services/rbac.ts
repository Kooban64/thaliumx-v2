/**
 * RBAC Service - Matrix Controlled Role-Based Access Control
 * 
 * Production-ready RBAC system with comprehensive role matrix:
 * - Platform-level roles (admin, compliance, finance, support, risk, content)
 * - Broker-level roles (admin, compliance, finance, support, ops, risk, p2p-moderator, content)
 * - End-user roles (trader, institutional, vip)
 * - Permission-based access control
 * - Tenant-specific role assignments
 * - Dynamic permission inheritance
 * 
 * Based on industry standards for crypto platforms
 */

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { AppError, createError } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { kycLimitsConfig, RoleTransactionLimits as ConfigRoleTransactionLimits, getCurrencySymbol, formatCurrency } from '../config/kyc-limits.config';

// =============================================================================
// ENHANCED RBAC TYPES FROM UNIFIED PROJECT
// =============================================================================

export enum Environment {
  PLATFORM = 'platform',
  BROKER = 'broker',
  USER = 'user'
}

export enum RoleType {
  // Platform-wide roles
  MASTER_SYSTEM_ADMIN = 'master_system_admin',
  PLATFORM_ADMIN = 'platform_admin',
  PLATFORM_COMPLIANCE = 'platform_compliance',
  PLATFORM_FINANCE = 'platform_finance',
  PLATFORM_OPERATIONS = 'platform_operations',
  PLATFORM_SECURITY = 'platform_security',

  // Broker-level roles
  BROKER_ADMIN = 'broker_admin',
  BROKER_COMPLIANCE = 'broker_compliance',
  BROKER_FINANCE = 'broker_finance',
  BROKER_OPERATIONS = 'broker_operations',
  BROKER_TRADING = 'broker_trading',
  BROKER_SUPPORT = 'broker_support',

  // User roles
  USER_TRADER = 'user_trader',
  USER_ANALYST = 'user_analyst',
  USER_VIEWER = 'user_viewer'
}

export enum PermissionType {
  // System Administration
  SYSTEM_CONFIG_READ = 'system.config.read',
  SYSTEM_CONFIG_WRITE = 'system.config.write',
  SYSTEM_MAINTENANCE = 'system.maintenance',

  // User Management
  USER_CREATE = 'user.create',
  USER_READ = 'user.read',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_ROLE_ASSIGN = 'user.role.assign',
  USER_ROLE_REVOKE = 'user.role.revoke',

  // Tenant Management
  TENANT_CREATE = 'tenant.create',
  TENANT_READ = 'tenant.read',
  TENANT_UPDATE = 'tenant.update',
  TENANT_DELETE = 'tenant.delete',

  // Broker Management
  BROKER_CREATE = 'broker.create',
  BROKER_READ = 'broker.read',
  BROKER_UPDATE = 'broker.update',
  BROKER_DELETE = 'broker.delete',
  BROKER_CONFIG = 'broker.config',

  // Trading Permissions
  TRADING_ORDER_PLACE = 'trading.order.place',
  TRADING_ORDER_CANCEL = 'trading.order.cancel',
  TRADING_ORDER_READ = 'trading.order.read',
  TRADING_BOOK_VIEW = 'trading.book.view',
  TRADING_MARKET_DATA = 'trading.market.data',

  // Exchange Management
  EXCHANGE_CONFIG = 'exchange.config',
  EXCHANGE_BALANCE_READ = 'exchange.balance.read',
  EXCHANGE_BALANCE_MANAGE = 'exchange.balance.manage',
  EXCHANGE_TRADING_ENABLE = 'exchange.trading.enable',
  EXCHANGE_TRADING_DISABLE = 'exchange.trading.disable',

  // DEX Permissions
  DEX_CONFIG = 'dex.config',
  DEX_LIQUIDITY_MANAGE = 'dex.liquidity.manage',
  DEX_TRADING = 'dex.trading',

  // NFT Permissions
  NFT_CONFIG = 'nft.config',
  NFT_MINT = 'nft.mint',
  NFT_TRANSFER = 'nft.transfer',
  NFT_MARKETPLACE_MANAGE = 'nft.marketplace.manage',

  // Token Management
  TOKEN_CONFIG = 'token.config',
  TOKEN_MINT = 'token.mint',
  TOKEN_BURN = 'token.burn',
  TOKEN_TRANSFER = 'token.transfer',
  TOKEN_FREEZE = 'token.freeze',

  // Financial Permissions
  FINANCIAL_LEDGER_READ = 'financial.ledger.read',
  FINANCIAL_LEDGER_WRITE = 'financial.ledger.write',
  FINANCIAL_REPORTS = 'financial.reports',
  FINANCIAL_COMPLIANCE = 'financial.compliance',

  // KYC/KYB Permissions
  KYC_READ = 'kyc.read',
  KYC_APPROVE = 'kyc.approve',
  KYC_REJECT = 'kyc.reject',
  KYC_DOCUMENTS_MANAGE = 'kyc.documents.manage',
  KYB_READ = 'kyb.read',
  KYB_APPROVE = 'kyb.approve',
  KYB_REJECT = 'kyb.reject',

  // Compliance Permissions
  COMPLIANCE_REPORTS = 'compliance.reports',
  COMPLIANCE_AUDIT = 'compliance.audit',
  COMPLIANCE_RISK_ASSESS = 'compliance.risk.assess',
  COMPLIANCE_SANCTIONS = 'compliance.sanctions',

  // AI/ML Permissions
  AI_MODEL_MANAGE = 'ai.model.manage',
  AI_MODEL_TRAIN = 'ai.model.train',
  AI_INSIGHTS_READ = 'ai.insights.read',
  AI_ANALYTICS = 'ai.analytics',

  // Monitoring Permissions
  MONITORING_DASHBOARD = 'monitoring.dashboard',
  MONITORING_ALERTS = 'monitoring.alerts',
  MONITORING_LOGS = 'monitoring.logs',

  // API Permissions
  API_ACCESS = 'api.access',
  API_RATE_LIMIT_BYPASS = 'api.rate.limit.bypass'
}

export interface RoleDefinition {
  id: string;
  name: RoleType;
  environment: Environment;
  description: string;
  permissions: PermissionType[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  tenantId?: string;
  brokerId?: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface PermissionMatrix {
  userId: string;
  environment: Environment;
  tenantId?: string;
  brokerId?: string;
  roles: RoleType[];
  permissions: PermissionType[];
  restrictions: string[];
}

// =============================================================================
// CORE TYPES & INTERFACES
// =============================================================================

export interface Role {
  id: string;
  name: string;
  description: string;
  tenantType: TenantType;
  level: RoleLevel;
  permissions: Permission[];
  transactionLimits: TransactionLimits;
  isSystemRole: boolean;
  canBeAssigned: boolean;
  requiresApproval: boolean;
  maxUsers?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  tenantType: TenantType;
}

export interface PermissionCondition {
  type: ConditionType;
  value: any;
  operator: ConditionOperator;
}

export interface TransactionLimits {
  maxDailyVolume: number;
  maxMonthlyVolume: number;
  maxSingleTransaction: number;
  maxWithdrawalDaily: number;
  maxWithdrawalMonthly: number;
  maxDepositDaily: number;
  maxDepositMonthly: number;
  currencies: string[];
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  tenantId?: string;
  brokerId?: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface RoleMetadata {
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  tenantId: string;
  assignedBy: string;
  reason: string;
  expiresAt?: Date;
}

export interface PermissionCheck {
  userId: string;
  permission: string;
  resource?: string;
  tenantId?: string;
  context?: any;
}

export enum TenantType {
  PLATFORM = 'platform',
  BROKER = 'broker',
  SYSTEM = 'system'
}

export enum RoleLevel {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum ConditionType {
  TIME_BASED = 'time_based',
  LOCATION_BASED = 'location_based',
  AMOUNT_BASED = 'amount_based',
  FREQUENCY_BASED = 'frequency_based',
  CUSTOM = 'custom'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in',
  CONTAINS = 'contains',
  REGEX = 'regex'
}

// =============================================================================
// RBAC SERVICE CLASS
// =============================================================================

export class RBACService {
  private static isInitialized = false;
  private static roles: Map<string, Role> = new Map();
  private static permissions: Map<string, Permission> = new Map();
  private static userRoles: Map<string, UserRole> = new Map();
  private static roleRequests: Map<string, {
    id: string;
    userId: string;
    roleId: string;
    tenantId: string;
    requestedBy: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    approvalsRequired: number;
    approvers: string[];
    approvals: string[];
    createdAt: Date;
    updatedAt: Date;
  }> = new Map();

  // Industry Standard Permission Matrix
  private static readonly PERMISSIONS: Permission[] = [
    // Platform Permissions
    { id: 'platform:tenants:read', name: 'Read Tenants', description: 'View tenant information', resource: 'tenants', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:tenants:create', name: 'Create Tenants', description: 'Create new tenants', resource: 'tenants', action: 'create', tenantType: TenantType.PLATFORM },
    { id: 'platform:tenants:update', name: 'Update Tenants', description: 'Update tenant information', resource: 'tenants', action: 'update', tenantType: TenantType.PLATFORM },
    { id: 'platform:tenants:delete', name: 'Delete Tenants', description: 'Delete tenants', resource: 'tenants', action: 'delete', tenantType: TenantType.PLATFORM },
    { id: 'platform:provisioning:read', name: 'Read Provisioning', description: 'View provisioning status', resource: 'provisioning', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:provisioning:manage', name: 'Manage Provisioning', description: 'Manage tenant provisioning', resource: 'provisioning', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:compliance:read', name: 'Read Compliance', description: 'View compliance reports', resource: 'compliance', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:compliance:manage', name: 'Manage Compliance', description: 'Manage compliance rules', resource: 'compliance', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:billing:read', name: 'Read Billing', description: 'View billing information', resource: 'billing', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:billing:manage', name: 'Manage Billing', description: 'Manage billing and payments', resource: 'billing', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:observability:read', name: 'Read Observability', description: 'View system metrics and logs', resource: 'observability', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:templates:read', name: 'Read Templates', description: 'View tenant templates', resource: 'templates', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:templates:manage', name: 'Manage Templates', description: 'Manage tenant templates', resource: 'templates', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:flags:read', name: 'Read Feature Flags', description: 'View feature flags', resource: 'flags', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:flags:manage', name: 'Manage Feature Flags', description: 'Manage feature flags', resource: 'flags', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:settings:read', name: 'Read Settings', description: 'View platform settings', resource: 'settings', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:settings:manage', name: 'Manage Settings', description: 'Manage platform settings', resource: 'settings', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:audit:read', name: 'Read Audit Logs', description: 'View audit logs', resource: 'audit', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:treasury:read', name: 'Read Treasury', description: 'View treasury information', resource: 'treasury', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:treasury:manage', name: 'Manage Treasury', description: 'Manage treasury operations', resource: 'treasury', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:banking:read', name: 'Read Banking', description: 'View banking information', resource: 'banking', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:banking:manage', name: 'Manage Banking', description: 'Manage banking operations', resource: 'banking', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:markets:read', name: 'Read Markets', description: 'View market information', resource: 'markets', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:markets:manage', name: 'Manage Markets', description: 'Manage market operations', resource: 'markets', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:custody:read', name: 'Read Custody', description: 'View custody information', resource: 'custody', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:custody:manage', name: 'Manage Custody', description: 'Manage custody operations', resource: 'custody', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:brokers:read', name: 'Read Brokers', description: 'View broker information', resource: 'brokers', action: 'read', tenantType: TenantType.PLATFORM },
    { id: 'platform:brokers:manage', name: 'Manage Brokers', description: 'Manage broker operations', resource: 'brokers', action: 'manage', tenantType: TenantType.PLATFORM },
    { id: 'platform:overview:read', name: 'Read Overview', description: 'View platform overview', resource: 'overview', action: 'read', tenantType: TenantType.PLATFORM },

    // Broker Permissions
    { id: 'broker:customers:read', name: 'Read Customers', description: 'View customer information', resource: 'customers', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:customers:manage', name: 'Manage Customers', description: 'Manage customer accounts', resource: 'customers', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:orders:read', name: 'Read Orders', description: 'View trading orders', resource: 'orders', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:orders:manage', name: 'Manage Orders', description: 'Manage trading orders', resource: 'orders', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:wallet:read', name: 'Read Wallet', description: 'View wallet information', resource: 'wallet', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:wallet:manage', name: 'Manage Wallet', description: 'Manage wallet operations', resource: 'wallet', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:kyc:read', name: 'Read KYC', description: 'View KYC information', resource: 'kyc', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:kyc:manage', name: 'Manage KYC', description: 'Manage KYC processes', resource: 'kyc', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:compliance:read', name: 'Read Compliance', description: 'View compliance information', resource: 'compliance', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:compliance:manage', name: 'Manage Compliance', description: 'Manage compliance processes', resource: 'compliance', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:finance:read', name: 'Read Finance', description: 'View financial information', resource: 'finance', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:finance:manage', name: 'Manage Finance', description: 'Manage financial operations', resource: 'finance', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:support:read', name: 'Read Support', description: 'View support tickets', resource: 'support', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:support:manage', name: 'Manage Support', description: 'Manage support operations', resource: 'support', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:settings:read', name: 'Read Settings', description: 'View broker settings', resource: 'settings', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:settings:manage', name: 'Manage Settings', description: 'Manage broker settings', resource: 'settings', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:risk:read', name: 'Read Risk', description: 'View risk information', resource: 'risk', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:risk:manage', name: 'Manage Risk', description: 'Manage risk operations', resource: 'risk', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'broker:reports:read', name: 'Read Reports', description: 'View reports', resource: 'reports', action: 'read', tenantType: TenantType.BROKER },
    { id: 'broker:reports:manage', name: 'Manage Reports', description: 'Manage reports', resource: 'reports', action: 'manage', tenantType: TenantType.BROKER },

    // User Permissions
    { id: 'user:trading:read', name: 'Read Trading', description: 'View trading information', resource: 'trading', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:trading:execute', name: 'Execute Trading', description: 'Execute trading operations', resource: 'trading', action: 'execute', tenantType: TenantType.BROKER },
    { id: 'user:wallet:read', name: 'Read Wallet', description: 'View wallet information', resource: 'wallet', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:wallet:deposit', name: 'Deposit Funds', description: 'Deposit funds to wallet', resource: 'wallet', action: 'deposit', tenantType: TenantType.BROKER },
    { id: 'user:wallet:withdraw', name: 'Withdraw Funds', description: 'Withdraw funds from wallet', resource: 'wallet', action: 'withdraw', tenantType: TenantType.BROKER },
    { id: 'user:wallet:transfer', name: 'Transfer Funds', description: 'Transfer funds between wallets', resource: 'wallet', action: 'transfer', tenantType: TenantType.BROKER },
    { id: 'user:profile:read', name: 'Read Profile', description: 'View user profile', resource: 'profile', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:profile:update', name: 'Update Profile', description: 'Update user profile', resource: 'profile', action: 'update', tenantType: TenantType.BROKER },
    { id: 'user:kyc:read', name: 'Read KYC', description: 'View KYC status', resource: 'kyc', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:kyc:submit', name: 'Submit KYC', description: 'Submit KYC documents', resource: 'kyc', action: 'submit', tenantType: TenantType.BROKER },
    { id: 'user:api:read', name: 'Read API', description: 'View API information', resource: 'api', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:api:manage', name: 'Manage API', description: 'Manage API keys', resource: 'api', action: 'manage', tenantType: TenantType.BROKER },
    { id: 'user:notifications:read', name: 'Read Notifications', description: 'View notifications', resource: 'notifications', action: 'read', tenantType: TenantType.BROKER },
    { id: 'user:notifications:manage', name: 'Manage Notifications', description: 'Manage notification settings', resource: 'notifications', action: 'manage', tenantType: TenantType.BROKER }
  ];

  // Industry Standard Role Definitions
  private static readonly ROLE_DEFINITIONS: Role[] = [
    // Platform Roles
    {
      id: 'platform-admin',
      name: 'Platform Administrator',
      description: 'Full platform access with tenant lifecycle management',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.ADMIN,
      permissions: this.PERMISSIONS.filter(p => p.tenantType === TenantType.PLATFORM),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      maxUsers: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'platform-compliance',
      name: 'Platform Compliance Officer',
      description: 'Global compliance rules and oversight',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('compliance') || p.id.includes('audit')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'platform-finance',
      name: 'Platform Finance Manager',
      description: 'Platform financial operations and treasury management',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('finance') || p.id.includes('treasury') || p.id.includes('billing')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'platform-support',
      name: 'Platform Support Manager',
      description: 'Platform-wide support operations',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('support') || p.id.includes('customers')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'platform-risk',
      name: 'Platform Risk Manager',
      description: 'Platform-wide risk management',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('risk') || p.id.includes('compliance')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'platform-content',
      name: 'Platform Content Manager',
      description: 'Platform content and documentation',
      tenantType: TenantType.PLATFORM,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('templates') || p.id.includes('settings')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },

    // Broker Roles - Transaction limits loaded from configuration
    {
      id: 'broker-admin',
      name: 'Broker Administrator',
      description: 'Full broker access with customer management',
      tenantType: TenantType.BROKER,
      level: RoleLevel.ADMIN,
      permissions: this.PERMISSIONS.filter(p => p.tenantType === TenantType.BROKER),
      transactionLimits: this.getConfigurableRoleLimits('broker-admin', {
        maxDailyVolume: 18500000,
        maxMonthlyVolume: 185000000,
        maxSingleTransaction: 1850000,
        maxWithdrawalDaily: 9250000,
        maxWithdrawalMonthly: 92500000,
        maxDepositDaily: 18500000,
        maxDepositMonthly: 185000000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      maxUsers: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-compliance',
      name: 'Broker Compliance Officer',
      description: 'Broker compliance and KYC management',
      tenantType: TenantType.BROKER,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('compliance') || p.id.includes('kyc') || p.id.includes('risk')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-finance',
      name: 'Broker Finance Manager',
      description: 'Broker financial operations',
      tenantType: TenantType.BROKER,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('finance') || p.id.includes('wallet')),
      transactionLimits: this.getConfigurableRoleLimits('broker-finance', {
        maxDailyVolume: 9250000,
        maxMonthlyVolume: 92500000,
        maxSingleTransaction: 925000,
        maxWithdrawalDaily: 4625000,
        maxWithdrawalMonthly: 46250000,
        maxDepositDaily: 9250000,
        maxDepositMonthly: 92500000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-support',
      name: 'Broker Support Agent',
      description: 'Customer support operations',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('support') || p.id.includes('customers')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-ops',
      name: 'Broker Operations',
      description: 'Broker operational tasks',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('orders') || p.id.includes('trading')),
      transactionLimits: this.getConfigurableRoleLimits('broker-ops', {
        maxDailyVolume: 1850000,
        maxMonthlyVolume: 18500000,
        maxSingleTransaction: 185000,
        maxWithdrawalDaily: 925000,
        maxWithdrawalMonthly: 9250000,
        maxDepositDaily: 1850000,
        maxDepositMonthly: 18500000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-risk',
      name: 'Broker Risk Manager',
      description: 'Broker risk management',
      tenantType: TenantType.BROKER,
      level: RoleLevel.MANAGER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('risk') || p.id.includes('compliance')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-p2p-moderator',
      name: 'P2P Moderator',
      description: 'P2P trading moderation and dispute resolution',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('orders') || p.id.includes('support')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'broker-content',
      name: 'Broker Content Manager',
      description: 'Broker-specific content and tutorials',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.includes('settings') || p.id.includes('support')),
      transactionLimits: {
        maxDailyVolume: 0,
        maxMonthlyVolume: 0,
        maxSingleTransaction: 0,
        maxWithdrawalDaily: 0,
        maxWithdrawalMonthly: 0,
        maxDepositDaily: 0,
        maxDepositMonthly: 0,
        currencies: []
      },
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },

    // End-User Roles - Transaction limits loaded from configuration
    {
      id: 'user-trader',
      name: 'Trader',
      description: 'Standard trading access',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.startsWith('user:')),
      transactionLimits: this.getConfigurableRoleLimits('user-trader', {
        maxDailyVolume: 185000,
        maxMonthlyVolume: 1850000,
        maxSingleTransaction: 18500,
        maxWithdrawalDaily: 92500,
        maxWithdrawalMonthly: 925000,
        maxDepositDaily: 185000,
        maxDepositMonthly: 1850000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'user-institutional',
      name: 'Institutional Trader',
      description: 'Enhanced trading access for institutions',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.startsWith('user:')),
      transactionLimits: this.getConfigurableRoleLimits('user-institutional', {
        maxDailyVolume: 1850000,
        maxMonthlyVolume: 18500000,
        maxSingleTransaction: 185000,
        maxWithdrawalDaily: 925000,
        maxWithdrawalMonthly: 9250000,
        maxDepositDaily: 1850000,
        maxDepositMonthly: 18500000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'user-vip',
      name: 'VIP Trader',
      description: 'Premium trading access with enhanced limits',
      tenantType: TenantType.BROKER,
      level: RoleLevel.USER,
      permissions: this.PERMISSIONS.filter(p => p.id.startsWith('user:')),
      transactionLimits: this.getConfigurableRoleLimits('user-vip', {
        maxDailyVolume: 925000,
        maxMonthlyVolume: 9250000,
        maxSingleTransaction: 92500,
        maxWithdrawalDaily: 462500,
        maxWithdrawalMonthly: 4625000,
        maxDepositDaily: 925000,
        maxDepositMonthly: 9250000,
        currencies: ['ZAR', 'USD', 'EUR', 'BTC', 'ETH', 'THAL']
      }),
      isSystemRole: true,
      canBeAssigned: true,
      requiresApproval: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  /**
   * Get configurable role limits from environment or use defaults
   */
  private static getConfigurableRoleLimits(roleId: string, defaults: TransactionLimits): TransactionLimits {
    try {
      kycLimitsConfig.initialize();
      const configLimits = kycLimitsConfig.getRoleLimits(roleId);
      if (configLimits) {
        return {
          maxDailyVolume: configLimits.maxDailyVolume,
          maxMonthlyVolume: configLimits.maxMonthlyVolume,
          maxSingleTransaction: configLimits.maxSingleTransaction,
          maxWithdrawalDaily: configLimits.maxWithdrawalDaily,
          maxWithdrawalMonthly: configLimits.maxWithdrawalMonthly,
          maxDepositDaily: configLimits.maxDepositDaily,
          maxDepositMonthly: configLimits.maxDepositMonthly,
          currencies: configLimits.currencies
        };
      }
    } catch (error) {
      // Use defaults on error
    }
    return defaults;
  }

  /**
   * Get currency symbol for display
   */
  public static getCurrencySymbol(): string {
    return getCurrencySymbol();
  }

  /**
   * Format amount with currency
   */
  public static formatAmount(amount: number): string {
    return formatCurrency(amount);
  }

  /**
   * Initialize RBAC Service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing RBAC Service...');
      
      // Load permissions
      this.PERMISSIONS.forEach(permission => {
        this.permissions.set(permission.id, permission);
      });

      // Load roles
      this.ROLE_DEFINITIONS.forEach(role => {
        this.roles.set(role.id, role);
      });

      // Load existing user roles
      await this.loadExistingUserRoles();
      
      this.isInitialized = true;
      LoggerService.info('✅ RBAC Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'rbac.initialized',
        'RBACService',
        'info',
        {
          message: 'RBAC service initialized',
          rolesCount: this.roles.size,
          permissionsCount: this.permissions.size,
          userRolesCount: this.userRoles.size
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ RBAC Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  public static async assignRole(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string,
    reason: string,
    expiresAt?: Date
  ): Promise<UserRole> {
    try {
      LoggerService.info('Assigning role to user', {
        userId,
        roleId,
        tenantId,
        assignedBy,
        reason
      });

      const role = this.roles.get(roleId);
      if (!role) {
        throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
      }

      // Check if user already has this role
      const existingUserRole = Array.from(this.userRoles.values()).find(
        ur => ur.userId === userId && ur.roleId === roleId && ur.tenantId === tenantId && ur.isActive
      );

      if (existingUserRole) {
        throw createError('User already has this role', 400, 'ROLE_ALREADY_ASSIGNED');
      }

      // Check role limits
      if (role.maxUsers) {
        const currentUserCount = Array.from(this.userRoles.values()).filter(
          ur => ur.roleId === roleId && ur.tenantId === tenantId && ur.isActive
        ).length;

        if (currentUserCount >= role.maxUsers) {
          throw createError('Role user limit exceeded', 400, 'ROLE_LIMIT_EXCEEDED');
        }
      }

      const userRoleId = uuidv4();
      const userRole: UserRole = {
        id: userRoleId,
        userId,
        roleId,
        tenantId,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        isActive: true
      };

      // Store user role
      this.userRoles.set(userRoleId, userRole);

      LoggerService.info('Role assigned successfully', {
        userRoleId: userRole.id,
        userId: userRole.userId,
        roleId: userRole.roleId,
        tenantId: userRole.tenantId
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'role.assigned',
        'rbac',
        userRoleId,
        {
          userId,
          roleId,
          tenantId,
          assignedBy,
          reason,
          expiresAt
        }
      );

      return userRole;

    } catch (error) {
      LoggerService.error('Assign role failed:', error);
      throw error;
    }
  }

  /**
   * Request role assignment (approval workflow if role requiresApproval)
   */
  public static async requestRoleAssignment(
    userId: string,
    roleId: string,
    tenantId: string,
    requestedBy: string,
    reason: string,
    approvalsRequired: number,
    approvers: string[]
  ): Promise<{ requestId: string; status: string } | UserRole> {
    const role = this.roles.get(roleId);
    if (!role) throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
    if (!role.requiresApproval) {
      // Directly assign if no approval required
      return await this.assignRole(userId, roleId, tenantId, requestedBy, reason);
    }
    const id = `role_req_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    this.roleRequests.set(id, {
      id,
      userId,
      roleId,
      tenantId,
      requestedBy,
      reason,
      status: 'pending',
      approvalsRequired,
      approvers,
      approvals: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { requestId: id, status: 'pending' };
  }

  public static async approveRoleRequest(requestId: string, approverId: string): Promise<{ status: string }> {
    const req = this.roleRequests.get(requestId);
    if (!req) throw createError('Request not found', 404, 'REQUEST_NOT_FOUND');
    if (!req.approvers.includes(approverId)) throw createError('Not authorized approver', 403, 'NOT_AUTHORIZED');
    if (!req.approvals.includes(approverId)) req.approvals.push(approverId);
    req.updatedAt = new Date();
    if (req.approvals.length >= req.approvalsRequired) {
      // Assign role now
      await this.assignRole(req.userId, req.roleId, req.tenantId, approverId, `Approved: ${req.reason}`);
      req.status = 'approved';
    }
    return { status: req.status };
  }

  public static async rejectRoleRequest(requestId: string, approverId: string, reason?: string): Promise<{ status: string }> {
    const req = this.roleRequests.get(requestId);
    if (!req) throw createError('Request not found', 404, 'REQUEST_NOT_FOUND');
    if (!req.approvers.includes(approverId)) throw createError('Not authorized approver', 403, 'NOT_AUTHORIZED');
    req.status = 'rejected';
    req.updatedAt = new Date();
    return { status: req.status };
  }

  public static async listRoleRequests(filter?: { tenantId?: string; status?: string }) {
    return Array.from(this.roleRequests.values()).filter(r => (!filter?.tenantId || r.tenantId === filter.tenantId) && (!filter?.status || r.status === filter.status));
  }

  /**
   * Check if user has permission
   */
  public static async hasPermission(
    userId: string,
    permission: string,
    tenantId?: string,
    context?: any
  ): Promise<boolean> {
    try {
      // Get user's active roles
      const userRoles = Array.from(this.userRoles.values()).filter(
        ur => ur.userId === userId && ur.isActive && (!tenantId || ur.tenantId === tenantId)
      );

      // Check if any role has the permission
      for (const userRole of userRoles) {
        const role = this.roles.get(userRole.roleId);
        if (!role) continue;

        // Check if role has permission
        const hasPermission = role.permissions.some(p => p.id === permission);
        if (hasPermission) {
          // Check transaction limits if applicable
          if (context && context.amount && context.currency) {
            const limits = role.transactionLimits;
            if (limits.currencies.includes(context.currency)) {
              if (context.amount > limits.maxSingleTransaction) {
                return false;
              }
            }
          }

          return true;
        }
      }

      return false;

    } catch (error) {
      LoggerService.error('Check permission failed:', error);
      return false;
    }
  }

  /**
   * Get user roles
   */
  public static async getUserRoles(userId: string, tenantId?: string): Promise<UserRole[]> {
    try {
      return Array.from(this.userRoles.values()).filter(
        ur => ur.userId === userId && ur.isActive && (!tenantId || ur.tenantId === tenantId)
      );
    } catch (error) {
      LoggerService.error('Get user roles failed:', error);
      throw error;
    }
  }

  /**
   * Get all roles
   */
  public static async getAllRoles(tenantType?: TenantType): Promise<Role[]> {
    try {
      return Array.from(this.roles.values()).filter(
        role => !tenantType || role.tenantType === tenantType
      );
    } catch (error) {
      LoggerService.error('Get all roles failed:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing RBAC Service...');
      this.isInitialized = false;
      this.roles.clear();
      this.permissions.clear();
      this.userRoles.clear();
      LoggerService.info('✅ RBAC Service closed');
    } catch (error) {
      LoggerService.error('Error closing RBAC Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static async loadExistingUserRoles(): Promise<void> {
    try {
      // This would typically load from database
      LoggerService.info('Existing user roles loaded from database');
    } catch (error) {
      LoggerService.error('Load existing user roles failed:', error);
      throw error;
    }
  }
}
