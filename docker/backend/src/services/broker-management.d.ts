/**
 * Broker Management Service
 *
 * Complete white-label broker management system:
 * - Broker onboarding and registration
 * - Broker configuration management
 * - White-label branding system
 * - Broker-specific feature toggles
 * - Broker analytics and reporting
 * - Broker user management
 * - Broker financial controls
 * - Broker compliance monitoring
 * - APZHEX default broker integration
 * - User migration between brokers
 *
 * Production-ready with comprehensive error handling
 */
export interface BrokerConfig {
    id: string;
    name: string;
    slug: string;
    domain: string;
    status: BrokerStatus;
    tier: BrokerTier;
    features: BrokerFeatures;
    branding: BrokerBranding;
    limits: BrokerLimits;
    compliance: BrokerCompliance;
    financial: BrokerFinancial;
    analytics: BrokerAnalytics;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    lastActivityAt: Date;
}
export declare enum BrokerStatus {
    PENDING = "pending",
    ACTIVE = "active",
    SUSPENDED = "suspended",
    TERMINATED = "terminated",
    MAINTENANCE = "maintenance"
}
export declare enum BrokerTier {
    STARTER = "starter",
    PROFESSIONAL = "professional",
    ENTERPRISE = "enterprise",
    CUSTOM = "custom"
}
export interface BrokerFeatures {
    trading: boolean;
    margin: boolean;
    nft: boolean;
    dex: boolean;
    presale: boolean;
    staking: boolean;
    lending: boolean;
    derivatives: boolean;
    api: boolean;
    webhooks: boolean;
    customDomains: boolean;
    whiteLabel: boolean;
    multiLanguage: boolean;
    mobileApp: boolean;
    analytics: boolean;
    reporting: boolean;
    compliance: boolean;
    kyc: boolean;
    aml: boolean;
    ofac: boolean;
    riskManagement: boolean;
    liquidity: boolean;
    marketMaking: boolean;
    institutional: boolean;
    retail: boolean;
    p2p: boolean;
    otc: boolean;
}
export interface BrokerBranding {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    customCss: string;
    customJs: string;
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    socialImage: string;
    footerText: string;
    supportEmail: string;
    supportPhone: string;
    termsUrl: string;
    privacyUrl: string;
    helpUrl: string;
    customPages: Record<string, string>;
}
export interface BrokerLimits {
    maxUsers: number;
    maxTradingVolume: number;
    maxMarginLeverage: number;
    maxWithdrawalAmount: number;
    maxDepositAmount: number;
    maxApiCalls: number;
    maxWebhooks: number;
    maxCustomDomains: number;
    maxLanguages: number;
    maxCurrencies: number;
    maxTradingPairs: number;
    maxMarginPairs: number;
    maxStakingPools: number;
    maxNftCollections: number;
    maxPresaleProjects: number;
    maxInstitutionalClients: number;
    maxRetailClients: number;
    maxP2PClients: number;
    maxOtcClients: number;
    maxRiskExposure: number;
    maxLiquidityPool: number;
    maxMarketMakingPairs: number;
    maxDerivativesPairs: number;
    maxLendingPairs: number;
}
export interface BrokerCompliance {
    kycRequired: boolean;
    amlRequired: boolean;
    ofacRequired: boolean;
    riskAssessment: boolean;
    auditTrail: boolean;
    reporting: boolean;
    dataRetention: number;
    jurisdiction: string;
    licenseNumber: string;
    regulatoryBody: string;
    complianceOfficer: string;
    complianceEmail: string;
    compliancePhone: string;
    lastAuditDate: Date;
    nextAuditDate: Date;
    auditStatus: 'passed' | 'failed' | 'pending' | 'scheduled';
    complianceScore: number;
    violations: ComplianceViolation[];
    certifications: ComplianceCertification[];
}
export interface ComplianceViolation {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    detectedAt: Date;
    resolvedAt?: Date;
    status: 'open' | 'resolved' | 'dismissed';
    assignedTo: string;
    notes: string;
}
export interface ComplianceCertification {
    id: string;
    name: string;
    issuer: string;
    issuedAt: Date;
    expiresAt: Date;
    status: 'active' | 'expired' | 'revoked';
    certificateUrl: string;
}
export interface BrokerFinancial {
    currency: string;
    baseCurrency: string;
    supportedCurrencies: string[];
    tradingFees: TradingFees;
    withdrawalFees: WithdrawalFees;
    depositFees: DepositFees;
    marginFees: MarginFees;
    stakingFees: StakingFees;
    lendingFees: LendingFees;
    derivativesFees: DerivativesFees;
    nftFees: NftFees;
    presaleFees: PresaleFees;
    apiFees: ApiFees;
    webhookFees: WebhookFees;
    customDomainFees: CustomDomainFees;
    whiteLabelFees: WhiteLabelFees;
    complianceFees: ComplianceFees;
    riskManagementFees: RiskManagementFees;
    liquidityFees: LiquidityFees;
    marketMakingFees: MarketMakingFees;
    institutionalFees: InstitutionalFees;
    retailFees: RetailFees;
    p2pFees: P2pFees;
    otcFees: OtcFees;
    minimumDeposit: number;
    minimumWithdrawal: number;
    maximumWithdrawal: number;
    dailyWithdrawalLimit: number;
    monthlyWithdrawalLimit: number;
    kycTierLimits: KycTierLimits;
    riskLimits: RiskLimits;
    liquidityLimits: LiquidityLimits;
    marketMakingLimits: MarketMakingLimits;
    derivativesLimits: DerivativesLimits;
    lendingLimits: LendingLimits;
    stakingLimits: StakingLimits;
    nftLimits: NftLimits;
    presaleLimits: PresaleLimits;
}
export interface TradingFees {
    maker: number;
    taker: number;
    vip1: number;
    vip2: number;
    vip3: number;
    vip4: number;
    vip5: number;
    institutional: number;
    marketMaker: number;
    custom: Record<string, number>;
}
export interface WithdrawalFees {
    crypto: Record<string, number>;
    fiat: Record<string, number>;
    minimum: Record<string, number>;
    maximum: Record<string, number>;
}
export interface DepositFees {
    crypto: Record<string, number>;
    fiat: Record<string, number>;
    minimum: Record<string, number>;
    maximum: Record<string, number>;
}
export interface MarginFees {
    interestRate: number;
    liquidationFee: number;
    fundingRate: number;
    maintenanceMargin: number;
    initialMargin: number;
}
export interface StakingFees {
    stakingReward: number;
    unstakingFee: number;
    minimumStake: number;
    maximumStake: number;
    lockPeriod: number;
}
export interface LendingFees {
    interestRate: number;
    collateralRatio: number;
    liquidationThreshold: number;
    minimumLoan: number;
    maximumLoan: number;
}
export interface DerivativesFees {
    maker: number;
    taker: number;
    fundingRate: number;
    liquidationFee: number;
    maintenanceMargin: number;
    initialMargin: number;
}
export interface NftFees {
    mintingFee: number;
    tradingFee: number;
    listingFee: number;
    delistingFee: number;
    royaltyFee: number;
}
export interface PresaleFees {
    participationFee: number;
    successFee: number;
    failureFee: number;
    minimumParticipation: number;
    maximumParticipation: number;
}
export interface ApiFees {
    basic: number;
    professional: number;
    enterprise: number;
    custom: Record<string, number>;
}
export interface WebhookFees {
    basic: number;
    professional: number;
    enterprise: number;
    custom: Record<string, number>;
}
export interface CustomDomainFees {
    setup: number;
    monthly: number;
    ssl: number;
    cdn: number;
}
export interface WhiteLabelFees {
    setup: number;
    monthly: number;
    customization: number;
    support: number;
}
export interface ComplianceFees {
    kyc: number;
    aml: number;
    ofac: number;
    audit: number;
    reporting: number;
}
export interface RiskManagementFees {
    monitoring: number;
    alerting: number;
    reporting: number;
    analysis: number;
}
export interface LiquidityFees {
    provision: number;
    withdrawal: number;
    management: number;
    performance: number;
}
export interface MarketMakingFees {
    spread: number;
    volume: number;
    performance: number;
    risk: number;
}
export interface InstitutionalFees {
    trading: number;
    custody: number;
    reporting: number;
    support: number;
}
export interface RetailFees {
    trading: number;
    withdrawal: number;
    deposit: number;
    support: number;
}
export interface P2pFees {
    trading: number;
    escrow: number;
    dispute: number;
    support: number;
}
export interface OtcFees {
    trading: number;
    settlement: number;
    reporting: number;
    support: number;
}
export interface KycTierLimits {
    tier1: {
        dailyLimit: number;
        monthlyLimit: number;
        maxWithdrawal: number;
    };
    tier2: {
        dailyLimit: number;
        monthlyLimit: number;
        maxWithdrawal: number;
    };
    tier3: {
        dailyLimit: number;
        monthlyLimit: number;
        maxWithdrawal: number;
    };
    institutional: {
        dailyLimit: number;
        monthlyLimit: number;
        maxWithdrawal: number;
    };
}
export interface RiskLimits {
    maxPositionSize: number;
    maxLeverage: number;
    maxExposure: number;
    maxDrawdown: number;
    maxCorrelation: number;
    maxConcentration: number;
    maxVaR: number;
    maxStressTest: number;
}
export interface LiquidityLimits {
    minLiquidity: number;
    maxLiquidity: number;
    minSpread: number;
    maxSpread: number;
    minVolume: number;
    maxVolume: number;
}
export interface MarketMakingLimits {
    minSpread: number;
    maxSpread: number;
    minVolume: number;
    maxVolume: number;
    minInventory: number;
    maxInventory: number;
}
export interface DerivativesLimits {
    maxLeverage: number;
    maxPositionSize: number;
    maxExposure: number;
    maxCorrelation: number;
}
export interface LendingLimits {
    maxLoanToValue: number;
    maxCollateralRatio: number;
    maxLiquidationThreshold: number;
    maxInterestRate: number;
}
export interface StakingLimits {
    minStake: number;
    maxStake: number;
    minLockPeriod: number;
    maxLockPeriod: number;
}
export interface NftLimits {
    maxMintPrice: number;
    maxTradingPrice: number;
    maxRoyaltyRate: number;
    maxCollectionSize: number;
}
export interface PresaleLimits {
    minParticipation: number;
    maxParticipation: number;
    minProjectSize: number;
    maxProjectSize: number;
}
export interface BrokerAnalytics {
    users: {
        total: number;
        active: number;
        new: number;
        churn: number;
        retention: number;
    };
    trading: {
        volume: number;
        trades: number;
        revenue: number;
        fees: number;
    };
    financial: {
        deposits: number;
        withdrawals: number;
        netFlow: number;
        balance: number;
    };
    compliance: {
        kycCompleted: number;
        amlChecks: number;
        ofacChecks: number;
        violations: number;
    };
    performance: {
        uptime: number;
        latency: number;
        errors: number;
        satisfaction: number;
    };
    lastUpdated: Date;
}
export interface BrokerOnboardingRequest {
    name: string;
    slug: string;
    domain: string;
    tier: BrokerTier;
    features: Partial<BrokerFeatures>;
    branding: Partial<BrokerBranding>;
    limits: Partial<BrokerLimits>;
    compliance: Partial<BrokerCompliance>;
    financial: Partial<BrokerFinancial>;
    contactInfo: {
        email: string;
        phone: string;
        address: string;
        country: string;
        jurisdiction: string;
    };
    businessInfo: {
        type: string;
        registrationNumber: string;
        taxId: string;
        licenseNumber: string;
        regulatoryBody: string;
    };
    technicalInfo: {
        expectedUsers: number;
        expectedVolume: number;
        expectedTradingPairs: number;
        expectedCurrencies: number;
        expectedLanguages: number;
        expectedDomains: number;
    };
}
export interface BrokerOnboardingResult {
    success: boolean;
    brokerId: string;
    brokerName: string;
    realmName: string;
    adminUrl: string;
    clientId: string;
    clientSecret: string;
    apiKey: string;
    webhookSecret: string;
    error?: string;
    warnings?: string[];
}
export declare class BrokerManagementService {
    private static isInitialized;
    private static brokers;
    private static apzhexBroker;
    private static readonly DEFAULT_TIER_CONFIGS;
    /**
     * Initialize Broker Management Service
     */
    static initialize(): Promise<void>;
    /**
     * Onboard new broker
     */
    static onboardBroker(request: BrokerOnboardingRequest): Promise<BrokerOnboardingResult>;
    /**
     * Get broker by ID
     */
    static getBroker(brokerId: string): BrokerConfig | null;
    /**
     * Get broker by slug
     */
    static getBrokerBySlug(slug: string): BrokerConfig | null;
    /**
     * Get all brokers
     */
    static getAllBrokers(): BrokerConfig[];
    /**
     * Get APZHEX broker
     */
    static getApzhexBroker(): BrokerConfig | null;
    /**
     * Update broker configuration
     */
    static updateBroker(brokerId: string, updates: Partial<BrokerConfig>): Promise<boolean>;
    /**
     * Suspend broker
     */
    static suspendBroker(brokerId: string, reason: string): Promise<boolean>;
    /**
     * Activate broker
     */
    static activateBroker(brokerId: string): Promise<boolean>;
    /**
     * Get broker analytics
     */
    static getBrokerAnalytics(brokerId: string): Promise<BrokerAnalytics | null>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static loadBrokers;
    private static initializeApzhexBroker;
    private static validateOnboardingRequest;
    private static createBrokerConfig;
    private static createDefaultFinancialConfig;
    private static saveBrokerToDatabase;
    private static generateApiKey;
    private static generateWebhookSecret;
}
//# sourceMappingURL=broker-management.d.ts.map