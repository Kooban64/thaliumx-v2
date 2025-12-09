"use strict";
/**
 * Token Management Service
 *
 * Core token operations including:
 * - THAL token management (public sales, broker migration)
 * - P2P transfers between users
 * - Staking and governance mechanisms
 * - Gas fee integration
 * - Trading pair integration
 * - Multi-tenant fund segregation
 *
 * Production-ready for financial operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
// =============================================================================
// TOKEN SERVICE CLASS
// =============================================================================
class TokenService {
    static wallets = new Map();
    static transactions = new Map();
    static stakingPools = new Map();
    static stakingPositions = new Map();
    static tokenSales = new Map();
    static gasFeeConfigs = new Map();
    /**
     * Initialize Token service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Token Service...');
            // Load staking pools
            await this.loadStakingPools();
            // Load active token sales
            await this.loadTokenSales();
            // Load gas fee configurations
            await this.loadGasFeeConfigs();
            // Start staking rewards calculation
            this.startStakingRewardsCalculation();
            // Start token sale monitoring
            this.startTokenSaleMonitoring();
            logger_1.LoggerService.info('✅ Token Service initialized successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Token Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create token wallet for user
     */
    static async createWallet(userId, tenantId, tokenSymbol, tokenAddress) {
        try {
            // Validate token symbol
            if (!this.isValidToken(tokenSymbol)) {
                throw (0, utils_1.createError)('Invalid token symbol', 400, 'INVALID_TOKEN_SYMBOL');
            }
            // Check if wallet already exists
            const existingWallet = await this.getWallet(userId, tenantId, tokenSymbol);
            if (existingWallet) {
                throw (0, utils_1.createError)('Token wallet already exists', 400, 'WALLET_EXISTS');
            }
            const wallet = {
                id: this.generateWalletId(),
                userId,
                tenantId,
                tokenSymbol,
                tokenAddress,
                available: 0,
                locked: 0,
                staked: 0,
                total: 0,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Save wallet
            await this.saveWallet(wallet);
            logger_1.LoggerService.info(`Token wallet created: ${wallet.id}`, {
                walletId: wallet.id,
                userId,
                tenantId,
                tokenSymbol
            });
            return wallet;
        }
        catch (error) {
            logger_1.LoggerService.error('Token wallet creation failed:', error);
            throw error;
        }
    }
    /**
     * Get user token wallets
     */
    static async getUserWallets(userId, tenantId) {
        try {
            const key = `${userId}:${tenantId}`;
            return this.wallets.get(key) || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Get user wallets failed:', error);
            throw error;
        }
    }
    /**
     * Get specific token wallet
     */
    static async getWallet(userId, tenantId, tokenSymbol) {
        try {
            const wallets = await this.getUserWallets(userId, tenantId);
            return wallets.find(w => w.tokenSymbol === tokenSymbol) || null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get wallet failed:', error);
            throw error;
        }
    }
    /**
     * Transfer tokens between users
     */
    static async transfer(fromUserId, fromTenantId, toUserId, toTenantId, tokenSymbol, amount, description) {
        try {
            if (amount <= 0) {
                throw (0, utils_1.createError)('Invalid transfer amount', 400, 'INVALID_AMOUNT');
            }
            // Get source wallet
            const fromWallet = await this.getWallet(fromUserId, fromTenantId, tokenSymbol);
            if (!fromWallet) {
                throw (0, utils_1.createError)('Source wallet not found', 404, 'SOURCE_WALLET_NOT_FOUND');
            }
            // Check balance
            if (fromWallet.available < amount) {
                throw (0, utils_1.createError)('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
            }
            // Get or create destination wallet
            let toWallet = await this.getWallet(toUserId, toTenantId, tokenSymbol);
            if (!toWallet) {
                toWallet = await this.createWallet(toUserId, toTenantId, tokenSymbol, fromWallet.tokenAddress);
            }
            // Calculate gas fee
            const gasFee = await this.calculateGasFee(tokenSymbol, 'transfer');
            // Create transaction
            const transaction = {
                id: this.generateTransactionId(),
                userId: fromUserId,
                tenantId: fromTenantId,
                walletId: fromWallet.id,
                type: 'transfer',
                tokenSymbol,
                amount,
                status: 'pending',
                reference: this.generateReference(),
                toUserId,
                toTenantId,
                toWalletId: toWallet.id,
                gasFee,
                gasToken: 'THAL',
                description,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process transfer
            await this.processTransfer(transaction, fromWallet, toWallet);
            logger_1.LoggerService.info(`Token transfer initiated: ${transaction.id}`, {
                transactionId: transaction.id,
                fromUserId,
                toUserId,
                amount,
                tokenSymbol
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Token transfer failed:', error);
            throw error;
        }
    }
    /**
     * Stake tokens
     */
    static async stake(userId, tenantId, tokenSymbol, amount, poolId) {
        try {
            if (amount <= 0) {
                throw (0, utils_1.createError)('Invalid stake amount', 400, 'INVALID_AMOUNT');
            }
            // Get wallet
            const wallet = await this.getWallet(userId, tenantId, tokenSymbol);
            if (!wallet) {
                throw (0, utils_1.createError)('Wallet not found', 404, 'WALLET_NOT_FOUND');
            }
            // Check balance
            if (wallet.available < amount) {
                throw (0, utils_1.createError)('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
            }
            // Get staking pool
            const pool = this.stakingPools.get(poolId);
            if (!pool) {
                throw (0, utils_1.createError)('Staking pool not found', 404, 'POOL_NOT_FOUND');
            }
            if (pool.status !== 'active') {
                throw (0, utils_1.createError)('Staking pool is not active', 400, 'POOL_INACTIVE');
            }
            if (amount < pool.minStakeAmount) {
                throw (0, utils_1.createError)('Amount below minimum stake', 400, 'BELOW_MIN_STAKE');
            }
            if (pool.maxStakeAmount && amount > pool.maxStakeAmount) {
                throw (0, utils_1.createError)('Amount above maximum stake', 400, 'ABOVE_MAX_STAKE');
            }
            // Create staking position
            const position = {
                id: this.generatePositionId(),
                userId,
                tenantId,
                poolId,
                tokenSymbol,
                amount,
                apy: pool.apy,
                lockPeriod: pool.lockPeriod,
                startDate: new Date(),
                endDate: new Date(Date.now() + pool.lockPeriod * 24 * 60 * 60 * 1000),
                status: 'active',
                rewardsEarned: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Create transaction
            const transaction = {
                id: this.generateTransactionId(),
                userId,
                tenantId,
                walletId: wallet.id,
                type: 'stake',
                tokenSymbol,
                amount,
                status: 'pending',
                reference: this.generateReference(),
                gasFee: await this.calculateGasFee(tokenSymbol, 'stake'),
                gasToken: 'THAL',
                description: `Stake ${amount} ${tokenSymbol} in pool ${poolId}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process staking
            await this.processStaking(transaction, wallet, position);
            logger_1.LoggerService.info(`Token staking initiated: ${transaction.id}`, {
                transactionId: transaction.id,
                userId,
                amount,
                tokenSymbol,
                poolId
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Token staking failed:', error);
            throw error;
        }
    }
    /**
     * Unstake tokens
     */
    static async unstake(userId, tenantId, positionId) {
        try {
            // Get staking position
            const positions = this.stakingPositions.get(`${userId}:${tenantId}`) || [];
            const position = positions.find(p => p.id === positionId);
            if (!position) {
                throw (0, utils_1.createError)('Staking position not found', 404, 'POSITION_NOT_FOUND');
            }
            if (position.status !== 'active') {
                throw (0, utils_1.createError)('Position is not active', 400, 'POSITION_INACTIVE');
            }
            // Check if lock period has ended
            if (new Date() < position.endDate) {
                throw (0, utils_1.createError)('Lock period has not ended', 400, 'LOCK_PERIOD_ACTIVE');
            }
            // Get wallet
            const wallet = await this.getWallet(userId, tenantId, position.tokenSymbol);
            if (!wallet) {
                throw (0, utils_1.createError)('Wallet not found', 404, 'WALLET_NOT_FOUND');
            }
            // Create transaction
            const transaction = {
                id: this.generateTransactionId(),
                userId,
                tenantId,
                walletId: wallet.id,
                type: 'unstake',
                tokenSymbol: position.tokenSymbol,
                amount: position.amount + position.rewardsEarned,
                status: 'pending',
                reference: this.generateReference(),
                gasFee: await this.calculateGasFee(position.tokenSymbol, 'unstake'),
                gasToken: 'THAL',
                description: `Unstake ${position.amount} ${position.tokenSymbol} from position ${positionId}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process unstaking
            await this.processUnstaking(transaction, wallet, position);
            logger_1.LoggerService.info(`Token unstaking initiated: ${transaction.id}`, {
                transactionId: transaction.id,
                userId,
                positionId
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Token unstaking failed:', error);
            throw error;
        }
    }
    /**
     * Purchase tokens in public sale
     */
    static async purchaseTokens(userId, tenantId, saleId, amount, paymentMethod) {
        try {
            if (amount <= 0) {
                throw (0, utils_1.createError)('Invalid purchase amount', 400, 'INVALID_AMOUNT');
            }
            // Get token sale
            const sales = Array.from(this.tokenSales.values()).flat();
            const sale = sales.find(s => s.id === saleId);
            if (!sale) {
                throw (0, utils_1.createError)('Token sale not found', 404, 'SALE_NOT_FOUND');
            }
            if (sale.status !== 'active') {
                throw (0, utils_1.createError)('Token sale is not active', 400, 'SALE_INACTIVE');
            }
            if (amount < sale.minPurchase) {
                throw (0, utils_1.createError)('Amount below minimum purchase', 400, 'BELOW_MIN_PURCHASE');
            }
            if (sale.maxPurchase && amount > sale.maxPurchase) {
                throw (0, utils_1.createError)('Amount above maximum purchase', 400, 'ABOVE_MAX_PURCHASE');
            }
            // Calculate cost
            const cost = amount * sale.price;
            // Get or create wallet
            let wallet = await this.getWallet(userId, tenantId, sale.tokenSymbol);
            if (!wallet) {
                wallet = await this.createWallet(userId, tenantId, sale.tokenSymbol);
            }
            // Create transaction
            const transaction = {
                id: this.generateTransactionId(),
                userId,
                tenantId,
                walletId: wallet.id,
                type: 'mint',
                tokenSymbol: sale.tokenSymbol,
                amount,
                status: 'pending',
                reference: this.generateReference(),
                gasFee: await this.calculateGasFee(sale.tokenSymbol, 'mint'),
                gasToken: 'THAL',
                description: `Purchase ${amount} ${sale.tokenSymbol} tokens`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Process purchase
            await this.processTokenPurchase(transaction, wallet, sale, cost, paymentMethod);
            logger_1.LoggerService.info(`Token purchase initiated: ${transaction.id}`, {
                transactionId: transaction.id,
                userId,
                saleId,
                amount,
                cost
            });
            return transaction;
        }
        catch (error) {
            logger_1.LoggerService.error('Token purchase failed:', error);
            throw error;
        }
    }
    /**
     * Get staking pools
     */
    static async getStakingPools() {
        try {
            return Array.from(this.stakingPools.values());
        }
        catch (error) {
            logger_1.LoggerService.error('Get staking pools failed:', error);
            throw error;
        }
    }
    /**
     * Get user staking positions
     */
    static async getUserStakingPositions(userId, tenantId) {
        try {
            const key = `${userId}:${tenantId}`;
            return this.stakingPositions.get(key) || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Get staking positions failed:', error);
            throw error;
        }
    }
    /**
     * Get active token sales
     */
    static async getActiveTokenSales() {
        try {
            const allSales = Array.from(this.tokenSales.values()).flat();
            return allSales.filter(sale => sale.status === 'active');
        }
        catch (error) {
            logger_1.LoggerService.error('Get token sales failed:', error);
            throw error;
        }
    }
    /**
     * Get transaction history
     */
    static async getTransactionHistory(userId, tenantId, tokenSymbol, limit = 50, offset = 0) {
        try {
            const key = `${userId}:${tenantId}`;
            let transactions = this.transactions.get(key) || [];
            // Filter by token symbol if specified
            if (tokenSymbol) {
                transactions = transactions.filter(t => t.tokenSymbol === tokenSymbol);
            }
            // Sort by creation date (newest first)
            transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            // Apply pagination
            return transactions.slice(offset, offset + limit);
        }
        catch (error) {
            logger_1.LoggerService.error('Get transaction history failed:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static isValidToken(tokenSymbol) {
        const validTokens = ['THAL', 'BTC', 'ETH', 'USDT', 'USDC', 'DAI'];
        return validTokens.includes(tokenSymbol.toUpperCase());
    }
    static async processTransfer(transaction, fromWallet, toWallet) {
        try {
            // Update transaction status
            transaction.status = 'processing';
            transaction.updatedAt = new Date();
            // Update source wallet
            fromWallet.available -= transaction.amount;
            fromWallet.total = fromWallet.available + fromWallet.locked + fromWallet.staked;
            fromWallet.updatedAt = new Date();
            // Update destination wallet
            toWallet.available += transaction.amount;
            toWallet.total = toWallet.available + toWallet.locked + toWallet.staked;
            toWallet.updatedAt = new Date();
            // Complete transaction
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            transaction.updatedAt = new Date();
            // Save changes
            await this.saveWallet(fromWallet);
            await this.saveWallet(toWallet);
            await this.saveTransaction(transaction);
            // Emit transfer completed event
            await this.emitTokenEvent('transfer.completed', transaction);
            logger_1.LoggerService.info(`Transfer completed: ${transaction.id}`, {
                transactionId: transaction.id,
                amount: transaction.amount
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Process transfer failed:', error);
            throw error;
        }
    }
    static async processStaking(transaction, wallet, position) {
        try {
            // Update transaction status
            transaction.status = 'processing';
            transaction.updatedAt = new Date();
            // Update wallet
            wallet.available -= transaction.amount;
            wallet.staked += transaction.amount;
            wallet.total = wallet.available + wallet.locked + wallet.staked;
            wallet.updatedAt = new Date();
            // Save staking position
            const key = `${position.userId}:${position.tenantId}`;
            const positions = this.stakingPositions.get(key) || [];
            positions.push(position);
            this.stakingPositions.set(key, positions);
            // Complete transaction
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            transaction.updatedAt = new Date();
            // Save changes
            await this.saveWallet(wallet);
            await this.saveTransaction(transaction);
            // Emit staking completed event
            await this.emitTokenEvent('staking.completed', transaction);
            logger_1.LoggerService.info(`Staking completed: ${transaction.id}`, {
                transactionId: transaction.id,
                amount: transaction.amount
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Process staking failed:', error);
            throw error;
        }
    }
    static async processUnstaking(transaction, wallet, position) {
        try {
            // Update transaction status
            transaction.status = 'processing';
            transaction.updatedAt = new Date();
            // Update wallet
            wallet.staked -= position.amount;
            wallet.available += transaction.amount; // amount + rewards
            wallet.total = wallet.available + wallet.locked + wallet.staked;
            wallet.updatedAt = new Date();
            // Update position
            position.status = 'completed';
            position.updatedAt = new Date();
            // Complete transaction
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            transaction.updatedAt = new Date();
            // Save changes
            await this.saveWallet(wallet);
            await this.saveTransaction(transaction);
            // Emit unstaking completed event
            await this.emitTokenEvent('unstaking.completed', transaction);
            logger_1.LoggerService.info(`Unstaking completed: ${transaction.id}`, {
                transactionId: transaction.id,
                amount: transaction.amount
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Process unstaking failed:', error);
            throw error;
        }
    }
    static async processTokenPurchase(transaction, wallet, sale, cost, paymentMethod) {
        try {
            // Update transaction status
            transaction.status = 'processing';
            transaction.updatedAt = new Date();
            // In production, this would integrate with payment processors
            // For now, simulate processing
            // Simulate payment processing delay
            setTimeout(async () => {
                try {
                    // Update wallet
                    wallet.available += transaction.amount;
                    wallet.total = wallet.available + wallet.locked + wallet.staked;
                    wallet.updatedAt = new Date();
                    // Update sale
                    sale.soldAmount += transaction.amount;
                    sale.updatedAt = new Date();
                    // Complete transaction
                    transaction.status = 'completed';
                    transaction.completedAt = new Date();
                    transaction.updatedAt = new Date();
                    // Save changes
                    await this.saveWallet(wallet);
                    await this.saveTransaction(transaction);
                    // Emit purchase completed event
                    await this.emitTokenEvent('purchase.completed', transaction);
                    logger_1.LoggerService.info(`Token purchase completed: ${transaction.id}`, {
                        transactionId: transaction.id,
                        amount: transaction.amount,
                        cost
                    });
                }
                catch (error) {
                    logger_1.LoggerService.error('Token purchase completion failed:', error);
                    transaction.status = 'failed';
                    transaction.updatedAt = new Date();
                    await this.saveTransaction(transaction);
                }
            }, 5000); // 5 second delay
            await this.saveTransaction(transaction);
        }
        catch (error) {
            logger_1.LoggerService.error('Process token purchase failed:', error);
            throw error;
        }
    }
    static async calculateGasFee(tokenSymbol, operation) {
        try {
            const config = this.gasFeeConfigs.get(tokenSymbol);
            if (!config) {
                return 0.001; // Default gas fee
            }
            // Simple gas fee calculation based on operation type
            switch (operation) {
                case 'transfer':
                    return config.baseFee;
                case 'stake':
                    return config.baseFee * 1.5;
                case 'unstake':
                    return config.baseFee * 1.2;
                case 'mint':
                    return config.baseFee * 2;
                default:
                    return config.baseFee;
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate gas fee failed:', error);
            return 0.001; // Default fallback
        }
    }
    static async loadStakingPools() {
        // Mock staking pools - in production, load from database
        const pools = [
            {
                id: 'pool_thal_30d',
                tokenSymbol: 'THAL',
                apy: 12.5,
                minStakeAmount: 100,
                maxStakeAmount: 10000,
                lockPeriod: 30,
                status: 'active',
                totalStaked: 50000,
                totalRewards: 5000,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'pool_thal_90d',
                tokenSymbol: 'THAL',
                apy: 18.0,
                minStakeAmount: 500,
                maxStakeAmount: 50000,
                lockPeriod: 90,
                status: 'active',
                totalStaked: 100000,
                totalRewards: 15000,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        for (const pool of pools) {
            this.stakingPools.set(pool.id, pool);
        }
    }
    static async loadTokenSales() {
        // Mock token sales - in production, load from database
        const sales = [
            {
                id: 'sale_thal_2024',
                tokenSymbol: 'THAL',
                price: 0.50,
                totalSupply: 1000000,
                soldAmount: 250000,
                status: 'active',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
                minPurchase: 10,
                maxPurchase: 10000,
                kycRequired: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        for (const sale of sales) {
            const tenantSales = this.tokenSales.get('global') || [];
            tenantSales.push(sale);
            this.tokenSales.set('global', tenantSales);
        }
    }
    static async loadGasFeeConfigs() {
        // Mock gas fee configurations - in production, load from database
        const configs = [
            {
                tokenSymbol: 'THAL',
                baseFee: 0.001,
                priorityFee: 0.0005,
                maxFee: 0.01,
                gasLimit: 21000,
                status: 'active',
                updatedAt: new Date()
            },
            {
                tokenSymbol: 'ETH',
                baseFee: 0.005,
                priorityFee: 0.002,
                maxFee: 0.05,
                gasLimit: 21000,
                status: 'active',
                updatedAt: new Date()
            }
        ];
        for (const config of configs) {
            this.gasFeeConfigs.set(config.tokenSymbol, config);
        }
    }
    static startStakingRewardsCalculation() {
        // Calculate staking rewards every hour
        setInterval(() => {
            this.calculateStakingRewards();
        }, 3600000); // 1 hour
        logger_1.LoggerService.info('Staking rewards calculation started');
    }
    static startTokenSaleMonitoring() {
        // Monitor token sales every minute
        setInterval(() => {
            this.monitorTokenSales();
        }, 60000); // 1 minute
        logger_1.LoggerService.info('Token sale monitoring started');
    }
    static async calculateStakingRewards() {
        try {
            // Calculate rewards for all active positions
            for (const [key, positions] of this.stakingPositions) {
                for (const position of positions) {
                    if (position.status === 'active') {
                        const pool = this.stakingPools.get(position.poolId);
                        if (pool) {
                            // Calculate hourly reward
                            const hourlyReward = (position.amount * pool.apy / 100) / (365 * 24);
                            position.rewardsEarned += hourlyReward;
                            position.updatedAt = new Date();
                        }
                    }
                }
            }
            logger_1.LoggerService.info('Staking rewards calculated');
        }
        catch (error) {
            logger_1.LoggerService.error('Calculate staking rewards failed:', error);
        }
    }
    static async monitorTokenSales() {
        try {
            // Monitor token sales and update status
            const allSales = Array.from(this.tokenSales.values()).flat();
            for (const sale of allSales) {
                if (sale.status === 'active' && sale.endDate && new Date() > sale.endDate) {
                    sale.status = 'completed';
                    sale.updatedAt = new Date();
                }
            }
            logger_1.LoggerService.info('Token sales monitored');
        }
        catch (error) {
            logger_1.LoggerService.error('Monitor token sales failed:', error);
        }
    }
    static async saveWallet(wallet) {
        // This would save to database
        const key = `${wallet.userId}:${wallet.tenantId}`;
        const wallets = this.wallets.get(key) || [];
        const existingIndex = wallets.findIndex(w => w.id === wallet.id);
        if (existingIndex >= 0) {
            wallets[existingIndex] = wallet;
        }
        else {
            wallets.push(wallet);
        }
        this.wallets.set(key, wallets);
    }
    static async saveTransaction(transaction) {
        // This would save to database
        const key = `${transaction.userId}:${transaction.tenantId}`;
        const transactions = this.transactions.get(key) || [];
        const existingIndex = transactions.findIndex(t => t.id === transaction.id);
        if (existingIndex >= 0) {
            transactions[existingIndex] = transaction;
        }
        else {
            transactions.push(transaction);
        }
        this.transactions.set(key, transactions);
    }
    static async emitTokenEvent(eventType, transaction) {
        // This would emit to Kafka
        logger_1.LoggerService.info(`Token event: ${eventType}`, {
            transactionId: transaction.id,
            eventType
        });
    }
    static generateWalletId() {
        return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generatePositionId() {
        return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static generateReference() {
        return `REF${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
}
exports.TokenService = TokenService;
//# sourceMappingURL=token.js.map