/**
 * DEX Service (Decentralized Exchange)
 *
 * Production-ready DEX service with comprehensive features:
 * - DEX Aggregation (0x, Uniswap, SushiSwap, PancakeSwap)
 * - Cross-DEX Price Discovery
 * - Best Execution Routing
 * - Gas Optimization
 * - Slippage Protection
 * - Real-time Price Feeds
 * - Liquidity Pool Management
 * - Smart Contract Integration
 *
 * Based on the original thaliumx DEX implementation
 */
export declare enum DEXProtocol {
    UNISWAP_V2 = "uniswap_v2",
    UNISWAP_V3 = "uniswap_v3",
    SUSHISWAP = "sushiswap",
    PANCAKESWAP = "pancakeswap",
    QUICKSWAP = "quickswap",
    TRADERJOE = "traderjoe",
    SPOOKYSWAP = "spookyswap",
    SPIRITSWAP = "spiritswap",
    JOE = "joe",
    PANGOLIN = "pangolin",
    ZEROX = "0x"
}
export declare enum ChainId {
    ETHEREUM = 1,
    BSC = 56,
    POLYGON = 137,
    ARBITRUM = 42161,
    OPTIMISM = 10,
    AVALANCHE = 43114,
    FANTOM = 250,
    BASE = 8453
}
export interface DEXConfig {
    name: string;
    protocol: DEXProtocol;
    chainId: ChainId;
    routerAddress: string;
    factoryAddress: string;
    quoterAddress?: string;
    wrappedNativeToken: string;
    stableCoins: string[];
    rpcUrl: string;
    blockExplorer: string;
}
export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    chainId: ChainId;
}
export interface PoolInfo {
    address: string;
    token0: TokenInfo;
    token1: TokenInfo;
    fee?: number;
    liquidity: string;
    volume24h: string;
    protocol: DEXProtocol;
    chainId: ChainId;
}
export interface DEXQuote {
    dex: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    priceImpact: string;
    fee: string;
    gasEstimate: string;
    route: SwapRoute[];
    slippage: number;
    deadline: number;
    timestamp: Date;
}
export interface AggregatedQuote {
    dex: string;
    quote: DEXQuote;
    amountOut: string;
    priceImpact: string;
    fee: string;
    gasEstimate: string;
    route: SwapRoute[];
}
export interface BestQuoteResult {
    bestQuote: AggregatedQuote;
    allQuotes: AggregatedQuote[];
    executionTime: number;
    gasOptimized: boolean;
    slippageProtected: boolean;
}
export interface SwapRoute {
    tokenIn: string;
    tokenOut: string;
    fee: number;
    poolAddress?: string;
    dex: string;
}
export interface LiquidityPool {
    id: string;
    dex: string;
    token0: string;
    token1: string;
    fee: number;
    liquidity: string;
    reserve0: string;
    reserve1: string;
    price: string;
    volume24h: string;
    fees24h: string;
    apr: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface SwapTransaction {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    dex: string;
    route: SwapRoute[];
    txHash?: string;
    status: SwapStatus;
    gasUsed?: string;
    gasPrice?: string;
    slippage: number;
    priceImpact: string;
    fee: string;
    metadata: SwapMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface SwapMetadata {
    source: string;
    ipAddress?: string;
    userAgent?: string;
    complianceFlags: string[];
    riskScore: number;
    executionTime: number;
    gasOptimized: boolean;
    slippageProtected: boolean;
}
export interface DEXStats {
    totalSwaps: number;
    totalVolume: string;
    totalFees: string;
    averageSlippage: number;
    averageGasUsed: string;
    byDEX: DEXStatsByDEX[];
    byToken: TokenStats[];
    recentSwaps: number;
    activePools: number;
    totalLiquidity: string;
}
export interface DEXStatsByDEX {
    dex: string;
    swaps: number;
    volume: string;
    fees: string;
    averageSlippage: number;
    marketShare: number;
}
export interface TokenStats {
    token: string;
    swaps: number;
    volume: string;
    averagePrice: string;
    priceChange24h: number;
}
export interface PriceFeed {
    token: string;
    price: string;
    change24h: number;
    volume24h: string;
    marketCap?: string;
    lastUpdated: Date;
}
export interface LiquidityPosition {
    id: string;
    userId: string;
    poolId: string;
    token0Amount: string;
    token1Amount: string;
    lpTokens: string;
    share: number;
    feesEarned: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum SwapStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare enum DEXProvider {
    ZEROX = "0x",
    UNISWAP = "uniswap",
    SUSHISWAP = "sushiswap",
    PANCAKESWAP = "pancakeswap",
    THALIUM_DEX = "thalium_dex"
}
export declare enum PoolType {
    CONSTANT_PRODUCT = "constant_product",
    STABLE_SWAP = "stable_swap",
    WEIGHTED = "weighted",
    CONCENTRATED = "concentrated"
}
export declare class DEXService {
    private static isInitialized;
    private static pools;
    private static swaps;
    private static priceFeeds;
    private static liquidityPositions;
    private static dexConfigs;
    private static providers;
    private static tokenCache;
    private static poolCache;
    private static readonly DEX_CONFIG;
    /**
     * Initialize DEX Service
     */
    static initialize(): Promise<void>;
    /**
     * Initialize comprehensive DEX configurations for all supported chains
     */
    private static initializeDEXConfigs;
    /**
     * Initialize providers for all supported chains
     */
    private static initializeProviders;
    /**
     * Get token information with caching
     */
    static getTokenInfo(chainId: ChainId, tokenAddress: string): Promise<TokenInfo>;
    /**
     * Get supported DEX protocols
     */
    static getSupportedProtocols(): DEXProtocol[];
    /**
     * Get supported chains
     */
    static getSupportedChains(): ChainId[];
    /**
     * Get best quote across all DEXs
     */
    static getBestQuote(tokenIn: string, tokenOut: string, amountIn: string, slippage?: number, options?: {
        dexes?: DEXProvider[];
        chainId?: ChainId;
    }): Promise<BestQuoteResult>;
    /**
     * Execute swap transaction
     */
    static executeSwap(userId: string, tenantId: string, brokerId: string, tokenIn: string, tokenOut: string, amountIn: string, slippage: number, deadline: number, route: SwapRoute[]): Promise<SwapTransaction>;
    /**
     * Add liquidity to pool
     */
    static addLiquidity(userId: string, poolId: string, token0Amount: string, token1Amount: string, slippage?: number): Promise<LiquidityPosition>;
    /**
     * Remove liquidity from pool
     */
    static removeLiquidity(userId: string, positionId: string, lpTokenAmount: string, slippage?: number): Promise<LiquidityPosition>;
    /**
     * Get user swaps
     */
    static getUserSwaps(userId: string, options?: {
        status?: SwapStatus;
        limit?: number;
        offset?: number;
        tokenIn?: string;
        tokenOut?: string;
    }): Promise<SwapTransaction[]>;
    /**
     * Get swap by ID
     */
    static getSwapById(swapId: string): Promise<SwapTransaction | null>;
    /**
     * Get user liquidity positions
     */
    static getUserLiquidityPositions(userId: string): Promise<LiquidityPosition[]>;
    /**
     * Get liquidity pools
     */
    static getLiquidityPools(options?: {
        dex?: string;
        token0?: string;
        token1?: string;
        isActive?: boolean;
    }): Promise<LiquidityPool[]>;
    /**
     * Get pool by ID
     */
    static getPoolById(poolId: string): Promise<LiquidityPool | null>;
    /**
     * Get price feeds
     */
    static getPriceFeeds(tokens?: string[]): Promise<PriceFeed[]>;
    /**
     * Get DEX statistics
     */
    static getDEXStats(): Promise<DEXStats>;
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
    private static initializePriceFeeds;
    private static initializeLiquidityPools;
    private static startPriceFeedUpdater;
    private static startLiquidityUpdater;
    private static getQuoteFromDEX;
    private static getZeroXQuote;
    private static getUniswapQuote;
    private static getSushiSwapQuote;
    private static getPancakeSwapQuote;
    private static processSwap;
    private static processLiquidityAddition;
    private static processLiquidityRemoval;
    private static calculateSwapRiskScore;
    private static isGasOptimized;
    private static updatePriceFeeds;
    private static updateLiquidityPools;
}
//# sourceMappingURL=dex.d.ts.map