"use strict";
/**
 * Web3 Wallet Routes
 *
 * API endpoints for Web3 wallet integration:
 * - Connect/disconnect wallets
 * - Get wallet balances
 * - Manage wallet connections
 * - Token purchase with Web3 wallets
 * - Trading integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const web3_wallet_1 = require("../services/web3-wallet");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../services/logger");
const ethers_1 = require("ethers");
const utils_1 = require("../utils");
const sequelize_1 = require("sequelize");
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const connectWalletSchema = joi_1.default.object({
    walletType: joi_1.default.string().valid('metamask', 'walletconnect', 'coinbase', 'phantom', 'rainbow', 'trust', 'ledger', 'trezor').required(),
    chainId: joi_1.default.number().integer().positive().required(),
    address: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    signature: joi_1.default.string().optional(),
    message: joi_1.default.string().optional(),
    timestamp: joi_1.default.number().integer().positive().required(),
    nonce: joi_1.default.string().required()
});
const tokenPurchaseSchema = joi_1.default.object({
    tokenAddress: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    tokenSymbol: joi_1.default.string().required(),
    amount: joi_1.default.string().pattern(/^\d+(\.\d+)?$/).required(),
    paymentToken: joi_1.default.string().valid('ETH', 'USDT', 'USDC', 'DAI').required(),
    paymentAmount: joi_1.default.string().pattern(/^\d+(\.\d+)?$/).required(),
    slippageTolerance: joi_1.default.number().min(0).max(50).required(),
    deadline: joi_1.default.number().integer().positive().required(),
    chainId: joi_1.default.number().integer().positive().required(),
    userWallet: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});
// =============================================================================
// WALLET CONNECTION ROUTES
// =============================================================================
/**
 * Connect a Web3 wallet
 * POST /api/web3-wallet/connect
 */
router.post('/connect', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const connectionRequest = req.body;
        const wallet = await web3_wallet_1.web3WalletService.connectWallet(userId, tenantId, brokerId, connectionRequest);
        res.json({
            success: true,
            data: wallet,
            message: 'Wallet connected successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Connect wallet failed:', { error });
        next(error);
    }
});
/**
 * Disconnect a Web3 wallet
 * DELETE /api/web3-wallet/:walletId/disconnect
 */
router.delete('/:walletId/disconnect', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const walletId = req.params.walletId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        if (!walletId) {
            res.status(400).json({
                success: false,
                error: 'Wallet ID is required'
            });
            return;
        }
        await web3_wallet_1.web3WalletService.disconnectWallet(userId, tenantId, walletId);
        res.json({
            success: true,
            message: 'Wallet disconnected successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Disconnect wallet failed:', { error });
        next(error);
    }
});
/**
 * Get user's connected wallets
 * GET /api/web3-wallet/wallets
 */
router.get('/wallets', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const wallets = await web3_wallet_1.web3WalletService.getUserWallets(userId, tenantId);
        res.json({
            success: true,
            data: wallets,
            message: 'User wallets retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user wallets failed:', { error });
        next(error);
    }
});
/**
 * Get wallet balance
 * GET /api/web3-wallet/:address/balance/:chainId
 */
router.get('/:address/balance/:chainId', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const address = req.params.address;
        const chainIdStr = req.params.chainId;
        if (!address) {
            res.status(400).json({
                success: false,
                error: 'Address is required'
            });
            return;
        }
        if (!chainIdStr) {
            res.status(400).json({
                success: false,
                error: 'Chain ID is required'
            });
            return;
        }
        const chainId = parseInt(chainIdStr);
        if (!ethers_1.ethers.isAddress(address)) {
            throw (0, utils_1.createError)('Invalid wallet address', 400, 'INVALID_ADDRESS');
        }
        const balance = await web3_wallet_1.web3WalletService.getWalletBalance(address, chainId);
        res.json({
            success: true,
            data: balance,
            message: 'Wallet balance retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallet balance failed:', { error });
        next(error);
    }
});
// =============================================================================
// SUPPORTED CHAINS ROUTES
// =============================================================================
/**
 * Get supported chains
 * GET /api/web3-wallet/chains
 */
