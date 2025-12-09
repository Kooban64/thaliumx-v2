/**
 * Token Sale Platform Service
 *
 * Production-ready token sale platform with comprehensive features:
 * - Public token sales (THAL token purchases)
 * - Multi-phase presale system
 * - KYC integration with investment limits
 * - Smart contract integration
 * - Vesting schedule management
 * - Broker migration support
 * - Compliance and audit trails
 *
 * Based on industry standards for crypto token sales
 */
export interface PresalePhase {
    id: string;
    name: string;
    description: string;
    phaseType: PresalePhaseType;
    startDate: Date;
    endDate: Date;
    tokenPrice: number;
    minInvestment: number;
    maxInvestment: number;
    totalTokensAllocated: number;
    tokensSold: number;
    usdRaised: number;
    isActive: boolean;
    kycLevelRequired: string;
    vestingScheduleId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PresaleInvestment {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    phaseId: string;
    walletAddress: string;
    investmentAmountUSD: number;
    tokenAmount: number;
    tokenPrice: number;
    paymentMethod: PaymentMethod;
    paymentTxHash?: string;
    status: InvestmentStatus;
    kycLevel: string;
    vestingScheduleId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface VestingSchedule {
    id: string;
    name: string;
    description: string;
    totalTokens: number;
    vestingPeriod: number;
    cliffPeriod: number;
    vestingFrequency: VestingFrequency;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface VestingEntry {
    id: string;
    userId: string;
    investmentId: string;
    scheduleId: string;
    totalTokens: number;
    vestedTokens: number;
    remainingTokens: number;
    nextVestDate: Date;
    lastVestDate?: Date;
    isCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface TokenSaleStats {
    totalPhases: number;
    activePhases: number;
    totalInvestments: number;
    totalTokensSold: number;
    totalUSDRaised: number;
    uniqueInvestors: number;
    averageInvestment: number;
    byPhase: PhaseStats[];
    byKycLevel: KycLevelStats[];
}
export interface PhaseStats {
    phaseId: string;
    phaseName: string;
    investments: number;
    tokensSold: number;
    usdRaised: number;
    uniqueInvestors: number;
}
export interface KycLevelStats {
    kycLevel: string;
    investments: number;
    totalAmount: number;
    averageAmount: number;
    uniqueInvestors: number;
}
export interface InvestmentEligibility {
    isEligible: boolean;
    reason?: string;
    requiredKycLevel: string;
    currentKycLevel: string;
    maxInvestmentAllowed: number;
    phaseLimits: {
        minInvestment: number;
        maxInvestment: number;
        tokensAvailable: number;
    };
}
export declare enum PresalePhaseType {
    PRIVATE = "PRIVATE",
    PUBLIC = "PUBLIC",
    COMMUNITY = "COMMUNITY",
    INSTITUTIONAL = "INSTITUTIONAL"
}
export declare enum PaymentMethod {
    USDT = "USDT",
    USDC = "USDC",
    ETH = "ETH",
    BTC = "BTC",
    BANK_TRANSFER = "BANK_TRANSFER"
}
export declare enum InvestmentStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
    CANCELLED = "CANCELLED"
}
export declare enum VestingFrequency {
    DAILY = "DAILY",
    WEEKLY = "WEEKLY",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    ANNUALLY = "ANNUALLY"
}
export declare class TokenSaleService {
    private static isInitialized;
    private static phases;
    private static investments;
    private static vestingSchedules;
    private static vestingEntries;
    private static readonly TOKEN_SALE_CONFIG;
    /**
     * Initialize Token Sale Service
     */
    static initialize(): Promise<void>;
    /**
     * Create new presale phase
     */
    static createPresalePhase(name: string, description: string, phaseType: PresalePhaseType, startDate: Date, endDate: Date, tokenPrice: number, minInvestment: number, maxInvestment: number, totalTokensAllocated: number, kycLevelRequired: string, vestingScheduleId?: string): Promise<PresalePhase>;
    /**
     * Process investment
     */
    static processInvestment(userId: string, tenantId: string, brokerId: string, phaseId: string, walletAddress: string, investmentAmountUSD: number, paymentMethod: PaymentMethod, paymentTxHash?: string): Promise<PresaleInvestment>;
    /**
     * Check investment eligibility
     */
    static checkInvestmentEligibility(userId: string, phaseId: string, investmentAmountUSD: number): Promise<InvestmentEligibility>;
    /**
     * Get all presale phases
     */
    static getPresalePhases(activeOnly?: boolean): Promise<PresalePhase[]>;
    /**
     * Get presale phase by ID
     */
    static getPresalePhase(phaseId: string): Promise<PresalePhase | null>;
    /**
     * Get user investments
     */
    static getUserInvestments(userId: string, phaseId?: string, status?: InvestmentStatus): Promise<PresaleInvestment[]>;
    /**
     * Get investment by ID
     */
    static getInvestment(investmentId: string): Promise<PresaleInvestment | null>;
    /**
     * Get phase statistics
     */
    static getPhaseStats(phaseId: string): Promise<PhaseStats | null>;
    /**
     * Get all vesting schedules
     */
    static getVestingSchedules(activeOnly?: boolean): Promise<VestingSchedule[]>;
    /**
     * Get user vesting entries
     */
    static getUserVestingEntries(userId: string): Promise<VestingEntry[]>;
    /**
     * Get token sale statistics
     */
    static getTokenSaleStats(): Promise<TokenSaleStats>;
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
    private static initializeDefaultVestingSchedules;
    private static initializeDefaultPresalePhases;
    private static processPaymentAndAllocation;
    private static processSmartContractAllocation;
}
//# sourceMappingURL=token-sale.d.ts.map