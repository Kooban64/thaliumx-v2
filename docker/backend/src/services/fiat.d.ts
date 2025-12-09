/**
 * FIAT Management Service
 *
 * Core FIAT operations including:
 * - Multi-currency FIAT wallets
 * - Banking API integration (Nedbank)
 * - PayShap integration
 * - Deposit/withdrawal processing
 * - Automated reconciliation
 * - Risk assessment
 *
 * Production-ready for financial operations
 */
export interface FiatWallet {
    id: string;
    userId: string;
    tenantId: string;
    currency: string;
    available: number;
    locked: number;
    total: number;
    status: 'active' | 'suspended' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}
export interface FiatTransaction {
    id: string;
    userId: string;
    tenantId: string;
    walletId: string;
    type: 'deposit' | 'withdrawal' | 'transfer' | 'fee' | 'refund';
    currency: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    reference: string;
    externalReference?: string;
    bankReference?: string;
    description?: string;
    fee?: number;
    netAmount?: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}
export interface BankAccount {
    id: string;
    tenantId: string;
    bankName: string;
    accountNumber: string;
    accountType: 'current' | 'savings';
    currency: string;
    status: 'active' | 'inactive';
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface BankingApiResponse {
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
    };
    reference?: string;
}
export interface ReconciliationRecord {
    id: string;
    tenantId: string;
    bankAccountId: string;
    externalReference: string;
    amount: number;
    currency: string;
    transactionDate: Date;
    description: string;
    status: 'matched' | 'unmatched' | 'disputed';
    matchedTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FiatService {
    private static wallets;
    private static transactions;
    private static bankAccounts;
    private static reconciliationRecords;
    /**
     * Initialize FIAT service
     */
    static initialize(): Promise<void>;
    /**
     * Create FIAT wallet for user
     */
    static createWallet(userId: string, tenantId: string, currency: string): Promise<FiatWallet>;
    /**
     * Get user wallets
     */
    static getUserWallets(userId: string, tenantId: string): Promise<FiatWallet[]>;
    /**
     * Get specific wallet
     */
    static getWallet(userId: string, tenantId: string, currency: string): Promise<FiatWallet | null>;
    /**
     * Deposit FIAT
     */
    static deposit(userId: string, tenantId: string, currency: string, amount: number, reference: string): Promise<FiatTransaction>;
    /**
     * Withdraw FIAT
     */
    static withdraw(userId: string, tenantId: string, currency: string, amount: number, bankAccountId: string): Promise<FiatTransaction>;
    /**
     * Transfer FIAT between users
     */
    static transfer(fromUserId: string, fromTenantId: string, toUserId: string, toTenantId: string, currency: string, amount: number, description?: string): Promise<FiatTransaction>;
    /**
     * Get transaction history
     */
    static getTransactionHistory(userId: string, tenantId: string, currency?: string, limit?: number, offset?: number): Promise<FiatTransaction[]>;
    /**
     * Get transaction by ID
     */
    static getTransaction(transactionId: string): Promise<FiatTransaction | null>;
    private static isValidCurrency;
    private static processDeposit;
    private static completeDeposit;
    private static processWithdrawal;
    private static completeWithdrawal;
    private static processTransfer;
    private static lockFunds;
    private static unlockFunds;
    private static calculateWithdrawalFee;
    private static calculateTransferFee;
    private static getBankAccount;
    private static loadBankAccounts;
    private static loadActiveWallets;
    private static startReconciliationProcess;
    private static startBankingApiMonitoring;
    private static performReconciliation;
    private static monitorBankingApis;
    private static saveWallet;
    private static saveTransaction;
    private static emitFiatEvent;
    private static generateWalletId;
    private static generateTransactionId;
    private static generateReference;
    private static generateBankReference;
}
//# sourceMappingURL=fiat.d.ts.map