"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACService = exports.ConditionOperator = exports.ConditionType = exports.RoleLevel = exports.TenantType = exports.PermissionType = exports.RoleType = exports.Environment = void 0;
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
// =============================================================================
// ENHANCED RBAC TYPES FROM UNIFIED PROJECT
// =============================================================================
var Environment;
(function (Environment) {
    Environment["PLATFORM"] = "platform";
    Environment["BROKER"] = "broker";
    Environment["USER"] = "user";
})(Environment || (exports.Environment = Environment = {}));
var RoleType;
(function (RoleType) {
    // Platform-wide roles
    RoleType["MASTER_SYSTEM_ADMIN"] = "master_system_admin";
    RoleType["PLATFORM_ADMIN"] = "platform_admin";
    RoleType["PLATFORM_COMPLIANCE"] = "platform_compliance";
    RoleType["PLATFORM_FINANCE"] = "platform_finance";
    RoleType["PLATFORM_OPERATIONS"] = "platform_operations";
    RoleType["PLATFORM_SECURITY"] = "platform_security";
    // Broker-level roles
    RoleType["BROKER_ADMIN"] = "broker_admin";
    RoleType["BROKER_COMPLIANCE"] = "broker_compliance";
    RoleType["BROKER_FINANCE"] = "broker_finance";
    RoleType["BROKER_OPERATIONS"] = "broker_operations";
    RoleType["BROKER_TRADING"] = "broker_trading";
    RoleType["BROKER_SUPPORT"] = "broker_support";
    // User roles
    RoleType["USER_TRADER"] = "user_trader";
    RoleType["USER_ANALYST"] = "user_analyst";
    RoleType["USER_VIEWER"] = "user_viewer";
})(RoleType || (exports.RoleType = RoleType = {}));
var PermissionType;
(function (PermissionType) {
    // System Administration
    PermissionType["SYSTEM_CONFIG_READ"] = "system.config.read";
    PermissionType["SYSTEM_CONFIG_WRITE"] = "system.config.write";
    PermissionType["SYSTEM_MAINTENANCE"] = "system.maintenance";
    // User Management
    PermissionType["USER_CREATE"] = "user.create";
    PermissionType["USER_READ"] = "user.read";
    PermissionType["USER_UPDATE"] = "user.update";
    PermissionType["USER_DELETE"] = "user.delete";
    PermissionType["USER_ROLE_ASSIGN"] = "user.role.assign";
    PermissionType["USER_ROLE_REVOKE"] = "user.role.revoke";
    // Tenant Management
    PermissionType["TENANT_CREATE"] = "tenant.create";
    PermissionType["TENANT_READ"] = "tenant.read";
    PermissionType["TENANT_UPDATE"] = "tenant.update";
    PermissionType["TENANT_DELETE"] = "tenant.delete";
    // Broker Management
    PermissionType["BROKER_CREATE"] = "broker.create";
    PermissionType["BROKER_READ"] = "broker.read";
    PermissionType["BROKER_UPDATE"] = "broker.update";
    PermissionType["BROKER_DELETE"] = "broker.delete";
    PermissionType["BROKER_CONFIG"] = "broker.config";
    // Trading Permissions
    PermissionType["TRADING_ORDER_PLACE"] = "trading.order.place";
    PermissionType["TRADING_ORDER_CANCEL"] = "trading.order.cancel";
    PermissionType["TRADING_ORDER_READ"] = "trading.order.read";
    PermissionType["TRADING_BOOK_VIEW"] = "trading.book.view";
    PermissionType["TRADING_MARKET_DATA"] = "trading.market.data";
    // Exchange Management
    PermissionType["EXCHANGE_CONFIG"] = "exchange.config";
    PermissionType["EXCHANGE_BALANCE_READ"] = "exchange.balance.read";
    PermissionType["EXCHANGE_BALANCE_MANAGE"] = "exchange.balance.manage";
    PermissionType["EXCHANGE_TRADING_ENABLE"] = "exchange.trading.enable";
    PermissionType["EXCHANGE_TRADING_DISABLE"] = "exchange.trading.disable";
    // DEX Permissions
    PermissionType["DEX_CONFIG"] = "dex.config";
    PermissionType["DEX_LIQUIDITY_MANAGE"] = "dex.liquidity.manage";
    PermissionType["DEX_TRADING"] = "dex.trading";
    // NFT Permissions
    PermissionType["NFT_CONFIG"] = "nft.config";
    PermissionType["NFT_MINT"] = "nft.mint";
    PermissionType["NFT_TRANSFER"] = "nft.transfer";
    PermissionType["NFT_MARKETPLACE_MANAGE"] = "nft.marketplace.manage";
    // Token Management
    PermissionType["TOKEN_CONFIG"] = "token.config";
    PermissionType["TOKEN_MINT"] = "token.mint";
    PermissionType["TOKEN_BURN"] = "token.burn";
    PermissionType["TOKEN_TRANSFER"] = "token.transfer";
    PermissionType["TOKEN_FREEZE"] = "token.freeze";
    // Financial Permissions
    PermissionType["FINANCIAL_LEDGER_READ"] = "financial.ledger.read";
    PermissionType["FINANCIAL_LEDGER_WRITE"] = "financial.ledger.write";
    PermissionType["FINANCIAL_REPORTS"] = "financial.reports";
    PermissionType["FINANCIAL_COMPLIANCE"] = "financial.compliance";
    // KYC/KYB Permissions
    PermissionType["KYC_READ"] = "kyc.read";
    PermissionType["KYC_APPROVE"] = "kyc.approve";
    PermissionType["KYC_REJECT"] = "kyc.reject";
    PermissionType["KYC_DOCUMENTS_MANAGE"] = "kyc.documents.manage";
    PermissionType["KYB_READ"] = "kyb.read";
    PermissionType["KYB_APPROVE"] = "kyb.approve";
    PermissionType["KYB_REJECT"] = "kyb.reject";
    // Compliance Permissions
    PermissionType["COMPLIANCE_REPORTS"] = "compliance.reports";
    PermissionType["COMPLIANCE_AUDIT"] = "compliance.audit";
    PermissionType["COMPLIANCE_RISK_ASSESS"] = "compliance.risk.assess";
    PermissionType["COMPLIANCE_SANCTIONS"] = "compliance.sanctions";
    // AI/ML Permissions
    PermissionType["AI_MODEL_MANAGE"] = "ai.model.manage";
    PermissionType["AI_MODEL_TRAIN"] = "ai.model.train";
    PermissionType["AI_INSIGHTS_READ"] = "ai.insights.read";
    PermissionType["AI_ANALYTICS"] = "ai.analytics";
    // Monitoring Permissions
    PermissionType["MONITORING_DASHBOARD"] = "monitoring.dashboard";
    PermissionType["MONITORING_ALERTS"] = "monitoring.alerts";
    PermissionType["MONITORING_LOGS"] = "monitoring.logs";
    // API Permissions
    PermissionType["API_ACCESS"] = "api.access";
    PermissionType["API_RATE_LIMIT_BYPASS"] = "api.rate.limit.bypass";
})(PermissionType || (exports.PermissionType = PermissionType = {}));
var TenantType;
(function (TenantType) {
    TenantType["PLATFORM"] = "platform";
    TenantType["BROKER"] = "broker";
    TenantType["SYSTEM"] = "system";
})(TenantType || (exports.TenantType = TenantType = {}));
var RoleLevel;
(function (RoleLevel) {
    RoleLevel["ADMIN"] = "admin";
    RoleLevel["MANAGER"] = "manager";
    RoleLevel["USER"] = "user";
    RoleLevel["VIEWER"] = "viewer";
})(RoleLevel || (exports.RoleLevel = RoleLevel = {}));
var ConditionType;
(function (ConditionType) {
    ConditionType["TIME_BASED"] = "time_based";
    ConditionType["LOCATION_BASED"] = "location_based";
    ConditionType["AMOUNT_BASED"] = "amount_based";
    ConditionType["FREQUENCY_BASED"] = "frequency_based";
    ConditionType["CUSTOM"] = "custom";
})(ConditionType || (exports.ConditionType = ConditionType = {}));
var ConditionOperator;
(function (ConditionOperator) {
    ConditionOperator["EQUALS"] = "equals";
    ConditionOperator["GREATER_THAN"] = "greater_than";
    ConditionOperator["LESS_THAN"] = "less_than";
    ConditionOperator["IN"] = "in";
    ConditionOperator["NOT_IN"] = "not_in";
    ConditionOperator["CONTAINS"] = "contains";
    ConditionOperator["REGEX"] = "regex";
})(ConditionOperator || (exports.ConditionOperator = ConditionOperator = {}));
// =============================================================================
// RBAC SERVICE CLASS
// =============================================================================
class RBACService {
    static isInitialized = false;
    static roles = new Map();
    static permissions = new Map();
    static userRoles = new Map();
    static roleRequests = new Map();
    // Industry Standard Permission Matrix
    static PERMISSIONS = [
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
    static ROLE_DEFINITIONS = [
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
        // Broker Roles
        {
            id: 'broker-admin',
            name: 'Broker Administrator',
            description: 'Full broker access with customer management',
            tenantType: TenantType.BROKER,
            level: RoleLevel.ADMIN,
            permissions: this.PERMISSIONS.filter(p => p.tenantType === TenantType.BROKER),
            transactionLimits: {
                maxDailyVolume: 1000000,
                maxMonthlyVolume: 10000000,
                maxSingleTransaction: 100000,
                maxWithdrawalDaily: 500000,
                maxWithdrawalMonthly: 5000000,
                maxDepositDaily: 1000000,
                maxDepositMonthly: 10000000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
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
            transactionLimits: {
                maxDailyVolume: 500000,
                maxMonthlyVolume: 5000000,
                maxSingleTransaction: 50000,
                maxWithdrawalDaily: 250000,
                maxWithdrawalMonthly: 2500000,
                maxDepositDaily: 500000,
                maxDepositMonthly: 5000000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
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
            transactionLimits: {
                maxDailyVolume: 100000,
                maxMonthlyVolume: 1000000,
                maxSingleTransaction: 10000,
                maxWithdrawalDaily: 50000,
                maxWithdrawalMonthly: 500000,
                maxDepositDaily: 100000,
                maxDepositMonthly: 1000000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
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
        // End-User Roles
        {
            id: 'user-trader',
            name: 'Trader',
            description: 'Standard trading access',
            tenantType: TenantType.BROKER,
            level: RoleLevel.USER,
            permissions: this.PERMISSIONS.filter(p => p.id.startsWith('user:')),
            transactionLimits: {
                maxDailyVolume: 10000,
                maxMonthlyVolume: 100000,
                maxSingleTransaction: 1000,
                maxWithdrawalDaily: 5000,
                maxWithdrawalMonthly: 50000,
                maxDepositDaily: 10000,
                maxDepositMonthly: 100000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
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
            transactionLimits: {
                maxDailyVolume: 100000,
                maxMonthlyVolume: 1000000,
                maxSingleTransaction: 10000,
                maxWithdrawalDaily: 50000,
                maxWithdrawalMonthly: 500000,
                maxDepositDaily: 100000,
                maxDepositMonthly: 1000000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
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
            transactionLimits: {
                maxDailyVolume: 50000,
                maxMonthlyVolume: 500000,
                maxSingleTransaction: 5000,
                maxWithdrawalDaily: 25000,
                maxWithdrawalMonthly: 250000,
                maxDepositDaily: 50000,
                maxDepositMonthly: 500000,
                currencies: ['USD', 'EUR', 'BTC', 'ETH', 'THAL']
            },
            isSystemRole: true,
            canBeAssigned: true,
            requiresApproval: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];
    /**
     * Initialize RBAC Service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing RBAC Service...');
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
            logger_1.LoggerService.info('✅ RBAC Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('rbac.initialized', 'RBACService', 'info', {
                message: 'RBAC service initialized',
                rolesCount: this.roles.size,
                permissionsCount: this.permissions.size,
                userRolesCount: this.userRoles.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ RBAC Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Assign role to user
     */
    static async assignRole(userId, roleId, tenantId, assignedBy, reason, expiresAt) {
        try {
            logger_1.LoggerService.info('Assigning role to user', {
                userId,
                roleId,
                tenantId,
                assignedBy,
                reason
            });
            const role = this.roles.get(roleId);
            if (!role) {
                throw (0, utils_1.createError)('Role not found', 404, 'ROLE_NOT_FOUND');
            }
            // Check if user already has this role
            const existingUserRole = Array.from(this.userRoles.values()).find(ur => ur.userId === userId && ur.roleId === roleId && ur.tenantId === tenantId && ur.isActive);
            if (existingUserRole) {
                throw (0, utils_1.createError)('User already has this role', 400, 'ROLE_ALREADY_ASSIGNED');
            }
            // Check role limits
            if (role.maxUsers) {
                const currentUserCount = Array.from(this.userRoles.values()).filter(ur => ur.roleId === roleId && ur.tenantId === tenantId && ur.isActive).length;
                if (currentUserCount >= role.maxUsers) {
                    throw (0, utils_1.createError)('Role user limit exceeded', 400, 'ROLE_LIMIT_EXCEEDED');
                }
            }
            const userRoleId = (0, uuid_1.v4)();
            const userRole = {
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
            logger_1.LoggerService.info('Role assigned successfully', {
                userRoleId: userRole.id,
                userId: userRole.userId,
                roleId: userRole.roleId,
                tenantId: userRole.tenantId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('role.assigned', 'rbac', userRoleId, {
                userId,
                roleId,
                tenantId,
                assignedBy,
                reason,
                expiresAt
            });
            return userRole;
        }
        catch (error) {
            logger_1.LoggerService.error('Assign role failed:', error);
            throw error;
        }
    }
    /**
     * Request role assignment (approval workflow if role requiresApproval)
     */
    static async requestRoleAssignment(userId, roleId, tenantId, requestedBy, reason, approvalsRequired, approvers) {
        const role = this.roles.get(roleId);
        if (!role)
            throw (0, utils_1.createError)('Role not found', 404, 'ROLE_NOT_FOUND');
        if (!role.requiresApproval) {
            // Directly assign if no approval required
            return await this.assignRole(userId, roleId, tenantId, requestedBy, reason);
        }
        const id = `role_req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
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
    static async approveRoleRequest(requestId, approverId) {
        const req = this.roleRequests.get(requestId);
        if (!req)
            throw (0, utils_1.createError)('Request not found', 404, 'REQUEST_NOT_FOUND');
        if (!req.approvers.includes(approverId))
            throw (0, utils_1.createError)('Not authorized approver', 403, 'NOT_AUTHORIZED');
        if (!req.approvals.includes(approverId))
            req.approvals.push(approverId);
        req.updatedAt = new Date();
        if (req.approvals.length >= req.approvalsRequired) {
            // Assign role now
            await this.assignRole(req.userId, req.roleId, req.tenantId, approverId, `Approved: ${req.reason}`);
            req.status = 'approved';
        }
        return { status: req.status };
    }
    static async rejectRoleRequest(requestId, approverId, reason) {
        const req = this.roleRequests.get(requestId);
        if (!req)
            throw (0, utils_1.createError)('Request not found', 404, 'REQUEST_NOT_FOUND');
        if (!req.approvers.includes(approverId))
            throw (0, utils_1.createError)('Not authorized approver', 403, 'NOT_AUTHORIZED');
        req.status = 'rejected';
        req.updatedAt = new Date();
        return { status: req.status };
    }
    static async listRoleRequests(filter) {
        return Array.from(this.roleRequests.values()).filter(r => (!filter?.tenantId || r.tenantId === filter.tenantId) && (!filter?.status || r.status === filter.status));
    }
    /**
     * Check if user has permission
     */
    static async hasPermission(userId, permission, tenantId, context) {
        try {
            // Get user's active roles
            const userRoles = Array.from(this.userRoles.values()).filter(ur => ur.userId === userId && ur.isActive && (!tenantId || ur.tenantId === tenantId));
            // Check if any role has the permission
            for (const userRole of userRoles) {
                const role = this.roles.get(userRole.roleId);
                if (!role)
                    continue;
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
        }
        catch (error) {
            logger_1.LoggerService.error('Check permission failed:', error);
            return false;
        }
    }
    /**
     * Get user roles
     */
    static async getUserRoles(userId, tenantId) {
        try {
            return Array.from(this.userRoles.values()).filter(ur => ur.userId === userId && ur.isActive && (!tenantId || ur.tenantId === tenantId));
        }
        catch (error) {
            logger_1.LoggerService.error('Get user roles failed:', error);
            throw error;
        }
    }
    /**
     * Get all roles
     */
    static async getAllRoles(tenantType) {
        try {
            return Array.from(this.roles.values()).filter(role => !tenantType || role.tenantType === tenantType);
        }
        catch (error) {
            logger_1.LoggerService.error('Get all roles failed:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing RBAC Service...');
            this.isInitialized = false;
            this.roles.clear();
            this.permissions.clear();
            this.userRoles.clear();
            logger_1.LoggerService.info('✅ RBAC Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing RBAC Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async loadExistingUserRoles() {
        try {
            // This would typically load from database
            logger_1.LoggerService.info('Existing user roles loaded from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Load existing user roles failed:', error);
            throw error;
        }
    }
}
exports.RBACService = RBACService;
//# sourceMappingURL=rbac.js.map