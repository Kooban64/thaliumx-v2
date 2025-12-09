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
export declare enum Environment {
    PLATFORM = "platform",
    BROKER = "broker",
    USER = "user"
}
export declare enum RoleType {
    MASTER_SYSTEM_ADMIN = "master_system_admin",
    PLATFORM_ADMIN = "platform_admin",
    PLATFORM_COMPLIANCE = "platform_compliance",
    PLATFORM_FINANCE = "platform_finance",
    PLATFORM_OPERATIONS = "platform_operations",
    PLATFORM_SECURITY = "platform_security",
    BROKER_ADMIN = "broker_admin",
    BROKER_COMPLIANCE = "broker_compliance",
    BROKER_FINANCE = "broker_finance",
    BROKER_OPERATIONS = "broker_operations",
    BROKER_TRADING = "broker_trading",
    BROKER_SUPPORT = "broker_support",
    USER_TRADER = "user_trader",
    USER_ANALYST = "user_analyst",
    USER_VIEWER = "user_viewer"
}
export declare enum PermissionType {
    SYSTEM_CONFIG_READ = "system.config.read",
    SYSTEM_CONFIG_WRITE = "system.config.write",
    SYSTEM_MAINTENANCE = "system.maintenance",
    USER_CREATE = "user.create",
    USER_READ = "user.read",
    USER_UPDATE = "user.update",
    USER_DELETE = "user.delete",
    USER_ROLE_ASSIGN = "user.role.assign",
    USER_ROLE_REVOKE = "user.role.revoke",
    TENANT_CREATE = "tenant.create",
    TENANT_READ = "tenant.read",
    TENANT_UPDATE = "tenant.update",
    TENANT_DELETE = "tenant.delete",
    BROKER_CREATE = "broker.create",
    BROKER_READ = "broker.read",
    BROKER_UPDATE = "broker.update",
    BROKER_DELETE = "broker.delete",
    BROKER_CONFIG = "broker.config",
    TRADING_ORDER_PLACE = "trading.order.place",
    TRADING_ORDER_CANCEL = "trading.order.cancel",
    TRADING_ORDER_READ = "trading.order.read",
    TRADING_BOOK_VIEW = "trading.book.view",
    TRADING_MARKET_DATA = "trading.market.data",
    EXCHANGE_CONFIG = "exchange.config",
    EXCHANGE_BALANCE_READ = "exchange.balance.read",
    EXCHANGE_BALANCE_MANAGE = "exchange.balance.manage",
    EXCHANGE_TRADING_ENABLE = "exchange.trading.enable",
    EXCHANGE_TRADING_DISABLE = "exchange.trading.disable",
    DEX_CONFIG = "dex.config",
    DEX_LIQUIDITY_MANAGE = "dex.liquidity.manage",
    DEX_TRADING = "dex.trading",
    NFT_CONFIG = "nft.config",
    NFT_MINT = "nft.mint",
    NFT_TRANSFER = "nft.transfer",
    NFT_MARKETPLACE_MANAGE = "nft.marketplace.manage",
    TOKEN_CONFIG = "token.config",
    TOKEN_MINT = "token.mint",
    TOKEN_BURN = "token.burn",
    TOKEN_TRANSFER = "token.transfer",
    TOKEN_FREEZE = "token.freeze",
    FINANCIAL_LEDGER_READ = "financial.ledger.read",
    FINANCIAL_LEDGER_WRITE = "financial.ledger.write",
    FINANCIAL_REPORTS = "financial.reports",
    FINANCIAL_COMPLIANCE = "financial.compliance",
    KYC_READ = "kyc.read",
    KYC_APPROVE = "kyc.approve",
    KYC_REJECT = "kyc.reject",
    KYC_DOCUMENTS_MANAGE = "kyc.documents.manage",
    KYB_READ = "kyb.read",
    KYB_APPROVE = "kyb.approve",
    KYB_REJECT = "kyb.reject",
    COMPLIANCE_REPORTS = "compliance.reports",
    COMPLIANCE_AUDIT = "compliance.audit",
    COMPLIANCE_RISK_ASSESS = "compliance.risk.assess",
    COMPLIANCE_SANCTIONS = "compliance.sanctions",
    AI_MODEL_MANAGE = "ai.model.manage",
    AI_MODEL_TRAIN = "ai.model.train",
    AI_INSIGHTS_READ = "ai.insights.read",
    AI_ANALYTICS = "ai.analytics",
    MONITORING_DASHBOARD = "monitoring.dashboard",
    MONITORING_ALERTS = "monitoring.alerts",
    MONITORING_LOGS = "monitoring.logs",
    API_ACCESS = "api.access",
    API_RATE_LIMIT_BYPASS = "api.rate.limit.bypass"
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
export declare enum TenantType {
    PLATFORM = "platform",
    BROKER = "broker",
    SYSTEM = "system"
}
export declare enum RoleLevel {
    ADMIN = "admin",
    MANAGER = "manager",
    USER = "user",
    VIEWER = "viewer"
}
export declare enum ConditionType {
    TIME_BASED = "time_based",
    LOCATION_BASED = "location_based",
    AMOUNT_BASED = "amount_based",
    FREQUENCY_BASED = "frequency_based",
    CUSTOM = "custom"
}
export declare enum ConditionOperator {
    EQUALS = "equals",
    GREATER_THAN = "greater_than",
    LESS_THAN = "less_than",
    IN = "in",
    NOT_IN = "not_in",
    CONTAINS = "contains",
    REGEX = "regex"
}
export declare class RBACService {
    private static isInitialized;
    private static roles;
    private static permissions;
    private static userRoles;
    private static roleRequests;
    private static readonly PERMISSIONS;
    private static readonly ROLE_DEFINITIONS;
    /**
     * Initialize RBAC Service
     */
    static initialize(): Promise<void>;
    /**
     * Assign role to user
     */
    static assignRole(userId: string, roleId: string, tenantId: string, assignedBy: string, reason: string, expiresAt?: Date): Promise<UserRole>;
    /**
     * Request role assignment (approval workflow if role requiresApproval)
     */
    static requestRoleAssignment(userId: string, roleId: string, tenantId: string, requestedBy: string, reason: string, approvalsRequired: number, approvers: string[]): Promise<{
        requestId: string;
        status: string;
    } | UserRole>;
    static approveRoleRequest(requestId: string, approverId: string): Promise<{
        status: string;
    }>;
    static rejectRoleRequest(requestId: string, approverId: string, reason?: string): Promise<{
        status: string;
    }>;
    static listRoleRequests(filter?: {
        tenantId?: string;
        status?: string;
    }): Promise<{
        id: string;
        userId: string;
        roleId: string;
        tenantId: string;
        requestedBy: string;
        reason: string;
        status: "pending" | "approved" | "rejected";
        approvalsRequired: number;
        approvers: string[];
        approvals: string[];
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    /**
     * Check if user has permission
     */
    static hasPermission(userId: string, permission: string, tenantId?: string, context?: any): Promise<boolean>;
    /**
     * Get user roles
     */
    static getUserRoles(userId: string, tenantId?: string): Promise<UserRole[]>;
    /**
     * Get all roles
     */
    static getAllRoles(tenantType?: TenantType): Promise<Role[]>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static loadExistingUserRoles;
}
//# sourceMappingURL=rbac.d.ts.map