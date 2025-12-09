/**
 * ADVANCED MARGIN TRADING SERVICE
 *
 * BEST-IN-CLASS FEATURES:
 * - Strict fund segregation (isolated/cross margin per symbol)
 * - Multi-tier risk management (user/broker/platform levels)
 * - Real-time liquidation engine with penalty fees
 * - Integration with wallet system and omni-exchange
 * - QuantLib-powered risk calculations
 * - BlnkFinance double-entry bookkeeping
 * - Comprehensive audit trails and compliance
 * - Production-ready with enterprise security
 */
export interface MarginAccount {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    accountType: 'isolated' | 'cross';
    symbol?: string;
    status: 'active' | 'margin_call' | 'liquidation' | 'suspended' | 'closed';
    totalEquity: number;
    totalMargin: number;
    availableBalance: number;
    usedMargin: number;
    freeMargin: number;
    marginLevel: number;
    marginRatio: number;
    maxLeverage: number;
    maintenanceMarginRatio: number;
    liquidationThreshold: number;
    marginCallThreshold: number;
    userSegregation: {
        userId: string;
        userAccountId: string;
        userBalance: number;
        userMarginUsed: number;
        userCollateral: Map<string, number>;
        userBorrowed: Map<string, number>;
        userPositions: string[];
        userRiskScore: number;
        userComplianceFlags: string[];
    };
    brokerSegregation: {
        brokerId: string;
        brokerAccountId: string;
        brokerBalance: number;
        brokerMarginUsed: number;
        brokerCollateral: Map<string, number>;
        brokerBorrowed: Map<string, number>;
        brokerPositions: string[];
        brokerRiskScore: number;
        brokerComplianceFlags: string[];
    };
    platformSegregation: {
        platformAccountId: string;
        platformBalance: number;
        platformMarginUsed: number;
        platformCollateral: Map<string, number>;
        platformBorrowed: Map<string, number>;
        platformPositions: string[];
        platformRiskScore: number;
        platformComplianceFlags: string[];
    };
    segregatedBalances: Map<string, number>;
    borrowedAssets: Map<string, number>;
    collateralAssets: Map<string, number>;
    createdAt: Date;
    updatedAt: Date;
    lastRiskCheck: Date;
    riskScore: number;
    complianceFlags: string[];
}
export interface MarginPosition {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    accountId: string;
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    initialMargin: number;
    maintenanceMargin: number;
    marginUsed: number;
    liquidationPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    fundingFee: number;
    interestFee: number;
    status: 'open' | 'closing' | 'closed' | 'liquidated';
    openedAt: Date;
    closedAt?: Date;
    updatedAt: Date;
    marginRatio: number;
    riskScore: number;
    volatility: number;
    maxDrawdown: number;
    userFundAllocation: {
        userAccountId: string;
        userAllocation: string;
        userCollateralPool: string;
        userBorrowedPool: string;
        userMarginPool: string;
        userFeePool: string;
    };
    brokerFundAllocation: {
        brokerAllocation: string;
        brokerCollateralPool: string;
        brokerBorrowedPool: string;
    };
    platformFundAllocation: {
        platformAccount: string;
        platformCollateralPool: string;
        platformBorrowedPool: string;
    };
    fundAllocation: {
        brokerAllocation: string;
        customerAllocation: string;
        collateralPool: string;
        borrowedPool: string;
    };
}
export interface MarginOrder {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    leverage: number;
    status: 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
    filledQuantity: number;
    averagePrice: number;
    remainingQuantity: number;
    marginRequired: number;
    marginUsed: number;
    createdAt: Date;
    updatedAt: Date;
    filledAt?: Date;
    riskScore: number;
    complianceFlags: string[];
    fundAllocation: {
        brokerAllocation: string;
        customerAllocation: string;
        orderPool: string;
        feePool: string;
    };
}
export interface LiquidationEvent {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    accountId: string;
    positionId: string;
    symbol: string;
    liquidationPrice: number;
    liquidationAmount: number;
    liquidationValue: number;
    remainingMargin: number;
    penaltyFee: number;
    marginRatio: number;
    riskScore: number;
    reason: 'margin_call' | 'forced_liquidation' | 'risk_limit_exceeded';
    status: 'pending' | 'executed' | 'failed';
    triggeredAt: Date;
    executedAt?: Date;
    fundAllocation: {
        brokerAllocation: string;
        customerAllocation: string;
        liquidationPool: string;
        penaltyPool: string;
    };
}
export interface MarginTransfer {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    fromAccount: string;
    toAccount: string;
    asset: string;
    amount: number;
    type: 'deposit' | 'withdrawal' | 'transfer' | 'collateral_add' | 'collateral_remove';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    riskScore: number;
    complianceFlags: string[];
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    fundAllocation: {
        brokerAllocation: string;
        customerAllocation: string;
        transferPool: string;
    };
}
export interface RiskLimits {
    userId: string;
    tenantId: string;
    brokerId: string;
    maxLeverage: number;
    maxPositionSize: number;
    maxOpenPositions: number;
    maxAccountRisk: number;
    maxDrawdown: number;
    maxVolatility: number;
    marginCallThreshold: number;
    liquidationThreshold: number;
    maintenanceMarginRatio: number;
    kycRequired: boolean;
    amlRequired: boolean;
    riskTier: 'low' | 'medium' | 'high' | 'professional';
    createdAt: Date;
    updatedAt: Date;
}
export interface FundingRate {
    symbol: string;
    rate: number;
    nextFundingTime: Date;
    updatedAt: Date;
}
export declare class AdvancedMarginTradingService {
    private static isInitialized;
    private static db;
    private static accounts;
    private static positions;
    private static orders;
    private static transfers;
    private static liquidations;
    private static riskLimits;
    private static fundingRates;
    private static config;
    /**
     * Initialize Advanced Margin Trading Service
     */
    static initialize(): Promise<void>;
    /**
     * Create Margin Account with Strict Fund Segregation
     */
    static createMarginAccount(userId: string, tenantId: string, brokerId: string, accountType: 'isolated' | 'cross', symbol?: string, initialDeposit?: {
        asset: string;
        amount: number;
    }): Promise<MarginAccount>;
    /**
     * Create Margin Position with Advanced Risk Management
     */
    static createMarginPosition(userId: string, tenantId: string, brokerId: string, accountId: string, symbol: string, side: 'long' | 'short', size: number, leverage: number, orderType?: 'market' | 'limit', price?: number): Promise<MarginPosition>;
    /**
     * Close Margin Position with P&L Calculation
     */
    static closeMarginPosition(userId: string, tenantId: string, brokerId: string, positionId: string, closeSize?: number): Promise<{
        position: MarginPosition;
        realizedPnl: number;
        transactionId: string;
    }>;
    /**
     * Advanced Liquidation Engine
     */
    static liquidatePosition(positionId: string, reason: 'margin_call' | 'forced_liquidation' | 'risk_limit_exceeded'): Promise<LiquidationEvent>;
    /**
     * Get User Risk Limits
     */
    static getUserRiskLimits(userId: string, tenantId: string, brokerId: string): Promise<RiskLimits>;
    /**
     * Get User-Level Fund Segregation
     */
    static getUserFundSegregation(userId: string, tenantId: string, brokerId: string): Promise<any>;
    /**
     * Get All Users Fund Segregation (Admin Only)
     */
    static getAllUsersFundSegregation(): Promise<any[]>;
    /**
     * Update User Risk Score
     */
    static updateUserRiskScore(userId: string, tenantId: string, brokerId: string, riskScore: number): Promise<void>;
    /**
     * Get Service Health Status
     */
    static isHealthy(): boolean;
    /**
     * Close Service
     */
    static close(): Promise<void>;
    private static loadExistingData;
    private static loadFundingRates;
    private static startRiskMonitoring;
    private static startLiquidationMonitoring;
    private static startFundingRateUpdates;
    private static monitorRiskLevels;
    private static checkLiquidations;
    private static updateFundingRates;
    private static processInitialDeposit;
    private static createBlnkFinanceAccount;
    private static validatePositionRisk;
    private static calculateLiquidationPrice;
    private static calculateRealizedPnl;
    private static updateAccountMarginUsage;
    private static updateMarginLevel;
    private static calculateAccountRisk;
    private static getCurrentPrice;
    private static getAssetVolatility;
    private static getVolatilityData;
    private static processPositionThroughBlnkFinance;
    private static processPositionThroughOmniExchange;
    private static processPositionCloseThroughBlnkFinance;
    private static executeLiquidation;
    private static getMarginAccount;
    static getUserMarginAccount(userId: string, tenantId: string, brokerId: string): Promise<MarginAccount | null>;
    private static generateAccountId;
    private static generatePositionId;
    private static generateLiquidationId;
    private static processBlnkFinancePayment;
    private static createBlnkFinanceAccountStub;
    private static processMarginPositionStub;
    private static processMarginPositionCloseStub;
    private static processLiquidationStub;
    private static getCurrentPriceStub;
    private static getVolatilityDataStub;
    private static calculatePositionRiskStub;
    private static calculateVaRStub;
    private static processOmniExchangeOrder;
}
//# sourceMappingURL=advanced-margin.d.ts.map