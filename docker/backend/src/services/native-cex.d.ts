/**
 * Native CEX (Centralized Exchange) Service
 *
 * ARCHITECTURE OVERVIEW:
 * - Integrates Dingir Exchange (primary trading engine)
 * - Integrates Liquibook (order book management)
 * - Integrates QuantLib (risk assessment and pricing)
 * - Promotes THAL token usage with rewards
 * - Provides liquidity incentives
 * - Business model focused on THAL adoption
 *
 * Features:
 * - Multi-engine trading (Dingir + Liquibook)
 * - Advanced order matching and execution
 * - Risk management with QuantLib
 * - THAL token rewards and fee discounts
 * - Liquidity provider incentives
 * - Real-time market data aggregation
 * - Cross-engine arbitrage opportunities
 */
import { Sequelize } from 'sequelize';
export interface TradingEngine {
    id: string;
    name: string;
    type: 'dingir' | 'liquibook' | 'hybrid';
    endpoint: string;
    status: 'active' | 'degraded' | 'down';
    capabilities: {
        orderMatching: boolean;
        marketData: boolean;
        balanceManagement: boolean;
        realTimeUpdates: boolean;
        riskManagement: boolean;
    };
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
        lastHealthCheck?: Date;
    };
}
export interface TradingPair {
    id: string;
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: 'active' | 'suspended' | 'maintenance';
    precision: {
        price: number;
        quantity: number;
    };
    limits: {
        minOrderSize: string;
        maxOrderSize: string;
        minPrice: string;
        maxPrice: string;
    };
    fees: {
        maker: string;
        taker: string;
        thalDiscount: string;
    };
    engines: string[];
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
export interface CEXOrder {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    tradingPairId: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'iceberg';
    quantity: string;
    price?: string;
    stopPrice?: string;
    timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
    status: 'pending' | 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired';
    filledQuantity: string;
    remainingQuantity: string;
    averagePrice: string;
    fees: string;
    thalRewards: string;
    thalFeeDiscount: string;
    engine: string;
    riskScore: number;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
        executionLog: Array<{
            timestamp: Date;
            action: string;
            details: any;
        }>;
    };
}
export interface MarketData {
    symbol: string;
    price: string;
    volume24h: string;
    change24h: string;
    high24h: string;
    low24h: string;
    bid: string;
    ask: string;
    spread: string;
    depth: {
        bids: Array<{
            price: string;
            quantity: string;
        }>;
        asks: Array<{
            price: string;
            quantity: string;
        }>;
    };
    timestamp: Date;
}
export interface LiquidityIncentive {
    id: string;
    userId: string;
    brokerId: string;
    tradingPairId: string;
    incentiveType: 'maker_reward' | 'volume_bonus' | 'liquidity_provider';
    amount: string;
    currency: string;
    status: 'pending' | 'credited' | 'expired';
    expiresAt: Date;
    metadata: {
        sourceOrderId?: string;
        volumeTraded: string;
        multiplier: number;
        createdAt: Date;
    };
}
export interface THALBusinessModel {
    feeDiscounts: {
        tradingFeeDiscount: string;
        withdrawalFeeDiscount: string;
        depositFeeDiscount: string;
    };
    rewards: {
        tradingRewardRate: string;
        liquidityProviderReward: string;
        referralReward: string;
    };
    staking: {
        stakingRewardRate: string;
        minimumStakeAmount: string;
        lockPeriodDays: number;
    };
    governance: {
        votingPowerPerTHAL: string;
        proposalThreshold: string;
    };
}
export declare class NativeCEXService {
    private db;
    private eventStreamingService;
    private quantlibService;
    private blnkfinanceService;
    private tradingEngines;
    private tradingPairs;
    private orders;
    private liquidityIncentives;
    private dingirClient;
    private liquibookClient;
    private readonly THAL_BUSINESS_MODEL;
    constructor(db: Sequelize);
    initialize(): Promise<void>;
    /**
     * Initialize trading engines (Dingir + Liquibook)
     */
    private initializeTradingEngines;
    /**
     * Initialize trading pairs with THAL promotion
     */
    private initializeTradingPairs;
    /**
     * Place order with intelligent engine routing
     */
    placeOrder(userId: string, tenantId: string, brokerId: string, params: {
        tradingPairId: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: string;
        price?: string;
        stopPrice?: string;
        timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
    }): Promise<CEXOrder>;
    /**
     * Route order to best available engine
     */
    private routeOrderToEngine;
    /**
     * Submit order to Dingir Exchange
     */
    private submitOrderToDingir;
    /**
     * Submit order to Liquibook
     */
    private submitOrderToLiquibook;
    /**
     * Calculate THAL rewards and fee discounts
     */
    private calculateTHALBenefits;
    /**
     * Credit THAL rewards to user
     */
    creditTHALRewards(userId: string, orderId: string): Promise<void>;
    /**
     * Get aggregated market data from all engines
     */
    getMarketData(symbol: string): Promise<MarketData>;
    /**
     * Perform risk assessment using QuantLib
     */
    private performRiskAssessment;
    /**
     * Start health monitoring for trading engines
     */
    private startHealthMonitoring;
    /**
     * Check individual engine health
     */
    private checkEngineHealth;
    /**
     * Get trading engines status
     */
    getTradingEngines(): TradingEngine[];
    /**
     * Get trading pairs
     */
    getTradingPairs(): TradingPair[];
    /**
     * Get THAL trading pairs (promoted)
     */
    getTHALTradingPairs(): TradingPair[];
    /**
     * Get order by ID
     */
    getOrder(orderId: string): CEXOrder | null;
    /**
     * Get user's orders
     */
    getUserOrders(userId: string): CEXOrder[];
    /**
     * Get liquidity incentives for user
     */
    getUserLiquidityIncentives(userId: string): LiquidityIncentive[];
    /**
     * Get THAL business model
     */
    getTHALBusinessModel(): THALBusinessModel;
    /**
     * Cancel order
     */
    cancelOrder(orderId: string, userId: string): Promise<boolean>;
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=native-cex.d.ts.map