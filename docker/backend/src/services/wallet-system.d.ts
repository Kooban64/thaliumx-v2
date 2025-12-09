/**
 * Comprehensive Wallet System Service
 *
 * ARCHITECTURE OVERVIEW:
 * - Multi-tier wallet system (Platform → Broker → User)
 * - FIAT wallets with unique reference system
 * - Crypto hot wallets (non-custodial with MFA recovery)
 * - Integration with native CEX (Dingir + Liquibook)
 * - THAL token promotion and business model
 * - Nedbank pool account system
 *
 * Features:
 * - Unique reference generation (THAL-JD-8F2K format)
 * - FIAT → USDT conversion with bulk liquidity management
 * - Hot wallet portability with secure MFA recovery
 * - Native CEX integration with liquidity incentives
 * - THAL token rewards and fee discounts
 * - Complete audit trails and compliance
 */
import { Sequelize } from 'sequelize';
export interface Wallet {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    walletType: 'fiat' | 'crypto_hot' | 'crypto_cold' | 'thal_token' | 'trading';
    currency: string;
    address?: string;
    accountId?: string;
    status: 'active' | 'suspended' | 'pending' | 'closed' | 'recovery';
    balance: string;
    metadata: {
        provider?: string;
        network?: string;
        derivationPath?: string;
        publicKey?: string;
        encryptedPrivateKey?: string;
        recoveryPhrase?: string;
        mfaEnabled: boolean;
        lastBackup?: Date;
        createdAt: Date;
        updatedAt: Date;
        version: string;
        lots?: Array<{
            amount: number;
            costZAR: number;
            acquiredAt: Date;
        }>;
    };
    security: {
        accessCount: number;
        lastAccessed?: Date;
        accessLog: Array<{
            accessedAt: Date;
            ipAddress: string;
            userAgent: string;
            action: string;
        }>;
        fraudIndicators: string[];
    };
}
export interface UniqueReference {
    id: string;
    reference: string;
    referenceType: 'fiat_deposit' | 'crypto_deposit' | 'withdrawal' | 'transfer';
    brokerCode: string;
    userInitials: string;
    randomSuffix: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    currency: string;
    expectedAmount?: string;
    actualAmount?: string;
    status: 'active' | 'used' | 'expired' | 'cancelled';
    isPersistent?: boolean;
    expiresAt: Date;
    usedAt?: Date;
    metadata: {
        createdVia: 'auto_generated' | 'manual' | 'api';
        ipAddress?: string;
        userAgent?: string;
        riskScore: number;
        complianceFlags: string[];
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface PoolAccount {
    id: string;
    brokerId: string;
    accountType: 'platform' | 'broker';
    bankAccountNumber: string;
    bankReference: string;
    currency: string;
    balance: string;
    availableBalance: string;
    pendingDeposits: string;
    metadata: {
        bankName: string;
        accountHolder: string;
        swiftCode?: string;
        iban?: string;
        lastReconciliation?: Date;
        createdAt: Date;
        updatedAt: Date;
    };
}
export interface CEXOrder {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    tradingPair: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: string;
    price?: string;
    stopPrice?: string;
    status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
    filledQuantity: string;
    averagePrice: string;
    fees: string;
    thalRewards: string;
    engine: 'dingir' | 'liquibook' | 'hybrid';
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
export interface THALReward {
    id: string;
    userId: string;
    brokerId: string;
    rewardType: 'trading_fee_discount' | 'volume_bonus' | 'liquidity_provider' | 'referral';
    amount: string;
    currency: string;
    status: 'pending' | 'credited' | 'expired';
    expiresAt?: Date;
    metadata: {
        sourceOrderId?: string;
        sourceTransactionId?: string;
        multiplier: number;
        createdAt: Date;
    };
}
export declare class WalletSystemService {
    private db;
    private eventStreamingService;
    private blnkfinanceService;
    private quantlibService;
    private wallets;
    private references;
    private poolAccounts;
    private cexOrders;
    private thalRewards;
    private transactionsLog;
    private unallocatedDeposits;
    private allocationProposals;
    recordUnallocatedDeposit(dep: {
        id: string;
        brokerId?: string;
        poolAccountNumber?: string;
        amount: string;
        currency: string;
        bankReference?: string;
        customerReference?: string;
        valueDate: string;
        notes?: string;
    }): void;
    listUnallocatedDeposits(filter?: {
        brokerId?: string;
        currency?: string;
        status?: string;
    }): {
        id: string;
        brokerId?: string;
        poolAccountNumber?: string;
        amount: string;
        currency: string;
        bankReference?: string;
        customerReference?: string;
        valueDate: string;
        status: "unallocated" | "proposed" | "allocated" | "rejected";
        notes?: string;
        createdAt: Date;
        updatedAt: Date;
    }[];
    createAllocationProposal(params: {
        depositId: string;
        proposedBy: string;
        target: {
            tenantId: string;
            brokerId: string;
            userId: string;
            currency: string;
        };
        amount: string;
        approvalsRequired: number;
        approvers: string[];
    }): {
        id: string;
        depositId: string;
        proposedBy: string;
        target: {
            tenantId: string;
            brokerId: string;
            userId: string;
            currency: string;
        };
        amount: string;
        approvalsRequired: number;
        approvers: string[];
        approvals: never[];
        status: "pending";
        createdAt: Date;
        updatedAt: Date;
    };
    approveAllocationProposal(proposalId: string, approverId: string): {
        id: string;
        depositId: string;
        proposedBy: string;
        target: {
            tenantId: string;
            brokerId: string;
            userId: string;
            currency: string;
        };
        amount: string;
        approvalsRequired: number;
        approvers: string[];
        approvals: string[];
        status: "pending" | "approved" | "rejected" | "executed";
        createdAt: Date;
        updatedAt: Date;
    };
    rejectAllocationProposal(proposalId: string, approverId: string, reason?: string): {
        id: string;
        depositId: string;
        proposedBy: string;
        target: {
            tenantId: string;
            brokerId: string;
            userId: string;
            currency: string;
        };
        amount: string;
        approvalsRequired: number;
        approvers: string[];
        approvals: string[];
        status: "pending" | "approved" | "rejected" | "executed";
        createdAt: Date;
        updatedAt: Date;
    };
    executeAllocation(proposalId: string): Promise<{
        success: boolean;
        depositId: string;
        walletId?: string;
    }>;
    private readonly ZAR_TO_USDT_RATE;
    private readonly THAL_REWARD_RATE;
    private readonly MIN_THAL_REWARD;
    private readonly MAX_THAL_REWARD;
    private readonly PLATFORM_FEE_RATE;
    private readonly BROKER_FEE_RATE;
    constructor(db: Sequelize);
    initialize(): Promise<void>;
    /**
     * Create comprehensive wallet infrastructure for new user
     */
    createUserWalletInfrastructure(userId: string, tenantId: string, brokerId: string, userInfo: {
        firstName: string;
        lastName: string;
        email: string;
    }): Promise<Wallet[]>;
    /**
     * Create FIAT wallet with BlnkFinance integration
     */
    private createFiatWallet;
    /**
     * Create Crypto Hot wallet (non-custodial with MFA recovery)
     */
    private createCryptoHotWallet;
    /**
     * Create THAL Token wallet
     */
    private createTHALWallet;
    /**
     * Create Trading wallet for CEX integration
     */
    private createTradingWallet;
    /**
     * Generate unique reference for FIAT deposits
     */
    generateUniqueReference(userId: string, tenantId: string, brokerId: string, referenceType: UniqueReference['referenceType'], currency: string, expectedAmount?: string): Promise<UniqueReference>;
    /**
     * Get or create a persistent alphanumeric reference per (userId, brokerId, currency)
     */
    getOrCreatePersistentReference(userId: string, tenantId: string, brokerId: string, currency: string): Promise<UniqueReference>;
    /**
     * Process FIAT deposit with unique reference
     */
    processFiatDeposit(reference: string, actualAmount: string, bankTransaction: any): Promise<{
        success: boolean;
        walletId?: string;
    }>;
    /**
     * Create a conversion quote (FIAT ↔ USDT) with fee/tax breakdown (estimates)
     */
    getConversionQuote(params: {
        userId: string;
        tenantId: string;
        brokerId: string;
        fromCurrency: string;
        toCurrency: string;
        amount: string;
    }): Promise<{
        quoteId: string;
        fromCurrency: string;
        toCurrency: string;
        grossAmount: string;
        rate: string;
        fxSpread: string;
        platformFee: string;
        taxes: string;
        netToReceive: string;
        expiresAt: Date;
        feePolicyVersion: string;
    }>;
    /**
     * Confirm conversion (FIAT ↔ USDT) applying quoted fees, updating wallets
     */
    confirmConversion(params: {
        userId: string;
        tenantId: string;
        brokerId: string;
        fromCurrency: string;
        toCurrency: string;
        amount: string;
        quoteId: string;
        acceptFees: boolean;
    }): Promise<{
        success: boolean;
        fromWalletId: string;
        toWalletId: string;
    }>;
    /**
     * Create pool account for broker
     */
    createPoolAccount(brokerId: string, accountType: 'platform' | 'broker', bankDetails: {
        bankAccountNumber: string;
        bankName: string;
        accountHolder: string;
        swiftCode?: string;
        iban?: string;
    }): Promise<PoolAccount>;
    /**
     * Place order on native CEX
     */
    placeCEXOrder(userId: string, tenantId: string, brokerId: string, params: {
        tradingPair: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: string;
        price?: string;
        stopPrice?: string;
    }): Promise<CEXOrder>;
    /**
     * Process CEX order through trading engines
     */
    private processCEXOrder;
    /**
     * Calculate THAL reward based on transaction
     */
    private calculateTHALReward;
    /**
     * Credit THAL reward to user
     */
    private creditTHALReward;
    /**
     * Recover hot wallet with MFA verification
     */
    recoverHotWallet(userId: string, mfaCode: string, recoveryMethod: 'phrase' | 'private_key'): Promise<{
        success: boolean;
        wallet?: Wallet;
        recoveryData?: string;
    }>;
    private loadExistingWallets;
    private loadPoolAccounts;
    private initializeCEXIntegration;
    private getBrokerCode;
    private getUserInitials;
    private generateRandomSuffix;
    private ensureReferenceUniqueness;
    /**
     * Attempt to auto-match a bank deposit to a persistent reference
     */
    autoMatchDepositToReference(record: {
        reference: string;
        amount: string;
        currency: string;
    }): {
        matched: boolean;
        userId?: string;
        brokerId?: string;
        tenantId?: string;
        referenceId?: string;
    };
    private generateBankReference;
    private encryptData;
    private decryptData;
    private verifyMFACode;
    private getMarketPrice;
    private processDingirOrder;
    private processLiquibookOrder;
    /**
     * Get user's wallets
     */
    getUserWallets(userId: string): Wallet[];
    /**
     * Get wallet by ID
     */
    getWallet(walletId: string): Wallet | null;
    /**
     * Get unique reference by reference string
     */
    getReference(reference: string): UniqueReference | null;
    /**
     * Get pool accounts for broker
     */
    getBrokerPoolAccounts(brokerId: string): PoolAccount[];
    /**
     * Get CEX orders for user
     */
    getUserCEXOrders(userId: string): CEXOrder[];
    /**
     * Get THAL rewards for user
     */
    getUserTHALRewards(userId: string): THALReward[];
    /**
     * Generate wallet statement (CSV) for date range (mocked from in-memory state)
     */
    generateWalletStatementCSV(params: {
        walletId: string;
        from?: string;
        to?: string;
    }): Promise<string>;
    /**
     * Generate tax report (CSV) for a range with method (FIFO/LIFO) - placeholder
     */
    generateTaxReportCSV(params: {
        userId: string;
        from?: string;
        to?: string;
        method?: 'fifo' | 'lifo';
        baseCurrency?: string;
    }): Promise<string>;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=wallet-system.d.ts.map