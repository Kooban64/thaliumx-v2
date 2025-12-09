"use strict";
/**
 * Type Definitions
 *
 * Centralized TypeScript type definitions for the entire application.
 *
 * Type Categories:
 * - Core Types: User, Address, KYC status and levels, User roles, Permissions
 * - Authentication Types: AuthRequest, AuthResponse, JWTPayload, RefreshTokenRequest
 * - Financial Types: Transaction, TransactionType, TransactionStatus, Wallet, WalletType
 * - Tenant Types: Tenant, TenantSettings
 * - API Types: ApiResponse, PaginatedResponse, ApiError
 * - Configuration Types: DatabaseConfig, RedisConfig, JWTConfig, SMTPConfig, AppConfig
 * - Exchange Types: Order, Trade, TradingPair, MarketData, Balance
 * - Utility Types: DeepPartial, Optional, RequiredFields, etc.
 *
 * Usage:
 * - Imported throughout the application
 * - Provides type safety and IntelliSense
 * - Ensures consistent data structures
 * - Used for API request/response validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletType = exports.TransactionStatus = exports.TransactionType = exports.UserRole = exports.KycLevel = exports.KycStatus = void 0;
var KycStatus;
(function (KycStatus) {
    KycStatus["NOT_STARTED"] = "not_started";
    KycStatus["IN_PROGRESS"] = "in_progress";
    KycStatus["PENDING_REVIEW"] = "pending_review";
    KycStatus["APPROVED"] = "approved";
    KycStatus["REJECTED"] = "rejected";
    KycStatus["EXPIRED"] = "expired";
})(KycStatus || (exports.KycStatus = KycStatus = {}));
var KycLevel;
(function (KycLevel) {
    KycLevel["BASIC"] = "basic";
    KycLevel["INTERMEDIATE"] = "intermediate";
    KycLevel["ADVANCED"] = "advanced";
    KycLevel["ENTERPRISE"] = "enterprise";
})(KycLevel || (exports.KycLevel = KycLevel = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["BROKER"] = "broker";
    UserRole["COMPLIANCE"] = "compliance";
    UserRole["FINANCE"] = "finance";
    UserRole["SUPPORT"] = "support";
    UserRole["SUPER_ADMIN"] = "super_admin";
    // Platform roles
    UserRole["PLATFORM_ADMIN"] = "platform-admin";
    UserRole["PLATFORM_COMPLIANCE"] = "platform-compliance";
    UserRole["PLATFORM_FINANCE"] = "platform-finance";
    UserRole["PLATFORM_OPERATIONS"] = "platform-operations";
    UserRole["PLATFORM_SECURITY"] = "platform-security";
    // Broker roles
    UserRole["BROKER_ADMIN"] = "broker-admin";
    UserRole["BROKER_COMPLIANCE"] = "broker-compliance";
    UserRole["BROKER_FINANCE"] = "broker-finance";
    UserRole["BROKER_OPERATIONS"] = "broker-operations";
    UserRole["BROKER_TRADING"] = "broker-trading";
    UserRole["BROKER_SUPPORT"] = "broker-support";
})(UserRole || (exports.UserRole = UserRole = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["DEPOSIT"] = "deposit";
    TransactionType["WITHDRAWAL"] = "withdrawal";
    TransactionType["TRANSFER"] = "transfer";
    TransactionType["TRADE"] = "trade";
    TransactionType["FEE"] = "fee";
    TransactionType["REWARD"] = "reward";
    TransactionType["REFUND"] = "refund";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["CONFIRMED"] = "confirmed";
    TransactionStatus["FAILED"] = "failed";
    TransactionStatus["CANCELLED"] = "cancelled";
    TransactionStatus["PROCESSING"] = "processing";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var WalletType;
(function (WalletType) {
    WalletType["HOT"] = "hot";
    WalletType["COLD"] = "cold";
    WalletType["MULTI_SIG"] = "multi_sig";
    WalletType["HARDWARE"] = "hardware";
})(WalletType || (exports.WalletType = WalletType = {}));
//# sourceMappingURL=index.js.map