router.get('/chains', async (req, res, next) => {
    try {
        const chains = web3_wallet_1.web3WalletService.getSupportedChains();
        res.json({
            success: true,
            data: chains,
            message: 'Supported chains retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get supported chains failed:', { error });
        next(error);
    }
});
/**
 * Get chain configuration
 * GET /api/web3-wallet/chains/:chainId
 */
router.get('/chains/:chainId', async (req, res, next) => {
    try {
        const chainIdStr = req.params.chainId;
        if (!chainIdStr) {
            res.status(400).json({
                success: false,
                error: 'Chain ID is required'
            });
            return;
        }
        const chainId = parseInt(chainIdStr);
        const chainConfig = web3_wallet_1.web3WalletService.getChainConfig(chainId);
        if (!chainConfig) {
            throw (0, utils_1.createError)('Chain not supported', 404, 'CHAIN_NOT_SUPPORTED');
        }
        res.json({
            success: true,
            data: chainConfig,
            message: 'Chain configuration retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get chain config failed:', { error });
        next(error);
    }
});
// =============================================================================
// TOKEN PURCHASE ROUTES
// =============================================================================
/**
 * Purchase tokens with Web3 wallet
 * POST /api/web3-wallet/purchase-tokens
 */
router.post('/purchase-tokens', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const purchaseRequest = req.body;
        // Validate wallet belongs to user and client
        const wallet = await web3_wallet_1.web3WalletService.getUserWallets(userId, tenantId);
        const userWallet = wallet.find(w => w.address.toLowerCase() === purchaseRequest.userWallet.toLowerCase() &&
            w.chainId === purchaseRequest.chainId);
        if (!userWallet) {
            throw (0, utils_1.createError)('Wallet not found or does not belong to user', 404, 'WALLET_NOT_FOUND');
        }
        // Check client-level compliance and fund segregation
        if (userWallet.security.isBlacklisted) {
            throw (0, utils_1.createError)('Wallet is blacklisted', 403, 'WALLET_BLACKLISTED');
        }
        // Get payment token address
        const chainConfig = web3_wallet_1.web3WalletService.getChainConfig(purchaseRequest.chainId);
        if (!chainConfig) {
            throw (0, utils_1.createError)('Unsupported chain', 400, 'UNSUPPORTED_CHAIN');
        }
        const paymentTokenMap = {
            'ETH': chainConfig.contracts.weth || 'native',
            'USDT': chainConfig.contracts.usdt || '',
            'USDC': chainConfig.contracts.usdc || '',
            'DAI': chainConfig.contracts.dai || ''
        };
        const paymentTokenAddress = paymentTokenMap[purchaseRequest.paymentToken];
        if (!paymentTokenAddress && purchaseRequest.paymentToken !== 'ETH') {
            throw (0, utils_1.createError)('Payment token not supported on this chain', 400, 'PAYMENT_TOKEN_UNSUPPORTED');
        }
        // Ensure paymentTokenAddress is defined
        const finalPaymentTokenAddress = paymentTokenAddress || (purchaseRequest.paymentToken === 'ETH' ? 'native' : '');
        if (!finalPaymentTokenAddress) {
            throw (0, utils_1.createError)('Payment token address is required', 400, 'PAYMENT_TOKEN_REQUIRED');
        }
        // Import DEX service for token swap
        const { DEXService } = await import('../services/dex');
        // Get best quote
        const quoteResult = await DEXService.getBestQuote(finalPaymentTokenAddress === 'native' ? chainConfig.contracts.weth || '' : finalPaymentTokenAddress, purchaseRequest.tokenAddress, purchaseRequest.paymentAmount, purchaseRequest.slippageTolerance);
        // Execute swap with client-level isolation
        const swapTransaction = await DEXService.executeSwap(userId, tenantId, brokerId, finalPaymentTokenAddress === 'native' ? chainConfig.contracts.weth || '' : finalPaymentTokenAddress, purchaseRequest.tokenAddress, purchaseRequest.paymentAmount, purchaseRequest.slippageTolerance, purchaseRequest.deadline, quoteResult.bestQuote.route);
        const purchaseResult = {
            transactionHash: swapTransaction.txHash || swapTransaction.id,
            swapId: swapTransaction.id,
            tokenAmount: purchaseRequest.amount,
            tokenAmountActual: swapTransaction.amountOut,
            paymentAmount: purchaseRequest.paymentAmount,
            paymentToken: purchaseRequest.paymentToken,
            slippageActual: swapTransaction.priceImpact,
            gasUsed: swapTransaction.gasUsed || '0',
            gasPrice: swapTransaction.gasPrice || '0',
            status: swapTransaction.status,
            clientId: userId,
            brokerId,
            complianceFlags: swapTransaction.metadata.complianceFlags || [],
            riskScore: swapTransaction.metadata.riskScore || 0
        };
        res.json({
            success: true,
            data: purchaseResult,
            message: 'Token purchase executed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Token purchase failed:', { error });
        next(error);
    }
});
// =============================================================================
// TRADING INTEGRATION ROUTES
// =============================================================================
/**
 * Get trading pairs available for Web3 wallet trading
 * GET /api/web3-wallet/trading/pairs
 */
router.get('/trading/pairs', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const chainId = parseInt(req.query.chainId) || 1;
        // Mock trading pairs - in production, this would come from DEX aggregators
        const tradingPairs = [
            {
                pair: 'ETH/USDT',
                baseToken: 'ETH',
                quoteToken: 'USDT',
                chainId,
                dex: 'Uniswap V3',
                liquidity: '1000000',
                price: '2000.00',
                priceChange24h: '2.5%'
            },
            {
                pair: 'THAL/USDT',
                baseToken: 'THAL',
                quoteToken: 'USDT',
                chainId,
                dex: 'ThaliumX Native',
                liquidity: '500000',
                price: '0.50',
                priceChange24h: '5.2%'
            }
        ];
        res.json({
            success: true,
            data: tradingPairs,
            message: 'Trading pairs retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get trading pairs failed:', { error });
        next(error);
    }
});
/**
 * Place a trade order using Web3 wallet
 * POST /api/web3-wallet/trading/order
 */
