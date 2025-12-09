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
export interface FundAccessValidation {
    allowed: boolean;
    reason?: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export interface FundTransferResult {
    success: boolean;
    transactionId?: string;
    reason?: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export interface RiskAssessment {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: string[];
}
export interface SegregationValidation {
    allowed: boolean;
    reason?: string;
    violations?: string[];
}
export interface LedgerAccount {
    id: string;
    tenantId: string;
    accountType: AccountType;
    accountLevel: AccountLevel;
    parentAccountId?: string;
    name: string;
    currency: string;
    blnkAccountId: string;
    bankAccount?: BankAccountDetails;
    status: AccountStatus;
    permissions: AccountPermissions;
    metadata: AccountMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface BankAccountDetails {
    id: string;
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
    iban?: string;
    accountType: BankAccountType;
    currency: string;
    country: string;
    isVerified: boolean;
    verificationDate?: Date;
    metadata: any;
}
export interface AccountPermissions {
    canDeposit: boolean;
    canWithdraw: boolean;
    canTransfer: boolean;
    canTrade: boolean;
    canLend: boolean;
    canBorrow: boolean;
    maxDailyVolume: number;
    maxMonthlyVolume: number;
    maxSingleTransaction: number;
    requiresApproval: boolean;
    approvalThreshold: number;
}
export interface AccountMetadata {
    description: string;
    tags: string[];
    complianceFlags: string[];
    riskLevel: RiskLevel;
    lastReconciliation: Date;
    version: string;
}
export interface FundSegregation {
    id: string;
    accountId: string;
    segregationType: SegregationType;
    segregatedAmount: number;
    currency: string;
    purpose: string;
    status: SegregationStatus;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}
export interface LedgerTransaction {
    id: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    currency: string;
    transactionType: TransactionType;
    description: string;
    reference?: string;
    status: TransactionStatus;
    metadata: TransactionMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface TransactionMetadata {
    source: string;
    ipAddress?: string;
    userAgent?: string;
    complianceFlags: string[];
    riskScore: number;
    approvalRequired: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    context?: any;
    segregationValidated?: boolean;
    riskLevel?: string;
    reference?: string;
    bankAccountId?: string;
    [key: string]: any;
}
export interface ReconciliationReport {
    id: string;
    accountId: string;
    reportDate: Date;
    blnkBalance: number;
    bankBalance: number;
    discrepancy: number;
    status: ReconciliationStatus;
    issues: ReconciliationIssue[];
    createdAt: Date;
}
export interface ReconciliationIssue {
    type: IssueType;
    description: string;
    amount: number;
    currency: string;
    severity: IssueSeverity;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
}
export interface LedgerStats {
    totalAccounts: number;
    activeAccounts: number;
    suspendedAccounts: number;
    totalBalance: number;
    byLevel: LevelStats[];
    byCurrency: CurrencyStats[];
    byStatus: StatusStats[];
    recentTransactions: number;
    pendingTransactions: number;
    failedTransactions: number;
}
export interface LevelStats {
    level: AccountLevel;
    count: number;
    totalBalance: number;
    activeAccounts: number;
}
export interface CurrencyStats {
    currency: string;
    count: number;
    totalBalance: number;
    averageBalance: number;
}
export interface StatusStats {
    status: AccountStatus;
    count: number;
    percentage: number;
}
export declare enum AccountType {
    PLATFORM_MASTER = "platform_master",
    BROKER_MASTER = "broker_master",
    END_USER = "end_user"
}
export declare enum AccountLevel {
    LEVEL_1 = 1,// Platform
    LEVEL_2 = 2,// Broker
    LEVEL_3 = 3
}
export declare enum AccountStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended",
    CLOSED = "closed",
    PENDING_APPROVAL = "pending_approval"
}
export declare enum BankAccountType {
    CHECKING = "checking",
    SAVINGS = "savings",
    BUSINESS = "business",
    ESCROW = "escrow",
    CUSTODY = "custody"
}
export declare enum SegregationType {
    CLIENT_FUNDS = "client_funds",
    OPERATIONAL_FUNDS = "operational_funds",
    RESERVE_FUNDS = "reserve_funds",
    INSURANCE_FUNDS = "insurance_funds",
    REGULATORY_FUNDS = "regulatory_funds"
}
export declare enum SegregationStatus {
    ACTIVE = "active",
    RELEASED = "released",
    EXPIRED = "expired",
    DISPUTED = "disputed"
}
export declare enum TransactionType {
    DEPOSIT = "deposit",
    WITHDRAWAL = "withdrawal",
    TRANSFER = "transfer",
    TRADE = "trade",
    FEE = "fee",
    INTEREST = "interest",
    DIVIDEND = "dividend",
    REBATE = "rebate",
    ADJUSTMENT = "adjustment"
}
export declare enum TransactionStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    REQUIRES_APPROVAL = "requires_approval"
}
export declare enum ReconciliationStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    DISCREPANCY = "discrepancy",
    FAILED = "failed"
}
export declare enum IssueType {
    BALANCE_MISMATCH = "balance_mismatch",
    MISSING_TRANSACTION = "missing_transaction",
    DUPLICATE_TRANSACTION = "duplicate_transaction",
    INVALID_TRANSACTION = "invalid_transaction",
    TIMING_DIFFERENCE = "timing_difference"
}
export declare enum IssueSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare class MultiTierLedgerService {
    private static isInitialized;
    private static accounts;
    private static fundSegregations;
    private static transactions;
    private static reconciliationReports;
    private static readonly LEDGER_CONFIG;
    /**
     * Initialize Multi-Tier Ledger Service
     */
    static initialize(): Promise<void>;
    /**
     * Create Platform Master Account
     */
    static createPlatformMasterAccount(tenantId: string, name: string, currency?: string, bankAccount?: BankAccountDetails): Promise<LedgerAccount>;
    /**
     * Create Broker Master Account
     */
    static createBrokerMasterAccount(tenantId: string, brokerId: string, name: string, currency: string | undefined, parentAccountId: string, bankAccount?: BankAccountDetails): Promise<LedgerAccount>;
    /**
     * Create End User Account
     */
    static createEndUserAccount(tenantId: string, userId: string, name: string, currency: string | undefined, parentAccountId: string, bankAccount?: BankAccountDetails): Promise<LedgerAccount>;
    /**
     * Get Platform Master Accounts
     */
    static getPlatformMasterAccounts(tenantId: string): Promise<LedgerAccount[]>;
    /**
     * Get Broker Master Accounts
     */
    static getBrokerMasterAccounts(tenantId: string, brokerId?: string): Promise<LedgerAccount[]>;
    /**
     * Get Broker Master Account by ID
     */
    static getBrokerMasterAccount(accountId: string): Promise<LedgerAccount | null>;
    /**
     * Get End User Accounts
     */
    static getEndUserAccounts(tenantId: string, brokerId?: string, userId?: string): Promise<LedgerAccount[]>;
    /**
     * Get End User Account by ID
     */
    static getEndUserAccount(accountId: string): Promise<LedgerAccount | null>;
    /**
     * Configure Bank Account for Ledger Account
     */
    static configureBankAccount(accountId: string, bankAccount: BankAccountDetails): Promise<LedgerAccount>;
    /**
     * Get Bank Account for Ledger Account
     */
    static getBankAccount(accountId: string): Promise<BankAccountDetails | null>;
    /**
     * Update Bank Account for Ledger Account
     */
    static updateBankAccount(accountId: string, updates: Partial<BankAccountDetails>): Promise<LedgerAccount>;
    /**
     * Get Account Transfers
     */
    static getAccountTransfers(accountId: string, filters?: {
        fromDate?: Date;
        toDate?: Date;
        status?: TransactionStatus;
        transactionType?: TransactionType;
        limit?: number;
        offset?: number;
    }): Promise<{
        transactions: LedgerTransaction[];
        total: number;
    }>;
    /**
     * Transfer funds between accounts
     */
    static transferFunds(fromAccountId: string, toAccountId: string, amount: number, currency: string, description: string, reference?: string, metadata?: any): Promise<LedgerTransaction>;
    /**
     * Get ledger statistics
     */
    static getLedgerStats(): Promise<LedgerStats>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static validateConfiguration;
    private static loadExistingData;
    private static initializePlatformMasterAccount;
    private static startReconciliationScheduler;
    private static createBlnkAccount;
    /**
     * Get Fund Segregations
     */
    static getFundSegregations(tenantId: string, filters?: {
        accountId?: string;
        segregationType?: SegregationType;
        status?: SegregationStatus;
        currency?: string;
    }): Promise<FundSegregation[]>;
    /**
     * Get Fund Segregation by ID
     */
    static getFundSegregation(segregationId: string): Promise<FundSegregation | null>;
    /**
     * Update Fund Segregation Status
     */
    static updateFundSegregationStatus(segregationId: string, status: SegregationStatus): Promise<FundSegregation>;
    /**
     * Reconcile Bank Accounts
     */
    static reconcileBankAccounts(tenantId: string, accountIds: string[], reconciliationDate?: Date): Promise<ReconciliationReport>;
    /**
     * Get Reconciliation Reports
     */
    static getReconciliationReports(tenantId: string, filters?: {
        fromDate?: Date;
        toDate?: Date;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        reports: ReconciliationReport[];
        total: number;
    }>;
    /**
     * Create Fiat Deposit
     */
    static createFiatDeposit(tenantId: string, accountId: string, amount: number, currency: string, reference: string, description?: string): Promise<LedgerTransaction>;
    /**
     * Create Fiat Withdrawal
     */
    static createFiatWithdrawal(tenantId: string, accountId: string, amount: number, currency: string, bankAccountId: string, description?: string): Promise<LedgerTransaction>;
    /**
     * Get Fiat Transactions
     */
    static getFiatTransactions(tenantId: string, filters?: {
        accountId?: string;
        type?: 'deposit' | 'withdrawal';
        status?: TransactionStatus;
        currency?: string;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        transactions: LedgerTransaction[];
        total: number;
    }>;
    /**
     * Get Fiat Transaction by ID
     */
    static getFiatTransaction(transactionId: string): Promise<LedgerTransaction | null>;
    /**
     * Calculate withdrawal risk score
     */
    private static calculateWithdrawalRiskScore;
    /**
     * Get Unallocated Funds
     */
    static getUnallocatedFunds(tenantId: string): Promise<Array<{
        currency: string;
        amount: number;
        accountId: string;
        reason: string;
        createdAt: Date;
    }>>;
    /**
     * Allocate Fund
     */
    static allocateFund(tenantId: string, fundId: string, targetAccountId: string, allocationReason?: string): Promise<LedgerTransaction>;
    /**
     * Refund Unallocated Fund
     */
    static refundUnallocatedFund(tenantId: string, fundId: string, refundReason?: string): Promise<LedgerTransaction>;
    /**
     * Get Withdrawal Limits
     */
    static getWithdrawalLimits(tenantId: string, accountId?: string): Promise<Array<{
        accountId: string;
        currency: string;
        dailyLimit: number;
        monthlyLimit: number;
        singleTransactionLimit: number;
        currentDailyUsage: number;
        currentMonthlyUsage: number;
        resetAt: Date;
    }>>;
    /**
     * Create Withdrawal Limit
     */
    static createWithdrawalLimit(tenantId: string, accountId: string, limits: {
        dailyLimit?: number;
        monthlyLimit?: number;
        singleTransactionLimit?: number;
    }): Promise<LedgerAccount>;
    /**
     * Update Withdrawal Limit
     */
    static updateWithdrawalLimit(tenantId: string, accountId: string, updates: {
        dailyLimit?: number;
        monthlyLimit?: number;
        singleTransactionLimit?: number;
    }): Promise<LedgerAccount>;
    private static createFundSegregation;
    private static processTransaction;
    private static calculateRiskScore;
    private static performReconciliation;
    /**
     * CRITICAL: Validate fund access with multi-layer security
     * Zero-tolerance for unauthorized access
     */
    static validateFundAccess(tenantId: string, userId: string, accountId: string, operation: 'read' | 'write' | 'transfer', context?: {
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
        riskScore?: number;
    }): Promise<FundAccessValidation>;
    /**
     * CRITICAL: Perform segregated fund transfer with full isolation
     * Zero-tolerance for fund mixing between tenants
     */
    static segregateFunds(tenantId: string, sourceAccountId: string, destinationAccountId: string, amount: number, currency: string, context: {
        userId: string;
        ipAddress?: string;
        userAgent?: string;
        reason?: string;
        complianceData?: any;
    }): Promise<FundTransferResult>;
    /**
     * Assess risk level for fund access operations
     */
    private static assessAccessRisk;
    /**
     * Validate fund segregation rules
     */
    private static validateSegregation;
    /**
     * Execute segregated transfer
     */
    private static executeSegregatedTransfer;
    /**
     * Generate Fund Segregation Report
     * Comprehensive report showing fund segregation status across all accounts
     */
    static generateFundSegregationReport(tenantId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        accountTypes?: AccountType[];
        currency?: string;
        includeTransactions?: boolean;
    }): Promise<{
        id: string;
        tenantId: string;
        reportType: 'fund_segregation';
        generatedAt: Date;
        period: {
            startDate: Date;
            endDate: Date;
        };
        summary: {
            totalAccounts: number;
            totalSegregatedFunds: number;
            totalClientFunds: number;
            totalOperationalFunds: number;
            totalReserveFunds: number;
            segregationCompliance: number;
        };
        accountBreakdown: Array<{
            accountId: string;
            accountName: string;
            accountType: AccountType;
            accountLevel: AccountLevel;
            currency: string;
            balance: number;
            segregatedAmount: number;
            segregationType: SegregationType;
            status: AccountStatus;
            lastReconciliation: Date;
        }>;
        segregationDetails: Array<{
            segregationId: string;
            accountId: string;
            segregationType: SegregationType;
            amount: number;
            currency: string;
            status: SegregationStatus;
            purpose: string;
            createdAt: Date;
        }>;
        complianceIssues: Array<{
            accountId: string;
            issue: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
            recommendation: string;
        }>;
        transactions?: Array<{
            transactionId: string;
            fromAccountId: string;
            toAccountId: string;
            amount: number;
            currency: string;
            type: TransactionType;
            status: TransactionStatus;
            createdAt: Date;
        }>;
    }>;
    /**
     * Get Oversight Report
     * Comprehensive oversight report for regulatory compliance
     */
    static getOversightReport(reportId: string): Promise<{
        id: string;
        tenantId: string;
        reportType: string;
        generatedAt: Date;
        status: string;
        data: any;
    } | null>;
    /**
     * Generate Oversight Report
     * Creates a comprehensive oversight report for regulatory purposes
     */
    static generateOversightReport(tenantId: string, options?: {
        reportType?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
        startDate?: Date;
        endDate?: Date;
        includeAllBrokers?: boolean;
    }): Promise<{
        id: string;
        tenantId: string;
        reportType: string;
        generatedAt: Date;
        period: {
            startDate: Date;
            endDate: Date;
        };
        platformOverview: {
            totalPlatformBalance: number;
            totalBrokerAccounts: number;
            totalEndUserAccounts: number;
            totalTransactionsVolume: number;
            totalTransactionsCount: number;
        };
        brokerSummary: Array<{
            brokerId: string;
            brokerName: string;
            totalBalance: number;
            clientCount: number;
            transactionVolume: number;
            complianceScore: number;
        }>;
        riskMetrics: {
            highRiskAccounts: number;
            pendingApprovals: number;
            failedTransactions: number;
            reconciliationDiscrepancies: number;
        };
        complianceStatus: {
            fundSegregationCompliant: boolean;
            reconciliationUpToDate: boolean;
            kycCompliant: boolean;
            amlCompliant: boolean;
            overallScore: number;
        };
        alerts: Array<{
            type: string;
            severity: 'info' | 'warning' | 'critical';
            message: string;
            accountId?: string;
            timestamp: Date;
        }>;
    }>;
}
//# sourceMappingURL=multi-tier-ledger.d.ts.map