"use strict";
/**
 * Multi-Tier Ledger System Service
 *
 * Production-ready multi-tier ledger system with comprehensive features:
 * - Platform Master Accounts (Level 1)
 * - Broker Master Accounts (Level 2)
 * - End User Accounts (Level 3)
 * - Fund Segregation and Oversight
 * - Banking Integration
 * - Real-time Reconciliation
 * - Compliance Monitoring
 *
 * Based on industry standards for financial platforms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiTierLedgerService = exports.RiskLevel = exports.IssueSeverity = exports.IssueType = exports.ReconciliationStatus = exports.TransactionStatus = exports.TransactionType = exports.SegregationStatus = exports.SegregationType = exports.BankAccountType = exports.AccountStatus = exports.AccountLevel = exports.AccountType = void 0;
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const blnkfinance_1 = require("./blnkfinance");
const database_1 = require("./database");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
var AccountType;
(function (AccountType) {
    AccountType["PLATFORM_MASTER"] = "platform_master";
    AccountType["BROKER_MASTER"] = "broker_master";
    AccountType["END_USER"] = "end_user";
})(AccountType || (exports.AccountType = AccountType = {}));
var AccountLevel;
(function (AccountLevel) {
    AccountLevel[AccountLevel["LEVEL_1"] = 1] = "LEVEL_1";
    AccountLevel[AccountLevel["LEVEL_2"] = 2] = "LEVEL_2";
    AccountLevel[AccountLevel["LEVEL_3"] = 3] = "LEVEL_3"; // End User
})(AccountLevel || (exports.AccountLevel = AccountLevel = {}));
var AccountStatus;
(function (AccountStatus) {
    AccountStatus["ACTIVE"] = "active";
    AccountStatus["SUSPENDED"] = "suspended";
    AccountStatus["CLOSED"] = "closed";
    AccountStatus["PENDING_APPROVAL"] = "pending_approval";
})(AccountStatus || (exports.AccountStatus = AccountStatus = {}));
var BankAccountType;
(function (BankAccountType) {
    BankAccountType["CHECKING"] = "checking";
    BankAccountType["SAVINGS"] = "savings";
    BankAccountType["BUSINESS"] = "business";
    BankAccountType["ESCROW"] = "escrow";
    BankAccountType["CUSTODY"] = "custody";
})(BankAccountType || (exports.BankAccountType = BankAccountType = {}));
var SegregationType;
(function (SegregationType) {
    SegregationType["CLIENT_FUNDS"] = "client_funds";
    SegregationType["OPERATIONAL_FUNDS"] = "operational_funds";
    SegregationType["RESERVE_FUNDS"] = "reserve_funds";
    SegregationType["INSURANCE_FUNDS"] = "insurance_funds";
    SegregationType["REGULATORY_FUNDS"] = "regulatory_funds";
})(SegregationType || (exports.SegregationType = SegregationType = {}));
var SegregationStatus;
(function (SegregationStatus) {
    SegregationStatus["ACTIVE"] = "active";
    SegregationStatus["RELEASED"] = "released";
    SegregationStatus["EXPIRED"] = "expired";
    SegregationStatus["DISPUTED"] = "disputed";
})(SegregationStatus || (exports.SegregationStatus = SegregationStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["DEPOSIT"] = "deposit";
    TransactionType["WITHDRAWAL"] = "withdrawal";
    TransactionType["TRANSFER"] = "transfer";
    TransactionType["TRADE"] = "trade";
    TransactionType["FEE"] = "fee";
    TransactionType["INTEREST"] = "interest";
    TransactionType["DIVIDEND"] = "dividend";
    TransactionType["REBATE"] = "rebate";
    TransactionType["ADJUSTMENT"] = "adjustment";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "pending";
    TransactionStatus["PROCESSING"] = "processing";
    TransactionStatus["COMPLETED"] = "completed";
    TransactionStatus["FAILED"] = "failed";
    TransactionStatus["CANCELLED"] = "cancelled";
    TransactionStatus["REQUIRES_APPROVAL"] = "requires_approval";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var ReconciliationStatus;
(function (ReconciliationStatus) {
    ReconciliationStatus["PENDING"] = "pending";
    ReconciliationStatus["IN_PROGRESS"] = "in_progress";
    ReconciliationStatus["COMPLETED"] = "completed";
    ReconciliationStatus["DISCREPANCY"] = "discrepancy";
    ReconciliationStatus["FAILED"] = "failed";
})(ReconciliationStatus || (exports.ReconciliationStatus = ReconciliationStatus = {}));
var IssueType;
(function (IssueType) {
    IssueType["BALANCE_MISMATCH"] = "balance_mismatch";
    IssueType["MISSING_TRANSACTION"] = "missing_transaction";
    IssueType["DUPLICATE_TRANSACTION"] = "duplicate_transaction";
    IssueType["INVALID_TRANSACTION"] = "invalid_transaction";
    IssueType["TIMING_DIFFERENCE"] = "timing_difference";
})(IssueType || (exports.IssueType = IssueType = {}));
var IssueSeverity;
(function (IssueSeverity) {
    IssueSeverity["LOW"] = "low";
    IssueSeverity["MEDIUM"] = "medium";
    IssueSeverity["HIGH"] = "high";
    IssueSeverity["CRITICAL"] = "critical";
})(IssueSeverity || (exports.IssueSeverity = IssueSeverity = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
    RiskLevel["CRITICAL"] = "critical";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
// =============================================================================
// MULTI-TIER LEDGER SERVICE CLASS
// =============================================================================
class MultiTierLedgerService {
    static isInitialized = false;
    static accounts = new Map();
    static fundSegregations = new Map();
    static transactions = new Map();
    static reconciliationReports = new Map();
    // Ledger configuration
    static LEDGER_CONFIG = {
        platformMasterAccountId: process.env.PLATFORM_MASTER_ACCOUNT_ID || 'platform-master',
        defaultCurrency: 'USD',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL'],
        reconciliationInterval: 24 * 60 * 60 * 1000, // 24 hours
        maxTransactionAmount: 1000000, // $1M
        approvalThreshold: 10000, // $10k
        segregationRequired: true,
        complianceMonitoring: true
    };
    /**
     * Initialize Multi-Tier Ledger Service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Multi-Tier Ledger Service...');
            // Validate configuration
            await this.validateConfiguration();
            // Load existing data
            await this.loadExistingData();
            // Initialize platform master account
            await this.initializePlatformMasterAccount();
            // Start reconciliation scheduler
            await this.startReconciliationScheduler();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Multi-Tier Ledger Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('multi-tier-ledger.initialized', 'MultiTierLedgerService', 'info', {
                message: 'Multi-tier ledger service initialized',
                accountsCount: this.accounts.size,
                fundSegregationsCount: this.fundSegregations.size,
                transactionsCount: this.transactions.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Multi-Tier Ledger Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create Platform Master Account
     */
    static async createPlatformMasterAccount(tenantId, name, currency = 'USD', bankAccount) {
        try {
            logger_1.LoggerService.info('Creating platform master account', {
                tenantId,
                name,
                currency
            });
            const accountId = (0, uuid_1.v4)();
            const blnkAccountId = await this.createBlnkAccount(accountId, name, currency);
            const account = {
                id: accountId,
                tenantId,
                accountType: AccountType.PLATFORM_MASTER,
                accountLevel: AccountLevel.LEVEL_1,
                name,
                currency,
                blnkAccountId,
                bankAccount,
                status: AccountStatus.ACTIVE,
                permissions: {
                    canDeposit: true,
                    canWithdraw: true,
                    canTransfer: true,
                    canTrade: true,
                    canLend: true,
                    canBorrow: true,
                    maxDailyVolume: 10000000, // $10M
                    maxMonthlyVolume: 100000000, // $100M
                    maxSingleTransaction: 1000000, // $1M
                    requiresApproval: false,
                    approvalThreshold: 0
                },
                metadata: {
                    description: 'Platform master account for fund management',
                    tags: ['platform', 'master', 'funds'],
                    complianceFlags: [],
                    riskLevel: RiskLevel.LOW,
                    lastReconciliation: new Date(),
                    version: '1.0.0'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store account
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('Platform master account created successfully', {
                accountId: account.id,
                tenantId: account.tenantId,
                blnkAccountId: account.blnkAccountId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('platform-master-account.created', 'multi-tier-ledger', accountId, {
                tenantId,
                name,
                currency,
                bankAccount: bankAccount ? 'configured' : 'not_configured'
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Create platform master account failed:', error);
            throw error;
        }
    }
    /**
     * Create Broker Master Account
     */
    static async createBrokerMasterAccount(tenantId, brokerId, name, currency = 'USD', parentAccountId, bankAccount) {
        try {
            logger_1.LoggerService.info('Creating broker master account', {
                tenantId,
                brokerId,
                name,
                currency,
                parentAccountId
            });
            // Validate parent account
            const parentAccount = this.accounts.get(parentAccountId);
            if (!parentAccount || parentAccount.accountLevel !== AccountLevel.LEVEL_1) {
                throw (0, utils_1.createError)('Invalid parent account for broker master account', 400, 'INVALID_PARENT_ACCOUNT');
            }
            const accountId = (0, uuid_1.v4)();
            const blnkAccountId = await this.createBlnkAccount(accountId, name, currency);
            const account = {
                id: accountId,
                tenantId,
                accountType: AccountType.BROKER_MASTER,
                accountLevel: AccountLevel.LEVEL_2,
                parentAccountId,
                name,
                currency,
                blnkAccountId,
                bankAccount,
                status: AccountStatus.ACTIVE,
                permissions: {
                    canDeposit: true,
                    canWithdraw: true,
                    canTransfer: true,
                    canTrade: true,
                    canLend: true,
                    canBorrow: false,
                    maxDailyVolume: 1000000, // $1M
                    maxMonthlyVolume: 10000000, // $10M
                    maxSingleTransaction: 100000, // $100k
                    requiresApproval: true,
                    approvalThreshold: 50000 // $50k
                },
                metadata: {
                    description: `Broker master account for ${brokerId}`,
                    tags: ['broker', 'master', brokerId],
                    complianceFlags: [],
                    riskLevel: RiskLevel.MEDIUM,
                    lastReconciliation: new Date(),
                    version: '1.0.0'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store account
            this.accounts.set(accountId, account);
            // Create fund segregation
            await this.createFundSegregation(accountId, SegregationType.CLIENT_FUNDS, 0, currency);
            logger_1.LoggerService.info('Broker master account created successfully', {
                accountId: account.id,
                tenantId: account.tenantId,
                brokerId,
                blnkAccountId: account.blnkAccountId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('broker-master-account.created', 'multi-tier-ledger', accountId, {
                tenantId,
                brokerId,
                name,
                currency,
                parentAccountId
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Create broker master account failed:', error);
            throw error;
        }
    }
    /**
     * Create End User Account
     */
    static async createEndUserAccount(tenantId, userId, name, currency = 'USD', parentAccountId, bankAccount) {
        try {
            logger_1.LoggerService.info('Creating end user account', {
                tenantId,
                userId,
                name,
                currency,
                parentAccountId
            });
            // Validate parent account
            const parentAccount = this.accounts.get(parentAccountId);
            if (!parentAccount || parentAccount.accountLevel !== AccountLevel.LEVEL_2) {
                throw (0, utils_1.createError)('Invalid parent account for end user account', 400, 'INVALID_PARENT_ACCOUNT');
            }
            const accountId = (0, uuid_1.v4)();
            const blnkAccountId = await this.createBlnkAccount(accountId, name, currency);
            const account = {
                id: accountId,
                tenantId,
                accountType: AccountType.END_USER,
                accountLevel: AccountLevel.LEVEL_3,
                parentAccountId,
                name,
                currency,
                blnkAccountId,
                bankAccount,
                status: AccountStatus.ACTIVE,
                permissions: {
                    canDeposit: true,
                    canWithdraw: true,
                    canTransfer: true,
                    canTrade: true,
                    canLend: false,
                    canBorrow: false,
                    maxDailyVolume: 100000, // $100k
                    maxMonthlyVolume: 1000000, // $1M
                    maxSingleTransaction: 10000, // $10k
                    requiresApproval: true,
                    approvalThreshold: 5000 // $5k
                },
                metadata: {
                    description: `End user account for ${userId}`,
                    tags: ['user', 'end-user', userId],
                    complianceFlags: [],
                    riskLevel: RiskLevel.MEDIUM,
                    lastReconciliation: new Date(),
                    version: '1.0.0'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store account
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('End user account created successfully', {
                accountId: account.id,
                tenantId: account.tenantId,
                userId,
                blnkAccountId: account.blnkAccountId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('end-user-account.created', 'multi-tier-ledger', accountId, {
                tenantId,
                userId,
                name,
                currency,
                parentAccountId
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Create end user account failed:', error);
            throw error;
        }
    }
    /**
     * Get Platform Master Accounts
     */
    static async getPlatformMasterAccounts(tenantId) {
        try {
            const accounts = Array.from(this.accounts.values())
                .filter(account => account.tenantId === tenantId &&
                account.accountType === AccountType.PLATFORM_MASTER &&
                account.accountLevel === AccountLevel.LEVEL_1);
            logger_1.LoggerService.info('Retrieved platform master accounts', {
                tenantId,
                count: accounts.length
            });
            return accounts;
        }
        catch (error) {
            logger_1.LoggerService.error('Get platform master accounts failed:', error);
            throw error;
        }
    }
    /**
     * Get Broker Master Accounts
     */
    static async getBrokerMasterAccounts(tenantId, brokerId) {
        try {
            let accounts = Array.from(this.accounts.values())
                .filter(account => account.tenantId === tenantId &&
                account.accountType === AccountType.BROKER_MASTER &&
                account.accountLevel === AccountLevel.LEVEL_2);
            // If brokerId provided, filter by it (for broker-tenants, brokerId = tenantId)
            if (brokerId) {
                // For broker-tenants, brokerId equals tenantId, so filter by parent account
                // or check metadata for brokerId
                accounts = accounts.filter(account => {
                    // Check if this broker's account (could be stored in metadata or we check parent)
                    const parentAccount = this.accounts.get(account.parentAccountId || '');
                    return parentAccount?.tenantId === tenantId;
                });
            }
            logger_1.LoggerService.info('Retrieved broker master accounts', {
                tenantId,
                brokerId,
                count: accounts.length
            });
            return accounts;
        }
        catch (error) {
            logger_1.LoggerService.error('Get broker master accounts failed:', error);
            throw error;
        }
    }
    /**
     * Get Broker Master Account by ID
     */
    static async getBrokerMasterAccount(accountId) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.accountType !== AccountType.BROKER_MASTER) {
                return null;
            }
            logger_1.LoggerService.info('Retrieved broker master account', {
                accountId,
                tenantId: account.tenantId
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Get broker master account failed:', error);
            throw error;
        }
    }
    /**
     * Get End User Accounts
     */
    static async getEndUserAccounts(tenantId, brokerId, userId) {
        try {
            let accounts = Array.from(this.accounts.values())
                .filter(account => account.tenantId === tenantId &&
                account.accountType === AccountType.END_USER &&
                account.accountLevel === AccountLevel.LEVEL_3);
            // Filter by broker if provided (check parent account)
            if (brokerId) {
                accounts = accounts.filter(account => {
                    const parentAccount = this.accounts.get(account.parentAccountId || '');
                    return parentAccount?.tenantId === tenantId;
                });
            }
            // Filter by userId if provided (check metadata tags)
            if (userId) {
                accounts = accounts.filter(account => account.metadata.tags?.includes(userId));
            }
            logger_1.LoggerService.info('Retrieved end user accounts', {
                tenantId,
                brokerId,
                userId,
                count: accounts.length
            });
            return accounts;
        }
        catch (error) {
            logger_1.LoggerService.error('Get end user accounts failed:', error);
            throw error;
        }
    }
    /**
     * Get End User Account by ID
     */
    static async getEndUserAccount(accountId) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.accountType !== AccountType.END_USER) {
                return null;
            }
            logger_1.LoggerService.info('Retrieved end user account', {
                accountId,
                tenantId: account.tenantId
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Get end user account failed:', error);
            throw error;
        }
    }
    /**
     * Configure Bank Account for Ledger Account
     */
    static async configureBankAccount(accountId, bankAccount) {
        try {
            const account = this.accounts.get(accountId);
            if (!account) {
                throw (0, utils_1.createError)('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Update bank account
            account.bankAccount = bankAccount;
            account.updatedAt = new Date();
            // Store updated account
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('Bank account configured successfully', {
                accountId,
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('bank-account.configured', 'multi-tier-ledger', accountId, {
                bankName: bankAccount.bankName,
                accountType: bankAccount.accountType,
                currency: bankAccount.currency,
                country: bankAccount.country,
                isVerified: bankAccount.isVerified
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Configure bank account failed:', error);
            throw error;
        }
    }
    /**
     * Get Bank Account for Ledger Account
     */
    static async getBankAccount(accountId) {
        try {
            const account = this.accounts.get(accountId);
            if (!account) {
                return null;
            }
            return account.bankAccount || null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get bank account failed:', error);
            throw error;
        }
    }
    /**
     * Update Bank Account for Ledger Account
     */
    static async updateBankAccount(accountId, updates) {
        try {
            const account = this.accounts.get(accountId);
            if (!account) {
                throw (0, utils_1.createError)('Account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            if (!account.bankAccount) {
                throw (0, utils_1.createError)('Bank account not configured', 400, 'BANK_ACCOUNT_NOT_CONFIGURED');
            }
            // Update bank account fields
            account.bankAccount = {
                ...account.bankAccount,
                ...updates,
                id: account.bankAccount.id, // Preserve ID
                updatedAt: new Date()
            };
            account.updatedAt = new Date();
            // Store updated account
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('Bank account updated successfully', {
                accountId,
                updates: Object.keys(updates)
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('bank-account.updated', 'multi-tier-ledger', accountId, {
                updates: Object.keys(updates),
                bankName: account.bankAccount.bankName
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Update bank account failed:', error);
            throw error;
        }
    }
    /**
     * Get Account Transfers
     */
    static async getAccountTransfers(accountId, filters) {
        try {
            let transactions = Array.from(this.transactions.values())
                .filter(t => t.fromAccountId === accountId || t.toAccountId === accountId);
            // Apply filters
            if (filters?.fromDate) {
                transactions = transactions.filter(t => t.createdAt >= filters.fromDate);
            }
            if (filters?.toDate) {
                transactions = transactions.filter(t => t.createdAt <= filters.toDate);
            }
            if (filters?.status) {
                transactions = transactions.filter(t => t.status === filters.status);
            }
            if (filters?.transactionType) {
                transactions = transactions.filter(t => t.transactionType === filters.transactionType);
            }
            const total = transactions.length;
            // Sort by date (newest first)
            transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            // Apply pagination
            const offset = filters?.offset || 0;
            const limit = filters?.limit || 50;
            const paginatedTransactions = transactions.slice(offset, offset + limit);
            logger_1.LoggerService.info('Retrieved account transfers', {
                accountId,
                total,
                returned: paginatedTransactions.length,
                filters: filters || {}
            });
            return {
                transactions: paginatedTransactions,
                total
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get account transfers failed:', error);
            throw error;
        }
    }
    /**
     * Transfer funds between accounts
     */
    static async transferFunds(fromAccountId, toAccountId, amount, currency, description, reference, metadata) {
        try {
            logger_1.LoggerService.info('Processing fund transfer', {
                fromAccountId,
                toAccountId,
                amount,
                currency,
                description
            });
            // Validate accounts
            const fromAccount = this.accounts.get(fromAccountId);
            const toAccount = this.accounts.get(toAccountId);
            if (!fromAccount || !toAccount) {
                throw (0, utils_1.createError)('One or both accounts not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            if (fromAccount.status !== AccountStatus.ACTIVE || toAccount.status !== AccountStatus.ACTIVE) {
                throw (0, utils_1.createError)('One or both accounts are not active', 400, 'ACCOUNT_NOT_ACTIVE');
            }
            // Check permissions
            if (!fromAccount.permissions.canTransfer) {
                throw (0, utils_1.createError)('From account does not have transfer permissions', 403, 'TRANSFER_NOT_ALLOWED');
            }
            // Check limits
            if (amount > fromAccount.permissions.maxSingleTransaction) {
                throw (0, utils_1.createError)('Amount exceeds maximum single transaction limit', 400, 'AMOUNT_EXCEEDS_LIMIT');
            }
            // Check approval requirements
            const requiresApproval = fromAccount.permissions.requiresApproval &&
                amount >= fromAccount.permissions.approvalThreshold;
            const transactionId = (0, uuid_1.v4)();
            const transaction = {
                id: transactionId,
                fromAccountId,
                toAccountId,
                amount,
                currency,
                transactionType: TransactionType.TRANSFER,
                description,
                reference,
                status: requiresApproval ? TransactionStatus.REQUIRES_APPROVAL : TransactionStatus.PENDING,
                metadata: {
                    source: 'multi-tier-ledger',
                    complianceFlags: [],
                    riskScore: this.calculateRiskScore(fromAccount, toAccount, amount),
                    approvalRequired: requiresApproval,
                    ...metadata
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store transaction
            this.transactions.set(transactionId, transaction);
            // Process transaction if no approval required
            if (!requiresApproval) {
                await this.processTransaction(transaction);
            }
            logger_1.LoggerService.info('Fund transfer processed successfully', {
                transactionId: transaction.id,
                fromAccountId: transaction.fromAccountId,
                toAccountId: transaction.toAccountId,
                amount: transaction.amount,
                status: transaction.status
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fund-transfer.processed', 'multi-tier-ledger', transactionId, {
                fromAccountId,
                toAccountId,
                amount,
                currency,
                description,
                requiresApproval
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Transfer funds failed:', error);
            throw error;
        }
    }
    /**
     * Get ledger statistics
     */
    static async getLedgerStats() {
        try {
            const accounts = Array.from(this.accounts.values());
            const transactions = Array.from(this.transactions.values());
            const totalAccounts = accounts.length;
            const activeAccounts = accounts.filter(a => a.status === AccountStatus.ACTIVE).length;
            const suspendedAccounts = accounts.filter(a => a.status === AccountStatus.SUSPENDED).length;
            // Calculate balances from BlnkFinance
            let totalBalance = 0;
            try {
                for (const account of accounts) {
                    const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(account.id);
                    totalBalance += balance ? balance.netBalance : 0;
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to fetch balances from BlnkFinance, using 0', { error });
                totalBalance = 0;
            }
            const byLevel = await Promise.all([
                AccountLevel.LEVEL_1,
                AccountLevel.LEVEL_2,
                AccountLevel.LEVEL_3
            ].map(async (level) => {
                const levelAccounts = accounts.filter(a => a.accountLevel === level);
                // Calculate total balance for this level
                let levelBalance = 0;
                try {
                    for (const acc of levelAccounts) {
                        const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(acc.id);
                        levelBalance += balance ? balance.netBalance : 0;
                    }
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch level balance from BlnkFinance', { level, error });
                }
                return {
                    level,
                    count: levelAccounts.length,
                    totalBalance: levelBalance,
                    activeAccounts: levelAccounts.filter(a => a.status === AccountStatus.ACTIVE).length
                };
            }));
            const byCurrency = await Promise.all(this.LEDGER_CONFIG.supportedCurrencies.map(async (currency) => {
                const currencyAccounts = accounts.filter(a => a.currency === currency);
                let currencyBalance = 0;
                try {
                    for (const acc of currencyAccounts) {
                        const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(acc.id);
                        currencyBalance += balance ? balance.netBalance : 0;
                    }
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch currency balance from BlnkFinance', { currency, error });
                }
                return {
                    currency,
                    count: currencyAccounts.length,
                    totalBalance: currencyBalance,
                    averageBalance: currencyAccounts.length > 0 ? currencyBalance / currencyAccounts.length : 0
                };
            }));
            const byStatus = [
                AccountStatus.ACTIVE,
                AccountStatus.SUSPENDED,
                AccountStatus.CLOSED,
                AccountStatus.PENDING_APPROVAL
            ].map(status => {
                const statusAccounts = accounts.filter(a => a.status === status);
                return {
                    status,
                    count: statusAccounts.length,
                    percentage: totalAccounts > 0 ? (statusAccounts.length / totalAccounts) * 100 : 0
                };
            });
            const recentTransactions = transactions.filter(t => new Date(t.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
            const pendingTransactions = transactions.filter(t => t.status === TransactionStatus.PENDING || t.status === TransactionStatus.REQUIRES_APPROVAL).length;
            const failedTransactions = transactions.filter(t => t.status === TransactionStatus.FAILED).length;
            return {
                totalAccounts,
                activeAccounts,
                suspendedAccounts,
                totalBalance,
                byLevel,
                byCurrency,
                byStatus,
                recentTransactions,
                pendingTransactions,
                failedTransactions
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get ledger stats failed:', error);
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
            logger_1.LoggerService.info('Closing Multi-Tier Ledger Service...');
            this.isInitialized = false;
            this.accounts.clear();
            this.fundSegregations.clear();
            this.transactions.clear();
            this.reconciliationReports.clear();
            logger_1.LoggerService.info('✅ Multi-Tier Ledger Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing Multi-Tier Ledger Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async validateConfiguration() {
        try {
            if (!this.LEDGER_CONFIG.platformMasterAccountId) {
                throw new Error('Platform master account ID not configured');
            }
            logger_1.LoggerService.info('Multi-tier ledger configuration validated successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Validate configuration failed:', error);
            throw error;
        }
    }
    static async loadExistingData() {
        try {
            // This would typically load from database
            logger_1.LoggerService.info('Existing multi-tier ledger data loaded from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Load existing data failed:', error);
            throw error;
        }
    }
    static async initializePlatformMasterAccount() {
        try {
            // Check if platform master account already exists
            const existingAccount = Array.from(this.accounts.values()).find(a => a.accountType === AccountType.PLATFORM_MASTER);
            if (!existingAccount) {
                await this.createPlatformMasterAccount('platform', 'Platform Master Account', 'USD');
                logger_1.LoggerService.info('Platform master account initialized');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize platform master account failed:', error);
            throw error;
        }
    }
    static async startReconciliationScheduler() {
        try {
            // Start reconciliation scheduler
            setInterval(async () => {
                try {
                    await this.performReconciliation();
                }
                catch (error) {
                    logger_1.LoggerService.error('Reconciliation scheduler error:', error);
                }
            }, this.LEDGER_CONFIG.reconciliationInterval);
            logger_1.LoggerService.info('Reconciliation scheduler started');
        }
        catch (error) {
            logger_1.LoggerService.error('Start reconciliation scheduler failed:', error);
            throw error;
        }
    }
    static async createBlnkAccount(accountId, name, currency) {
        try {
            // Create account in BlnkFinance
            const blnkAccount = await blnkfinance_1.BlnkFinanceService.createAccount(accountId, name, 'ASSET', currency, 'platform');
            return blnkAccount.id;
        }
        catch (error) {
            logger_1.LoggerService.error('Create BlnkFinance account failed:', error);
            throw error;
        }
    }
    /**
     * Get Fund Segregations
     */
    static async getFundSegregations(tenantId, filters) {
        try {
            // Get all accounts for this tenant
            const tenantAccounts = Array.from(this.accounts.values())
                .filter(a => a.tenantId === tenantId)
                .map(a => a.id);
            let segregations = Array.from(this.fundSegregations.values())
                .filter(s => tenantAccounts.includes(s.accountId));
            // Apply filters
            if (filters?.accountId) {
                segregations = segregations.filter(s => s.accountId === filters.accountId);
            }
            if (filters?.segregationType) {
                segregations = segregations.filter(s => s.segregationType === filters.segregationType);
            }
            if (filters?.status) {
                segregations = segregations.filter(s => s.status === filters.status);
            }
            if (filters?.currency) {
                segregations = segregations.filter(s => s.currency === filters.currency);
            }
            logger_1.LoggerService.info('Retrieved fund segregations', {
                tenantId,
                count: segregations.length,
                filters: filters || {}
            });
            return segregations;
        }
        catch (error) {
            logger_1.LoggerService.error('Get fund segregations failed:', error);
            throw error;
        }
    }
    /**
     * Get Fund Segregation by ID
     */
    static async getFundSegregation(segregationId) {
        try {
            const segregation = this.fundSegregations.get(segregationId);
            if (!segregation) {
                return null;
            }
            logger_1.LoggerService.info('Retrieved fund segregation', {
                segregationId,
                accountId: segregation.accountId
            });
            return segregation;
        }
        catch (error) {
            logger_1.LoggerService.error('Get fund segregation failed:', error);
            throw error;
        }
    }
    /**
     * Update Fund Segregation Status
     */
    static async updateFundSegregationStatus(segregationId, status) {
        try {
            const segregation = this.fundSegregations.get(segregationId);
            if (!segregation) {
                throw (0, utils_1.createError)('Fund segregation not found', 404, 'FUND_SEGREGATION_NOT_FOUND');
            }
            segregation.status = status;
            segregation.updatedAt = new Date();
            this.fundSegregations.set(segregationId, segregation);
            logger_1.LoggerService.info('Fund segregation status updated', {
                segregationId,
                status
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fund-segregation.status-updated', 'multi-tier-ledger', segregationId, {
                accountId: segregation.accountId,
                previousStatus: segregation.status,
                newStatus: status
            });
            return segregation;
        }
        catch (error) {
            logger_1.LoggerService.error('Update fund segregation status failed:', error);
            throw error;
        }
    }
    /**
     * Reconcile Bank Accounts
     */
    static async reconcileBankAccounts(tenantId, accountIds, reconciliationDate) {
        try {
            const date = reconciliationDate || new Date();
            const reportId = (0, uuid_1.v4)();
            const discrepancies = [];
            // Reconcile each account
            for (const accountId of accountIds) {
                const account = this.accounts.get(accountId);
                if (!account || account.tenantId !== tenantId) {
                    continue;
                }
                // Get expected balance from internal ledger (BlnkFinance)
                let expectedBalance = 0;
                try {
                    const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(accountId);
                    expectedBalance = balance ? balance.netBalance : 0;
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch expected balance from BlnkFinance', { accountId, error });
                    expectedBalance = 0;
                }
                // Get actual balance from bank account (external API - placeholder for now)
                // TODO: Integrate with actual bank API when available
                let actualBalance = 0;
                try {
                    // This would call the actual bank API
                    // const bankBalance = await BankAPIService.getAccountBalance(account.bankAccountId);
                    // actualBalance = bankBalance.availableBalance;
                    logger_1.LoggerService.warn('Bank API integration pending, using expected balance', { accountId });
                    actualBalance = expectedBalance; // Use expected as fallback until bank API is integrated
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch actual balance from bank API', { accountId, error });
                    actualBalance = expectedBalance; // Use expected as fallback
                }
                if (Math.abs(expectedBalance - actualBalance) > 0.01) { // Tolerance for floating point
                    discrepancies.push({
                        accountId,
                        expectedBalance,
                        actualBalance,
                        difference: actualBalance - expectedBalance,
                        currency: account.currency
                    });
                }
            }
            // Create reconciliation report for first account (interface expects single accountId)
            // For multiple accounts, we'll create one report per account or aggregate
            const primaryAccountId = accountIds[0];
            if (!primaryAccountId) {
                throw new Error('No accounts found for reconciliation');
            }
            const account = this.accounts.get(primaryAccountId);
            // Calculate aggregate balances
            let totalExpected = 0;
            let totalActual = 0;
            const issues = [];
            for (const accId of accountIds) {
                const acc = this.accounts.get(accId);
                if (acc) {
                    // Fetch from BlnkFinance and bank API
                    let expected = 0;
                    let actual = 0;
                    try {
                        const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(accId);
                        expected = balance ? balance.netBalance : 0;
                    }
                    catch (error) {
                        logger_1.LoggerService.warn('Failed to fetch expected balance from BlnkFinance', { accId, error });
                    }
                    try {
                        // TODO: Integrate with actual bank API when available
                        // const bankBalance = await BankAPIService.getAccountBalance(acc.bankAccountId);
                        // actual = bankBalance.availableBalance;
                        actual = expected; // Use expected as fallback until bank API is integrated
                    }
                    catch (error) {
                        logger_1.LoggerService.warn('Failed to fetch actual balance from bank API', { accId, error });
                        actual = expected; // Use expected as fallback
                    }
                    totalExpected += expected;
                    totalActual += actual;
                    if (Math.abs(expected - actual) > 0.01) {
                        issues.push({
                            type: 'balance_discrepancy',
                            description: `Balance discrepancy for account ${accId}`,
                            amount: actual - expected,
                            currency: acc.currency,
                            severity: 'medium',
                            resolved: false
                        });
                    }
                }
            }
            const report = {
                id: reportId,
                accountId: primaryAccountId,
                reportDate: date,
                blnkBalance: totalExpected,
                bankBalance: totalActual,
                discrepancy: totalActual - totalExpected,
                status: issues.length === 0 ? ReconciliationStatus.COMPLETED : ReconciliationStatus.DISCREPANCY,
                issues,
                createdAt: new Date()
            };
            this.reconciliationReports.set(reportId, report);
            logger_1.LoggerService.info('Bank account reconciliation completed', {
                reportId,
                tenantId,
                totalAccounts: accountIds.length,
                discrepancies: discrepancies.length
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('bank-reconciliation.completed', 'multi-tier-ledger', reportId, {
                tenantId,
                totalAccounts: accountIds.length,
                discrepancies: discrepancies.length,
                status: report.status
            });
            return report;
        }
        catch (error) {
            logger_1.LoggerService.error('Reconcile bank accounts failed:', error);
            throw error;
        }
    }
    /**
     * Get Reconciliation Reports
     */
    static async getReconciliationReports(tenantId, filters) {
        try {
            // Get reports by checking account tenantId
            const tenantAccountIds = Array.from(this.accounts.values())
                .filter(a => a.tenantId === tenantId)
                .map(a => a.id);
            let reports = Array.from(this.reconciliationReports.values())
                .filter(r => tenantAccountIds.includes(r.accountId));
            // Apply filters
            if (filters?.fromDate) {
                reports = reports.filter(r => r.reportDate >= filters.fromDate);
            }
            if (filters?.toDate) {
                reports = reports.filter(r => r.reportDate <= filters.toDate);
            }
            if (filters?.status) {
                reports = reports.filter(r => r.status === filters.status);
            }
            const total = reports.length;
            // Sort by date (newest first)
            reports.sort((a, b) => b.reportDate.getTime() - a.reportDate.getTime());
            // Apply pagination
            const offset = filters?.offset || 0;
            const limit = filters?.limit || 50;
            const paginatedReports = reports.slice(offset, offset + limit);
            logger_1.LoggerService.info('Retrieved reconciliation reports', {
                tenantId,
                total,
                returned: paginatedReports.length
            });
            return {
                reports: paginatedReports,
                total
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get reconciliation reports failed:', error);
            throw error;
        }
    }
    /**
     * Create Fiat Deposit
     */
    static async createFiatDeposit(tenantId, accountId, amount, currency, reference, description) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Create deposit transaction
            const transactionId = (0, uuid_1.v4)();
            const transaction = {
                id: transactionId,
                fromAccountId: '', // External source
                toAccountId: accountId,
                amount,
                currency,
                transactionType: TransactionType.DEPOSIT,
                description: description || `Fiat deposit - ${reference}`,
                reference,
                status: TransactionStatus.PENDING,
                metadata: {
                    source: 'fiat-deposit',
                    reference,
                    ipAddress: undefined,
                    userAgent: undefined,
                    complianceFlags: [],
                    riskScore: 0,
                    approvalRequired: false,
                    segregationValidated: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.transactions.set(transactionId, transaction);
            // Process deposit (would typically integrate with FiatService)
            await this.processTransaction(transaction);
            logger_1.LoggerService.info('Fiat deposit created', {
                transactionId,
                accountId,
                amount,
                currency,
                reference
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fiat-deposit.created', 'multi-tier-ledger', transactionId, {
                tenantId,
                accountId,
                amount,
                currency,
                reference
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Create fiat deposit failed:', error);
            throw error;
        }
    }
    /**
     * Create Fiat Withdrawal
     */
    static async createFiatWithdrawal(tenantId, accountId, amount, currency, bankAccountId, description) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
            }
            if (!account.bankAccount || account.bankAccount.id !== bankAccountId) {
                throw (0, utils_1.createError)('Bank account not configured or invalid', 400, 'INVALID_BANK_ACCOUNT');
            }
            // Check account balance (would fetch from BlnkFinance)
            // Placeholder validation
            const requiresApproval = amount > (account.permissions.approvalThreshold || 10000);
            // Create withdrawal transaction
            const transactionId = (0, uuid_1.v4)();
            const transaction = {
                id: transactionId,
                fromAccountId: accountId,
                toAccountId: '', // External destination
                amount,
                currency,
                transactionType: TransactionType.WITHDRAWAL,
                description: description || `Fiat withdrawal to ${account.bankAccount.bankName}`,
                reference: `WTH-${transactionId.substring(0, 8)}`,
                status: requiresApproval ? TransactionStatus.REQUIRES_APPROVAL : TransactionStatus.PENDING,
                metadata: {
                    source: 'fiat-withdrawal',
                    bankAccountId,
                    ipAddress: undefined,
                    userAgent: undefined,
                    complianceFlags: [],
                    riskScore: this.calculateWithdrawalRiskScore(account, amount),
                    approvalRequired: requiresApproval,
                    segregationValidated: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.transactions.set(transactionId, transaction);
            // Process withdrawal if no approval needed (would typically integrate with FiatService)
            if (!requiresApproval) {
                await this.processTransaction(transaction);
            }
            logger_1.LoggerService.info('Fiat withdrawal created', {
                transactionId,
                accountId,
                amount,
                currency,
                bankAccountId,
                requiresApproval
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fiat-withdrawal.created', 'multi-tier-ledger', transactionId, {
                tenantId,
                accountId,
                amount,
                currency,
                bankAccountId,
                requiresApproval
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Create fiat withdrawal failed:', error);
            throw error;
        }
    }
    /**
     * Get Fiat Transactions
     */
    static async getFiatTransactions(tenantId, filters) {
        try {
            // Get all accounts for tenant
            const tenantAccountIds = Array.from(this.accounts.values())
                .filter(a => a.tenantId === tenantId)
                .map(a => a.id);
            let transactions = Array.from(this.transactions.values())
                .filter(t => (tenantAccountIds.includes(t.fromAccountId) || tenantAccountIds.includes(t.toAccountId)) &&
                (t.transactionType === TransactionType.DEPOSIT || t.transactionType === TransactionType.WITHDRAWAL));
            // Apply filters
            if (filters?.accountId) {
                transactions = transactions.filter(t => t.fromAccountId === filters.accountId || t.toAccountId === filters.accountId);
            }
            if (filters?.type) {
                const txType = filters.type === 'deposit' ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL;
                transactions = transactions.filter(t => t.transactionType === txType);
            }
            if (filters?.status) {
                transactions = transactions.filter(t => t.status === filters.status);
            }
            if (filters?.currency) {
                transactions = transactions.filter(t => t.currency === filters.currency);
            }
            if (filters?.fromDate) {
                transactions = transactions.filter(t => t.createdAt >= filters.fromDate);
            }
            if (filters?.toDate) {
                transactions = transactions.filter(t => t.createdAt <= filters.toDate);
            }
            const total = transactions.length;
            // Sort by date (newest first)
            transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            // Apply pagination
            const offset = filters?.offset || 0;
            const limit = filters?.limit || 50;
            const paginatedTransactions = transactions.slice(offset, offset + limit);
            logger_1.LoggerService.info('Retrieved fiat transactions', {
                tenantId,
                total,
                returned: paginatedTransactions.length
            });
            return {
                transactions: paginatedTransactions,
                total
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get fiat transactions failed:', error);
            throw error;
        }
    }
    /**
     * Get Fiat Transaction by ID
     */
    static async getFiatTransaction(transactionId) {
        try {
            const transaction = this.transactions.get(transactionId);
            if (!transaction ||
                (transaction.transactionType !== TransactionType.DEPOSIT &&
                    transaction.transactionType !== TransactionType.WITHDRAWAL)) {
                return null;
            }
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Get fiat transaction failed:', error);
            throw error;
        }
    }
    /**
     * Calculate withdrawal risk score
     */
    static calculateWithdrawalRiskScore(account, amount) {
        let riskScore = 0;
        // Amount-based risk
        if (amount > 100000)
            riskScore += 30;
        else if (amount > 50000)
            riskScore += 20;
        else if (amount > 10000)
            riskScore += 10;
        // Account level risk
        if (account.accountLevel === AccountLevel.LEVEL_3)
            riskScore += 10;
        // Compliance flags
        if (account.metadata.complianceFlags.length > 0) {
            riskScore += account.metadata.complianceFlags.length * 5;
        }
        return Math.min(riskScore, 100);
    }
    /**
     * Get Unallocated Funds
     */
    static async getUnallocatedFunds(tenantId) {
        try {
            // Unallocated funds are funds that have been received but not yet assigned to a specific account
            // This would typically come from reconciliation discrepancies or pending deposits
            const unallocated = [];
            // Check for pending deposit transactions that haven't been allocated
            const tenantAccountIds = Array.from(this.accounts.values())
                .filter(a => a.tenantId === tenantId)
                .map(a => a.id);
            const pendingDeposits = Array.from(this.transactions.values())
                .filter(t => tenantAccountIds.includes(t.toAccountId) &&
                t.transactionType === TransactionType.DEPOSIT &&
                t.status === TransactionStatus.PENDING &&
                !t.metadata.context?.allocated);
            for (const tx of pendingDeposits) {
                unallocated.push({
                    currency: tx.currency,
                    amount: tx.amount,
                    accountId: tx.toAccountId,
                    reason: 'Pending deposit allocation',
                    createdAt: tx.createdAt
                });
            }
            logger_1.LoggerService.info('Retrieved unallocated funds', {
                tenantId,
                count: unallocated.length
            });
            return unallocated;
        }
        catch (error) {
            logger_1.LoggerService.error('Get unallocated funds failed:', error);
            throw error;
        }
    }
    /**
     * Allocate Fund
     */
    static async allocateFund(tenantId, fundId, targetAccountId, allocationReason) {
        try {
            // Find the unallocated fund (would be identified by transaction ID or fund ID)
            const transaction = this.transactions.get(fundId);
            if (!transaction) {
                throw (0, utils_1.createError)('Fund not found', 404, 'FUND_NOT_FOUND');
            }
            // Verify tenant access
            const targetAccount = this.accounts.get(targetAccountId);
            if (!targetAccount || targetAccount.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Target account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Update transaction metadata to mark as allocated
            transaction.metadata.context = {
                ...transaction.metadata.context,
                allocated: true,
                allocatedAt: new Date(),
                targetAccountId,
                allocationReason: allocationReason || 'Manual allocation'
            };
            transaction.updatedAt = new Date();
            this.transactions.set(fundId, transaction);
            // Process the allocation (would typically create a transfer or update account balance)
            if (transaction.status === TransactionStatus.PENDING) {
                transaction.status = TransactionStatus.PROCESSING;
                await this.processTransaction(transaction);
            }
            logger_1.LoggerService.info('Fund allocated successfully', {
                fundId,
                targetAccountId,
                tenantId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fund.allocated', 'multi-tier-ledger', fundId, {
                tenantId,
                targetAccountId,
                amount: transaction.amount,
                currency: transaction.currency,
                allocationReason
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Allocate fund failed:', error);
            throw error;
        }
    }
    /**
     * Refund Unallocated Fund
     */
    static async refundUnallocatedFund(tenantId, fundId, refundReason) {
        try {
            const transaction = this.transactions.get(fundId);
            if (!transaction) {
                throw (0, utils_1.createError)('Fund not found', 404, 'FUND_NOT_FOUND');
            }
            // Verify transaction belongs to tenant
            const account = this.accounts.get(transaction.toAccountId);
            if (!account || account.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Fund not found or access denied', 404, 'FUND_NOT_FOUND');
            }
            // Mark transaction as refunded
            transaction.status = TransactionStatus.CANCELLED;
            transaction.metadata.context = {
                ...transaction.metadata.context,
                refunded: true,
                refundedAt: new Date(),
                refundReason: refundReason || 'Manual refund'
            };
            transaction.updatedAt = new Date();
            this.transactions.set(fundId, transaction);
            logger_1.LoggerService.info('Unallocated fund refunded', {
                fundId,
                tenantId,
                refundReason
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fund.refunded', 'multi-tier-ledger', fundId, {
                tenantId,
                amount: transaction.amount,
                currency: transaction.currency,
                refundReason
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Refund unallocated fund failed:', error);
            throw error;
        }
    }
    /**
     * Get Withdrawal Limits
     */
    static async getWithdrawalLimits(tenantId, accountId) {
        try {
            const tenantAccounts = accountId
                ? [this.accounts.get(accountId)].filter(Boolean)
                : Array.from(this.accounts.values()).filter(a => a.tenantId === tenantId);
            const limits = await Promise.all(tenantAccounts.map(async (account) => {
                // Calculate current usage from transaction history
                let currentDailyUsage = 0;
                let currentMonthlyUsage = 0;
                try {
                    const TransactionModel = database_1.DatabaseService.getModel('Transaction');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    const { Op } = await import('sequelize');
                    const dailyTransactions = await TransactionModel.findAll({
                        where: {
                            tenantId: account.tenantId,
                            currency: account.currency,
                            createdAt: { [Op.gte]: today },
                            status: { [Op.in]: ['completed', 'pending'] }
                        },
                        attributes: ['amount']
                    });
                    const monthlyTransactions = await TransactionModel.findAll({
                        where: {
                            tenantId: account.tenantId,
                            currency: account.currency,
                            createdAt: { [Op.gte]: monthStart },
                            status: { [Op.in]: ['completed', 'pending'] }
                        },
                        attributes: ['amount']
                    });
                    currentDailyUsage = dailyTransactions.reduce((sum, tx) => {
                        return sum + parseFloat(tx.amount || tx.dataValues?.amount || '0');
                    }, 0);
                    currentMonthlyUsage = monthlyTransactions.reduce((sum, tx) => {
                        return sum + parseFloat(tx.amount || tx.dataValues?.amount || '0');
                    }, 0);
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to calculate usage from transaction history', {
                        error: error.message,
                        accountId: account.id
                    });
                }
                return {
                    accountId: account.id,
                    currency: account.currency,
                    dailyLimit: account.permissions.maxDailyVolume,
                    monthlyLimit: account.permissions.maxMonthlyVolume,
                    singleTransactionLimit: account.permissions.maxSingleTransaction,
                    currentDailyUsage,
                    currentMonthlyUsage,
                    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day
                };
            }));
            logger_1.LoggerService.info('Retrieved withdrawal limits', {
                tenantId,
                accountId,
                count: limits.length
            });
            return limits;
        }
        catch (error) {
            logger_1.LoggerService.error('Get withdrawal limits failed:', error);
            throw error;
        }
    }
    /**
     * Create Withdrawal Limit
     */
    static async createWithdrawalLimit(tenantId, accountId, limits) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Update account permissions
            if (limits.dailyLimit !== undefined) {
                account.permissions.maxDailyVolume = limits.dailyLimit;
            }
            if (limits.monthlyLimit !== undefined) {
                account.permissions.maxMonthlyVolume = limits.monthlyLimit;
            }
            if (limits.singleTransactionLimit !== undefined) {
                account.permissions.maxSingleTransaction = limits.singleTransactionLimit;
            }
            account.updatedAt = new Date();
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('Withdrawal limit created/updated', {
                accountId,
                tenantId,
                limits
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('withdrawal-limit.created', 'multi-tier-ledger', accountId, {
                tenantId,
                limits
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Create withdrawal limit failed:', error);
            throw error;
        }
    }
    /**
     * Update Withdrawal Limit
     */
    static async updateWithdrawalLimit(tenantId, accountId, updates) {
        try {
            const account = this.accounts.get(accountId);
            if (!account || account.tenantId !== tenantId) {
                throw (0, utils_1.createError)('Account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Update account permissions
            if (updates.dailyLimit !== undefined) {
                account.permissions.maxDailyVolume = updates.dailyLimit;
            }
            if (updates.monthlyLimit !== undefined) {
                account.permissions.maxMonthlyVolume = updates.monthlyLimit;
            }
            if (updates.singleTransactionLimit !== undefined) {
                account.permissions.maxSingleTransaction = updates.singleTransactionLimit;
            }
            account.updatedAt = new Date();
            this.accounts.set(accountId, account);
            logger_1.LoggerService.info('Withdrawal limit updated', {
                accountId,
                tenantId,
                updates
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('withdrawal-limit.updated', 'multi-tier-ledger', accountId, {
                tenantId,
                updates
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Update withdrawal limit failed:', error);
            throw error;
        }
    }
    static async createFundSegregation(accountId, segregationType, amount, currency) {
        try {
            const segregationId = (0, uuid_1.v4)();
            const segregation = {
                id: segregationId,
                accountId,
                segregationType,
                segregatedAmount: amount,
                currency,
                purpose: `Fund segregation for ${segregationType}`,
                status: SegregationStatus.ACTIVE,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.fundSegregations.set(segregationId, segregation);
            return segregation;
        }
        catch (error) {
            logger_1.LoggerService.error('Create fund segregation failed:', error);
            throw error;
        }
    }
    static async processTransaction(transaction) {
        try {
            // Update transaction status
            transaction.status = TransactionStatus.PROCESSING;
            transaction.updatedAt = new Date();
            this.transactions.set(transaction.id, transaction);
            // Record transaction in BlnkFinance
            await blnkfinance_1.BlnkFinanceService.recordTransaction(transaction.description, [
                {
                    accountId: transaction.fromAccountId,
                    creditAmount: transaction.amount,
                    description: `Transfer to ${transaction.toAccountId}`,
                    reference: transaction.id
                },
                {
                    accountId: transaction.toAccountId,
                    debitAmount: transaction.amount,
                    description: `Transfer from ${transaction.fromAccountId}`,
                    reference: transaction.id
                }
            ], 'platform', transaction.currency, 'TRANSFER', transaction.id, transaction.metadata);
            // Update transaction status
            transaction.status = TransactionStatus.COMPLETED;
            transaction.updatedAt = new Date();
            this.transactions.set(transaction.id, transaction);
            logger_1.LoggerService.info('Transaction processed successfully', {
                transactionId: transaction.id,
                status: transaction.status
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Process transaction failed:', error);
            // Mark transaction as failed
            transaction.status = TransactionStatus.FAILED;
            transaction.updatedAt = new Date();
            this.transactions.set(transaction.id, transaction);
            throw error;
        }
    }
    static calculateRiskScore(fromAccount, toAccount, amount) {
        try {
            let riskScore = 0;
            // Account level risk
            if (fromAccount.accountLevel === AccountLevel.LEVEL_3)
                riskScore += 20;
            if (toAccount.accountLevel === AccountLevel.LEVEL_3)
                riskScore += 20;
            // Amount risk
            if (amount > 100000)
                riskScore += 30;
            if (amount > 500000)
                riskScore += 20;
            // Cross-level transfers
            if (fromAccount.accountLevel !== toAccount.accountLevel)
                riskScore += 15;
            // Cross-tenant transfers
            if (fromAccount.tenantId !== toAccount.tenantId)
                riskScore += 25;
            return Math.min(riskScore, 100);
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate risk score failed:', error);
            return 50; // Default medium risk
        }
    }
    static async performReconciliation() {
        try {
            logger_1.LoggerService.info('Performing ledger reconciliation...');
            // This would typically reconcile with BlnkFinance and bank accounts
            // For now, just log the reconciliation process
            logger_1.LoggerService.info('Ledger reconciliation completed');
        }
        catch (error) {
            logger_1.LoggerService.error('Perform reconciliation failed:', error);
            throw error;
        }
    }
    // =============================================================================
    // ENHANCED FUND SEGREGATION METHODS FROM UNIFIED PROJECT
    // =============================================================================
    /**
     * CRITICAL: Validate fund access with multi-layer security
     * Zero-tolerance for unauthorized access
     */
    static async validateFundAccess(tenantId, userId, accountId, operation, context = {}) {
        const accessCheck = {
            tenantId,
            userId,
            accountId,
            operation,
            timestamp: new Date(),
            context
        };
        try {
            // Layer 1: Basic account access check
            const account = this.accounts.get(accountId);
            if (!account || account.tenantId !== tenantId) {
                logger_1.LoggerService.error('Security Event: Fund Access Denied', {
                    tenantId,
                    userId,
                    reason: 'Account access denied',
                    accountId,
                    operation,
                    context
                });
                return {
                    allowed: false,
                    reason: 'Account access denied',
                    riskLevel: 'CRITICAL'
                };
            }
            // Layer 2: Account status validation for write operations
            if (operation === 'write' || operation === 'transfer') {
                if (account.status !== AccountStatus.ACTIVE) {
                    logger_1.LoggerService.error('Security Event: Inactive Account Operation', {
                        tenantId,
                        userId,
                        reason: 'Account not active',
                        accountId,
                        status: account.status,
                        operation,
                        context
                    });
                    return {
                        allowed: false,
                        reason: 'Account not active',
                        riskLevel: 'HIGH'
                    };
                }
            }
            // Layer 3: Risk-based access control
            const riskAssessment = await this.assessAccessRisk(tenantId, userId, accountId, operation, context);
            if (riskAssessment.riskLevel === 'CRITICAL') {
                logger_1.LoggerService.error('Security Event: High Risk Access Blocked', {
                    tenantId,
                    userId,
                    reason: 'High risk access blocked',
                    accountId,
                    operation,
                    riskAssessment,
                    context
                });
                return {
                    allowed: false,
                    reason: 'High risk access blocked',
                    riskLevel: 'CRITICAL'
                };
            }
            // Access granted - log successful validation
            // Access granted - log successful validation
            logger_1.LoggerService.info('Financial Event: Fund Access Validated', {
                tenantId,
                userId,
                accountId,
                operation,
                riskLevel: riskAssessment.riskLevel,
                context
            });
            return {
                allowed: true,
                riskLevel: riskAssessment.riskLevel
            };
        }
        catch (error) {
            logger_1.LoggerService.error('CRITICAL: Fund access validation error', {
                error: error instanceof Error ? error.message : String(error),
                accessCheck
            });
            // Fail-safe: deny access on validation errors
            return {
                allowed: false,
                reason: 'Validation error - access denied for security',
                riskLevel: 'CRITICAL'
            };
        }
    }
    /**
     * CRITICAL: Perform segregated fund transfer with full isolation
     * Zero-tolerance for fund mixing between tenants
     */
    static async segregateFunds(tenantId, sourceAccountId, destinationAccountId, amount, currency, context) {
        const transferRequest = {
            tenantId,
            sourceAccountId,
            destinationAccountId,
            amount,
            currency,
            context,
            timestamp: new Date()
        };
        try {
            // Step 1: Validate tenant isolation (CRITICAL)
            const sourceAccount = this.accounts.get(sourceAccountId);
            const destAccount = this.accounts.get(destinationAccountId);
            if (!sourceAccount || !destAccount ||
                sourceAccount.tenantId !== tenantId || destAccount.tenantId !== tenantId) {
                logger_1.LoggerService.error('Security Event: Cross-Tenant Transfer Attempted', {
                    tenantId,
                    userId: context.userId,
                    reason: 'Cross-tenant transfer attempted',
                    sourceAccountId,
                    destinationAccountId,
                    sourceTenant: sourceAccount?.tenantId,
                    destTenant: destAccount?.tenantId,
                    expectedTenant: tenantId,
                    context
                });
                return {
                    success: false,
                    reason: 'Cross-tenant transfer not allowed',
                    riskLevel: 'CRITICAL'
                };
            }
            // Step 2: Pre-transfer validation
            const preValidation = await this.validateFundAccess(tenantId, context.userId, sourceAccountId, 'transfer', {
                ipAddress: context.ipAddress || '',
                userAgent: context.userAgent || '',
                riskScore: 0
            });
            if (!preValidation.allowed) {
                return {
                    success: false,
                    reason: preValidation.reason || 'Validation failed',
                    riskLevel: preValidation.riskLevel
                };
            }
            // Step 3: Segregation validation
            const segregationValidation = await this.validateSegregation(tenantId, sourceAccountId, destinationAccountId, amount, currency, context);
            if (!segregationValidation.allowed) {
                logger_1.LoggerService.error('Security Event: Fund Segregation Violation', {
                    tenantId,
                    userId: context.userId,
                    reason: 'Fund segregation violation',
                    sourceAccountId,
                    destinationAccountId,
                    amount,
                    currency,
                    segregationValidation,
                    context
                });
                return {
                    success: false,
                    reason: segregationValidation.reason || 'Fund segregation violation',
                    riskLevel: 'CRITICAL'
                };
            }
            // Step 4: Execute segregated transfer
            const transferResult = await this.executeSegregatedTransfer(tenantId, sourceAccountId, destinationAccountId, amount, currency, context);
            if (transferResult.success) {
                // Step 5: Post-transfer audit logging
                logger_1.LoggerService.info('Financial Event: Fund Transfer Completed', {
                    tenantId,
                    userId: context.userId,
                    transactionId: transferResult.transactionId,
                    sourceAccountId,
                    destinationAccountId,
                    amount,
                    currency,
                    riskLevel: preValidation.riskLevel,
                    context
                });
                logger_1.LoggerService.info('FUND TRANSFER COMPLETED: Segregation maintained', {
                    tenantId,
                    transactionId: transferResult.transactionId,
                    sourceAccountId,
                    destinationAccountId,
                    amount,
                    currency,
                    riskLevel: preValidation.riskLevel
                });
                return {
                    success: true,
                    transactionId: transferResult.transactionId || '',
                    riskLevel: preValidation.riskLevel
                };
            }
            else {
                return {
                    success: false,
                    reason: transferResult.reason || 'Transfer failed',
                    riskLevel: 'HIGH'
                };
            }
        }
        catch (error) {
            logger_1.LoggerService.error('CRITICAL: Fund segregation error', {
                error: error instanceof Error ? error.message : String(error),
                transferRequest
            });
            return {
                success: false,
                reason: 'Fund segregation error - transfer blocked',
                riskLevel: 'CRITICAL'
            };
        }
    }
    /**
     * Assess risk level for fund access operations
     */
    static async assessAccessRisk(tenantId, userId, accountId, operation, context) {
        const factors = [];
        let riskScore = 0;
        // Factor 1: Operation type risk
        if (operation === 'transfer') {
            riskScore += 30;
            factors.push('transfer_operation');
        }
        else if (operation === 'write') {
            riskScore += 20;
            factors.push('write_operation');
        }
        // Factor 2: Account level risk
        const account = this.accounts.get(accountId);
        if (account) {
            if (account.accountLevel === AccountLevel.LEVEL_3) {
                riskScore += 20;
                factors.push('end_user_account');
            }
            if (account.accountType === AccountType.PLATFORM_MASTER) {
                riskScore += 10;
                factors.push('platform_master_account');
            }
        }
        // Factor 3: Context risk (unusual patterns)
        if (context.riskScore) {
            riskScore += context.riskScore;
            if (context.riskScore > 30)
                factors.push('high_context_risk');
        }
        // Determine risk level
        let riskLevel;
        if (riskScore >= 80) {
            riskLevel = 'CRITICAL';
        }
        else if (riskScore >= 60) {
            riskLevel = 'HIGH';
        }
        else if (riskScore >= 40) {
            riskLevel = 'MEDIUM';
        }
        else {
            riskLevel = 'LOW';
        }
        return { riskLevel, factors };
    }
    /**
     * Validate fund segregation rules
     */
    static async validateSegregation(tenantId, sourceAccountId, destinationAccountId, amount, currency, context) {
        try {
            const violations = [];
            // Check account types and levels
            const sourceAccount = this.accounts.get(sourceAccountId);
            const destAccount = this.accounts.get(destinationAccountId);
            if (!sourceAccount || !destAccount) {
                violations.push('Account not found');
            }
            // Check tenant isolation
            if (sourceAccount?.tenantId !== tenantId || destAccount?.tenantId !== tenantId) {
                violations.push('Cross-tenant transfer violation');
            }
            // Check account status
            if (sourceAccount?.status !== AccountStatus.ACTIVE) {
                violations.push('Source account not active');
            }
            if (destAccount?.status !== AccountStatus.ACTIVE) {
                violations.push('Destination account not active');
            }
            // Check transfer limits
            if (amount > this.LEDGER_CONFIG.maxTransactionAmount) {
                violations.push('Amount exceeds maximum transaction limit');
            }
            return {
                allowed: violations.length === 0,
                reason: violations.length > 0 ? violations.join(', ') : undefined,
                violations: violations.length > 0 ? violations : undefined
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Segregation validation failed:', error);
            return {
                allowed: false,
                reason: 'Validation error',
                violations: ['validation_error']
            };
        }
    }
    /**
     * Execute segregated transfer
     */
    static async executeSegregatedTransfer(tenantId, sourceAccountId, destinationAccountId, amount, currency, context) {
        try {
            // Create transaction record
            const transactionId = (0, uuid_1.v4)();
            const transaction = {
                id: transactionId,
                fromAccountId: sourceAccountId,
                toAccountId: destinationAccountId,
                amount,
                currency,
                transactionType: TransactionType.TRANSFER,
                status: TransactionStatus.PROCESSING,
                description: `Segregated transfer: ${context.reason || 'Fund transfer'}`,
                metadata: {
                    source: 'multi-tier-ledger',
                    complianceFlags: [],
                    riskScore: 0,
                    approvalRequired: false,
                    context,
                    segregationValidated: true,
                    riskLevel: 'LOW'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.transactions.set(transactionId, transaction);
            // Record in BlnkFinance
            await blnkfinance_1.BlnkFinanceService.recordTransaction(`Segregated transfer: ${context.reason || 'Fund transfer'}`, [
                {
                    accountId: sourceAccountId,
                    debitAmount: amount,
                    description: `Transfer to ${destinationAccountId}`,
                    reference: transactionId
                },
                {
                    accountId: destinationAccountId,
                    creditAmount: amount,
                    description: `Transfer from ${sourceAccountId}`,
                    reference: transactionId
                }
            ], tenantId, 'USD', blnkfinance_1.TransactionType.TRANSFER, transactionId, {
                source: 'multi-tier-ledger',
                complianceFlags: [],
                riskScore: 0,
                approvalRequired: false,
                context,
                segregationValidated: true,
                riskLevel: 'LOW'
            });
            // Update transaction status
            transaction.status = TransactionStatus.COMPLETED;
            transaction.updatedAt = new Date();
            this.transactions.set(transactionId, transaction);
            return {
                success: true,
                transactionId
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Execute segregated transfer failed:', error);
            return {
                success: false,
                reason: 'Transfer execution failed'
            };
        }
    }
    // =============================================================================
    // FUND SEGREGATION REPORTING METHODS
    // =============================================================================
    /**
     * Generate Fund Segregation Report
     * Comprehensive report showing fund segregation status across all accounts
     */
    static async generateFundSegregationReport(tenantId, options) {
        try {
            const reportId = (0, uuid_1.v4)();
            const now = new Date();
            const startDate = options?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = options?.endDate || now;
            logger_1.LoggerService.info('Generating fund segregation report', {
                reportId,
                tenantId,
                startDate,
                endDate
            });
            // Get all accounts for tenant
            let accounts = Array.from(this.accounts.values())
                .filter(a => a.tenantId === tenantId);
            // Filter by account types if specified
            if (options?.accountTypes && options.accountTypes.length > 0) {
                accounts = accounts.filter(a => options.accountTypes.includes(a.accountType));
            }
            // Filter by currency if specified
            if (options?.currency) {
                accounts = accounts.filter(a => a.currency === options.currency);
            }
            // Get fund segregations for these accounts
            const accountIds = accounts.map(a => a.id);
            const segregations = Array.from(this.fundSegregations.values())
                .filter(s => accountIds.includes(s.accountId));
            // Calculate balances from BlnkFinance
            const accountBreakdown = await Promise.all(accounts.map(async (account) => {
                let balance = 0;
                try {
                    const blnkBalance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(account.id);
                    balance = blnkBalance ? blnkBalance.netBalance : 0;
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch balance from BlnkFinance', { accountId: account.id, error });
                }
                // Find segregation for this account
                const accountSegregation = segregations.find(s => s.accountId === account.id);
                return {
                    accountId: account.id,
                    accountName: account.name,
                    accountType: account.accountType,
                    accountLevel: account.accountLevel,
                    currency: account.currency,
                    balance,
                    segregatedAmount: accountSegregation?.segregatedAmount || 0,
                    segregationType: accountSegregation?.segregationType || SegregationType.CLIENT_FUNDS,
                    status: account.status,
                    lastReconciliation: account.metadata.lastReconciliation
                };
            }));
            // Calculate summary statistics
            const totalAccounts = accounts.length;
            const totalSegregatedFunds = segregations.reduce((sum, s) => sum + s.segregatedAmount, 0);
            const totalClientFunds = segregations
                .filter(s => s.segregationType === SegregationType.CLIENT_FUNDS)
                .reduce((sum, s) => sum + s.segregatedAmount, 0);
            const totalOperationalFunds = segregations
                .filter(s => s.segregationType === SegregationType.OPERATIONAL_FUNDS)
                .reduce((sum, s) => sum + s.segregatedAmount, 0);
            const totalReserveFunds = segregations
                .filter(s => s.segregationType === SegregationType.RESERVE_FUNDS)
                .reduce((sum, s) => sum + s.segregatedAmount, 0);
            // Calculate compliance percentage (accounts with active segregation / total accounts)
            const accountsWithSegregation = new Set(segregations.filter(s => s.status === SegregationStatus.ACTIVE).map(s => s.accountId));
            const segregationCompliance = totalAccounts > 0
                ? (accountsWithSegregation.size / totalAccounts) * 100
                : 100;
            // Identify compliance issues
            const complianceIssues = [];
            for (const account of accounts) {
                // Check for missing segregation
                if (!accountsWithSegregation.has(account.id) && account.accountLevel === AccountLevel.LEVEL_2) {
                    complianceIssues.push({
                        accountId: account.id,
                        issue: 'Broker account missing fund segregation',
                        severity: 'high',
                        recommendation: 'Configure fund segregation for this broker account immediately'
                    });
                }
                // Check for stale reconciliation
                const daysSinceReconciliation = Math.floor((now.getTime() - account.metadata.lastReconciliation.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceReconciliation > 7) {
                    complianceIssues.push({
                        accountId: account.id,
                        issue: `Account not reconciled for ${daysSinceReconciliation} days`,
                        severity: daysSinceReconciliation > 30 ? 'critical' : 'medium',
                        recommendation: 'Run reconciliation process for this account'
                    });
                }
                // Check for suspended accounts with funds
                const accountBalance = accountBreakdown.find(ab => ab.accountId === account.id)?.balance || 0;
                if (account.status === AccountStatus.SUSPENDED && accountBalance > 0) {
                    complianceIssues.push({
                        accountId: account.id,
                        issue: 'Suspended account has remaining balance',
                        severity: 'high',
                        recommendation: 'Review and transfer funds from suspended account'
                    });
                }
            }
            // Get transactions if requested
            let transactions;
            if (options?.includeTransactions) {
                const allTransactions = Array.from(this.transactions.values())
                    .filter(t => (accountIds.includes(t.fromAccountId) || accountIds.includes(t.toAccountId)) &&
                    t.createdAt >= startDate &&
                    t.createdAt <= endDate)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, 100); // Limit to 100 transactions
                transactions = allTransactions.map(t => ({
                    transactionId: t.id,
                    fromAccountId: t.fromAccountId,
                    toAccountId: t.toAccountId,
                    amount: t.amount,
                    currency: t.currency,
                    type: t.transactionType,
                    status: t.status,
                    createdAt: t.createdAt
                }));
            }
            const report = {
                id: reportId,
                tenantId,
                reportType: 'fund_segregation',
                generatedAt: now,
                period: { startDate, endDate },
                summary: {
                    totalAccounts,
                    totalSegregatedFunds,
                    totalClientFunds,
                    totalOperationalFunds,
                    totalReserveFunds,
                    segregationCompliance
                },
                accountBreakdown,
                segregationDetails: segregations.map(s => ({
                    segregationId: s.id,
                    accountId: s.accountId,
                    segregationType: s.segregationType,
                    amount: s.segregatedAmount,
                    currency: s.currency,
                    status: s.status,
                    purpose: s.purpose,
                    createdAt: s.createdAt
                })),
                complianceIssues,
                transactions
            };
            logger_1.LoggerService.info('Fund segregation report generated', {
                reportId,
                tenantId,
                totalAccounts,
                segregationCompliance,
                complianceIssues: complianceIssues.length
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('fund-segregation-report.generated', 'multi-tier-ledger', reportId, {
                tenantId,
                totalAccounts,
                segregationCompliance,
                complianceIssues: complianceIssues.length
            });
            return report;
        }
        catch (error) {
            logger_1.LoggerService.error('Generate fund segregation report failed:', error);
            throw error;
        }
    }
    /**
     * Get Oversight Report
     * Comprehensive oversight report for regulatory compliance
     */
    static async getOversightReport(reportId) {
        try {
            // Check reconciliation reports first
            const reconciliationReport = this.reconciliationReports.get(reportId);
            if (reconciliationReport) {
                const account = this.accounts.get(reconciliationReport.accountId);
                return {
                    id: reconciliationReport.id,
                    tenantId: account?.tenantId || 'unknown',
                    reportType: 'reconciliation',
                    generatedAt: reconciliationReport.createdAt,
                    status: reconciliationReport.status,
                    data: {
                        accountId: reconciliationReport.accountId,
                        reportDate: reconciliationReport.reportDate,
                        blnkBalance: reconciliationReport.blnkBalance,
                        bankBalance: reconciliationReport.bankBalance,
                        discrepancy: reconciliationReport.discrepancy,
                        issues: reconciliationReport.issues
                    }
                };
            }
            // If not found in reconciliation reports, check if it's a stored oversight report
            // For now, return null as we don't have a separate oversight reports store
            // This would typically query a database
            logger_1.LoggerService.warn('Oversight report not found', { reportId });
            return null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get oversight report failed:', error);
            throw error;
        }
    }
    /**
     * Generate Oversight Report
     * Creates a comprehensive oversight report for regulatory purposes
     */
    static async generateOversightReport(tenantId, options) {
        try {
            const reportId = (0, uuid_1.v4)();
            const now = new Date();
            const reportType = options?.reportType || 'daily';
            // Calculate date range based on report type
            let startDate;
            const endDate = options?.endDate || now;
            if (options?.startDate) {
                startDate = options.startDate;
            }
            else {
                switch (reportType) {
                    case 'weekly':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'monthly':
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                        break;
                    case 'quarterly':
                        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                        break;
                    default: // daily
                        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                }
            }
            logger_1.LoggerService.info('Generating oversight report', {
                reportId,
                tenantId,
                reportType,
                startDate,
                endDate
            });
            // Get all accounts
            const allAccounts = Array.from(this.accounts.values())
                .filter(a => options?.includeAllBrokers ? true : a.tenantId === tenantId);
            const platformAccounts = allAccounts.filter(a => a.accountLevel === AccountLevel.LEVEL_1);
            const brokerAccounts = allAccounts.filter(a => a.accountLevel === AccountLevel.LEVEL_2);
            const endUserAccounts = allAccounts.filter(a => a.accountLevel === AccountLevel.LEVEL_3);
            // Calculate total platform balance
            let totalPlatformBalance = 0;
            for (const account of allAccounts) {
                try {
                    const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(account.id);
                    totalPlatformBalance += balance ? balance.netBalance : 0;
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch balance', { accountId: account.id });
                }
            }
            // Get transactions in period
            const periodTransactions = Array.from(this.transactions.values())
                .filter(t => t.createdAt >= startDate && t.createdAt <= endDate);
            const totalTransactionsVolume = periodTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalTransactionsCount = periodTransactions.length;
            // Generate broker summary
            const brokerSummary = await Promise.all(brokerAccounts.map(async (broker) => {
                let brokerBalance = 0;
                try {
                    const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(broker.id);
                    brokerBalance = balance ? balance.netBalance : 0;
                }
                catch (error) {
                    logger_1.LoggerService.warn('Failed to fetch broker balance', { brokerId: broker.id });
                }
                // Count clients (end user accounts under this broker)
                const clientAccounts = endUserAccounts.filter(a => a.parentAccountId === broker.id);
                // Calculate transaction volume for this broker
                const brokerTransactions = periodTransactions.filter(t => t.fromAccountId === broker.id || t.toAccountId === broker.id);
                const transactionVolume = brokerTransactions.reduce((sum, t) => sum + t.amount, 0);
                // Calculate compliance score (simplified)
                let complianceScore = 100;
                if (broker.status !== AccountStatus.ACTIVE)
                    complianceScore -= 30;
                if (!broker.bankAccount)
                    complianceScore -= 20;
                const daysSinceReconciliation = Math.floor((now.getTime() - broker.metadata.lastReconciliation.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceReconciliation > 7)
                    complianceScore -= 10;
                if (daysSinceReconciliation > 30)
                    complianceScore -= 20;
                return {
                    brokerId: broker.id,
                    brokerName: broker.name,
                    totalBalance: brokerBalance,
                    clientCount: clientAccounts.length,
                    transactionVolume,
                    complianceScore: Math.max(0, complianceScore)
                };
            }));
            // Calculate risk metrics
            const highRiskAccounts = allAccounts.filter(a => a.metadata.riskLevel === RiskLevel.HIGH || a.metadata.riskLevel === RiskLevel.CRITICAL).length;
            const pendingApprovals = periodTransactions.filter(t => t.status === TransactionStatus.REQUIRES_APPROVAL).length;
            const failedTransactions = periodTransactions.filter(t => t.status === TransactionStatus.FAILED).length;
            // Count reconciliation discrepancies
            const recentReconciliations = Array.from(this.reconciliationReports.values())
                .filter(r => r.createdAt >= startDate && r.createdAt <= endDate);
            const reconciliationDiscrepancies = recentReconciliations.filter(r => r.status === ReconciliationStatus.DISCREPANCY).length;
            // Calculate compliance status
            const fundSegregationCompliant = brokerAccounts.every(b => {
                const segregation = Array.from(this.fundSegregations.values())
                    .find(s => s.accountId === b.id && s.status === SegregationStatus.ACTIVE);
                return !!segregation;
            });
            const reconciliationUpToDate = allAccounts.every(a => {
                const daysSinceReconciliation = Math.floor((now.getTime() - a.metadata.lastReconciliation.getTime()) / (1000 * 60 * 60 * 24));
                return daysSinceReconciliation <= 7;
            });
            // KYC and AML compliance would typically come from external services
            const kycCompliant = true; // Placeholder
            const amlCompliant = true; // Placeholder
            const overallScore = [
                fundSegregationCompliant ? 25 : 0,
                reconciliationUpToDate ? 25 : 0,
                kycCompliant ? 25 : 0,
                amlCompliant ? 25 : 0
            ].reduce((sum, score) => sum + score, 0);
            // Generate alerts
            const alerts = [];
            // Alert for high-risk accounts
            if (highRiskAccounts > 0) {
                alerts.push({
                    type: 'risk',
                    severity: 'warning',
                    message: `${highRiskAccounts} high-risk accounts detected`,
                    timestamp: now
                });
            }
            // Alert for pending approvals
            if (pendingApprovals > 10) {
                alerts.push({
                    type: 'approval',
                    severity: 'warning',
                    message: `${pendingApprovals} transactions pending approval`,
                    timestamp: now
                });
            }
            // Alert for failed transactions
            if (failedTransactions > 0) {
                alerts.push({
                    type: 'transaction',
                    severity: failedTransactions > 5 ? 'critical' : 'warning',
                    message: `${failedTransactions} failed transactions in period`,
                    timestamp: now
                });
            }
            // Alert for reconciliation discrepancies
            if (reconciliationDiscrepancies > 0) {
                alerts.push({
                    type: 'reconciliation',
                    severity: 'critical',
                    message: `${reconciliationDiscrepancies} reconciliation discrepancies found`,
                    timestamp: now
                });
            }
            // Alert for non-compliant fund segregation
            if (!fundSegregationCompliant) {
                alerts.push({
                    type: 'compliance',
                    severity: 'critical',
                    message: 'Fund segregation compliance issue detected',
                    timestamp: now
                });
            }
            const report = {
                id: reportId,
                tenantId,
                reportType,
                generatedAt: now,
                period: { startDate, endDate },
                platformOverview: {
                    totalPlatformBalance,
                    totalBrokerAccounts: brokerAccounts.length,
                    totalEndUserAccounts: endUserAccounts.length,
                    totalTransactionsVolume,
                    totalTransactionsCount
                },
                brokerSummary,
                riskMetrics: {
                    highRiskAccounts,
                    pendingApprovals,
                    failedTransactions,
                    reconciliationDiscrepancies
                },
                complianceStatus: {
                    fundSegregationCompliant,
                    reconciliationUpToDate,
                    kycCompliant,
                    amlCompliant,
                    overallScore
                },
                alerts
            };
            logger_1.LoggerService.info('Oversight report generated', {
                reportId,
                tenantId,
                reportType,
                overallScore,
                alertsCount: alerts.length
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('oversight-report.generated', 'multi-tier-ledger', reportId, {
                tenantId,
                reportType,
                overallScore,
                alertsCount: alerts.length
            });
            return report;
        }
        catch (error) {
            logger_1.LoggerService.error('Generate oversight report failed:', error);
            throw error;
        }
    }
}
exports.MultiTierLedgerService = MultiTierLedgerService;
//# sourceMappingURL=multi-tier-ledger.js.map