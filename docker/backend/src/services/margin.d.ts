/**
 * Margin Trading Service
 *
 * Core margin trading operations including:
 * - Leveraged trading (2x, 5x, 10x leverage)
 * - Risk management (liquidation, margin calls)
 * - Collateral management (cross-margin, isolated margin)
 * - Interest calculations (borrowing costs, funding rates)
 * - Position management (long/short positions, P&L tracking)
 * - Multi-tenant fund segregation
 *
 * Production-ready for financial operations
 */
export interface MarginAccount {
    id: string;
    userId: string;
    tenantId: string;
    accountType: 'cross' | 'isolated';
    totalEquity: number;
    totalMargin: number;
    availableBalance: number;
    usedMargin: number;
    freeMargin: number;
    marginLevel: number;
    marginRatio: number;
    status: 'active' | 'margin_call' | 'liquidation' | 'suspended';
    createdAt: Date;
    updatedAt: Date;
}
export interface MarginPosition {
    id: string;
    userId: string;
    tenantId: string;
    accountId: string;
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    marginUsed: number;
    unrealizedPnl: number;
    realizedPnl: number;
    fundingFee: number;
    status: 'open' | 'closed' | 'liquidated';
    openedAt: Date;
    closedAt?: Date;
    updatedAt: Date;
}
export interface MarginOrder {
    id: string;
    userId: string;
    tenantId: string;
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    leverage: number;
    marginRequired: number;
    status: 'pending' | 'filled' | 'cancelled' | 'rejected';
    filledQuantity: number;
    averagePrice: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface MarginTransfer {
    id: string;
    userId: string;
    tenantId: string;
    fromAccount: string;
    toAccount: string;
    asset: string;
    amount: number;
    type: 'deposit' | 'withdrawal' | 'transfer';
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}
export interface LiquidationEvent {
    id: string;
    userId: string;
    tenantId: string;
    accountId: string;
    positionId: string;
    symbol: string;
    liquidationPrice: number;
    liquidationAmount: number;
    remainingMargin: number;
    reason: 'margin_call' | 'forced_liquidation';
    createdAt: Date;
}
export interface FundingRate {
    symbol: string;
    rate: number;
    nextFundingTime: Date;
    updatedAt: Date;
}
export interface MarginConfig {
    maxLeverage: number;
    maintenanceMarginRatio: number;
    liquidationThreshold: number;
    fundingRateInterval: number;
    interestRate: number;
    minMarginTransfer: number;
    maxMarginTransfer: number;
}
export declare class MarginTradingService {
    private static isInitialized;
    private static accounts;
    private static positions;
    private static orders;
    private static transfers;
    private static fundingRates;
    private static config;
    /**
     * Initialize Margin Trading service
     */
    static initialize(): Promise<void>;
    /**
     * Create margin account
     */
    static createMarginAccount(userId: string, tenantId: string, accountType?: 'cross' | 'isolated'): Promise<MarginAccount>;
    /**
     * Get margin account
     */
    static getMarginAccount(userId: string, tenantId: string): Promise<MarginAccount | null>;
    /**
     * Deposit margin
     */
    static depositMargin(userId: string, tenantId: string, asset: string, amount: number): Promise<MarginTransfer>;
    /**
     * Withdraw margin
     */
    static withdrawMargin(userId: string, tenantId: string, asset: string, amount: number): Promise<MarginTransfer>;
    /**
     * Create margin order
     */
    static createMarginOrder(userId: string, tenantId: string, symbol: string, side: 'buy' | 'sell', type: 'market' | 'limit' | 'stop' | 'stop_limit', quantity: number, leverage: number, price?: number, stopPrice?: number): Promise<MarginOrder>;
    /**
     * Close margin position
     */
    static closeMarginPosition(userId: string, tenantId: string, positionId: string): Promise<MarginPosition>;
    /**
     * Get user positions
     */
    static getUserPositions(userId: string, tenantId: string): Promise<MarginPosition[]>;
    /**
     * Get user orders
     */
    static getUserOrders(userId: string, tenantId: string): Promise<MarginOrder[]>;
    /**
     * Get funding rates
     */
    static getFundingRates(): Promise<FundingRate[]>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static processMarginTransfer;
    private static processMarginOrder;
    private static createPosition;
    private static updateMarginLevel;
    private static calculatePnl;
    private static calculateRequiredMargin;
    private static getCurrentPrice;
    private static loadFundingRates;
    private static startFundingRateUpdates;
    private static startMarginMonitoring;
    private static startLiquidationMonitoring;
    private static updateFundingRates;
    private static monitorMarginLevels;
    private static checkLiquidations;
    private static liquidatePosition;
    private static generateAccountId;
    private static generateOrderId;
    private static generatePositionId;
    private static generateTransferId;
    private static generateLiquidationId;
}
//# sourceMappingURL=margin.d.ts.map