/**
 * Exchange Operations Service
 *
 * Core trading functionality including:
 * - Order matching engine
 * - Fund segregation by tenant
 * - Trading pairs management
 * - Real-time market data
 * - Risk management
 * - Integration with external exchanges using API keys from secrets
 *
 * Production-ready for financial operations
 */
export interface Order {
    id: string;
    userId: string;
    tenantId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
    filledQuantity: number;
    averagePrice?: number;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}
export interface Trade {
    id: string;
    buyOrderId: string;
    sellOrderId: string;
    symbol: string;
    quantity: number;
    price: number;
    buyerId: string;
    sellerId: string;
    buyerTenantId: string;
    sellerTenantId: string;
    timestamp: Date;
    fee: number;
    feeCurrency: string;
}
export interface TradingPair {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: 'active' | 'inactive' | 'suspended';
    minQuantity: number;
    maxQuantity: number;
    tickSize: number;
    stepSize: number;
    makerFee: number;
    takerFee: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface MarketData {
    symbol: string;
    price: number;
    volume24h: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    lastUpdate: Date;
}
export interface Balance {
    userId: string;
    tenantId: string;
    asset: string;
    available: number;
    locked: number;
    total: number;
    updatedAt: Date;
}
export declare class ExchangeService {
    private static tradingPairs;
    private static exchangeCredentials;
    /**
     * Initialize exchange service
     */
    static initialize(): Promise<void>;
    /**
     * Validate exchange credentials by testing connectivity
     */
    private static validateExchangeCredentials;
    /**
     * Test connection to an exchange
     */
    private static testExchangeConnection;
    /**
     * Generate API signature for different exchanges
     */
    private static generateSignature;
    /**
     * Create a new order - enhanced with external execution if needed
     */
    static createOrder(orderData: Partial<Order>): Promise<Order>;
    private static validateOrderData;
    private static validateUserBalance;
    private static generateOrderId;
    private static lockFunds;
    private static addToOrderBook;
    private static saveOrder;
    private static emitOrderEvent;
    /**
     * Route order to external exchange
     */
    private static routeToExternalExchange;
    /**
     * Select best external exchange for order
     */
    private static selectBestExchange;
    /**
     * Initialize market data from external exchanges
     */
    private static initializeMarketDataFromExchanges;
    /**
     * Fetch market data from external exchanges
     */
    private static fetchExternalMarketData;
    /**
     * Start market data updater
     */
    private static startMarketDataUpdater;
    private static loadTradingPairs;
    private static loadActiveOrders;
    private static startOrderMatchingEngine;
    private static matchOrders;
    /** Cancel an order by id for a user */
    static cancelOrder(orderId: string, userId: string): Promise<Order>;
    /** Get user orders optionally filtered */
    static getUserOrders(userId: string, tenantId: string, symbol?: string, status?: string): Promise<Order[]>;
    /** Get simple order book (placeholder from DB orders) */
    static getOrderBook(symbol: string, limit?: number): Promise<{
        bids: [number, number][];
        asks: [number, number][];
    }>;
    /** Get market data for a symbol */
    static getMarketData(symbol: string): Promise<MarketData | null>;
    /** Get user balances across assets */
    static getUserBalance(userId: string, tenantId: string): Promise<Balance[]>;
}
//# sourceMappingURL=exchange.d.ts.map