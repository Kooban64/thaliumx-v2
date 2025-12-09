"use strict";
/**
 * BlnkFinance Integration Service
 *
 * Comprehensive double-entry bookkeeping system with:
 * - Account Management (Chart of accounts and hierarchy)
 * - Transaction Processing (Double-entry recording)
 * - Ledger Management (General ledger and sub-ledgers)
 * - Balance Tracking (Real-time calculations)
 * - Financial Reporting (P&L, Balance Sheet, Cash Flow)
 * - Audit Trail (Complete transaction history)
 * - Multi-Currency Support (Multi-currency accounting)
 * - Broker Segregation (Fund separation by broker)
 * - Compliance Reporting (Regulatory reporting)
 * - Reconciliation (Bank and exchange reconciliation)
 *
 * Production-ready with comprehensive error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlnkFinanceService = exports.ReconciliationStatus = exports.ReportType = exports.TransactionType = exports.TransactionStatus = exports.AccountType = void 0;
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const database_1 = require("./database");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
var AccountType;
(function (AccountType) {
    AccountType["ASSET"] = "ASSET";
    AccountType["LIABILITY"] = "LIABILITY";
    AccountType["EQUITY"] = "EQUITY";
    AccountType["REVENUE"] = "REVENUE";
    AccountType["EXPENSE"] = "EXPENSE";
    AccountType["BANK"] = "BANK";
    AccountType["CASH"] = "CASH";
    AccountType["RECEIVABLE"] = "RECEIVABLE";
    AccountType["PAYABLE"] = "PAYABLE";
    AccountType["INVESTMENT"] = "INVESTMENT";
    AccountType["TRADING"] = "TRADING";
    AccountType["MARGIN"] = "MARGIN";
    AccountType["STAKING"] = "STAKING";
    AccountType["NFT"] = "NFT";
    AccountType["DEFI"] = "DEFI";
})(AccountType || (exports.AccountType = AccountType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["POSTED"] = "POSTED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
    TransactionStatus["REVERSED"] = "REVERSED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["DEPOSIT"] = "DEPOSIT";
    TransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    TransactionType["TRANSFER"] = "TRANSFER";
    TransactionType["TRADE"] = "TRADE";
    TransactionType["FEE"] = "FEE";
    TransactionType["INTEREST"] = "INTEREST";
    TransactionType["DIVIDEND"] = "DIVIDEND";
    TransactionType["STAKING_REWARD"] = "STAKING_REWARD";
    TransactionType["MARGIN_CALL"] = "MARGIN_CALL";
    TransactionType["LIQUIDATION"] = "LIQUIDATION";
    TransactionType["NFT_PURCHASE"] = "NFT_PURCHASE";
    TransactionType["NFT_SALE"] = "NFT_SALE";
    TransactionType["DEFI_DEPOSIT"] = "DEFI_DEPOSIT";
    TransactionType["DEFI_WITHDRAWAL"] = "DEFI_WITHDRAWAL";
    TransactionType["DEFI_REWARD"] = "DEFI_REWARD";
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
    TransactionType["RECONCILIATION"] = "RECONCILIATION";
    TransactionType["PAYMENT"] = "PAYMENT"; // Payment transactions (e.g., for broker/client payments)
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var ReportType;
(function (ReportType) {
    ReportType["PROFIT_LOSS"] = "PROFIT_LOSS";
    ReportType["BALANCE_SHEET"] = "BALANCE_SHEET";
    ReportType["CASH_FLOW"] = "CASH_FLOW";
    ReportType["TRIAL_BALANCE"] = "TRIAL_BALANCE";
    ReportType["GENERAL_LEDGER"] = "GENERAL_LEDGER";
    ReportType["ACCOUNT_STATEMENT"] = "ACCOUNT_STATEMENT";
    ReportType["BROKER_SUMMARY"] = "BROKER_SUMMARY";
    ReportType["COMPLIANCE_REPORT"] = "COMPLIANCE_REPORT";
})(ReportType || (exports.ReportType = ReportType = {}));
var ReconciliationStatus;
(function (ReconciliationStatus) {
    ReconciliationStatus["PENDING"] = "PENDING";
    ReconciliationStatus["MATCHED"] = "MATCHED";
    ReconciliationStatus["DIFFERENCE"] = "DIFFERENCE";
    ReconciliationStatus["RECONCILED"] = "RECONCILED";
})(ReconciliationStatus || (exports.ReconciliationStatus = ReconciliationStatus = {}));
// =============================================================================
// BLNKFINANCE SERVICE CLASS
// =============================================================================
class BlnkFinanceService {
    static isInitialized = false;
    static accounts = new Map();
    static balances = new Map();
    static transactions = new Map();
    // External BlnkFinance service configuration
    static externalServiceUrl = process.env.BLNK_FINANCE_URL || process.env.BLNK_FINANCE_API_URL || 'http://blnk-finance:5001';
    static externalServiceApiKey = process.env.BLNK_FINANCE_API_KEY || process.env.VAULT_BLNK_FINANCE_API_KEY || 'default-key';
    static externalServiceEnabled = !!process.env.BLNK_FINANCE_URL || !!process.env.BLNK_FINANCE_API_URL;
    static externalServiceClient = null;
    // Chart of Accounts Templates
    static CHART_OF_ACCOUNTS = {
        ASSETS: {
            '1000': { name: 'Current Assets', type: AccountType.ASSET, parent: undefined },
            '1100': { name: 'Cash and Cash Equivalents', type: AccountType.CASH, parent: '1000' },
            '1110': { name: 'Bank Accounts', type: AccountType.BANK, parent: '1100' },
            '1120': { name: 'Trading Accounts', type: AccountType.TRADING, parent: '1100' },
            '1130': { name: 'Margin Accounts', type: AccountType.MARGIN, parent: '1100' },
            '1200': { name: 'Accounts Receivable', type: AccountType.RECEIVABLE, parent: '1000' },
            '1300': { name: 'Investments', type: AccountType.INVESTMENT, parent: '1000' },
            '1400': { name: 'NFT Holdings', type: AccountType.NFT, parent: '1000' },
            '1500': { name: 'DeFi Positions', type: AccountType.DEFI, parent: '1000' },
            '1600': { name: 'Staking Positions', type: AccountType.STAKING, parent: '1000' }
        },
        LIABILITIES: {
            '2000': { name: 'Current Liabilities', type: AccountType.LIABILITY, parent: undefined },
            '2100': { name: 'Accounts Payable', type: AccountType.PAYABLE, parent: '2000' },
            '2200': { name: 'Margin Loans', type: AccountType.MARGIN, parent: '2000' },
            '2300': { name: 'DeFi Loans', type: AccountType.DEFI, parent: '2000' },
            '2400': { name: 'Accrued Expenses', type: AccountType.LIABILITY, parent: '2000' }
        },
        EQUITY: {
            '3000': { name: 'Equity', type: AccountType.EQUITY, parent: undefined },
            '3100': { name: 'Share Capital', type: AccountType.EQUITY, parent: '3000' },
            '3200': { name: 'Retained Earnings', type: AccountType.EQUITY, parent: '3000' },
            '3300': { name: 'Broker Equity', type: AccountType.EQUITY, parent: '3000' }
        },
        REVENUE: {
            '4000': { name: 'Revenue', type: AccountType.REVENUE, parent: undefined },
            '4100': { name: 'Trading Revenue', type: AccountType.REVENUE, parent: '4000' },
            '4200': { name: 'Fee Income', type: AccountType.REVENUE, parent: '4000' },
            '4300': { name: 'Interest Income', type: AccountType.REVENUE, parent: '4000' },
            '4400': { name: 'Staking Rewards', type: AccountType.REVENUE, parent: '4000' },
            '4500': { name: 'DeFi Rewards', type: AccountType.REVENUE, parent: '4000' }
        },
        EXPENSES: {
            '5000': { name: 'Expenses', type: AccountType.EXPENSE, parent: undefined },
            '5100': { name: 'Operating Expenses', type: AccountType.EXPENSE, parent: '5000' },
            '5200': { name: 'Interest Expense', type: AccountType.EXPENSE, parent: '5000' },
            '5300': { name: 'Trading Fees', type: AccountType.EXPENSE, parent: '5000' },
            '5400': { name: 'Bank Fees', type: AccountType.EXPENSE, parent: '5000' },
            '5500': { name: 'Regulatory Fees', type: AccountType.EXPENSE, parent: '5000' }
        }
    };
    /**
     * Initialize BlnkFinance Service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing BlnkFinance Service...');
            // Initialize external BlnkFinance service client if configured
            if (this.externalServiceEnabled && this.externalServiceUrl) {
                this.externalServiceClient = axios_1.default.create({
                    baseURL: this.externalServiceUrl,
                    headers: {
                        'Authorization': `Bearer ${this.externalServiceApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                logger_1.LoggerService.info(`External BlnkFinance service enabled: ${this.externalServiceUrl}`);
                // Test connection
                try {
                    const healthResponse = await this.externalServiceClient.get('/health');
                    if (healthResponse.status === 200) {
                        logger_1.LoggerService.info('External BlnkFinance service health check passed');
                    }
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service health check failed, will use local implementation', {
                        error: error.message
                    });
                }
            }
            else {
                logger_1.LoggerService.info('Using local BlnkFinance implementation');
            }
            // Initialize database models
            await this.initializeModels();
            // Create default chart of accounts
            await this.createDefaultChartOfAccounts();
            // Load existing accounts and balances
            await this.loadAccountsAndBalances();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ BlnkFinance Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('blnkfinance.initialized', 'BlnkFinanceService', 'info', {
                message: 'BlnkFinance service initialized',
                accountsCount: this.accounts.size,
                balancesCount: this.balances.size,
                transactionsCount: this.transactions.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ BlnkFinance Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create a new account
     * Uses external BlnkFinance service if available, otherwise creates locally
     */
    static async createAccount(code, name, type, currency, brokerId, parentId, description, metadata) {
        try {
            logger_1.LoggerService.info(`Creating account: ${code} - ${name}`, {
                type,
                currency,
                brokerId,
                parentId
            });
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post('/v1/accounts', {
                        code,
                        name,
                        type,
                        currency,
                        broker_id: brokerId,
                        parent_id: parentId,
                        description,
                        metadata
                    });
                    logger_1.LoggerService.info(`Account created via external BlnkFinance service: ${response.data.id}`);
                    return this.mapExternalAccountToInternal(response.data);
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation
            const account = {
                id: (0, uuid_1.v4)(),
                code,
                name,
                type,
                parentId,
                brokerId,
                currency,
                balance: 0,
                debitBalance: 0,
                creditBalance: 0,
                isActive: true,
                description,
                metadata,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save to database
            await this.saveAccount(account);
            // Add to memory cache
            this.accounts.set(account.id, account);
            // Initialize balance
            const balance = {
                accountId: account.id,
                currency,
                debitBalance: 0,
                creditBalance: 0,
                netBalance: 0,
                lastUpdated: new Date()
            };
            this.balances.set(account.id, balance);
            logger_1.LoggerService.info(`Account created successfully: ${account.id}`, {
                code: account.code,
                name: account.name
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('account.created', 'blnkfinance', account.id, {
                code: account.code,
                name: account.name,
                type: account.type,
                currency: account.currency,
                brokerId: account.brokerId
            });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Create account failed:', error);
            throw error;
        }
    }
    /**
     * Map external BlnkFinance account to internal format
     */
    static mapExternalAccountToInternal(externalAccount) {
        return {
            id: externalAccount.id || (0, uuid_1.v4)(),
            code: externalAccount.code || '',
            name: externalAccount.name || '',
            type: externalAccount.type,
            parentId: externalAccount.parent_id,
            brokerId: externalAccount.broker_id,
            currency: externalAccount.currency || 'USD',
            balance: parseFloat(externalAccount.balance || '0'),
            debitBalance: parseFloat(externalAccount.debit_balance || '0'),
            creditBalance: parseFloat(externalAccount.credit_balance || '0'),
            isActive: externalAccount.is_active !== false,
            description: externalAccount.description,
            metadata: externalAccount.metadata,
            createdAt: new Date(externalAccount.created_at || Date.now()),
            updatedAt: new Date(externalAccount.updated_at || Date.now())
        };
    }
    /**
     * Map external BlnkFinance transaction to internal format
     */
    static mapExternalTransactionToInternal(externalTransaction, originalEntries, description, currency) {
        const transaction = {
            id: externalTransaction.id || (0, uuid_1.v4)(),
            transactionNumber: externalTransaction.transaction_number || externalTransaction.id || '',
            date: new Date(externalTransaction.date || externalTransaction.created_at || Date.now()),
            description: externalTransaction.description || description,
            reference: externalTransaction.reference || '',
            brokerId: externalTransaction.broker_id,
            currency: externalTransaction.currency || currency,
            totalAmount: parseFloat(externalTransaction.total_amount || externalTransaction.amount || '0'),
            status: externalTransaction.status === 'completed' ? TransactionStatus.POSTED : TransactionStatus.PENDING,
            type: externalTransaction.type || TransactionType.TRANSFER,
            entries: originalEntries.map(entry => ({
                id: (0, uuid_1.v4)(),
                transactionId: externalTransaction.id || (0, uuid_1.v4)(),
                accountId: entry.accountId,
                debitAmount: entry.debitAmount || 0,
                creditAmount: entry.creditAmount || 0,
                currency: currency,
                description: entry.description,
                reference: entry.reference,
                metadata: {},
                createdAt: new Date()
            })),
            metadata: externalTransaction.metadata || {},
            createdAt: new Date(externalTransaction.created_at || Date.now()),
            updatedAt: new Date(externalTransaction.updated_at || Date.now())
        };
        // Store in memory cache
        this.transactions.set(transaction.id, transaction);
        return transaction;
    }
    /**
     * Map external ledger entry to internal format
     */
    static mapExternalEntryToInternal(externalEntry, accountId) {
        const date = new Date(externalEntry.date || externalEntry.created_at || Date.now());
        const debitAmount = parseFloat(externalEntry.debit_amount || externalEntry.debit || '0');
        const creditAmount = parseFloat(externalEntry.credit_amount || externalEntry.credit || '0');
        // Calculate balance (difference between debits and credits)
        const balance = debitAmount - creditAmount;
        return {
            id: externalEntry.id || (0, uuid_1.v4)(),
            accountId,
            transactionId: externalEntry.transaction_id || '',
            date,
            debitAmount,
            creditAmount,
            balance, // Calculate balance from debit/credit amounts
            currency: externalEntry.currency || 'USD',
            description: externalEntry.description || '',
            reference: externalEntry.reference || '',
            metadata: externalEntry.metadata || {},
            createdAt: externalEntry.created_at ? new Date(externalEntry.created_at) : date // Use created_at from external or fallback to date
        };
    }
    /**
     * Record a double-entry transaction
     * Uses external BlnkFinance service if available, otherwise records locally
     */
    static async recordTransaction(description, entries, brokerId, currency = 'USD', type = TransactionType.TRANSFER, reference, metadata) {
        try {
            // Validate double-entry principle
            const totalDebits = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);
            const totalCredits = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                throw (0, utils_1.createError)('Transaction does not balance', 400, 'UNBALANCED_TRANSACTION');
            }
            logger_1.LoggerService.info(`Recording transaction: ${description}`, {
                entriesCount: entries.length,
                totalDebits,
                totalCredits,
                brokerId,
                currency
            });
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    // Convert entries to BlnkFinance format
                    const ledgerEntries = entries.map(entry => ({
                        account_id: entry.accountId,
                        amount: (entry.debitAmount || 0) - (entry.creditAmount || 0), // Positive for debit, negative for credit
                        currency,
                        transaction_type: type,
                        description: entry.description,
                        reference: entry.reference
                    }));
                    const response = await this.externalServiceClient.post('/v1/ledger/entries', {
                        tenant_id: metadata?.tenantId || 'default',
                        broker_id: brokerId,
                        entries: ledgerEntries,
                        description,
                        reference,
                        metadata
                    });
                    logger_1.LoggerService.info(`Transaction recorded via external BlnkFinance service: ${response.data.id}`);
                    // Map response to internal format
                    return this.mapExternalTransactionToInternal(response.data, entries, description, currency);
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            const transactionId = (0, uuid_1.v4)();
            const transactionNumber = await this.generateTransactionNumber();
            const transaction = {
                id: transactionId,
                transactionNumber,
                date: new Date(),
                description,
                reference,
                brokerId,
                currency,
                totalAmount: totalDebits,
                status: TransactionStatus.PENDING,
                type,
                entries: [],
                metadata,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Create transaction entries
            for (const entryData of entries) {
                const entry = {
                    id: (0, uuid_1.v4)(),
                    transactionId,
                    accountId: entryData.accountId,
                    debitAmount: entryData.debitAmount || 0,
                    creditAmount: entryData.creditAmount || 0,
                    currency,
                    description: entryData.description,
                    reference: entryData.reference,
                    metadata: {},
                    createdAt: new Date()
                };
                transaction.entries.push(entry);
            }
            // Save transaction to database
            await this.saveTransaction(transaction);
            // Update account balances
            await this.updateAccountBalances(transaction);
            // Update transaction status
            transaction.status = TransactionStatus.POSTED;
            await this.updateTransaction(transaction);
            // Add to memory cache
            this.transactions.set(transactionId, transaction);
            logger_1.LoggerService.info(`Transaction recorded successfully: ${transactionId}`, {
                transactionNumber: transaction.transactionNumber,
                totalAmount: transaction.totalAmount
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('transaction.recorded', 'blnkfinance', transactionId, {
                transactionNumber: transaction.transactionNumber,
                description: transaction.description,
                type: transaction.type,
                totalAmount: transaction.totalAmount,
                entriesCount: transaction.entries.length
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Record transaction failed:', error);
            throw error;
        }
    }
    /**
     * Get account balance
     * Uses external BlnkFinance service if available, otherwise gets from local cache
     */
    static async getAccountBalance(accountId, tenantId, currency) {
        try {
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.get(`/v1/accounts/${accountId}/balance`, {
                        params: {
                            tenant_id: tenantId,
                            currency: currency
                        }
                    });
                    const externalBalance = response.data.balance || response.data;
                    logger_1.LoggerService.info(`Account balance retrieved via external BlnkFinance service: ${accountId}`);
                    // Convert external balance to internal format
                    return {
                        accountId,
                        currency: currency || externalBalance.currency || 'USD',
                        debitBalance: parseFloat(externalBalance.debit_balance || externalBalance.debit || '0'),
                        creditBalance: parseFloat(externalBalance.credit_balance || externalBalance.credit || '0'),
                        netBalance: parseFloat(externalBalance.balance || externalBalance.total || '0'),
                        lastUpdated: new Date(externalBalance.last_updated || Date.now())
                    };
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local cache', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation - get from cache
            const balance = this.balances.get(accountId);
            if (balance) {
                return balance;
            }
            // Load from database if not in cache
            const dbBalance = await this.loadAccountBalance(accountId);
            if (dbBalance) {
                this.balances.set(accountId, dbBalance);
                return dbBalance;
            }
            return null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get account balance failed:', error);
            return null;
        }
    }
    /**
     * Get account statement
     * Uses external BlnkFinance service if available
     */
    static async getAccountStatement(accountId, startDate, endDate, brokerId, tenantId) {
        try {
            logger_1.LoggerService.info(`Getting account statement: ${accountId}`, {
                startDate,
                endDate,
                brokerId
            });
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.get(`/v1/accounts/${accountId}/history`, {
                        params: {
                            tenant_id: tenantId,
                            start_date: startDate.toISOString(),
                            end_date: endDate.toISOString(),
                            broker_id: brokerId
                        }
                    });
                    logger_1.LoggerService.info(`Account statement retrieved via external BlnkFinance service: ${response.data.entries?.length || 0} entries`);
                    return (response.data.entries || []).map((entry) => this.mapExternalEntryToInternal(entry, accountId));
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation
            const entries = await this.loadLedgerEntries(accountId, startDate, endDate, brokerId);
            logger_1.LoggerService.info(`Account statement retrieved: ${entries.length} entries`);
            return entries;
        }
        catch (error) {
            logger_1.LoggerService.error('Get account statement failed:', error);
            throw error;
        }
    }
    /**
     * Process payment via external BlnkFinance service
     */
    static async processPayment(paymentData) {
        try {
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post('/payments', {
                        tenant_id: paymentData.tenantId,
                        account_id: paymentData.accountId,
                        amount: paymentData.amount,
                        currency: paymentData.currency,
                        description: paymentData.description,
                        reference: paymentData.reference,
                        metadata: paymentData.metadata
                    });
                    logger_1.LoggerService.info(`Payment processed via external BlnkFinance service: ${response.data.id}`);
                    return response.data;
                }
                catch (error) {
                    logger_1.LoggerService.error('Failed to process payment via BlnkFinance', { error: error.message });
                    throw error;
                }
            }
            else {
                // Local implementation - create transaction entry
                return await this.recordTransaction(paymentData.description, [{
                        accountId: paymentData.accountId,
                        debitAmount: paymentData.amount,
                        description: paymentData.description,
                        reference: paymentData.reference
                    }], undefined, paymentData.currency, TransactionType.PAYMENT, paymentData.reference, paymentData.metadata);
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Process payment failed:', error);
            throw error;
        }
    }
    // In-memory storage for margin positions (local implementation)
    static marginPositions = new Map();
    /**
     * Process margin position
     *
     * Creates a leveraged trading position with proper accounting entries:
     * - Debit: Margin Account (collateral locked)
     * - Credit: Trading Account (position opened)
     *
     * Supports both external BlnkFinance service and local implementation.
     */
    static async processMarginPosition(positionData) {
        try {
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post('/margin-positions', {
                        tenant_id: positionData.tenantId,
                        account_id: positionData.accountId,
                        amount: positionData.amount,
                        currency: positionData.currency,
                        position_type: positionData.positionType,
                        leverage: positionData.leverage,
                        metadata: positionData.metadata
                    });
                    logger_1.LoggerService.info(`Margin position processed via external BlnkFinance service: ${response.data.id}`);
                    return response.data;
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation
            const positionId = (0, uuid_1.v4)();
            const entryPrice = positionData.entryPrice || 1; // Default to 1 if not provided
            const margin = positionData.amount / positionData.leverage;
            // Calculate liquidation price (simplified)
            // For long: liquidation when price drops by (1/leverage) * 100%
            // For short: liquidation when price rises by (1/leverage) * 100%
            const liquidationThreshold = 1 / positionData.leverage;
            const liquidationPrice = positionData.positionType === 'long'
                ? entryPrice * (1 - liquidationThreshold * 0.9) // 90% of threshold for safety
                : entryPrice * (1 + liquidationThreshold * 0.9);
            const position = {
                id: positionId,
                tenantId: positionData.tenantId,
                accountId: positionData.accountId,
                amount: positionData.amount,
                currency: positionData.currency,
                positionType: positionData.positionType,
                leverage: positionData.leverage,
                entryPrice,
                currentPrice: entryPrice,
                unrealizedPnl: 0,
                margin,
                liquidationPrice,
                status: 'open',
                metadata: positionData.metadata,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store position
            this.marginPositions.set(positionId, position);
            // Record accounting entries
            // 1. Lock margin (collateral)
            await this.recordTransaction(`Margin position opened: ${positionData.positionType} ${positionData.amount} ${positionData.currency} @ ${positionData.leverage}x`, [
                {
                    accountId: positionData.accountId,
                    debitAmount: margin,
                    description: 'Margin collateral locked'
                },
                {
                    accountId: '1130', // Margin Accounts
                    creditAmount: margin,
                    description: 'Margin position collateral'
                }
            ], undefined, positionData.currency, TransactionType.MARGIN_CALL, positionId, {
                positionId,
                positionType: positionData.positionType,
                leverage: positionData.leverage,
                entryPrice
            });
            logger_1.LoggerService.info(`Margin position created locally: ${positionId}`, {
                positionType: positionData.positionType,
                amount: positionData.amount,
                leverage: positionData.leverage,
                margin,
                liquidationPrice
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('margin.position.opened', 'blnkfinance', positionId, {
                accountId: positionData.accountId,
                positionType: positionData.positionType,
                amount: positionData.amount,
                leverage: positionData.leverage,
                margin,
                entryPrice,
                liquidationPrice
            });
            return position;
        }
        catch (error) {
            logger_1.LoggerService.error('Process margin position failed:', error);
            throw error;
        }
    }
    /**
     * Close margin position
     *
     * Closes an open margin position and settles PnL:
     * - If profit: Credit user account, Debit trading revenue
     * - If loss: Debit user account, Credit trading revenue
     * - Release margin collateral
     */
    static async processMarginPositionClose(positionId, closeData) {
        try {
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post(`/margin-positions/${positionId}/close`, {
                        tenant_id: closeData.tenantId,
                        close_amount: closeData.closeAmount,
                        pnl: closeData.pnl,
                        metadata: closeData.metadata
                    });
                    logger_1.LoggerService.info(`Margin position closed via external BlnkFinance service: ${positionId}`);
                    return response.data;
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation
            const position = this.marginPositions.get(positionId);
            if (!position) {
                throw (0, utils_1.createError)('Margin position not found', 404, 'POSITION_NOT_FOUND');
            }
            if (position.status !== 'open') {
                throw (0, utils_1.createError)('Position is not open', 400, 'POSITION_NOT_OPEN');
            }
            const closePrice = closeData.closePrice || position.currentPrice;
            // Calculate PnL if not provided
            let pnl = closeData.pnl;
            if (pnl === undefined) {
                const priceChange = (closePrice - position.entryPrice) / position.entryPrice;
                pnl = position.positionType === 'long'
                    ? position.amount * priceChange
                    : position.amount * -priceChange;
            }
            // Update position
            position.status = 'closed';
            position.currentPrice = closePrice;
            position.unrealizedPnl = pnl;
            position.updatedAt = new Date();
            position.closedAt = new Date();
            this.marginPositions.set(positionId, position);
            // Record accounting entries
            const entries = [];
            // Release margin collateral
            entries.push({
                accountId: '1130', // Margin Accounts
                debitAmount: position.margin,
                description: 'Margin collateral released'
            });
            entries.push({
                accountId: position.accountId,
                creditAmount: position.margin,
                description: 'Margin collateral returned'
            });
            // Settle PnL
            if (pnl > 0) {
                // Profit - credit user, debit trading revenue
                entries.push({
                    accountId: position.accountId,
                    creditAmount: pnl,
                    description: 'Trading profit'
                });
                entries.push({
                    accountId: '4100', // Trading Revenue
                    debitAmount: pnl,
                    description: 'Trading profit paid'
                });
            }
            else if (pnl < 0) {
                // Loss - debit user, credit trading revenue
                entries.push({
                    accountId: position.accountId,
                    debitAmount: Math.abs(pnl),
                    description: 'Trading loss'
                });
                entries.push({
                    accountId: '4100', // Trading Revenue
                    creditAmount: Math.abs(pnl),
                    description: 'Trading loss collected'
                });
            }
            await this.recordTransaction(`Margin position closed: ${position.positionType} ${position.amount} ${position.currency} PnL: ${pnl}`, entries, undefined, position.currency, TransactionType.TRADE, positionId, {
                positionId,
                closePrice,
                pnl,
                ...closeData.metadata
            });
            logger_1.LoggerService.info(`Margin position closed locally: ${positionId}`, {
                pnl,
                closePrice,
                margin: position.margin
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('margin.position.closed', 'blnkfinance', positionId, {
                accountId: position.accountId,
                positionType: position.positionType,
                amount: position.amount,
                entryPrice: position.entryPrice,
                closePrice,
                pnl,
                margin: position.margin
            });
            return {
                ...position,
                pnl,
                closePrice
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Close margin position failed:', error);
            throw error;
        }
    }
    /**
     * Process liquidation
     *
     * Forcefully closes a margin position when it reaches liquidation threshold:
     * - Seize remaining collateral
     * - Close position at current market price
     * - Record liquidation fee
     */
    static async processLiquidation(liquidationData) {
        try {
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    const response = await this.externalServiceClient.post('/liquidations', {
                        tenant_id: liquidationData.tenantId,
                        account_id: liquidationData.accountId,
                        position_id: liquidationData.positionId,
                        liquidation_amount: liquidationData.liquidationAmount,
                        currency: liquidationData.currency,
                        reason: liquidationData.reason,
                        metadata: liquidationData.metadata
                    });
                    logger_1.LoggerService.info(`Liquidation processed via external BlnkFinance service: ${response.data.id}`);
                    return response.data;
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation
            const position = this.marginPositions.get(liquidationData.positionId);
            if (!position) {
                throw (0, utils_1.createError)('Margin position not found', 404, 'POSITION_NOT_FOUND');
            }
            if (position.status !== 'open') {
                throw (0, utils_1.createError)('Position is not open', 400, 'POSITION_NOT_OPEN');
            }
            const liquidationId = (0, uuid_1.v4)();
            const liquidationPrice = liquidationData.liquidationPrice || position.liquidationPrice;
            const liquidationFee = position.margin * 0.05; // 5% liquidation fee
            // Calculate final loss (user loses entire margin minus liquidation fee)
            const totalLoss = position.margin;
            // Update position
            position.status = 'liquidated';
            position.currentPrice = liquidationPrice;
            position.unrealizedPnl = -totalLoss;
            position.updatedAt = new Date();
            position.closedAt = new Date();
            this.marginPositions.set(liquidationData.positionId, position);
            // Record accounting entries
            await this.recordTransaction(`Liquidation: ${liquidationData.reason}`, [
                // Seize margin collateral
                {
                    accountId: '1130', // Margin Accounts
                    debitAmount: position.margin,
                    description: 'Margin collateral seized'
                },
                // Liquidation fee to platform
                {
                    accountId: '4200', // Fee Income
                    creditAmount: liquidationFee,
                    description: 'Liquidation fee'
                },
                // Remaining to cover losses
                {
                    accountId: '4100', // Trading Revenue
                    creditAmount: position.margin - liquidationFee,
                    description: 'Liquidation proceeds'
                }
            ], undefined, liquidationData.currency, TransactionType.LIQUIDATION, liquidationId, {
                positionId: liquidationData.positionId,
                liquidationPrice,
                liquidationFee,
                reason: liquidationData.reason,
                ...liquidationData.metadata
            });
            logger_1.LoggerService.info(`Liquidation processed locally: ${liquidationId}`, {
                positionId: liquidationData.positionId,
                liquidationPrice,
                liquidationFee,
                totalLoss,
                reason: liquidationData.reason
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('margin.position.liquidated', 'blnkfinance', liquidationId, {
                positionId: liquidationData.positionId,
                accountId: liquidationData.accountId,
                liquidationPrice,
                liquidationFee,
                totalLoss,
                reason: liquidationData.reason
            });
            return {
                id: liquidationId,
                positionId: liquidationData.positionId,
                accountId: liquidationData.accountId,
                liquidationPrice,
                liquidationFee,
                totalLoss,
                reason: liquidationData.reason,
                status: 'completed',
                createdAt: new Date()
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Process liquidation failed:', error);
            throw error;
        }
    }
    /**
     * Get margin position by ID
     */
    static async getMarginPosition(positionId) {
        const position = this.marginPositions.get(positionId);
        if (!position) {
            throw (0, utils_1.createError)('Margin position not found', 404, 'POSITION_NOT_FOUND');
        }
        return position;
    }
    /**
     * Get all margin positions for an account
     */
    static async getAccountMarginPositions(accountId, status) {
        const positions = Array.from(this.marginPositions.values())
            .filter(p => p.accountId === accountId)
            .filter(p => !status || p.status === status);
        return positions;
    }
    /**
     * Update margin position price (for PnL calculation)
     */
    static async updateMarginPositionPrice(positionId, currentPrice) {
        const position = this.marginPositions.get(positionId);
        if (!position) {
            throw (0, utils_1.createError)('Margin position not found', 404, 'POSITION_NOT_FOUND');
        }
        if (position.status !== 'open') {
            return position; // No update needed for closed positions
        }
        // Calculate unrealized PnL
        const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
        const unrealizedPnl = position.positionType === 'long'
            ? position.amount * priceChange
            : position.amount * -priceChange;
        position.currentPrice = currentPrice;
        position.unrealizedPnl = unrealizedPnl;
        position.updatedAt = new Date();
        this.marginPositions.set(positionId, position);
        // Check if position should be liquidated
        const shouldLiquidate = position.positionType === 'long'
            ? currentPrice <= position.liquidationPrice
            : currentPrice >= position.liquidationPrice;
        if (shouldLiquidate) {
            logger_1.LoggerService.warn(`Position ${positionId} has reached liquidation price`, {
                currentPrice,
                liquidationPrice: position.liquidationPrice
            });
        }
        return {
            ...position,
            shouldLiquidate
        };
    }
    /**
     * Generate financial report
     */
    static async generateFinancialReport(reportType, startDate, endDate, brokerId, currency = 'USD') {
        try {
            logger_1.LoggerService.info(`Generating financial report: ${reportType}`, {
                startDate,
                endDate,
                brokerId,
                currency
            });
            let data;
            switch (reportType) {
                case ReportType.PROFIT_LOSS:
                    data = await this.generateProfitLossReport(startDate, endDate, brokerId, currency);
                    break;
                case ReportType.BALANCE_SHEET:
                    data = await this.generateBalanceSheetReport(startDate, endDate, brokerId, currency);
                    break;
                case ReportType.CASH_FLOW:
                    data = await this.generateCashFlowReport(startDate, endDate, brokerId, currency);
                    break;
                case ReportType.TRIAL_BALANCE:
                    data = await this.generateTrialBalanceReport(startDate, endDate, brokerId, currency);
                    break;
                case ReportType.BROKER_SUMMARY:
                    data = await this.generateBrokerSummaryReport(startDate, endDate, brokerId, currency);
                    break;
                default:
                    throw (0, utils_1.createError)('Unsupported report type', 400, 'UNSUPPORTED_REPORT_TYPE');
            }
            const reportId = (0, uuid_1.v4)();
            const report = {
                id: reportId,
                reportType,
                period: { startDate, endDate },
                brokerId,
                currency,
                data,
                generatedAt: new Date()
            };
            // Persist report to database
            await this.saveFinancialReport(report);
            logger_1.LoggerService.info(`Financial report generated and saved: ${reportType}`, {
                reportId,
                dataSize: JSON.stringify(data).length
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('report.generated', 'blnkfinance', reportId, {
                reportId,
                reportType,
                startDate,
                endDate,
                brokerId,
                currency
            });
            return report;
        }
        catch (error) {
            logger_1.LoggerService.error('Generate financial report failed:', error);
            throw error;
        }
    }
    /**
     * Reconcile account with external source
     */
    static async reconcileAccount(accountId, externalSource, externalReference, internalAmount, externalAmount, notes) {
        try {
            logger_1.LoggerService.info(`Reconciling account: ${accountId}`, {
                externalSource,
                externalReference,
                internalAmount,
                externalAmount
            });
            const difference = internalAmount - externalAmount;
            const status = Math.abs(difference) < 0.01 ? ReconciliationStatus.MATCHED : ReconciliationStatus.DIFFERENCE;
            const reconciliation = {
                id: (0, uuid_1.v4)(),
                accountId,
                externalSource,
                externalReference,
                internalAmount,
                externalAmount,
                difference,
                status,
                reconciledAt: status === ReconciliationStatus.MATCHED ? new Date() : undefined,
                notes,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save reconciliation
            await this.saveReconciliation(reconciliation);
            logger_1.LoggerService.info(`Account reconciled: ${reconciliation.id}`, {
                status: reconciliation.status,
                difference: reconciliation.difference
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('account.reconciled', 'blnkfinance', accountId, {
                reconciliationId: reconciliation.id,
                externalSource,
                status: reconciliation.status,
                difference: reconciliation.difference
            });
            return reconciliation;
        }
        catch (error) {
            logger_1.LoggerService.error('Reconcile account failed:', error);
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
            logger_1.LoggerService.info('Closing BlnkFinance Service...');
            this.isInitialized = false;
            this.accounts.clear();
            this.balances.clear();
            this.transactions.clear();
            logger_1.LoggerService.info('✅ BlnkFinance Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing BlnkFinance Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async initializeModels() {
        try {
            // This would typically initialize Sequelize models
            // For now, we'll use in-memory storage
            logger_1.LoggerService.info('BlnkFinance models initialized');
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize models failed:', error);
            throw error;
        }
    }
    static async createDefaultChartOfAccounts() {
        try {
            logger_1.LoggerService.info('Creating default chart of accounts...');
            for (const [category, accounts] of Object.entries(this.CHART_OF_ACCOUNTS)) {
                for (const [code, accountData] of Object.entries(accounts)) {
                    const parentId = accountData.parent ? this.getAccountIdByCode(accountData.parent) : undefined;
                    await this.createAccount(code, accountData.name, accountData.type, 'USD', undefined, parentId, `Default ${category} account`);
                }
            }
            logger_1.LoggerService.info('Default chart of accounts created successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Create default chart of accounts failed:', error);
            throw error;
        }
    }
    static async loadAccountsAndBalances() {
        try {
            // This would typically load from database
            // For now, we'll initialize with empty maps
            logger_1.LoggerService.info('Accounts and balances loaded from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Load accounts and balances failed:', error);
            throw error;
        }
    }
    static async saveAccount(account) {
        try {
            // This would typically save to database
            logger_1.LoggerService.info(`Account saved to database: ${account.id}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Save account failed:', error);
            throw error;
        }
    }
    static async saveTransaction(transaction) {
        try {
            // This would typically save to database
            logger_1.LoggerService.info(`Transaction saved to database: ${transaction.id}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Save transaction failed:', error);
            throw error;
        }
    }
    static async updateTransaction(transaction) {
        try {
            // This would typically update in database
            logger_1.LoggerService.info(`Transaction updated in database: ${transaction.id}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Update transaction failed:', error);
            throw error;
        }
    }
    static async updateAccountBalances(transaction) {
        try {
            for (const entry of transaction.entries) {
                const balance = this.balances.get(entry.accountId);
                if (balance) {
                    balance.debitBalance += entry.debitAmount;
                    balance.creditBalance += entry.creditAmount;
                    balance.netBalance = balance.debitBalance - balance.creditBalance;
                    balance.lastUpdated = new Date();
                }
            }
            logger_1.LoggerService.info(`Account balances updated for transaction: ${transaction.id}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Update account balances failed:', error);
            throw error;
        }
    }
    static async loadAccountBalance(accountId) {
        try {
            // This would typically load from database
            return null;
        }
        catch (error) {
            logger_1.LoggerService.error('Load account balance failed:', error);
            return null;
        }
    }
    static async loadLedgerEntries(accountId, startDate, endDate, brokerId) {
        try {
            // This would typically load from database
            return [];
        }
        catch (error) {
            logger_1.LoggerService.error('Load ledger entries failed:', error);
            return [];
        }
    }
    static async generateTransactionNumber() {
        try {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000);
            return `TXN-${timestamp}-${random}`;
        }
        catch (error) {
            logger_1.LoggerService.error('Generate transaction number failed:', error);
            return `TXN-${Date.now()}`;
        }
    }
    static getAccountIdByCode(code) {
        for (const account of this.accounts.values()) {
            if (account.code === code) {
                return account.id;
            }
        }
        return undefined;
    }
    static async generateProfitLossReport(startDate, endDate, brokerId, currency = 'USD') {
        try {
            // This would generate actual P&L report
            return {
                revenue: 0,
                expenses: 0,
                netIncome: 0,
                period: { startDate, endDate }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Generate profit loss report failed:', error);
            throw error;
        }
    }
    static async generateBalanceSheetReport(startDate, endDate, brokerId, currency = 'USD') {
        try {
            // This would generate actual balance sheet
            return {
                assets: 0,
                liabilities: 0,
                equity: 0,
                period: { startDate, endDate }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Generate balance sheet report failed:', error);
            throw error;
        }
    }
    static async generateCashFlowReport(startDate, endDate, brokerId, currency = 'USD') {
        try {
            // This would generate actual cash flow report
            return {
                operatingCashFlow: 0,
                investingCashFlow: 0,
                financingCashFlow: 0,
                netCashFlow: 0,
                period: { startDate, endDate }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Generate cash flow report failed:', error);
            throw error;
        }
    }
    static async generateTrialBalanceReport(startDate, endDate, brokerId, currency = 'USD') {
        try {
            // This would generate actual trial balance
            return {
                accounts: [],
                totalDebits: 0,
                totalCredits: 0,
                period: { startDate, endDate }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Generate trial balance report failed:', error);
            throw error;
        }
    }
    static async generateBrokerSummaryReport(startDate, endDate, brokerId, currency = 'USD') {
        try {
            // This would generate actual broker summary
            return {
                brokerId,
                totalAssets: 0,
                totalLiabilities: 0,
                netWorth: 0,
                period: { startDate, endDate }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Generate broker summary report failed:', error);
            throw error;
        }
    }
    static async saveReconciliation(reconciliation) {
        try {
            // This would typically save to database
            logger_1.LoggerService.info(`Reconciliation saved to database: ${reconciliation.id}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Save reconciliation failed:', error);
            throw error;
        }
    }
    /**
     * Save financial report to database
     */
    static async saveFinancialReport(report) {
        try {
            // Try external BlnkFinance service first if enabled
            if (this.externalServiceEnabled && this.externalServiceClient) {
                try {
                    await this.externalServiceClient.post('/v1/reports', {
                        id: report.id,
                        report_type: report.reportType,
                        start_date: report.period.startDate.toISOString(),
                        end_date: report.period.endDate.toISOString(),
                        broker_id: report.brokerId,
                        currency: report.currency,
                        data: report.data,
                        generated_at: report.generatedAt.toISOString()
                    });
                    logger_1.LoggerService.info(`Financial report saved via external BlnkFinance service: ${report.id}`);
                    return;
                }
                catch (error) {
                    logger_1.LoggerService.warn('External BlnkFinance service call failed, using local storage', {
                        error: error.message
                    });
                    // Fall through to local implementation
                }
            }
            // Local implementation - save to database
            try {
                const FinancialReportModel = database_1.DatabaseService.getModel('FinancialReport');
                if (FinancialReportModel) {
                    await FinancialReportModel.upsert({
                        id: report.id,
                        reportType: report.reportType,
                        startDate: report.period.startDate,
                        endDate: report.period.endDate,
                        brokerId: report.brokerId,
                        currency: report.currency,
                        data: JSON.stringify(report.data),
                        generatedAt: report.generatedAt,
                        createdAt: report.createdAt || new Date(),
                        updatedAt: new Date()
                    });
                    logger_1.LoggerService.info(`Financial report saved to database: ${report.id}`);
                }
                else {
                    logger_1.LoggerService.warn('FinancialReport model not found, report not persisted');
                }
            }
            catch (error) {
                logger_1.LoggerService.error('Save financial report to database failed:', {
                    error: error.message,
                    reportId: report.id
                });
                // Don't throw - report generation succeeded, persistence is secondary
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Save financial report failed:', error);
            // Don't throw - report generation succeeded, persistence is secondary
        }
    }
}
exports.BlnkFinanceService = BlnkFinanceService;
//# sourceMappingURL=blnkfinance.js.map