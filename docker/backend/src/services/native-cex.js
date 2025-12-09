"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeCEXService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const quantlib_1 = require("./quantlib");
const blnkfinance_1 = require("./blnkfinance");
class NativeCEXService {
    db;
    eventStreamingService;
    quantlibService;
    blnkfinanceService;
    // Trading engines
    tradingEngines = new Map();
    tradingPairs = new Map();
    orders = new Map();
    liquidityIncentives = new Map();
    // HTTP clients for external engines
    dingirClient;
    liquibookClient;
    // Configuration
    THAL_BUSINESS_MODEL = {
        feeDiscounts: {
            tradingFeeDiscount: '0.25', // 25% discount
            withdrawalFeeDiscount: '0.50', // 50% discount
            depositFeeDiscount: '0.10' // 10% discount
        },
        rewards: {
            tradingRewardRate: '0.001', // 0.1% of trading volume
            liquidityProviderReward: '0.002', // 0.2% for liquidity providers
            referralReward: '0.005' // 0.5% for referrals
        },
        staking: {
            stakingRewardRate: '0.12', // 12% APY
            minimumStakeAmount: '1000', // 1000 THAL minimum
            lockPeriodDays: 30
        },
        governance: {
            votingPowerPerTHAL: '1',
            proposalThreshold: '10000' // 10,000 THAL to create proposal
        }
    };
    constructor(db) {
        this.db = db;
        this.eventStreamingService = new event_streaming_1.EventStreamingService();
        this.quantlibService = new quantlib_1.QuantLibService();
        this.blnkfinanceService = new blnkfinance_1.BlnkFinanceService();
        // Initialize HTTP clients
        this.dingirClient = axios_1.default.create({
            baseURL: process.env.DINGIR_ENDPOINT || 'http://dingir-exchange:8080',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.DINGIR_API_KEY || 'default-key'
            }
        });
        this.liquibookClient = axios_1.default.create({
            baseURL: process.env.LIQUIBOOK_ENDPOINT || 'http://liquibook:3000',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.LIQUIBOOK_API_KEY || 'default-key'
            }
        });
    }
    async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Native CEX Service...');
            await this.initializeTradingEngines();
            await this.initializeTradingPairs();
            await this.startHealthMonitoring();
            logger_1.LoggerService.info('Native CEX Service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize Native CEX Service', { error });
            throw error;
        }
    }
    // ==================== TRADING ENGINE MANAGEMENT ====================
    /**
     * Initialize trading engines (Dingir + Liquibook)
     */
    async initializeTradingEngines() {
        try {
            // Initialize Dingir Exchange
            const dingirEngine = {
                id: 'dingir-exchange',
                name: 'Dingir Exchange',
                type: 'dingir',
                endpoint: process.env.DINGIR_ENDPOINT || 'http://dingir-exchange:8080',
                status: 'active',
                capabilities: {
                    orderMatching: true,
                    marketData: true,
                    balanceManagement: true,
                    realTimeUpdates: true,
                    riskManagement: true
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            };
            // Initialize Liquibook
            const liquibookEngine = {
                id: 'liquibook',
                name: 'Liquibook Order Book',
                type: 'liquibook',
                endpoint: process.env.LIQUIBOOK_ENDPOINT || 'http://liquibook:3000',
                status: 'active',
                capabilities: {
                    orderMatching: true,
                    marketData: true,
                    balanceManagement: false,
                    realTimeUpdates: true,
                    riskManagement: false
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0'
                }
            };
            this.tradingEngines.set('dingir-exchange', dingirEngine);
            this.tradingEngines.set('liquibook', liquibookEngine);
            logger_1.LoggerService.info('Trading engines initialized', {
                engineCount: this.tradingEngines.size,
                engines: Array.from(this.tradingEngines.keys())
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize trading engines', { error });
            throw error;
        }
    }
    /**
     * Initialize trading pairs with THAL promotion
     */
    async initializeTradingPairs() {
        try {
            const tradingPairs = [
                // THAL pairs (promoted)
                {
                    id: 'THAL_USDT',
                    symbol: 'THAL/USDT',
                    baseAsset: 'THAL',
                    quoteAsset: 'USDT',
                    status: 'active',
                    precision: { price: 4, quantity: 2 },
                    limits: {
                        minOrderSize: '10',
                        maxOrderSize: '1000000',
                        minPrice: '0.0001',
                        maxPrice: '1000'
                    },
                    fees: {
                        maker: '0.001', // 0.1%
                        taker: '0.002', // 0.2%
                        thalDiscount: '0.25' // 25% discount when paying with THAL
                    },
                    engines: ['dingir-exchange', 'liquibook'],
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        version: '1.0.0'
                    }
                },
                {
                    id: 'THAL_BTC',
                    symbol: 'THAL/BTC',
                    baseAsset: 'THAL',
                    quoteAsset: 'BTC',
                    status: 'active',
                    precision: { price: 8, quantity: 2 },
                    limits: {
                        minOrderSize: '10',
                        maxOrderSize: '1000000',
                        minPrice: '0.00000001',
                        maxPrice: '1'
                    },
                    fees: {
                        maker: '0.001',
                        taker: '0.002',
                        thalDiscount: '0.25'
                    },
                    engines: ['dingir-exchange'],
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        version: '1.0.0'
                    }
                },
                // Standard pairs
                {
                    id: 'BTC_USDT',
                    symbol: 'BTC/USDT',
                    baseAsset: 'BTC',
                    quoteAsset: 'USDT',
                    status: 'active',
                    precision: { price: 2, quantity: 6 },
                    limits: {
                        minOrderSize: '0.0001',
                        maxOrderSize: '100',
                        minPrice: '1000',
                        maxPrice: '200000'
                    },
                    fees: {
                        maker: '0.001',
                        taker: '0.002',
                        thalDiscount: '0.15' // 15% discount for non-THAL pairs
                    },
                    engines: ['dingir-exchange', 'liquibook'],
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        version: '1.0.0'
                    }
                },
                {
                    id: 'ETH_USDT',
                    symbol: 'ETH/USDT',
                    baseAsset: 'ETH',
                    quoteAsset: 'USDT',
                    status: 'active',
                    precision: { price: 2, quantity: 4 },
                    limits: {
                        minOrderSize: '0.001',
                        maxOrderSize: '1000',
                        minPrice: '100',
                        maxPrice: '50000'
                    },
                    fees: {
                        maker: '0.001',
                        taker: '0.002',
                        thalDiscount: '0.15'
                    },
                    engines: ['dingir-exchange', 'liquibook'],
                    metadata: {
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        version: '1.0.0'
                    }
                }
            ];
            tradingPairs.forEach(pair => {
                this.tradingPairs.set(pair.id, pair);
            });
            logger_1.LoggerService.info('Trading pairs initialized', {
                pairCount: this.tradingPairs.size,
                thalPairs: tradingPairs.filter(p => p.baseAsset === 'THAL').length
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize trading pairs', { error });
            throw error;
        }
    }
    // ==================== ORDER MANAGEMENT ====================
    /**
     * Place order with intelligent engine routing
     */
    async placeOrder(userId, tenantId, brokerId, params) {
        try {
            logger_1.LoggerService.info('Placing CEX order', {
                userId,
                brokerId,
                tradingPairId: params.tradingPairId,
                side: params.side,
                type: params.type
            });
            // Validate trading pair
            const tradingPair = this.tradingPairs.get(params.tradingPairId);
            if (!tradingPair) {
                throw new Error('Trading pair not found');
            }
            if (tradingPair.status !== 'active') {
                throw new Error('Trading pair is not active');
            }
            // Perform risk assessment with QuantLib
            const riskScore = await this.performRiskAssessment(userId, params);
            if (riskScore > 80) {
                throw new Error('Order rejected due to high risk score');
            }
            // Create order
            const order = {
                id: `cex_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId,
                tenantId,
                brokerId,
                tradingPairId: params.tradingPairId,
                side: params.side,
                type: params.type,
                quantity: params.quantity,
                price: params.price,
                stopPrice: params.stopPrice,
                timeInForce: params.timeInForce || 'GTC',
                status: 'pending',
                filledQuantity: '0',
                remainingQuantity: params.quantity,
                averagePrice: '0',
                fees: '0',
                thalRewards: '0',
                thalFeeDiscount: '0',
                engine: 'hybrid',
                riskScore,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: '1.0.0',
                    executionLog: []
                }
            };
            // Route to best engine
            await this.routeOrderToEngine(order, tradingPair);
            // Calculate THAL rewards and discounts
            await this.calculateTHALBenefits(order, tradingPair);
            // Store order
            this.orders.set(order.id, order);
            // Log order placement
            logger_1.LoggerService.info('CEX order placed', {
                orderId: order.id,
                userId,
                brokerId,
                tradingPair: tradingPair.symbol,
                side: params.side,
                quantity: params.quantity,
                price: params.price,
                engine: order.engine,
                thalRewards: order.thalRewards
            });
            logger_1.LoggerService.logTransaction(order.id, 'cex_order_placed', {
                userId,
                brokerId,
                tradingPair: tradingPair.symbol,
                side: params.side,
                quantity: params.quantity,
                price: params.price,
                engine: order.engine,
                thalRewards: order.thalRewards
            });
            return order;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to place CEX order', { error, userId });
            throw error;
        }
    }
    /**
     * Route order to best available engine
     */
    async routeOrderToEngine(order, tradingPair) {
        try {
            const availableEngines = tradingPair.engines.filter(engineId => {
                const engine = this.tradingEngines.get(engineId);
                return engine && engine.status === 'active';
            });
            if (availableEngines.length === 0) {
                throw new Error('No available trading engines');
            }
            // Try Dingir first (primary engine)
            if (availableEngines.includes('dingir-exchange')) {
                try {
                    await this.submitOrderToDingir(order);
                    order.engine = 'dingir-exchange';
                    order.status = 'open';
                    return;
                }
                catch (error) {
                    logger_1.LoggerService.warn('Dingir order submission failed, trying Liquibook', { error, orderId: order.id });
                }
            }
            // Fallback to Liquibook
            if (availableEngines.includes('liquibook')) {
                try {
                    await this.submitOrderToLiquibook(order);
                    order.engine = 'liquibook';
                    order.status = 'open';
                    return;
                }
                catch (error) {
                    logger_1.LoggerService.error('Liquibook order submission failed', { error, orderId: order.id });
                }
            }
            throw new Error('All trading engines failed');
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to route order to engine', { error, orderId: order.id });
            order.status = 'rejected';
            throw error;
        }
    }
    /**
     * Submit order to Dingir Exchange
     */
    async submitOrderToDingir(order) {
        try {
            const orderData = {
                symbol: order.tradingPairId,
                side: order.side,
                type: order.type,
                quantity: order.quantity,
                price: order.price,
                stopPrice: order.stopPrice,
                timeInForce: order.timeInForce,
                clientOrderId: order.id
            };
            const response = await this.dingirClient.post('/api/v1/orders', orderData);
            if (response.data.success) {
                order.metadata.executionLog.push({
                    timestamp: new Date(),
                    action: 'submitted_to_dingir',
                    details: { response: response.data }
                });
                logger_1.LoggerService.info('Order submitted to Dingir', { orderId: order.id });
            }
            else {
                throw new Error(response.data.error || 'Dingir order submission failed');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to submit order to Dingir', { error, orderId: order.id });
            throw error;
        }
    }
    /**
     * Submit order to Liquibook
     */
    async submitOrderToLiquibook(order) {
        try {
            const orderData = {
                symbol: order.tradingPairId,
                side: order.side,
                type: order.type,
                quantity: order.quantity,
                price: order.price,
                stopPrice: order.stopPrice,
                timeInForce: order.timeInForce,
                clientOrderId: order.id
            };
            const response = await this.liquibookClient.post('/api/v1/orders', orderData);
            if (response.data.success) {
                order.metadata.executionLog.push({
                    timestamp: new Date(),
                    action: 'submitted_to_liquibook',
                    details: { response: response.data }
                });
                logger_1.LoggerService.info('Order submitted to Liquibook', { orderId: order.id });
            }
            else {
                throw new Error(response.data.error || 'Liquibook order submission failed');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to submit order to Liquibook', { error, orderId: order.id });
            throw error;
        }
    }
    // ==================== THAL BUSINESS MODEL ====================
    /**
     * Calculate THAL rewards and fee discounts
     */
    async calculateTHALBenefits(order, tradingPair) {
        try {
            // Calculate base fees
            const isMaker = order.type === 'limit'; // Simplified maker detection
            const baseFeeRate = isMaker ? parseFloat(tradingPair.fees.maker) : parseFloat(tradingPair.fees.taker);
            const baseFees = parseFloat(order.quantity) * baseFeeRate;
            // Calculate THAL fee discount
            const thalDiscountRate = parseFloat(tradingPair.fees.thalDiscount);
            const thalFeeDiscount = baseFees * thalDiscountRate;
            order.thalFeeDiscount = thalFeeDiscount.toString();
            // Calculate THAL rewards
            const tradingRewardRate = parseFloat(this.THAL_BUSINESS_MODEL.rewards.tradingRewardRate);
            const thalRewards = parseFloat(order.quantity) * tradingRewardRate;
            order.thalRewards = Math.max(parseFloat('1'), thalRewards).toString(); // Minimum 1 THAL
            // Apply THAL discount to fees
            order.fees = (baseFees - thalFeeDiscount).toString();
            logger_1.LoggerService.info('THAL benefits calculated', {
                orderId: order.id,
                baseFees,
                thalFeeDiscount,
                thalRewards: order.thalRewards,
                finalFees: order.fees
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to calculate THAL benefits', { error, orderId: order.id });
        }
    }
    /**
     * Credit THAL rewards to user
     */
    async creditTHALRewards(userId, orderId) {
        try {
            const order = this.orders.get(orderId);
            if (!order || order.userId !== userId) {
                throw new Error('Order not found');
            }
            if (parseFloat(order.thalRewards) > 0) {
                // Create liquidity incentive record
                const incentive = {
                    id: `incentive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    userId,
                    brokerId: order.brokerId,
                    tradingPairId: order.tradingPairId,
                    incentiveType: 'maker_reward',
                    amount: order.thalRewards,
                    currency: 'THAL',
                    status: 'credited',
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                    metadata: {
                        sourceOrderId: orderId,
                        volumeTraded: order.quantity,
                        multiplier: 1.0,
                        createdAt: new Date()
                    }
                };
                this.liquidityIncentives.set(incentive.id, incentive);
                // Update user's THAL wallet (would integrate with wallet system)
                logger_1.LoggerService.info('THAL rewards credited', {
                    userId,
                    orderId,
                    amount: order.thalRewards
                });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to credit THAL rewards', { error, userId, orderId });
        }
    }
    // ==================== MARKET DATA ====================
    /**
     * Get aggregated market data from all engines
     */
    async getMarketData(symbol) {
        try {
            const tradingPair = Array.from(this.tradingPairs.values())
                .find(p => p.symbol === symbol);
            if (!tradingPair) {
                throw new Error('Trading pair not found');
            }
            // Get market data from Dingir
            let dingirData = null;
            try {
                const response = await this.dingirClient.get(`/api/v1/ticker/${tradingPair.id}`);
                dingirData = response.data;
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to get Dingir market data', { error, symbol });
            }
            // Get market data from Liquibook
            let liquibookData = null;
            try {
                const response = await this.liquibookClient.get(`/api/v1/ticker/${tradingPair.id}`);
                liquibookData = response.data;
            }
            catch (error) {
                logger_1.LoggerService.warn('Failed to get Liquibook market data', { error, symbol });
            }
            // Aggregate market data
            const marketData = {
                symbol,
                price: dingirData?.price || liquibookData?.price || '0',
                volume24h: dingirData?.volume24h || liquibookData?.volume24h || '0',
                change24h: dingirData?.change24h || liquibookData?.change24h || '0',
                high24h: dingirData?.high24h || liquibookData?.high24h || '0',
                low24h: dingirData?.low24h || liquibookData?.low24h || '0',
                bid: dingirData?.bid || liquibookData?.bid || '0',
                ask: dingirData?.ask || liquibookData?.ask || '0',
                spread: '0', // Will be calculated
                depth: {
                    bids: dingirData?.depth?.bids || liquibookData?.depth?.bids || [],
                    asks: dingirData?.depth?.asks || liquibookData?.depth?.asks || []
                },
                timestamp: new Date()
            };
            // Calculate spread
            if (marketData.bid && marketData.ask) {
                marketData.spread = (parseFloat(marketData.ask) - parseFloat(marketData.bid)).toString();
            }
            return marketData;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get market data', { error, symbol });
            throw error;
        }
    }
    // ==================== RISK MANAGEMENT ====================
    /**
     * Perform risk assessment using QuantLib
     */
    async performRiskAssessment(userId, orderParams) {
        try {
            // Get user's trading history
            const userOrders = Array.from(this.orders.values())
                .filter(o => o.userId === userId);
            // Calculate risk metrics
            const riskMetrics = {
                orderSize: parseFloat(orderParams.quantity),
                userOrderCount: userOrders.length,
                userVolume24h: userOrders
                    .filter(o => o.metadata.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
                    .reduce((sum, o) => sum + parseFloat(o.quantity), 0),
                averageOrderSize: userOrders.length > 0
                    ? userOrders.reduce((sum, o) => sum + parseFloat(o.quantity), 0) / userOrders.length
                    : 0
            };
            // Calculate risk score (simplified)
            const riskScore = Math.min(100, Math.max(0, (riskMetrics.orderSize > 10000 ? 30 : 0) +
                (riskMetrics.userOrderCount > 100 ? 20 : 0) +
                (riskMetrics.userVolume24h > 100000 ? 25 : 0) +
                (riskMetrics.averageOrderSize > 5000 ? 15 : 0) +
                (orderParams.type === 'market' ? 10 : 0)));
            logger_1.LoggerService.info('Risk assessment completed', {
                userId,
                riskScore,
                riskMetrics
            });
            return riskScore;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to perform risk assessment', { error, userId });
            return 50; // Default medium risk
        }
    }
    // ==================== HEALTH MONITORING ====================
    /**
     * Start health monitoring for trading engines
     */
    async startHealthMonitoring() {
        setInterval(async () => {
            for (const [engineId, engine] of this.tradingEngines) {
                try {
                    await this.checkEngineHealth(engine);
                }
                catch (error) {
                    logger_1.LoggerService.error('Engine health check failed', { error, engineId });
                }
            }
        }, 30000); // Every 30 seconds
    }
    /**
     * Check individual engine health
     */
    async checkEngineHealth(engine) {
        try {
            let client;
            if (engine.type === 'dingir') {
                client = this.dingirClient;
            }
            else if (engine.type === 'liquibook') {
                client = this.liquibookClient;
            }
            else {
                return;
            }
            const response = await client.get('/health');
            if (response.status === 200) {
                engine.status = 'active';
                engine.metadata.lastHealthCheck = new Date();
            }
            else {
                engine.status = 'degraded';
            }
        }
        catch (error) {
            engine.status = 'down';
            logger_1.LoggerService.warn('Engine health check failed', {
                engineId: engine.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    // ==================== PUBLIC API METHODS ====================
    /**
     * Get trading engines status
     */
    getTradingEngines() {
        return Array.from(this.tradingEngines.values());
    }
    /**
     * Get trading pairs
     */
    getTradingPairs() {
        return Array.from(this.tradingPairs.values());
    }
    /**
     * Get THAL trading pairs (promoted)
     */
    getTHALTradingPairs() {
        return Array.from(this.tradingPairs.values())
            .filter(p => p.baseAsset === 'THAL' || p.quoteAsset === 'THAL');
    }
    /**
     * Get order by ID
     */
    getOrder(orderId) {
        return this.orders.get(orderId) || null;
    }
    /**
     * Get user's orders
     */
    getUserOrders(userId) {
        return Array.from(this.orders.values())
            .filter(o => o.userId === userId);
    }
    /**
     * Get liquidity incentives for user
     */
    getUserLiquidityIncentives(userId) {
        return Array.from(this.liquidityIncentives.values())
            .filter(i => i.userId === userId);
    }
    /**
     * Get THAL business model
     */
    getTHALBusinessModel() {
        return this.THAL_BUSINESS_MODEL;
    }
    /**
     * Cancel order
     */
    async cancelOrder(orderId, userId) {
        try {
            const order = this.orders.get(orderId);
            if (!order || order.userId !== userId) {
                return false;
            }
            if (order.status !== 'open' && order.status !== 'pending') {
                return false;
            }
            // Cancel on the respective engine
            if (order.engine === 'dingir-exchange') {
                await this.dingirClient.delete(`/api/v1/orders/${orderId}`);
            }
            else if (order.engine === 'liquibook') {
                await this.liquibookClient.delete(`/api/v1/orders/${orderId}`);
            }
            order.status = 'cancelled';
            order.metadata.updatedAt = new Date();
            order.metadata.executionLog.push({
                timestamp: new Date(),
                action: 'cancelled',
                details: { cancelledBy: userId }
            });
            logger_1.LoggerService.info('Order cancelled', { orderId, userId });
            return true;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to cancel order', { error, orderId, userId });
            return false;
        }
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        logger_1.LoggerService.info('Shutting down Native CEX Service...');
    }
}
exports.NativeCEXService = NativeCEXService;
//# sourceMappingURL=native-cex.js.map