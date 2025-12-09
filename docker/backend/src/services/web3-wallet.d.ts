/**
 * Web3 Wallet Integration Service
 *
 * Comprehensive Web3 wallet integration for ThaliumX platform:
 * - Multi-wallet support (MetaMask, WalletConnect, Coinbase Wallet, etc.)
 * - Multi-chain support (Ethereum, BSC, Polygon, Arbitrum, etc.)
 * - Trading integration with Web3 wallets
 * - Token purchase with Web3 wallets
 * - Secure wallet validation and connection management
 * - Cross-platform compatibility
 */
export interface Web3Wallet {
    id: string;
    userId: string;
    tenantId: string;
    brokerId: string;
    walletType: 'metamask' | 'walletconnect' | 'coinbase' | 'phantom' | 'rainbow' | 'trust' | 'ledger' | 'trezor';
    address: string;
    chainId: number;
    network: string;
    status: 'connected' | 'disconnected' | 'pending' | 'error';
    isVerified: boolean;
    verificationMethod: 'signature' | 'transaction' | 'none';
    metadata: {
        walletName?: string;
        walletVersion?: string;
        lastConnectedAt: Date;
        connectionCount: number;
        publicKey?: string;
        ensName?: string;
        avatar?: string;
        riskScore: number;
        complianceFlags: string[];
    };
    security: {
        isWhitelisted: boolean;
        isBlacklisted: boolean;
        maxDailyTransactions: number;
        maxTransactionAmount: number;
        requiresApproval: boolean;
        lastSecurityCheck: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    contracts: {
        thalToken?: string;
        usdt?: string;
        usdc?: string;
        dai?: string;
        weth?: string;
    };
    gasSettings: {
        gasPriceMultiplier: number;
        maxGasPrice: string;
        priorityFeeMultiplier: number;
    };
    isSupported: boolean;
}
export interface WalletConnectionRequest {
    walletType: string;
    chainId: number;
    address: string;
    signature?: string;
    message?: string;
    timestamp: number;
    nonce: string;
}
export interface WalletBalance {
    address: string;
    chainId: number;
    nativeBalance: string;
    tokenBalances: Array<{
        contractAddress: string;
        symbol: string;
        name: string;
        decimals: number;
        balance: string;
        balanceFormatted: string;
        priceUSD?: number;
        valueUSD?: number;
    }>;
    totalValueUSD: number;
    lastUpdated: Date;
}
export interface TransactionRequest {
    from: string;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    chainId: number;
    nonce?: number;
}
export interface SignedTransaction {
    rawTransaction: string;
    transactionHash: string;
    signature: {
        r: string;
        s: string;
        v: number;
    };
}
export interface TokenPurchaseRequest {
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    paymentToken: 'ETH' | 'USDT' | 'USDC' | 'DAI';
    paymentAmount: string;
    slippageTolerance: number;
    deadline: number;
    chainId: number;
    userWallet: string;
}
export declare class Web3WalletService {
    private static instance;
    private providers;
    private walletConnections;
    private constructor();
    static getInstance(): Web3WalletService;
    /**
     * Initialize the Web3 wallet service
     */
    initialize(): Promise<void>;
    /**
     * Get supported chains
     */
    getSupportedChains(): ChainConfig[];
    /**
     * Get chain configuration
     */
    getChainConfig(chainId: number): ChainConfig | null;
    /**
     * Connect a Web3 wallet
     */
    connectWallet(userId: string, tenantId: string, brokerId: string, connectionRequest: WalletConnectionRequest): Promise<Web3Wallet>;
    /**
     * Disconnect a Web3 wallet
     */
    disconnectWallet(userId: string, tenantId: string, walletId: string): Promise<void>;
    /**
     * Get wallet balance across all supported tokens
     */
    getWalletBalance(address: string, chainId: number): Promise<WalletBalance>;
    /**
     * Get token balance for a specific contract
     */
    private getTokenBalance;
    private priceCache;
    private readonly PRICE_CACHE_TTL;
    /**
     * Get token price in USD using multiple price oracles
     *
     * Priority:
     * 1. CoinGecko API (free tier)
     * 2. CoinMarketCap API (if API key configured)
     * 3. Chainlink price feeds (on-chain)
     * 4. Fallback to cached/default prices
     */
    private getTokenPriceUSD;
    /**
     * Fetch price from CoinGecko API
     */
    private fetchCoinGeckoPrice;
    /**
     * Fetch price from CoinMarketCap API
     */
    private fetchCoinMarketCapPrice;
    /**
     * Fetch price from Chainlink price feed (on-chain oracle)
     */
    private fetchChainlinkPrice;
    /**
     * Get prices for multiple tokens at once
     */
    getMultipleTokenPrices(symbols: string[]): Promise<Record<string, number>>;
    /**
     * Verify wallet ownership using signature
     */
    private verifyWalletOwnership;
    /**
     * Calculate wallet risk score based on multiple factors
     *
     * Risk factors analyzed:
     * - Wallet age (older = lower risk)
     * - Transaction history patterns
     * - Interaction with known risky contracts
     * - Balance volatility
     * - Connection to flagged addresses
     * - Smart contract interactions
     *
     * Score: 0-100 (0 = lowest risk, 100 = highest risk)
     */
    private calculateWalletRiskScore;
    /**
     * Check address against known risky address lists
     */
    private checkRiskyAddresses;
    /**
     * Get comprehensive wallet risk assessment
     */
    getWalletRiskAssessment(address: string, chainId?: number): Promise<{
        riskScore: number;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        factors: Array<{
            name: string;
            impact: string;
            description: string;
        }>;
        recommendations: string[];
        lastChecked: Date;
    }>;
    /**
     * Get wallet by ID
     */
    getWalletById(userId: string, tenantId: string, walletId: string): Promise<Web3Wallet | null>;
    /**
     * Get wallet by address
     */
    private getWalletByAddress;
    /**
     * Save wallet to database
     */
    private saveWallet;
    /**
     * Load wallet connections from database
     */
    private loadWalletConnections;
    /**
     * Get user's connected wallets
     */
    getUserWallets(userId: string, tenantId: string): Promise<Web3Wallet[]>;
    /**
     * Check if wallet is healthy
     */
    isHealthy(): boolean;
}
export declare const web3WalletService: Web3WalletService;
//# sourceMappingURL=web3-wallet.d.ts.map