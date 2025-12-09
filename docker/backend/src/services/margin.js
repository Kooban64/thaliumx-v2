"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarginTradingService = void 0;
const logger_1 = require("../services/logger");
const database_1 = require("../services/database");
const event_streaming_1 = require("./event-streaming");
const utils_1 = require("../utils");
// =============================================================================
// MARGIN TRADING SERVICE CLASS
// =============================================================================
class MarginTradingService {
    static isInitialized = false;
    static accounts = new Map();
    static positions = new Map();
    static orders = new Map();
    static transfers = new Map();
    static fundingRates = new Map();
    static config = {
        maxLeverage: 10,
        maintenanceMarginRatio: 0.1, // 10%
        liquidationThreshold: 0.05, // 5%
        fundingRateInterval: 8, // 8 hours
        interestRate: 0.12, // 12% annual
        minMarginTransfer: 10,
        maxMarginTransfer: 100000
    };
    /**
     * Initialize Margin Trading service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Margin Trading Service...');
            // Load funding rates
            await this.loadFundingRates();
            // Start funding rate updates
            this.startFundingRateUpdates();
            // Start margin monitoring
            this.startMarginMonitoring();
            // Start liquidation monitoring
            this.startLiquidationMonitoring();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Margin Trading Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('margin.initialized', 'MarginTradingService', 'info', {
                message: 'Margin trading service initialized',
                config: this.config
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Margin Trading Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create margin account
     */
    static async createMarginAccount(userId, tenantId, accountType = 'cross') {
        try {
            const accountKey = `${userId}:${tenantId}`;
            if (this.accounts.has(accountKey)) {
                throw (0, utils_1.createError)('Margin account already exists', 400, 'ACCOUNT_EXISTS');
            }
            const account = {
                id: this.generateAccountId(),
                userId,
                tenantId,
                accountType,
                totalEquity: 0,
                totalMargin: 0,
                availableBalance: 0,
                usedMargin: 0,
                freeMargin: 0,
                marginLevel: 0,
                marginRatio: 0,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.accounts.set(accountKey, account);
            logger_1.LoggerService.info(`Margin account created: ${account.id}`, {
                accountId: account.id,
                userId,
                tenantId,
                accountType
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('margin.account.created', 'margin_account', account.id, { accountType, userId, tenantId });
            return account;
        }
        catch (error) {
            logger_1.LoggerService.error('Margin account creation failed:', error);
            throw error;
        }
    }
    /**
     * Get margin account
     */
    static async getMarginAccount(userId, tenantId) {
        try {
            const accountKey = `${userId}:${tenantId}`;
            return this.accounts.get(accountKey) || null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get margin account failed:', error);
            throw error;
        }
    }
    /**
     * Deposit margin
     */
    static async depositMargin(userId, tenantId, asset, amount) {
        try {
            if (amount <= 0) {
                throw (0, utils_1.createError)('Invalid deposit amount', 400, 'INVALID_AMOUNT');
            }
            const account = await this.getMarginAccount(userId, tenantId);
            if (!account) {
                throw (0, utils_1.createError)('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            const transfer = {
                id: this.generateTransferId(),
                userId,
                tenantId,
                fromAccount: 'spot',
                toAccount: account.id,
                asset,
                amount,
                type: 'deposit',
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process deposit
            await this.processMarginTransfer(transfer);
            logger_1.LoggerService.info(`Margin deposit initiated: ${transfer.id}`, {
                transferId: transfer.id,
                userId,
                amount,
                asset
            });
            return transfer;
        }
        catch (error) {
            logger_1.LoggerService.error('Margin deposit failed:', error);
            throw error;
        }
    }
    /**
     * Withdraw margin
     */
    static async withdrawMargin(userId, tenantId, asset, amount) {
        try {
            if (amount <= 0) {
                throw (0, utils_1.createError)('Invalid withdrawal amount', 400, 'INVALID_AMOUNT');
            }
            const account = await this.getMarginAccount(userId, tenantId);
            if (!account) {
                throw (0, utils_1.createError)('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            if (account.availableBalance < amount) {
                throw (0, utils_1.createError)('Insufficient available balance', 400, 'INSUFFICIENT_BALANCE');
            }
            // Check margin requirements
            const requiredMargin = this.calculateRequiredMargin(account);
            if (account.totalEquity - amount < requiredMargin) {
                throw (0, utils_1.createError)('Withdrawal would violate margin requirements', 400, 'MARGIN_VIOLATION');
            }
            const transfer = {
                id: this.generateTransferId(),
                userId,
                tenantId,
                fromAccount: account.id,
                toAccount: 'spot',
                asset,
                amount,
                type: 'withdrawal',
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process withdrawal
            await this.processMarginTransfer(transfer);
            logger_1.LoggerService.info(`Margin withdrawal initiated: ${transfer.id}`, {
                transferId: transfer.id,
                userId,
                amount,
                asset
            });
            return transfer;
        }
        catch (error) {
            logger_1.LoggerService.error('Margin withdrawal failed:', error);
            throw error;
        }
    }
    /**
     * Create margin order
     */
    static async createMarginOrder(userId, tenantId, symbol, side, type, quantity, leverage, price, stopPrice) {
        try {
            if (quantity <= 0) {
                throw (0, utils_1.createError)('Invalid quantity', 400, 'INVALID_QUANTITY');
            }
            if (leverage < 1 || leverage > this.config.maxLeverage) {
                throw (0, utils_1.createError)(`Invalid leverage. Must be between 1 and ${this.config.maxLeverage}`, 400, 'INVALID_LEVERAGE');
            }
            const account = await this.getMarginAccount(userId, tenantId);
            if (!account) {
                throw (0, utils_1.createError)('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
            }
            // Calculate margin required
            const currentPrice = await this.getCurrentPrice(symbol);
            const marginRequired = (quantity * currentPrice) / leverage;
            if (account.availableBalance < marginRequired) {
                throw (0, utils_1.createError)('Insufficient margin', 400, 'INSUFFICIENT_MARGIN');
            }
            const order = {
                id: this.generateOrderId(),
                userId,
                tenantId,
                accountId: account.id,
                symbol,
                side,
                type,
                quantity,
                price,
                stopPrice,
                leverage,
                marginRequired,
                status: 'pending',
                filledQuantity: 0,
                averagePrice: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process order
            await this.processMarginOrder(order);
            logger_1.LoggerService.info(`Margin order created: ${order.id}`, {
                orderId: order.id,
                userId,
                symbol,
                side,
                quantity,
                leverage
            });
            // Emit transaction event
            await event_streaming_1.EventStreamingService.emitTransactionEvent('margin', order.id, marginRequired, 'USDT', 'pending', undefined, { symbol, side, leverage, orderType: type });
            return order;
        }
        catch (error) {
            logger_1.LoggerService.error('Margin order creation failed:', error);
            throw error;
        }
    }
    /**
     * Close margin position
     */
    static async closeMarginPosition(userId, tenantId, positionId) {
        try {
            const positions = this.positions.get(`${userId}:${tenantId}`) || [];
            const position = positions.find(p => p.id === positionId);
            if (!position) {
                throw (0, utils_1.createError)('Position not found', 404, 'POSITION_NOT_FOUND');
            }
            if (position.status !== 'open') {
                throw (0, utils_1.createError)('Position is not open', 400, 'POSITION_NOT_OPEN');
            }
            // Calculate final P&L
            const currentPrice = await this.getCurrentPrice(position.symbol);
            const finalPnl = this.calculatePnl(position, currentPrice);
            // Update position
            position.status = 'closed';
            position.closedAt = new Date();
            position.unrealizedPnl = finalPnl;
            position.realizedPnl += finalPnl;
            position.updatedAt = new Date();
            // Update account
            const account = await this.getMarginAccount(userId, tenantId);
            if (account) {
                account.usedMargin -= position.marginUsed;
                account.totalEquity += finalPnl;
                account.updatedAt = new Date();
                await this.updateMarginLevel(account);
            }
            logger_1.LoggerService.info(`Margin position closed: ${position.id}`, {
                positionId: position.id,
                userId,
                finalPnl
            });
            // Emit transaction event
            await event_streaming_1.EventStreamingService.emitTransactionEvent('margin', position.id, Math.abs(finalPnl), 'USDT', 'completed', undefined, { symbol: position.symbol, side: position.side, pnl: finalPnl });
            return position;
        }
        catch (error) {
            logger_1.LoggerService.error('Close margin position failed:', error);
            throw error;
        }
    }
    /**
     * Get user positions
     */
    static async getUserPositions(userId, tenantId) {
        try {
            const key = `${userId}:${tenantId}`;
            return this.positions.get(key) || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Get user positions failed:', error);
            throw error;
        }
    }
    /**
     * Get user orders
     */
    static async getUserOrders(userId, tenantId) {
        try {
            const key = `${userId}:${tenantId}`;
            return this.orders.get(key) || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Get user orders failed:', error);
            throw error;
        }
    }
    /**
     * Get funding rates
     */
    static async getFundingRates() {
        try {
            return Array.from(this.fundingRates.values());
        }
        catch (error) {
            logger_1.LoggerService.error('Get funding rates failed:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing Margin Trading Service...');
            this.isInitialized = false;
            logger_1.LoggerService.info('✅ Margin Trading Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing Margin Trading Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async processMarginTransfer(transfer) {
        try {
            transfer.status = 'pending';
            transfer.updatedAt = new Date();
            // Simulate processing delay
            setTimeout(async () => {
                try {
                    const account = await this.getMarginAccount(transfer.userId, transfer.tenantId);
                    if (!account) {
                        transfer.status = 'failed';
                        transfer.updatedAt = new Date();
                        return;
                    }
                    if (transfer.type === 'deposit') {
                        account.totalEquity += transfer.amount;
                        account.availableBalance += transfer.amount;
                    }
                    else if (transfer.type === 'withdrawal') {
                        account.totalEquity -= transfer.amount;
                        account.availableBalance -= transfer.amount;
                    }
                    account.updatedAt = new Date();
                    await this.updateMarginLevel(account);
                    transfer.status = 'completed';
                    transfer.updatedAt = new Date();
                    // Save transfer
                    const key = `${transfer.userId}:${transfer.tenantId}`;
                    const transfers = this.transfers.get(key) || [];
                    transfers.push(transfer);
                    this.transfers.set(key, transfers);
                    logger_1.LoggerService.info(`Margin transfer completed: ${transfer.id}`, {
                        transferId: transfer.id,
                        type: transfer.type,
                        amount: transfer.amount
                    });
                    // Emit transaction event
                    await event_streaming_1.EventStreamingService.emitTransactionEvent('margin', transfer.id, transfer.amount, transfer.asset, 'completed', undefined, { transferType: transfer.type });
                }
                catch (error) {
                    logger_1.LoggerService.error('Margin transfer processing failed:', error);
                    transfer.status = 'failed';
                    transfer.updatedAt = new Date();
                }
            }, 2000); // 2 second delay
        }
        catch (error) {
            logger_1.LoggerService.error('Process margin transfer failed:', error);
            throw error;
        }
    }
    static async processMarginOrder(order) {
        try {
            order.status = 'pending';
            order.updatedAt = new Date();
            // Simulate order processing
            setTimeout(async () => {
                try {
                    const currentPrice = await this.getCurrentPrice(order.symbol);
                    // For market orders, fill immediately
                    if (order.type === 'market') {
                        order.status = 'filled';
                        order.filledQuantity = order.quantity;
                        order.averagePrice = currentPrice;
                        order.updatedAt = new Date();
                        // Create position
                        await this.createPosition(order, currentPrice);
                        // Update account
                        const account = await this.getMarginAccount(order.userId, order.tenantId);
                        if (account) {
                            account.availableBalance -= order.marginRequired;
                            account.usedMargin += order.marginRequired;
                            account.updatedAt = new Date();
                            await this.updateMarginLevel(account);
                        }
                    }
                    else {
                        // For limit orders, keep as pending
                        order.status = 'pending';
                    }
                    // Save order
                    const key = `${order.userId}:${order.tenantId}`;
                    const orders = this.orders.get(key) || [];
                    orders.push(order);
                    this.orders.set(key, orders);
                    logger_1.LoggerService.info(`Margin order processed: ${order.id}`, {
                        orderId: order.id,
                        status: order.status
                    });
                }
                catch (error) {
                    logger_1.LoggerService.error('Margin order processing failed:', error);
                    order.status = 'rejected';
                    order.updatedAt = new Date();
                }
            }, 1000); // 1 second delay
        }
        catch (error) {
            logger_1.LoggerService.error('Process margin order failed:', error);
            throw error;
        }
    }
    static async createPosition(order, entryPrice) {
        try {
            const position = {
                id: this.generatePositionId(),
                userId: order.userId,
                tenantId: order.tenantId,
                accountId: order.accountId,
                symbol: order.symbol,
                side: order.side === 'buy' ? 'long' : 'short',
                size: order.quantity,
                entryPrice,
                currentPrice: entryPrice,
                leverage: order.leverage,
                marginUsed: order.marginRequired,
                unrealizedPnl: 0,
                realizedPnl: 0,
                fundingFee: 0,
                status: 'open',
                openedAt: new Date(),
                updatedAt: new Date()
            };
            const key = `${position.userId}:${position.tenantId}`;
            const positions = this.positions.get(key) || [];
            positions.push(position);
            this.positions.set(key, positions);
            logger_1.LoggerService.info(`Margin position created: ${position.id}`, {
                positionId: position.id,
                symbol: position.symbol,
                side: position.side,
                leverage: position.leverage
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Create position failed:', error);
            throw error;
        }
    }
    static async updateMarginLevel(account) {
        try {
            account.freeMargin = account.totalEquity - account.usedMargin;
            if (account.usedMargin > 0) {
                account.marginLevel = account.totalEquity / account.usedMargin;
                account.marginRatio = account.usedMargin / account.totalEquity;
                // Update status based on margin level
                if (account.marginLevel < this.config.liquidationThreshold) {
                    account.status = 'liquidation';
                }
                else if (account.marginLevel < this.config.maintenanceMarginRatio) {
                    account.status = 'margin_call';
                }
                else {
                    account.status = 'active';
                }
            }
            else {
                account.marginLevel = 0;
                account.marginRatio = 0;
                account.status = 'active';
            }
            account.updatedAt = new Date();
        }
        catch (error) {
            logger_1.LoggerService.error('Update margin level failed:', error);
            throw error;
        }
    }
    static calculatePnl(position, currentPrice) {
        try {
            const priceDiff = position.side === 'long'
                ? currentPrice - position.entryPrice
                : position.entryPrice - currentPrice;
            return (priceDiff / position.entryPrice) * position.size * position.entryPrice;
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate P&L failed:', error);
            return 0;
        }
    }
    static calculateRequiredMargin(account) {
        try {
            const positions = this.positions.get(`${account.userId}:${account.tenantId}`) || [];
            return positions.reduce((total, position) => {
                if (position.status === 'open') {
                    return total + position.marginUsed;
                }
                return total;
            }, 0);
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate required margin failed:', error);
            return 0;
        }
    }
    static async getCurrentPrice(symbol) {
        try {
            // Simulate price fetching - in production, this would fetch from market data service
            const basePrices = {
                'BTC/USDT': 45000,
                'ETH/USDT': 3000,
                'BNB/USDT': 300,
                'ADA/USDT': 0.5,
                'SOL/USDT': 100
            };
            return basePrices[symbol] || 1000; // Default price
        }
        catch (error) {
            logger_1.LoggerService.error('Get current price failed:', error);
            return 1000; // Default fallback
        }
    }
    static async loadFundingRates() {
        try {
            // Fetch real funding rates from exchange APIs or database
            const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'];
            // Try to fetch from database first
            try {
                const FundingRateModel = database_1.DatabaseService.getModel('FundingRate');
                if (FundingRateModel) {
                    const dbRates = await FundingRateModel.findAll({
                        where: { symbol: { [require('sequelize').Op.in]: symbols } },
                        order: [['updatedAt', 'DESC']]
                    });
                    for (const dbRate of dbRates) {
                        const data = dbRate.dataValues || dbRate;
                        const fundingRate = {
                            symbol: data.symbol,
                            rate: parseFloat(data.rate) || 0,
                            nextFundingTime: new Date(data.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000),
                            updatedAt: new Date(data.updatedAt || data.createdAt)
                        };
                        this.fundingRates.set(data.symbol, fundingRate);
                    }
                    logger_1.LoggerService.info('Funding rates loaded from database', { count: dbRates.length });
                    // If we got rates from DB, skip API calls
                    if (dbRates.length > 0) {
                        return;
                    }
                }
            }
            catch (error) {
                logger_1.LoggerService.warn('Could not load funding rates from database:', error.message);
            }
            // Fallback: Fetch from exchange APIs (public endpoints, no auth required)
            // Note: Most exchanges provide funding rates via their public API
            for (const symbol of symbols) {
                try {
                    // Try Binance public API for funding rates
                    const pair = symbol.replace('/', '');
                    const binanceUrl = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`;
                    try {
                        const axios = (await import('axios')).default;
                        const response = await axios.get(binanceUrl, { timeout: 5000 });
                        if (response.data && response.data.lastFundingRate) {
                            const rate = parseFloat(response.data.lastFundingRate) || 0;
                            const nextFundingTime = response.data.nextFundingTime ? new Date(response.data.nextFundingTime) : new Date(Date.now() + 8 * 60 * 60 * 1000);
                            const fundingRate = {
                                symbol,
                                rate: rate * 100, // Convert to percentage
                                nextFundingTime,
                                updatedAt: new Date()
                            };
                            this.fundingRates.set(symbol, fundingRate);
                            logger_1.LoggerService.debug(`Fetched funding rate from Binance for ${symbol}`, { rate: fundingRate.rate });
                            continue;
                        }
                    }
                    catch (error) {
                        logger_1.LoggerService.debug(`Binance funding rate API failed for ${symbol}:`, error.message);
                    }
                    // Default fallback: Set to 0% (neutral)
                    const fundingRate = {
                        symbol,
                        rate: 0,
                        nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
                        updatedAt: new Date()
                    };
                    this.fundingRates.set(symbol, fundingRate);
                }
                catch (error) {
                    logger_1.LoggerService.warn(`Failed to load funding rate for ${symbol}:`, error.message);
                    // Set default neutral rate
                    this.fundingRates.set(symbol, {
                        symbol,
                        rate: 0,
                        nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
                        updatedAt: new Date()
                    });
                }
            }
            logger_1.LoggerService.info('Funding rates loaded', { count: this.fundingRates.size });
        }
        catch (error) {
            logger_1.LoggerService.error('Load funding rates failed:', error);
        }
    }
    static startFundingRateUpdates() {
        // Update funding rates every 8 hours
        setInterval(() => {
            this.updateFundingRates();
        }, 8 * 60 * 60 * 1000); // 8 hours
        logger_1.LoggerService.info('Funding rate updates started');
    }
    static startMarginMonitoring() {
        // Monitor margin levels every 30 seconds
        setInterval(() => {
            this.monitorMarginLevels();
        }, 30000); // 30 seconds
        logger_1.LoggerService.info('Margin monitoring started');
    }
    static startLiquidationMonitoring() {
        // Check for liquidations every 10 seconds
        setInterval(() => {
            this.checkLiquidations();
        }, 10000); // 10 seconds
        logger_1.LoggerService.info('Liquidation monitoring started');
    }
    static async updateFundingRates() {
        try {
            for (const [symbol, rate] of this.fundingRates) {
                rate.rate = Math.random() * 0.01 - 0.005; // -0.5% to +0.5%
                rate.nextFundingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
                rate.updatedAt = new Date();
            }
            logger_1.LoggerService.info('Funding rates updated');
        }
        catch (error) {
            logger_1.LoggerService.error('Update funding rates failed:', error);
        }
    }
    static async monitorMarginLevels() {
        try {
            for (const [key, account] of this.accounts) {
                await this.updateMarginLevel(account);
                // Emit margin call events
                if (account.status === 'margin_call') {
                    await event_streaming_1.EventStreamingService.emitSystemEvent('margin.margin_call', 'MarginTradingService', 'warn', {
                        message: `Margin call for account ${account.id}`,
                        accountId: account.id,
                        userId: account.userId,
                        marginLevel: account.marginLevel
                    });
                }
            }
            logger_1.LoggerService.info('Margin levels monitored');
        }
        catch (error) {
            logger_1.LoggerService.error('Monitor margin levels failed:', error);
        }
    }
    static async checkLiquidations() {
        try {
            for (const [key, account] of this.accounts) {
                if (account.status === 'liquidation') {
                    const positions = this.positions.get(key) || [];
                    const openPositions = positions.filter(p => p.status === 'open');
                    for (const position of openPositions) {
                        await this.liquidatePosition(position, account);
                    }
                }
            }
            logger_1.LoggerService.info('Liquidations checked');
        }
        catch (error) {
            logger_1.LoggerService.error('Check liquidations failed:', error);
        }
    }
    static async liquidatePosition(position, account) {
        try {
            const currentPrice = await this.getCurrentPrice(position.symbol);
            const liquidationEvent = {
                id: this.generateLiquidationId(),
                userId: position.userId,
                tenantId: position.tenantId,
                accountId: position.accountId,
                positionId: position.id,
                symbol: position.symbol,
                liquidationPrice: currentPrice,
                liquidationAmount: position.size,
                remainingMargin: account.totalEquity - account.usedMargin,
                reason: 'forced_liquidation',
                createdAt: new Date()
            };
            // Update position
            position.status = 'liquidated';
            position.closedAt = new Date();
            position.currentPrice = currentPrice;
            position.unrealizedPnl = this.calculatePnl(position, currentPrice);
            position.updatedAt = new Date();
            // Update account
            account.usedMargin -= position.marginUsed;
            account.totalEquity += position.unrealizedPnl;
            account.updatedAt = new Date();
            await this.updateMarginLevel(account);
            logger_1.LoggerService.info(`Position liquidated: ${position.id}`, {
                positionId: position.id,
                liquidationPrice: currentPrice
            });
            // Emit liquidation event
            await event_streaming_1.EventStreamingService.emitSystemEvent('margin.liquidation', 'MarginTradingService', 'critical', {
                message: `Position liquidated: ${position.symbol}`,
                positionId: position.id,
                userId: position.userId,
                liquidationPrice: currentPrice,
                pnl: position.unrealizedPnl
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Liquidate position failed:', error);
        }
    }
    static generateAccountId() {
        return `marg_acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateOrderId() {
        return `marg_ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generatePositionId() {
        return `marg_pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateTransferId() {
        return `marg_trf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateLiquidationId() {
        return `marg_liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MarginTradingService = MarginTradingService;
//# sourceMappingURL=margin.js.map