router.post('/trading/order', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const orderRequest = req.body;
        // Validate wallet belongs to user and client
        const wallet = await web3_wallet_1.web3WalletService.getUserWallets(userId, tenantId);
        const userWallet = wallet.find(w => w.address.toLowerCase() === (orderRequest.walletAddress || '').toLowerCase() &&
            w.chainId === (orderRequest.chainId || 1));
        if (!userWallet) {
            throw (0, utils_1.createError)('Wallet not found or does not belong to user', 404, 'WALLET_NOT_FOUND');
        }
        // Check client-level compliance
        if (userWallet.security.isBlacklisted) {
            throw (0, utils_1.createError)('Wallet is blacklisted', 403, 'WALLET_BLACKLISTED');
        }
        // Check daily transaction limits (client-level isolation)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // In production, check transaction count for this client today
        // Parse trading pair
        const [baseToken, quoteToken] = orderRequest.pair.split('/');
        if (!baseToken || !quoteToken) {
            throw (0, utils_1.createError)('Invalid trading pair format', 400, 'INVALID_PAIR');
        }
        // Get token addresses from chain config
        const chainConfig = web3_wallet_1.web3WalletService.getChainConfig(orderRequest.chainId || 1);
        if (!chainConfig) {
            throw (0, utils_1.createError)('Unsupported chain', 400, 'UNSUPPORTED_CHAIN');
        }
        // Determine token addresses (simplified - in production use token registry)
        const tokenIn = orderRequest.side === 'buy' ? quoteToken : baseToken;
        const tokenOut = orderRequest.side === 'buy' ? baseToken : quoteToken;
        // Import DEX service
        const { DEXService } = await import('../services/dex');
        // Calculate amount based on side
        const amountIn = orderRequest.side === 'buy'
            ? (parseFloat(orderRequest.amount) * parseFloat(orderRequest.price)).toString()
            : orderRequest.amount;
        // Get best quote with client-level routing
        const quoteResult = await DEXService.getBestQuote(tokenIn, tokenOut, amountIn, orderRequest.slippageTolerance || 0.5, { chainId: orderRequest.chainId || 1 });
        // Execute swap with client isolation
        const swapTransaction = await DEXService.executeSwap(userId, tenantId, brokerId, tokenIn, tokenOut, amountIn, orderRequest.slippageTolerance || 0.5, Math.floor(Date.now() / 1000) + 3600, // 1 hour deadline
        quoteResult.bestQuote.route);
        const orderResult = {
            orderId: swapTransaction.id,
            swapId: swapTransaction.id,
            pair: orderRequest.pair,
            side: orderRequest.side,
            amount: orderRequest.amount,
            amountActual: orderRequest.side === 'buy' ? swapTransaction.amountOut : swapTransaction.amountIn,
            price: orderRequest.price,
            priceActual: (parseFloat(swapTransaction.amountOut) / parseFloat(swapTransaction.amountIn)).toString(),
            status: swapTransaction.status,
            transactionHash: swapTransaction.txHash || swapTransaction.id,
            estimatedGas: swapTransaction.gasUsed || '200000',
            estimatedGasPrice: swapTransaction.gasPrice || '20000000000',
            clientId: userId,
            brokerId,
            slippage: swapTransaction.priceImpact,
            fee: swapTransaction.fee,
            complianceFlags: swapTransaction.metadata.complianceFlags || [],
            riskScore: swapTransaction.metadata.riskScore || 0
        };
        res.json({
            success: true,
            data: orderResult,
            message: 'Trade order executed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Place trade order failed:', { error });
        next(error);
    }
});
// =============================================================================
// WALLET SECURITY ROUTES
// =============================================================================
/**
 * Get wallet security status
 * GET /api/web3-wallet/:walletId/security
 */
