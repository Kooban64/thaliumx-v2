"use strict";
// =============================================================================
// CORE TYPES
// =============================================================================
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