"use strict";
/**
 * Token Routes
 *
 * REST API endpoints for token operations:
 * - Token wallet management
 * - P2P transfers
 * - Staking operations
 * - Token sales
 * - Transaction history
 *
 * Production-ready with comprehensive validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const token_1 = require("../services/token");
const logger_1 = require("../services/logger");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
// =============================================================================
// WALLET MANAGEMENT
// =============================================================================
/**
 * Create token wallet
 * POST /api/token/wallets
 */
router.post('/wallets', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { tokenSymbol, tokenAddress } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const wallet = await token_1.TokenService.createWallet(userId, tenantId, tokenSymbol, tokenAddress);
        logger_1.LoggerService.info('Token wallet created via API', {
            walletId: wallet.id,
            userId,
            tokenSymbol
        });
        res.status(201).json({
            success: true,
            data: wallet,
            message: 'Token wallet created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Wallet creation API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Get user token wallets
 * GET /api/token/wallets
 */
router.get('/wallets', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const wallets = await token_1.TokenService.getUserWallets(userId, tenantId);
        res.json({
            success: true,
            data: wallets
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallets API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Get specific token wallet
 * GET /api/token/wallets/:tokenSymbol
 */
router.get('/wallets/:tokenSymbol', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { tokenSymbol } = req.params;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!tokenSymbol) {
            res.status(400).json({
                success: false,
                error: 'Token symbol is required'
            });
            return;
        }
        const wallet = await token_1.TokenService.getWallet(userId, tenantId, tokenSymbol);
        if (!wallet) {
            throw (0, utils_1.createError)('Token wallet not found', 404, 'WALLET_NOT_FOUND');
        }
        res.json({
            success: true,
            data: wallet
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallet API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// TRANSFERS
// =============================================================================
/**
 * Transfer tokens to another user
 * POST /api/token/transfers
 */
router.post('/transfers', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const fromUserId = req.user?.userId;
        const fromTenantId = req.user?.tenantId;
        const { toUserId, toTenantId, tokenSymbol, amount, description } = req.body;
        if (!fromUserId || !fromTenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        // Prevent self-transfer
        if (fromUserId === toUserId && fromTenantId === toTenantId) {
            throw (0, utils_1.createError)('Cannot transfer to yourself', 400, 'SELF_TRANSFER_NOT_ALLOWED');
        }
        const transaction = await token_1.TokenService.transfer(fromUserId, fromTenantId, toUserId, toTenantId, tokenSymbol, amount, description);
        logger_1.LoggerService.info('Token transfer initiated via API', {
            transactionId: transaction.id,
            fromUserId,
            toUserId,
            amount,
            tokenSymbol
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Transfer initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transfer API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// STAKING
// =============================================================================
/**
 * Get staking pools
 * GET /api/token/staking/pools
 */
router.get('/staking/pools', async (req, res) => {
    try {
        const pools = await token_1.TokenService.getStakingPools();
        res.json({
            success: true,
            data: pools
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get staking pools API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Stake tokens
 * POST /api/token/staking/stake
 */
router.post('/staking/stake', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { tokenSymbol, amount, poolId } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transaction = await token_1.TokenService.stake(userId, tenantId, tokenSymbol, amount, poolId);
        logger_1.LoggerService.info('Token staking initiated via API', {
            transactionId: transaction.id,
            userId,
            amount,
            tokenSymbol,
            poolId
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Staking initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Staking API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Unstake tokens
 * POST /api/token/staking/unstake
 */
router.post('/staking/unstake', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { positionId } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transaction = await token_1.TokenService.unstake(userId, tenantId, positionId);
        logger_1.LoggerService.info('Token unstaking initiated via API', {
            transactionId: transaction.id,
            userId,
            positionId
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Unstaking initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Unstaking API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Get user staking positions
 * GET /api/token/staking/positions
 */
router.get('/staking/positions', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const positions = await token_1.TokenService.getUserStakingPositions(userId, tenantId);
        res.json({
            success: true,
            data: positions
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get staking positions API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
// =============================================================================
// TOKEN SALES
// =============================================================================
/**
 * Get active token sales
 * GET /api/token/sales
 */
router.get('/sales', async (req, res) => {
    try {
        const sales = await token_1.TokenService.getActiveTokenSales();
        res.json({
            success: true,
            data: sales
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get token sales API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Purchase tokens
 * POST /api/token/sales/:saleId/purchase
 */
router.post('/sales/:saleId/purchase', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { saleId } = req.params;
        const { amount, paymentMethod } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!saleId) {
            res.status(400).json({
                success: false,
                error: 'Sale ID is required'
            });
            return;
        }
        const transaction = await token_1.TokenService.purchaseTokens(userId, tenantId, saleId, amount, paymentMethod);
        logger_1.LoggerService.info('Token purchase initiated via API', {
            transactionId: transaction.id,
            userId,
            saleId,
            amount
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Token purchase initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Token purchase API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// TRANSACTION HISTORY
// =============================================================================
/**
 * Get transaction history
 * GET /api/token/transactions
 */
router.get('/transactions', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { tokenSymbol, limit, offset } = req.query;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transactions = await token_1.TokenService.getTransactionHistory(userId, tenantId, tokenSymbol, Number(limit) || 50, Number(offset) || 0);
        res.json({
            success: true,
            data: {
                transactions,
                limit: Number(limit) || 50,
                offset: Number(offset) || 0
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get transactions API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * Token service health check
 * GET /api/token/health
 */
router.get('/health', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                status: 'healthy',
                service: 'token',
                timestamp: new Date(),
                features: {
                    walletManagement: 'active',
                    transfers: 'active',
                    staking: 'active',
                    tokenSales: 'active',
                    gasFeeIntegration: 'active',
                    multiTenantSupport: 'active'
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Token health check error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Token service unhealthy',
                code: 'SERVICE_UNHEALTHY'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=token.js.map