router.get('/:walletId/security', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const walletId = req.params.walletId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        if (!walletId) {
            res.status(400).json({
                success: false,
                error: 'Wallet ID is required'
            });
            return;
        }
        // Get wallet with client-level isolation
        const wallet = await web3_wallet_1.web3WalletService.getWalletById(userId, tenantId, walletId);
        if (!wallet) {
            throw (0, utils_1.createError)('Wallet not found', 404, 'WALLET_NOT_FOUND');
        }
        // Get client-level compliance status from KYC and risk systems
        const { KYCService } = await import('../services/kyc');
        let kycStatus;
        try {
            kycStatus = await KYCService.getKYCStatus(userId);
        }
        catch (error) {
            logger_1.LoggerService.warn('Could not retrieve KYC status for security check', { userId, error });
        }
        // Calculate risk score based on wallet and client attributes
        let riskScore = wallet.metadata.riskScore || 0;
        if (kycStatus) {
            // Adjust risk based on KYC level - higher KYC = lower risk
            const kycRiskAdjustment = {
                'L0': 50,
                'L1': 30,
                'L2': 10,
                'L3': 0
            };
            riskScore += kycRiskAdjustment[kycStatus.kycLevel] || 0;
        }
        // Check transaction history for this client
        const { DatabaseService } = await import('../services/database');
        const TransactionModel = DatabaseService.getModel('Transaction');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const recentTransactions = await TransactionModel.count({
            where: {
                userId,
                createdAt: { [sequelize_1.Op.gte]: today },
                fromAddress: wallet.address
            }
        });
        // Dynamic limits based on KYC level and client history
        const kycLimits = {
            'L0': { daily: 10, amount: 1000 },
            'L1': { daily: 50, amount: 10000 },
            'L2': { daily: 200, amount: 100000 },
            'L3': { daily: 1000, amount: 1000000 }
        };
        const limits = kycLimits[kycStatus?.kycLevel || 'L0'] || { daily: 100, amount: 100000 };
        // Build compliance flags from wallet and client data
        const complianceFlags = [];
        if (wallet.metadata.complianceFlags) {
            complianceFlags.push(...wallet.metadata.complianceFlags);
        }
        if (kycStatus?.complianceFlags) {
            complianceFlags.push(...kycStatus.complianceFlags.map(f => typeof f === 'string' ? f : f.type || 'UNKNOWN'));
        }
        if (recentTransactions >= limits.daily * 0.9) {
            complianceFlags.push('HIGH_TRANSACTION_VOLUME');
        }
        if (riskScore > 70) {
            complianceFlags.push('HIGH_RISK_WALLET');
        }
        const securityStatus = {
            walletId,
            address: wallet.address,
            chainId: wallet.chainId,
            riskScore: Math.min(100, Math.max(0, riskScore)),
            isWhitelisted: wallet.security.isWhitelisted,
            isBlacklisted: wallet.security.isBlacklisted,
            maxDailyTransactions: limits.daily,
            currentDailyTransactions: recentTransactions,
            maxTransactionAmount: limits.amount,
            requiresApproval: riskScore > 60 || recentTransactions >= limits.daily * 0.8,
            lastSecurityCheck: wallet.security.lastSecurityCheck.toISOString(),
            kycLevel: kycStatus?.kycLevel || 'L0',
            kycStatus: kycStatus?.status || 'PENDING',
            complianceFlags: [...new Set(complianceFlags)], // Remove duplicates
            recommendations: [
                ...(riskScore > 50 ? ['Wallet shows elevated risk - review recent activity'] : []),
                ...(kycStatus?.kycLevel === 'L0' ? ['Complete KYC verification for higher limits'] : []),
                ...(recentTransactions >= limits.daily * 0.9 ? ['Approaching daily transaction limit'] : []),
                'Enable 2FA for enhanced security',
                'Consider using hardware wallet for large amounts'
            ].filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        };
        res.json({
            success: true,
            data: securityStatus,
            message: 'Wallet security status retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallet security failed:', { error });
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=web3-wallet.js.map