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
export interface Account {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    parentId?: string;
    brokerId?: string;
    currency: string;
    balance: number;
    debitBalance: number;
    creditBalance: number;
    isActive: boolean;
    description?: string;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface TransactionEntry {
    id: string;
    transactionId: string;
    accountId: string;
    debitAmount: number;
    creditAmount: number;
    currency: string;
    description: string;
    reference?: string;
    metadata?: any;
    createdAt: Date;
}
export interface FinancialTransaction {
    id: string;
    transactionNumber: string;
    date: Date;
    description: string;
    reference?: string;
    brokerId?: string;
    currency: string;
    totalAmount: number;
    status: TransactionStatus;
    type: TransactionType;
    entries: TransactionEntry[];
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface LedgerEntry {
    id: string;
    accountId: string;
    transactionId: string;
    date: Date;
    debitAmount: number;
    creditAmount: number;
    balance: number;
    currency: string;
    description: string;
    reference?: string;
    brokerId?: string;
    metadata?: any;
    createdAt: Date;
}
export interface Balance {
    accountId: string;
    currency: string;
    debitBalance: number;
    creditBalance: number;
    netBalance: number;
    lastUpdated: Date;
}
export interface FinancialReport {
    id?: string;
    reportType: ReportType;
    period: {
        startDate: Date;
        endDate: Date;
    };
    brokerId?: string;
    currency: string;
    data: any;
    generatedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface Reconciliation {
    id: string;
    accountId: string;
    externalSource: string;
    externalReference: string;
    internalAmount: number;
    externalAmount: number;
    difference: number;
    status: ReconciliationStatus;
    reconciledAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum AccountType {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE",
    BANK = "BANK",
    CASH = "CASH",
    RECEIVABLE = "RECEIVABLE",
    PAYABLE = "PAYABLE",
    INVESTMENT = "INVESTMENT",
    TRADING = "TRADING",
    MARGIN = "MARGIN",
    STAKING = "STAKING",
    NFT = "NFT",
    DEFI = "DEFI"
}
export declare enum TransactionStatus {
    PENDING = "PENDING",
    POSTED = "POSTED",
    CANCELLED = "CANCELLED",
    REVERSED = "REVERSED"
}
export declare enum TransactionType {
    DEPOSIT = "DEPOSIT",
    WITHDRAWAL = "WITHDRAWAL",
    TRANSFER = "TRANSFER",
    TRADE = "TRADE",
    FEE = "FEE",
    INTEREST = "INTEREST",
    DIVIDEND = "DIVIDEND",
    STAKING_REWARD = "STAKING_REWARD",
    MARGIN_CALL = "MARGIN_CALL",
    LIQUIDATION = "LIQUIDATION",
    NFT_PURCHASE = "NFT_PURCHASE",
    NFT_SALE = "NFT_SALE",
    DEFI_DEPOSIT = "DEFI_DEPOSIT",
    DEFI_WITHDRAWAL = "DEFI_WITHDRAWAL",
    DEFI_REWARD = "DEFI_REWARD",
    ADJUSTMENT = "ADJUSTMENT",
    RECONCILIATION = "RECONCILIATION",
    PAYMENT = "PAYMENT"
}
export declare enum ReportType {
    PROFIT_LOSS = "PROFIT_LOSS",
    BALANCE_SHEET = "BALANCE_SHEET",
    CASH_FLOW = "CASH_FLOW",
    TRIAL_BALANCE = "TRIAL_BALANCE",
    GENERAL_LEDGER = "GENERAL_LEDGER",
    ACCOUNT_STATEMENT = "ACCOUNT_STATEMENT",
    BROKER_SUMMARY = "BROKER_SUMMARY",
    COMPLIANCE_REPORT = "COMPLIANCE_REPORT"
}
export declare enum ReconciliationStatus {
    PENDING = "PENDING",
    MATCHED = "MATCHED",
    DIFFERENCE = "DIFFERENCE",
    RECONCILED = "RECONCILED"
}
export declare class BlnkFinanceService {
    private static isInitialized;
    private static accounts;
    private static balances;
    private static transactions;
    private static externalServiceUrl;
    private static externalServiceApiKey;
    private static externalServiceEnabled;
    private static externalServiceClient;
    private static readonly CHART_OF_ACCOUNTS;
    /**
     * Initialize BlnkFinance Service
     */
    static initialize(): Promise<void>;
    /**
     * Create a new account
     * Uses external BlnkFinance service if available, otherwise creates locally
     */
    static createAccount(code: string, name: string, type: AccountType, currency: string, brokerId?: string, parentId?: string, description?: string, metadata?: any): Promise<Account>;
    /**
     * Map external BlnkFinance account to internal format
     */
    private static mapExternalAccountToInternal;
    /**
     * Map external BlnkFinance transaction to internal format
     */
    private static mapExternalTransactionToInternal;
    /**
     * Map external ledger entry to internal format
     */
    private static mapExternalEntryToInternal;
    /**
     * Record a double-entry transaction
     * Uses external BlnkFinance service if available, otherwise records locally
     */
    static recordTransaction(description: string, entries: Array<{
        accountId: string;
        debitAmount?: number;
        creditAmount?: number;
        description: string;
        reference?: string;
    }>, brokerId?: string, currency?: string, type?: TransactionType, reference?: string, metadata?: any): Promise<FinancialTransaction>;
    /**
     * Get account balance
     * Uses external BlnkFinance service if available, otherwise gets from local cache
     */
    static getAccountBalance(accountId: string, tenantId?: string, currency?: string): Promise<Balance | null>;
    /**
     * Get account statement
     * Uses external BlnkFinance service if available
     */
    static getAccountStatement(accountId: string, startDate: Date, endDate: Date, brokerId?: string, tenantId?: string): Promise<LedgerEntry[]>;
    /**
     * Process payment via external BlnkFinance service
     */
    static processPayment(paymentData: {
        tenantId: string;
        accountId: string;
        amount: number;
        currency: string;
        description: string;
        reference?: string;
        metadata?: any;
    }): Promise<any>;
    private static marginPositions;
    /**
     * Process margin position
     *
     * Creates a leveraged trading position with proper accounting entries:
     * - Debit: Margin Account (collateral locked)
     * - Credit: Trading Account (position opened)
     *
     * Supports both external BlnkFinance service and local implementation.
     */
    static processMarginPosition(positionData: {
        tenantId: string;
        accountId: string;
        amount: number;
        currency: string;
        positionType: 'long' | 'short';
        leverage: number;
        entryPrice?: number;
        metadata?: any;
    }): Promise<any>;
    /**
     * Close margin position
     *
     * Closes an open margin position and settles PnL:
     * - If profit: Credit user account, Debit trading revenue
     * - If loss: Debit user account, Credit trading revenue
     * - Release margin collateral
     */
    static processMarginPositionClose(positionId: string, closeData: {
        tenantId: string;
        closeAmount: number;
        closePrice?: number;
        pnl?: number;
        metadata?: any;
    }): Promise<any>;
    /**
     * Process liquidation
     *
     * Forcefully closes a margin position when it reaches liquidation threshold:
     * - Seize remaining collateral
     * - Close position at current market price
     * - Record liquidation fee
     */
    static processLiquidation(liquidationData: {
        tenantId: string;
        accountId: string;
        positionId: string;
        liquidationAmount: number;
        currency: string;
        reason: string;
        liquidationPrice?: number;
        metadata?: any;
    }): Promise<any>;
    /**
     * Get margin position by ID
     */
    static getMarginPosition(positionId: string): Promise<any>;
    /**
     * Get all margin positions for an account
     */
    static getAccountMarginPositions(accountId: string, status?: 'open' | 'closed' | 'liquidated'): Promise<any[]>;
    /**
     * Update margin position price (for PnL calculation)
     */
    static updateMarginPositionPrice(positionId: string, currentPrice: number): Promise<any>;
    /**
     * Generate financial report
     */
    static generateFinancialReport(reportType: ReportType, startDate: Date, endDate: Date, brokerId?: string, currency?: string): Promise<FinancialReport>;
    /**
     * Reconcile account with external source
     */
    static reconcileAccount(accountId: string, externalSource: string, externalReference: string, internalAmount: number, externalAmount: number, notes?: string): Promise<Reconciliation>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static initializeModels;
    private static createDefaultChartOfAccounts;
    private static loadAccountsAndBalances;
    private static saveAccount;
    private static saveTransaction;
    private static updateTransaction;
    private static updateAccountBalances;
    private static loadAccountBalance;
    private static loadLedgerEntries;
    private static generateTransactionNumber;
    private static getAccountIdByCode;
    private static generateProfitLossReport;
    private static generateBalanceSheetReport;
    private static generateCashFlowReport;
    private static generateTrialBalanceReport;
    private static generateBrokerSummaryReport;
    private static saveReconciliation;
    /**
     * Save financial report to database
     */
    private static saveFinancialReport;
}
//# sourceMappingURL=blnkfinance.d.ts.map