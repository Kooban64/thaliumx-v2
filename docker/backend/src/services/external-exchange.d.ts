/**
 * External Exchange Integration Service
 *
 * Comprehensive integration with 7 public cryptocurrency exchanges:
 * - Bybit
 * - KuCoin
 * - OKX
 * - Kraken
 * - VALR
 * - Bitstamp
 * - Crypto.com
 *
 * Features:
 * - Unified API for all exchanges
 * - Market data aggregation
 * - Order management
 * - Account management
 * - Trade execution
 * - Rate limiting & error handling
 *
 * Production-ready with full integration
 */
export declare enum ExchangeType {
    BYBIT = "bybit",
    KUCOIN = "kucoin",
    OKX = "okx",
    KRAKEN = "kraken",
    VALR = "valr",
    BITSTAMP = "bitstamp",
    CRYPTO_COM = "crypto.com"
}
export declare enum OrderType {
    MARKET = "market",
    LIMIT = "limit",
    STOP_LOSS = "stop_loss",
    STOP_LOSS_LIMIT = "stop_loss_limit",
    TAKE_PROFIT = "take_profit",
    TAKE_PROFIT_LIMIT = "take_profit_limit",
    ICEBERG = "iceberg",
    TRAILING_STOP = "trailing_stop"
}
export declare enum OrderSide {
    BUY = "buy",
    SELL = "sell"
}
export declare enum OrderStatus {
    NEW = "new",
    PARTIALLY_FILLED = "partially_filled",
    FILLED = "filled",
    CANCELLED = "cancelled",
    PENDING_CANCEL = "pending_cancel",
    REJECTED = "rejected",
    EXPIRED = "expired"
}
export declare enum TimeInForce {
    GTC = "GTC",
    IOC = "IOC",
    FOK = "FOK"
}
export interface ExchangeCredentials {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    sandbox?: boolean;
}
export interface ExchangeConfig {
    type: ExchangeType;
    name: string;
    credentials: ExchangeCredentials;
    enabled: boolean;
    rateLimit: number;
    baseUrl: string;
    sandboxUrl?: string;
    timeout?: number;
    retryCount?: number;
}
export interface Ticker {
    symbol: string;
    exchange: ExchangeType;
    bid: number;
    ask: number;
    last: number;
    high: number;
    low: number;
    volume: number;
    quoteVolume: number;
    timestamp: Date;
}
export interface OrderBook {
    symbol: string;
    exchange: ExchangeType;
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    timestamp: Date;
}
export interface OrderBookEntry {
    price: number;
    quantity: number;
}
export interface Trade {
    id: string;
    symbol: string;
    exchange: ExchangeType;
    side: OrderSide;
    price: number;
    quantity: number;
    timestamp: Date;
    fee?: number;
    feeCurrency?: string;
}
export interface Order {
    id: string;
    clientOrderId: string;
    symbol: string;
    exchange: ExchangeType;
    side: OrderSide;
    type: OrderType;
    status: OrderStatus;
    quantity: number;
    filledQuantity: number;
    price: number;
    averagePrice: number;
    fee: number;
    timeInForce: TimeInForce;
    timestamp: Date;
    updatedAt: Date;
}
export interface Balance {
    currency: string;
    exchange: ExchangeType;
    available: number;
    total: number;
    onOrder: number;
    frozen: number;
    timestamp: Date;
}
export interface ExchangeAccount {
    id: string;
    brokerId: string;
    exchangeType: ExchangeType;
    accountStatus: 'active' | 'suspended' | 'closed';
    credentials: ExchangeCredentials;
    balances: Balance[];
    tradingEnabled: boolean;
    withdrawalEnabled: boolean;
    metadata: ExchangeAccountMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface ExchangeAccountMetadata {
    accountNumber?: string;
    tier?: string;
    makerFee?: number;
    takerFee?: number;
    limits?: AccountLimits;
}
export interface AccountLimits {
    dailyWithdrawal?: number;
    dailyTrade?: number;
    perOrderMax?: number;
    perOrderMin?: number;
}
export interface MarketData {
    symbol: string;
    exchange: ExchangeType;
    price: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    timestamp: Date;
}
export declare class ExternalExchangeService {
    private static isInitialized;
    private static exchanges;
    private static accounts;
    private static tickers;
    private static orderBooks;
    private static trades;
    private static orders;
    private static balances;
    private static clients;
    /**
     * Initialize External Exchange Service
     */
    static initialize(): Promise<void>;
    /**
     * Load existing data from storage
     */
    private static loadExistingData;
    /**
     * Initialize exchange configurations based on original thaliumx project
     */
    private static initializeExchangeConfigurations;
    /**
     * Initialize exchange clients
     */
    private static initializeExchangeClients;
    /**
     * Start monitoring services
     */
    private static startMonitoringServices;
    /**
     * Update tickers
     */
    private static updateTickers;
    /**
     * Update order books
     */
    private static updateOrderBooks;
    /**
     * Update balances
     */
    private static updateBalances;
    /**
     * Create exchange account
     */
    static createExchangeAccount(brokerId: string, exchangeType: ExchangeType, credentials: ExchangeCredentials): Promise<ExchangeAccount>;
    /**
     * Get exchange account
     */
    static getExchangeAccount(accountId: string): Promise<ExchangeAccount | undefined>;
    /**
     * Get exchange accounts by broker
     */
    static getExchangeAccountsByBroker(brokerId: string): Promise<ExchangeAccount[]>;
    /**
     * Get available exchanges
     */
    static getAvailableExchanges(): Promise<ExchangeConfig[]>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=external-exchange.d.ts.map