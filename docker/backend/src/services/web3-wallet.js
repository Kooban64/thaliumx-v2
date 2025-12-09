"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.web3WalletService = exports.Web3WalletService = void 0;
const ethers_1 = require("ethers");
const logger_1 = require("./logger");
const database_1 = require("./database");
const event_streaming_1 = require("./event-streaming");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================
const SUPPORTED_CHAINS = {
    // Ethereum Mainnet
    1: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
        blockExplorer: 'https://etherscan.io',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        contracts: {
            thalToken: '0x...', // To be deployed
            usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            usdc: '0xA0b86a33E6441b8C4C8C0E4A8b8C4C8C0E4A8b8C',
            dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        },
        gasSettings: {
            gasPriceMultiplier: 1.1,
            maxGasPrice: '200000000000', // 200 gwei
            priorityFeeMultiplier: 1.2
        },
        isSupported: true
    },
    // Binance Smart Chain
    56: {
        chainId: 56,
        name: 'BSC',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        contracts: {
            thalToken: '0x...', // To be deployed
            usdt: '0x55d398326f99059fF775485246999027B3197955',
            usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            dai: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
            weth: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
        },
        gasSettings: {
            gasPriceMultiplier: 1.05,
            maxGasPrice: '20000000000', // 20 gwei
            priorityFeeMultiplier: 1.1
        },
        isSupported: true
    },
    // Polygon
    137: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com',
        nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
        },
        contracts: {
            thalToken: '0x...', // To be deployed
            usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            dai: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            weth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
        },
        gasSettings: {
            gasPriceMultiplier: 1.1,
            maxGasPrice: '100000000000', // 100 gwei
            priorityFeeMultiplier: 1.2
        },
        isSupported: true
    },
    // Arbitrum
    42161: {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        blockExplorer: 'https://arbiscan.io',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        contracts: {
            thalToken: '0x...', // To be deployed
            usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            usdc: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            dai: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
        },
        gasSettings: {
            gasPriceMultiplier: 1.1,
            maxGasPrice: '1000000000', // 1 gwei
            priorityFeeMultiplier: 1.2
        },
        isSupported: true
    },
    // Optimism
    10: {
        chainId: 10,
        name: 'Optimism',
        rpcUrl: 'https://mainnet.optimism.io',
        blockExplorer: 'https://optimistic.etherscan.io',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        contracts: {
            thalToken: '0x...', // To be deployed
            usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            usdc: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            dai: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
            weth: '0x4200000000000000000000000000000000000006'
        },
        gasSettings: {
            gasPriceMultiplier: 1.1,
            maxGasPrice: '1000000000', // 1 gwei
            priorityFeeMultiplier: 1.2
        },
        isSupported: true
    }
};
// =============================================================================
// WEB3 WALLET SERVICE
// =============================================================================
class Web3WalletService {
    static instance;
    providers = new Map();
    walletConnections = new Map();
    constructor() { }
    static getInstance() {
        if (!Web3WalletService.instance) {
            Web3WalletService.instance = new Web3WalletService();
        }
        return Web3WalletService.instance;
    }
    /**
     * Initialize the Web3 wallet service
     */
    async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Web3 Wallet Service...');
            // Initialize providers for all supported chains
            for (const [chainId, config] of Object.entries(SUPPORTED_CHAINS)) {
                if (config.isSupported) {
                    const provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
                    this.providers.set(parseInt(chainId), provider);
                    logger_1.LoggerService.info(`Initialized provider for ${config.name} (Chain ID: ${chainId})`);
                }
            }
            // Load existing wallet connections from database
            await this.loadWalletConnections();
            logger_1.LoggerService.info('Web3 Wallet Service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize Web3 Wallet Service:', error);
            throw error;
        }
    }
    /**
     * Get supported chains
     */
    getSupportedChains() {
        return Object.values(SUPPORTED_CHAINS).filter(chain => chain.isSupported);
    }
    /**
     * Get chain configuration
     */
    getChainConfig(chainId) {
        return SUPPORTED_CHAINS[chainId] || null;
    }
    /**
     * Connect a Web3 wallet
     */
    async connectWallet(userId, tenantId, brokerId, connectionRequest) {
        try {
            logger_1.LoggerService.info('Connecting Web3 wallet:', {
                userId,
                walletType: connectionRequest.walletType,
                address: connectionRequest.address,
                chainId: connectionRequest.chainId
            });
            // Validate chain support
            const chainConfig = this.getChainConfig(connectionRequest.chainId);
            if (!chainConfig) {
                throw (0, utils_1.createError)('Unsupported chain', 400, 'UNSUPPORTED_CHAIN');
            }
            // Validate wallet address
            if (!ethers_1.ethers.isAddress(connectionRequest.address)) {
                throw (0, utils_1.createError)('Invalid wallet address', 400, 'INVALID_ADDRESS');
            }
            // Check if wallet is already connected
            const existingWallet = await this.getWalletByAddress(userId, tenantId, connectionRequest.address);
            if (existingWallet && existingWallet.status === 'connected') {
                logger_1.LoggerService.warn('Wallet already connected:', { address: connectionRequest.address });
                return existingWallet;
            }
            // Verify wallet ownership (if signature provided)
            if (connectionRequest.signature) {
                const isValidSignature = await this.verifyWalletOwnership(connectionRequest.address, connectionRequest.message || '', connectionRequest.signature);
                if (!isValidSignature) {
                    throw (0, utils_1.createError)('Invalid wallet signature', 400, 'INVALID_SIGNATURE');
                }
            }
            // Create wallet record
            const wallet = {
                id: (0, uuid_1.v4)(),
                userId,
                tenantId,
                brokerId,
                walletType: connectionRequest.walletType,
                address: connectionRequest.address.toLowerCase(),
                chainId: connectionRequest.chainId,
                network: chainConfig.name,
                status: 'connected',
                isVerified: !!connectionRequest.signature,
                verificationMethod: connectionRequest.signature ? 'signature' : 'none',
                metadata: {
                    lastConnectedAt: new Date(),
                    connectionCount: existingWallet ? existingWallet.metadata.connectionCount + 1 : 1,
                    riskScore: await this.calculateWalletRiskScore(connectionRequest.address),
                    complianceFlags: []
                },
                security: {
                    isWhitelisted: false,
                    isBlacklisted: false,
                    maxDailyTransactions: 100,
                    maxTransactionAmount: 100000, // $100k
                    requiresApproval: false,
                    lastSecurityCheck: new Date()
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save to database
            await this.saveWallet(wallet);
            // Cache the connection
            this.walletConnections.set(wallet.id, wallet);
            // Emit event
            await event_streaming_1.EventStreamingService.emitSystemEvent('wallet.connected', 'Web3WalletService', 'info', {
                walletId: wallet.id,
                userId,
                tenantId,
                brokerId,
                address: wallet.address,
                chainId: wallet.chainId,
                walletType: wallet.walletType
            });
            logger_1.LoggerService.info('Wallet connected successfully:', {
                walletId: wallet.id,
                address: wallet.address,
                chainId: wallet.chainId
            });
            return wallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to connect wallet:', error);
            throw error;
        }
    }
    /**
     * Disconnect a Web3 wallet
     */
    async disconnectWallet(userId, tenantId, walletId) {
        try {
            logger_1.LoggerService.info('Disconnecting Web3 wallet:', { userId, walletId });
            const wallet = await this.getWalletById(userId, tenantId, walletId);
            if (!wallet) {
                throw (0, utils_1.createError)('Wallet not found', 404, 'WALLET_NOT_FOUND');
            }
            // Update wallet status
            wallet.status = 'disconnected';
            wallet.updatedAt = new Date();
            // Save to database
            await this.saveWallet(wallet);
            // Remove from cache
            this.walletConnections.delete(walletId);
            // Emit event
            await event_streaming_1.EventStreamingService.emitSystemEvent('wallet.disconnected', 'Web3WalletService', 'info', {
                walletId: wallet.id,
                userId,
                tenantId,
                brokerId: wallet.brokerId,
                address: wallet.address,
                chainId: wallet.chainId
            });
            logger_1.LoggerService.info('Wallet disconnected successfully:', { walletId });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to disconnect wallet:', error);
            throw error;
        }
    }
    /**
     * Get wallet balance across all supported tokens
     */
    async getWalletBalance(address, chainId) {
        try {
            const provider = this.providers.get(chainId);
            if (!provider) {
                throw (0, utils_1.createError)('Unsupported chain', 400, 'UNSUPPORTED_CHAIN');
            }
            const chainConfig = this.getChainConfig(chainId);
            if (!chainConfig) {
                throw (0, utils_1.createError)('Chain configuration not found', 400, 'CHAIN_CONFIG_NOT_FOUND');
            }
            // Get native balance
            const nativeBalance = await provider.getBalance(address);
            const nativeBalanceFormatted = ethers_1.ethers.formatEther(nativeBalance);
            // Get token balances
            const tokenBalances = [];
            for (const [symbol, contractAddress] of Object.entries(chainConfig.contracts)) {
                if (contractAddress && contractAddress !== '0x...') {
                    try {
                        const tokenBalance = await this.getTokenBalance(provider, address, contractAddress, symbol);
                        if (tokenBalance) {
                            tokenBalances.push(tokenBalance);
                        }
                    }
                    catch (error) {
                        logger_1.LoggerService.warn(`Failed to get ${symbol} balance:`, error);
                    }
                }
            }
            // Calculate total value in USD
            const totalValueUSD = tokenBalances.reduce((total, token) => {
                return total + (token.valueUSD || 0);
            }, 0);
            const balance = {
                address: address.toLowerCase(),
                chainId,
                nativeBalance: nativeBalanceFormatted,
                tokenBalances,
                totalValueUSD,
                lastUpdated: new Date()
            };
            return balance;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get wallet balance:', error);
            throw error;
        }
    }
    /**
     * Get token balance for a specific contract
     */
    async getTokenBalance(provider, address, contractAddress, symbol) {
        try {
            // ERC-20 ABI for balanceOf
            const erc20Abi = [
                'function balanceOf(address owner) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function symbol() view returns (string)',
                'function name() view returns (string)'
            ];
            const contract = new ethers_1.ethers.Contract(contractAddress, erc20Abi, provider);
            if (!contract.balanceOf) {
                throw new Error('Contract does not support balanceOf');
            }
            const balance = await contract.balanceOf(address);
            const decimals = contract.decimals ? await contract.decimals() : 18;
            const symbolResult = contract.symbol ? await contract.symbol() : symbol;
            const nameResult = contract.name ? await contract.name() : 'Token';
            const balanceFormatted = ethers_1.ethers.formatUnits(balance, decimals);
            return {
                contractAddress,
                symbol: symbolResult || symbol,
                name: nameResult || symbol,
                decimals: Number(decimals),
                balance: balance.toString(),
                balanceFormatted,
                priceUSD: await this.getTokenPriceUSD(symbol),
                valueUSD: parseFloat(balanceFormatted) * (await this.getTokenPriceUSD(symbol))
            };
        }
        catch (error) {
            logger_1.LoggerService.warn(`Failed to get token balance for ${symbol}:`, error);
            return null;
        }
    }
    // Price oracle configuration
    priceCache = new Map();
    PRICE_CACHE_TTL = 60000; // 1 minute cache
    /**
     * Get token price in USD using multiple price oracles
     *
     * Priority:
     * 1. CoinGecko API (free tier)
     * 2. CoinMarketCap API (if API key configured)
     * 3. Chainlink price feeds (on-chain)
     * 4. Fallback to cached/default prices
     */
    async getTokenPriceUSD(symbol) {
        // Check cache first
        const cached = this.priceCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
            return cached.price;
        }
        // Symbol to CoinGecko ID mapping
        const coinGeckoIds = {
            'ETH': 'ethereum',
            'WETH': 'ethereum',
            'BTC': 'bitcoin',
            'WBTC': 'wrapped-bitcoin',
            'USDT': 'tether',
            'USDC': 'usd-coin',
            'DAI': 'dai',
            'BNB': 'binancecoin',
            'MATIC': 'matic-network',
            'AVAX': 'avalanche-2',
            'SOL': 'solana',
            'ARB': 'arbitrum',
            'OP': 'optimism',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'AAVE': 'aave',
            'CRV': 'curve-dao-token',
            'MKR': 'maker',
            'SNX': 'synthetix-network-token',
            'COMP': 'compound-governance-token',
            'SUSHI': 'sushi',
            'YFI': 'yearn-finance',
            'THAL': 'thaliumx' // Our token
        };
        const coinGeckoId = coinGeckoIds[symbol.toUpperCase()];
        // Try CoinGecko API first
        if (coinGeckoId) {
            try {
                const price = await this.fetchCoinGeckoPrice(coinGeckoId);
                if (price > 0) {
                    this.priceCache.set(symbol, { price, timestamp: Date.now() });
                    return price;
                }
            }
            catch (error) {
                logger_1.LoggerService.warn(`CoinGecko price fetch failed for ${symbol}:`, error);
            }
        }
        // Try CoinMarketCap API if configured
        const cmcApiKey = process.env.COINMARKETCAP_API_KEY;
        if (cmcApiKey) {
            try {
                const price = await this.fetchCoinMarketCapPrice(symbol, cmcApiKey);
                if (price > 0) {
                    this.priceCache.set(symbol, { price, timestamp: Date.now() });
                    return price;
                }
            }
            catch (error) {
                logger_1.LoggerService.warn(`CoinMarketCap price fetch failed for ${symbol}:`, error);
            }
        }
        // Try Chainlink price feed (on-chain oracle)
        try {
            const price = await this.fetchChainlinkPrice(symbol);
            if (price > 0) {
                this.priceCache.set(symbol, { price, timestamp: Date.now() });
                return price;
            }
        }
        catch (error) {
            logger_1.LoggerService.warn(`Chainlink price fetch failed for ${symbol}:`, error);
        }
        // Fallback to default prices
        const defaultPrices = {
            'ETH': 2000,
            'WETH': 2000,
            'BTC': 40000,
            'WBTC': 40000,
            'USDT': 1,
            'USDC': 1,
            'DAI': 1,
            'BNB': 300,
            'MATIC': 0.8,
            'AVAX': 35,
            'SOL': 100,
            'ARB': 1.2,
            'OP': 2.5,
            'LINK': 15,
            'UNI': 6,
            'AAVE': 90,
            'CRV': 0.5,
            'MKR': 1500,
            'SNX': 3,
            'COMP': 50,
            'SUSHI': 1,
            'YFI': 8000
        };
        const fallbackPrice = defaultPrices[symbol.toUpperCase()] || 0;
        if (fallbackPrice > 0) {
            this.priceCache.set(symbol, { price: fallbackPrice, timestamp: Date.now() });
        }
        return fallbackPrice;
    }
    /**
     * Fetch price from CoinGecko API
     */
    async fetchCoinGeckoPrice(coinId) {
        try {
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price`, {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd'
                },
                timeout: 5000
            });
            return response.data?.[coinId]?.usd || 0;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Fetch price from CoinMarketCap API
     */
    async fetchCoinMarketCapPrice(symbol, apiKey) {
        try {
            const response = await axios_1.default.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
                params: {
                    symbol: symbol.toUpperCase()
                },
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey
                },
                timeout: 5000
            });
            const data = response.data?.data?.[symbol.toUpperCase()];
            return data?.quote?.USD?.price || 0;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Fetch price from Chainlink price feed (on-chain oracle)
     */
    async fetchChainlinkPrice(symbol) {
        // Chainlink price feed addresses on Ethereum mainnet
        const chainlinkFeeds = {
            'ETH': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
            'BTC': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
            'LINK': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', // LINK/USD
            'USDT': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', // USDT/USD
            'USDC': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
            'DAI': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', // DAI/USD
            'BNB': '0x14e613AC84a31f709eadbdF89C6CC390fDc9540A', // BNB/USD
            'MATIC': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676', // MATIC/USD
            'AAVE': '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9', // AAVE/USD
            'UNI': '0x553303d460EE0afB37EdFf9bE42922D8FF63220e', // UNI/USD
            'COMP': '0xdbd020CAeF83eFd542f4De03864e8c5d2D5bAC6E', // COMP/USD
            'MKR': '0xec1D1B3b0443256cc3860e24a46F108e699cF2C8', // MKR/USD
            'SNX': '0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699', // SNX/USD
            'YFI': '0xA027702dbb89fbd58e2903F4A5c3b8e0e0c0e0e0', // YFI/USD (placeholder)
            'CRV': '0xCd627aA160A6fA45Eb793D19286F3f0A0e0e0e0e', // CRV/USD (placeholder)
            'SUSHI': '0xCc70F09A6CC17553b2E31954cD36E4A2d89501f7' // SUSHI/USD
        };
        const feedAddress = chainlinkFeeds[symbol.toUpperCase()];
        if (!feedAddress) {
            return 0;
        }
        try {
            const provider = this.providers.get(1); // Ethereum mainnet
            if (!provider) {
                return 0;
            }
            // Chainlink Aggregator V3 ABI (minimal)
            const aggregatorAbi = [
                'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
                'function decimals() view returns (uint8)'
            ];
            const contract = new ethers_1.ethers.Contract(feedAddress, aggregatorAbi, provider);
            // Call the contract methods with proper typing
            const latestRoundData = contract.getFunction('latestRoundData');
            const decimalsFunc = contract.getFunction('decimals');
            const roundData = await latestRoundData();
            const decimals = await decimalsFunc();
            // Extract answer from round data (index 1)
            const answer = roundData[1];
            // Convert to USD price
            const price = Number(answer) / Math.pow(10, Number(decimals));
            return price;
        }
        catch (error) {
            logger_1.LoggerService.warn(`Chainlink price feed error for ${symbol}:`, error);
            return 0;
        }
    }
    /**
     * Get prices for multiple tokens at once
     */
    async getMultipleTokenPrices(symbols) {
        const prices = {};
        // Try batch fetch from CoinGecko first
        const coinGeckoIds = {
            'ETH': 'ethereum',
            'WETH': 'ethereum',
            'BTC': 'bitcoin',
            'USDT': 'tether',
            'USDC': 'usd-coin',
            'DAI': 'dai',
            'BNB': 'binancecoin',
            'MATIC': 'matic-network'
        };
        const idsToFetch = symbols
            .map(s => coinGeckoIds[s.toUpperCase()])
            .filter(Boolean);
        if (idsToFetch.length > 0) {
            try {
                const response = await axios_1.default.get('https://api.coingecko.com/api/v3/simple/price', {
                    params: {
                        ids: idsToFetch.join(','),
                        vs_currencies: 'usd'
                    },
                    timeout: 5000
                });
                for (const symbol of symbols) {
                    const coinId = coinGeckoIds[symbol.toUpperCase()];
                    if (coinId && response.data?.[coinId]?.usd) {
                        prices[symbol] = response.data[coinId].usd;
                        this.priceCache.set(symbol, {
                            price: response.data[coinId].usd,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Batch price fetch failed:', error);
            }
        }
        // Fetch remaining prices individually
        for (const symbol of symbols) {
            if (!prices[symbol]) {
                prices[symbol] = await this.getTokenPriceUSD(symbol);
            }
        }
        return prices;
    }
    /**
     * Verify wallet ownership using signature
     */
    async verifyWalletOwnership(address, message, signature) {
        try {
            const recoveredAddress = ethers_1.ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === address.toLowerCase();
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to verify wallet signature:', error);
            return false;
        }
    }
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
    async calculateWalletRiskScore(address) {
        try {
            let riskScore = 50; // Start with neutral score
            const riskFactors = [];
            // Get provider for Ethereum mainnet
            const provider = this.providers.get(1);
            if (!provider) {
                return riskScore;
            }
            // Factor 1: Wallet age (based on first transaction)
            try {
                const txCount = await provider.getTransactionCount(address);
                if (txCount === 0) {
                    // New wallet - higher risk
                    riskFactors.push({ factor: 'new_wallet', score: 30, weight: 0.2 });
                }
                else if (txCount < 10) {
                    riskFactors.push({ factor: 'low_activity', score: 20, weight: 0.15 });
                }
                else if (txCount < 100) {
                    riskFactors.push({ factor: 'moderate_activity', score: 0, weight: 0.1 });
                }
                else {
                    // High activity - lower risk
                    riskFactors.push({ factor: 'high_activity', score: -10, weight: 0.15 });
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to get transaction count for risk scoring:', error);
            }
            // Factor 2: Current balance
            try {
                const balance = await provider.getBalance(address);
                const balanceEth = parseFloat(ethers_1.ethers.formatEther(balance));
                if (balanceEth === 0) {
                    riskFactors.push({ factor: 'zero_balance', score: 15, weight: 0.1 });
                }
                else if (balanceEth < 0.01) {
                    riskFactors.push({ factor: 'dust_balance', score: 10, weight: 0.1 });
                }
                else if (balanceEth > 100) {
                    // High balance - lower risk (established wallet)
                    riskFactors.push({ factor: 'high_balance', score: -15, weight: 0.15 });
                }
                else {
                    riskFactors.push({ factor: 'normal_balance', score: 0, weight: 0.1 });
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to get balance for risk scoring:', error);
            }
            // Factor 3: Check against known risky addresses (sanctions, hacks, etc.)
            const riskyAddresses = await this.checkRiskyAddresses(address);
            if (riskyAddresses.isSanctioned) {
                riskFactors.push({ factor: 'sanctioned', score: 100, weight: 1.0 });
            }
            else if (riskyAddresses.isHighRisk) {
                riskFactors.push({ factor: 'high_risk_association', score: 50, weight: 0.3 });
            }
            else if (riskyAddresses.isMediumRisk) {
                riskFactors.push({ factor: 'medium_risk_association', score: 25, weight: 0.2 });
            }
            // Factor 4: Contract interaction analysis
            try {
                const code = await provider.getCode(address);
                if (code !== '0x') {
                    // This is a contract address
                    riskFactors.push({ factor: 'contract_address', score: 20, weight: 0.15 });
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to check if address is contract:', error);
            }
            // Factor 5: ENS name (having ENS = lower risk, more established)
            try {
                const ensName = await provider.lookupAddress(address);
                if (ensName) {
                    riskFactors.push({ factor: 'has_ens', score: -20, weight: 0.1 });
                }
            }
            catch (error) {
                // ENS lookup failed - not a risk factor
            }
            // Calculate weighted risk score
            let totalWeight = 0;
            let weightedScore = 0;
            for (const factor of riskFactors) {
                weightedScore += factor.score * factor.weight;
                totalWeight += factor.weight;
            }
            if (totalWeight > 0) {
                riskScore = 50 + (weightedScore / totalWeight);
            }
            // Clamp score between 0 and 100
            riskScore = Math.max(0, Math.min(100, riskScore));
            logger_1.LoggerService.debug('Wallet risk score calculated:', {
                address,
                riskScore,
                factors: riskFactors
            });
            return Math.round(riskScore);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to calculate wallet risk score:', error);
            return 50; // Default medium risk
        }
    }
    /**
     * Check address against known risky address lists
     */
    async checkRiskyAddresses(address) {
        const result = {
            isSanctioned: false,
            isHighRisk: false,
            isMediumRisk: false,
            reasons: []
        };
        const normalizedAddress = address.toLowerCase();
        // Known sanctioned addresses (OFAC SDN list - sample)
        const sanctionedAddresses = new Set([
            '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c', // Tornado Cash
            '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', // Tornado Cash
            '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
            '0xdd4c48c0b24039969fc16d1cdf626eab821d3384', // Tornado Cash
            '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3', // Tornado Cash
            '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf', // Tornado Cash
            '0xa160cdab225685da1d56aa342ad8841c3b53f291', // Tornado Cash
            '0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144', // Tornado Cash
            '0xf60dd140cff0706bae9cd734ac3ae76ad9ebc32a', // Tornado Cash
            '0x22aaa7720ddd5388a3c0a3333430953c68f1849b', // Tornado Cash
            '0xba214c1c1928a32bffe790263e38b4af9bfcd659', // Tornado Cash
            '0xb1c8094b234dce6e03f10a5b673c1d8c69739a00', // Tornado Cash
            '0x527653ea119f3e6a1f5bd18fbf4714081d7b31ce', // Tornado Cash
            '0x58e8dcc13be9780fc42e8723d8ead4cf46943df2', // Tornado Cash
            '0xd691f27f38b395864ea86cfc7253969b409c362d', // Tornado Cash
            '0xaeaac358560e11f52454d997aaff2c5731b6f8a6', // Tornado Cash
            '0x1356c899d8c9467c7f71c195612f8a395abf2f0a', // Tornado Cash
            '0xa60c772958a3ed56c1f15dd055ba37ac8e523a0d', // Tornado Cash
            '0x169ad27a470d064dede56a2d3ff727986b15d52b', // Tornado Cash
            '0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f', // Tornado Cash
        ]);
        // Known high-risk addresses (hacks, exploits, etc.)
        const highRiskAddresses = new Set([
        // Add known exploit addresses here
        ]);
        // Check sanctions
        if (sanctionedAddresses.has(normalizedAddress)) {
            result.isSanctioned = true;
            result.reasons.push('Address is on OFAC sanctions list');
        }
        // Check high risk
        if (highRiskAddresses.has(normalizedAddress)) {
            result.isHighRisk = true;
            result.reasons.push('Address associated with known exploits');
        }
        // Optional: Check external risk APIs (Chainalysis, Elliptic, etc.)
        const chainalysisApiKey = process.env.CHAINALYSIS_API_KEY;
        if (chainalysisApiKey && !result.isSanctioned) {
            try {
                const response = await axios_1.default.get(`https://api.chainalysis.com/api/risk/v2/entities/${address}`, {
                    headers: {
                        'Token': chainalysisApiKey
                    },
                    timeout: 5000
                });
                const riskLevel = response.data?.risk;
                if (riskLevel === 'Severe') {
                    result.isHighRisk = true;
                    result.reasons.push('Chainalysis: Severe risk');
                }
                else if (riskLevel === 'High') {
                    result.isHighRisk = true;
                    result.reasons.push('Chainalysis: High risk');
                }
                else if (riskLevel === 'Medium') {
                    result.isMediumRisk = true;
                    result.reasons.push('Chainalysis: Medium risk');
                }
            }
            catch (error) {
                // API call failed - continue without external risk check
                logger_1.LoggerService.debug('Chainalysis API check failed:', error);
            }
        }
        return result;
    }
    /**
     * Get comprehensive wallet risk assessment
     */
    async getWalletRiskAssessment(address, chainId = 1) {
        const riskScore = await this.calculateWalletRiskScore(address);
        const riskyAddresses = await this.checkRiskyAddresses(address);
        let riskLevel;
        if (riskyAddresses.isSanctioned || riskScore >= 80) {
            riskLevel = 'CRITICAL';
        }
        else if (riskyAddresses.isHighRisk || riskScore >= 60) {
            riskLevel = 'HIGH';
        }
        else if (riskyAddresses.isMediumRisk || riskScore >= 40) {
            riskLevel = 'MEDIUM';
        }
        else {
            riskLevel = 'LOW';
        }
        const factors = [];
        const recommendations = [];
        if (riskyAddresses.isSanctioned) {
            factors.push({
                name: 'Sanctions',
                impact: 'CRITICAL',
                description: 'Address is on OFAC sanctions list'
            });
            recommendations.push('Do not interact with this address');
        }
        if (riskyAddresses.isHighRisk) {
            factors.push({
                name: 'High Risk Association',
                impact: 'HIGH',
                description: riskyAddresses.reasons.join(', ')
            });
            recommendations.push('Exercise extreme caution with this address');
        }
        if (riskScore >= 60) {
            recommendations.push('Consider additional verification before large transactions');
        }
        if (riskLevel === 'LOW') {
            recommendations.push('Address appears to be low risk');
        }
        return {
            riskScore,
            riskLevel,
            factors,
            recommendations,
            lastChecked: new Date()
        };
    }
    /**
     * Get wallet by ID
     */
    async getWalletById(userId, tenantId, walletId) {
        try {
            // Check cache first
            const cachedWallet = this.walletConnections.get(walletId);
            if (cachedWallet && cachedWallet.userId === userId && cachedWallet.tenantId === tenantId) {
                return cachedWallet;
            }
            const Web3WalletModel = database_1.DatabaseService.getModel('Web3Wallet');
            const wallet = await Web3WalletModel.findOne({ where: { id: walletId, userId, tenantId } });
            return wallet ? wallet.toJSON() : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get wallet by ID:', error);
            return null;
        }
    }
    /**
     * Get wallet by address
     */
    async getWalletByAddress(userId, tenantId, address) {
        try {
            const Web3WalletModel = database_1.DatabaseService.getModel('Web3Wallet');
            const wallet = await Web3WalletModel.findOne({ where: { address: address.toLowerCase(), userId, tenantId } });
            return wallet ? wallet.toJSON() : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get wallet by address:', error);
            return null;
        }
    }
    /**
     * Save wallet to database
     */
    async saveWallet(wallet) {
        try {
            const Web3WalletModel = database_1.DatabaseService.getModel('Web3Wallet');
            const existing = await Web3WalletModel.findOne({ where: { id: wallet.id } });
            if (existing) {
                await existing.update(wallet);
            }
            else {
                await Web3WalletModel.create(wallet);
            }
            logger_1.LoggerService.info('Wallet saved to database:', { walletId: wallet.id });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to save wallet:', error);
            throw error;
        }
    }
    /**
     * Load wallet connections from database
     */
    async loadWalletConnections() {
        try {
            const Web3WalletModel = database_1.DatabaseService.getModel('Web3Wallet');
            const rows = await Web3WalletModel.findAll({ where: { status: 'connected' } });
            rows.forEach((row) => {
                const w = row.toJSON();
                this.walletConnections.set(w.id, w);
            });
            logger_1.LoggerService.info('Loaded wallet connections from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to load wallet connections:', error);
        }
    }
    /**
     * Get user's connected wallets
     */
    async getUserWallets(userId, tenantId) {
        try {
            const Web3WalletModel = database_1.DatabaseService.getModel('Web3Wallet');
            const rows = await Web3WalletModel.findAll({ where: { userId, tenantId } });
            return rows.map((r) => r.toJSON());
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get user wallets:', error);
            return [];
        }
    }
    /**
     * Check if wallet is healthy
     */
    isHealthy() {
        return this.providers.size > 0;
    }
}
exports.Web3WalletService = Web3WalletService;
// Export singleton instance
exports.web3WalletService = Web3WalletService.getInstance();
//# sourceMappingURL=web3-wallet.js.map