/**
 * Presale Service (Token Sales)
 *
 * Advanced presale management system with:
 * - Multi-phase presale management (Private, Public, Community, Institutional)
 * - Whitelist management and KYC integration
 * - Tier-based pricing and allocation
 * - Advanced vesting schedules and cliff periods
 * - Investment limits and compliance
 * - Referral programs and bonuses
 * - Smart contract integration
 * - Payment processing (crypto and fiat)
 * - Real-time statistics and analytics
 * - Compliance and audit trails
 *
 * Production-ready with full integration
 */
import Decimal from 'decimal.js';
type DecimalType = InstanceType<typeof Decimal>;
export declare enum PresalePhase {
    PRIVATE = "private",
    PUBLIC = "public",
    COMMUNITY = "community",
    INSTITUTIONAL = "institutional",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare enum PresaleStatus {
    UPCOMING = "upcoming",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare enum InvestmentTier {
    BRONZE = "bronze",
    SILVER = "silver",
    GOLD = "gold",
    PLATINUM = "platinum",
    DIAMOND = "diamond"
}
export declare enum PaymentMethod {
    USDT = "USDT",
    USDC = "USDC",
    ETH = "ETH",
    BTC = "BTC",
    BANK_TRANSFER = "BANK_TRANSFER",
    CREDIT_CARD = "CREDIT_CARD"
}
export declare enum VestingType {
    LINEAR = "linear",
    CLIFF = "cliff",
    CUSTOM = "custom"
}
export interface PresaleConfig {
    id: string;
    name: string;
    symbol: string;
    description: string;
    phase: PresalePhase;
    status: PresaleStatus;
    startDate: Date;
    endDate: Date;
    tokenPrice: DecimalType;
    totalSupply: DecimalType;
    availableSupply: DecimalType;
    minInvestment: DecimalType;
    maxInvestment: DecimalType;
    softCap: DecimalType;
    hardCap: DecimalType;
    raisedAmount: DecimalType;
    tiers: InvestmentTier[];
    vestingSchedule: VestingSchedule;
    whitelistRequired: boolean;
    kycRequired: boolean;
    referralEnabled: boolean;
    bonusEnabled: boolean;
    smartContractAddress?: string;
    metadata: PresaleMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface InvestmentTierConfig {
    tier: InvestmentTier;
    name: string;
    minInvestment: DecimalType;
    maxInvestment: DecimalType;
    bonusPercentage: number;
    allocationPercentage: number;
    kycLevel: string;
    whitelistRequired: boolean;
    earlyAccessHours: number;
    description: string;
}
export interface VestingSchedule {
    type: VestingType;
    cliffPeriod: number;
    vestingPeriod: number;
    releaseFrequency: number;
    customSchedule?: VestingRelease[];
    description: string;
}
export interface VestingRelease {
    releaseDate: Date;
    percentage: number;
    description: string;
}
export interface PresaleMetadata {
    website: string;
    whitepaper: string;
    socialMedia: {
        twitter?: string;
        telegram?: string;
        discord?: string;
        linkedin?: string;
    };
    team: TeamMember[];
    advisors: Advisor[];
    partners: Partner[];
    roadmap: RoadmapItem[];
    tokenomics: Tokenomics;
    legal: LegalDocument[];
}
export interface TeamMember {
    name: string;
    role: string;
    bio: string;
    linkedin?: string;
    twitter?: string;
    avatar?: string;
}
export interface Advisor {
    name: string;
    expertise: string;
    bio: string;
    linkedin?: string;
    avatar?: string;
}
export interface Partner {
    name: string;
    type: string;
    description: string;
    logo?: string;
    website?: string;
}
export interface RoadmapItem {
    quarter: string;
    title: string;
    description: string;
    status: 'completed' | 'in-progress' | 'upcoming';
}
export interface Tokenomics {
    totalSupply: DecimalType;
    presaleAllocation: DecimalType;
    teamAllocation: DecimalType;
    advisorAllocation: DecimalType;
    marketingAllocation: DecimalType;
    liquidityAllocation: DecimalType;
    treasuryAllocation: DecimalType;
    vestingSchedules: {
        team: VestingSchedule;
        advisor: VestingSchedule;
        marketing: VestingSchedule;
    };
}
export interface LegalDocument {
    name: string;
    type: string;
    url: string;
    version: string;
    lastUpdated: Date;
}
export interface PresaleInvestment {
    id: string;
    presaleId: string;
    userId: string;
    tenantId: string;
    attributedBrokerId?: string;
    tier: InvestmentTier;
    amount: DecimalType;
    tokenAmount: DecimalType;
    paymentMethod: PaymentMethod;
    paymentAddress?: string;
    transactionHash?: string;
    bonusAmount: DecimalType;
    referralCode?: string;
    referralBonus?: DecimalType;
    kycLevel: string;
    status: InvestmentStatus;
    vestingSchedule: VestingSchedule;
    metadata: InvestmentMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum InvestmentStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    VESTING = "vesting",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    REFUNDED = "refunded",
    FAILED = "failed"
}
export interface InvestmentMetadata {
    ipAddress: string;
    userAgent: string;
    referralSource?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    complianceFlags: string[];
    riskScore: number;
    notes?: string;
    blockchainTxHash?: string;
    vestingScheduleId?: string;
    onChainThalAmount?: string;
    blockNumber?: number;
    onChainError?: string;
    paymentNote?: string;
    userWalletAddress?: string;
    platformFee?: string;
    paymentProcessorFee?: string;
    networkFeeEstimate?: string;
    totalFees?: string;
}
export interface WhitelistEntry {
    id: string;
    presaleId: string;
    userId: string;
    email: string;
    walletAddress: string;
    tier: InvestmentTier;
    maxInvestment: DecimalType;
    kycLevel: string;
    status: WhitelistStatus;
    referralCode?: string;
    referredBy?: string;
    metadata: WhitelistMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum WhitelistStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    SUSPENDED = "suspended"
}
export interface WhitelistMetadata {
    source: string;
    notes?: string;
    complianceFlags: string[];
    riskScore: number;
    approvalReason?: string;
    rejectionReason?: string;
}
export interface ReferralProgram {
    id: string;
    presaleId: string;
    referrerCode: string;
    referrerId: string;
    referredCount: number;
    totalBonus: DecimalType;
    bonusRate: number;
    status: ReferralStatus;
    metadata: ReferralMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum ReferralStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export interface ReferralMetadata {
    maxReferrals: number;
    bonusCap: DecimalType;
    tierMultiplier: number;
    description: string;
}
export interface PresaleStatistics {
    presaleId: string;
    totalInvestors: number;
    totalInvestments: number;
    totalRaised: DecimalType;
    averageInvestment: DecimalType;
    tierDistribution: TierDistribution[];
    paymentMethodDistribution: PaymentMethodDistribution[];
    referralStats: ReferralStats;
    vestingStats: VestingStats;
    complianceStats: ComplianceStats;
    lastUpdated: Date;
}
export interface TierDistribution {
    tier: InvestmentTier;
    count: number;
    percentage: number;
    totalAmount: DecimalType;
}
export interface PaymentMethodDistribution {
    method: PaymentMethod;
    count: number;
    percentage: number;
    totalAmount: DecimalType;
}
export interface ReferralStats {
    totalReferrals: number;
    activeReferrers: number;
    totalBonusPaid: DecimalType;
    averageReferralsPerUser: number;
}
export interface VestingStats {
    totalVested: DecimalType;
    totalReleased: DecimalType;
    pendingRelease: DecimalType;
    nextReleaseDate?: Date;
    releaseCount: number;
}
export interface ComplianceStats {
    kycComplianceRate: number;
    whitelistApprovalRate: number;
    riskScoreAverage: number;
    flaggedInvestments: number;
}
export declare class PresaleService {
    private static isInitialized;
    private static presales;
    private static investments;
    private static whitelist;
    private static referrals;
    private static statistics;
    private static readonly PRESALE_CONFIG;
    /**
     * Initialize Presale Service
     */
    static initialize(): Promise<void>;
    /**
     * Load existing presales from storage
     */
    private static loadExistingPresales;
    /**
     * Initialize default presales
     */
    private static initializeDefaultPresales;
    /**
     * Start compliance monitoring
     */
    private static startComplianceMonitoring;
    /**
     * Monitor compliance
     */
    private static monitorCompliance;
    /**
     * Check investment limits
     */
    private static checkInvestmentLimits;
    /**
     * Check KYC compliance
     */
    private static checkKYCCompliance;
    /**
     * Check whitelist compliance
     */
    private static checkWhitelistCompliance;
    /**
     * Check vesting schedules
     */
    private static checkVestingSchedules;
    /**
     * Calculate next vesting release
     */
    private static calculateNextRelease;
    /**
     * Start statistics updates
     */
    private static startStatisticsUpdates;
    /**
     * Update statistics
     */
    private static updateStatistics;
    /**
     * Calculate statistics for a presale
     */
    private static calculateStatistics;
    /**
     * Calculate next global release date
     */
    private static calculateNextGlobalRelease;
    /**
     * Create a new presale
     */
    static createPresale(config: Omit<PresaleConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<PresaleConfig>;
    /**
     * Get presale by ID
     */
    static getPresale(presaleId: string): Promise<PresaleConfig>;
    /**
     * Get all presales
     */
    static getAllPresales(): Promise<PresaleConfig[]>;
    /**
     * Update presale
     */
    static updatePresale(presaleId: string, updates: Partial<PresaleConfig>): Promise<PresaleConfig>;
    /**
     * Make an investment
     */
    static makeInvestment(presaleId: string, userId: string, tenantId: string, amount: DecimalType, paymentMethod: PaymentMethod, tier: InvestmentTier, referralCode?: string, walletAddress?: string, // User's wallet address for on-chain transactions
    attributedBrokerId?: string): Promise<PresaleInvestment>;
    /**
     * Get investment by ID
     */
    static getInvestment(investmentId: string): Promise<PresaleInvestment>;
    /**
     * Get investments by presale
     */
    static getInvestmentsByPresale(presaleId: string): Promise<PresaleInvestment[]>;
    /**
     * Get investments by user
     */
    static getInvestmentsByUser(userId: string): Promise<PresaleInvestment[]>;
    /**
     * Add to whitelist
     */
    static addToWhitelist(presaleId: string, userId: string, email: string, walletAddress: string, tier: InvestmentTier, maxInvestment: DecimalType, kycLevel: string): Promise<WhitelistEntry>;
    /**
     * Approve whitelist entry
     */
    static approveWhitelistEntry(entryId: string, reason?: string): Promise<WhitelistEntry>;
    /**
     * Get whitelist entries by presale
     */
    static getWhitelistEntries(presaleId: string): Promise<WhitelistEntry[]>;
    /**
     * Get presale statistics
     */
    static getPresaleStatistics(presaleId: string): Promise<PresaleStatistics>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=presale.d.ts.map