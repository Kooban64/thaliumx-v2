"use strict";
/**
 * DEX Routes - API endpoints for DEX Service
 *
 * Production-ready routes for:
 * - Quote Management
 * - Swap Execution
 * - Liquidity Management
 * - Pool Management
 * - Statistics and Reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dex_1 = require("../services/dex");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// QUOTE MANAGEMENT ROUTES
// =============================================================================
/**
 * Get Best Quote
 * POST /api/dex/quotes
 */
router.post('/quotes', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    tokenIn: joi_1.default.string().required(),
    tokenOut: joi_1.default.string().required(),
    amountIn: joi_1.default.string().required(),
    slippage: joi_1.default.number().min(0.1).max(10.0).default(0.5)
})), async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, slippage, dexes, chainId } = req.body;
        logger_1.LoggerService.info('Getting best quote', {
            tokenIn,
            tokenOut,
            amountIn,
            slippage
        });
        const quoteResult = await dex_1.DEXService.getBestQuote(tokenIn, tokenOut, amountIn, slippage, { dexes, chainId });
        res.json({
            success: true,
            data: quoteResult
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get best quote failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// SWAP EXECUTION ROUTES
// =============================================================================
/**
 * Execute Swap
 * POST /api/dex/swaps
 */
router.post('/swaps', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    tokenIn: joi_1.default.string().required(),
    tokenOut: joi_1.default.string().required(),
    amountIn: joi_1.default.string().required(),
    slippage: joi_1.default.number().min(0.1).max(10.0).default(0.5),
    deadline: joi_1.default.number().integer().min(Math.floor(Date.now() / 1000)).required(),
    route: joi_1.default.array().items(joi_1.default.object({
        tokenIn: joi_1.default.string().required(),
        tokenOut: joi_1.default.string().required(),
        fee: joi_1.default.number().required(),
        poolAddress: joi_1.default.string().optional(),
        dex: joi_1.default.string().required()
    })).required()
})), async (req, res) => {
    try {
        const { tenantId, brokerId, userId } = req.user;
        const { tokenIn, tokenOut, amountIn, slippage, deadline, route } = req.body;
        logger_1.LoggerService.info('Executing swap', {
            userId,
            tenantId,
            brokerId,
            tokenIn,
            tokenOut,
            amountIn,
            slippage
        });
        const swap = await dex_1.DEXService.executeSwap(userId, tenantId, brokerId, tokenIn, tokenOut, amountIn, slippage, deadline, route);
        res.status(201).json({
            success: true,
            data: swap,
            message: 'Swap executed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Execute swap failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get User Swaps
 * GET /api/dex/swaps
 */
router.get('/swaps', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { status, limit = 50, offset = 0 } = req.query;
        logger_1.LoggerService.info('Fetching user swaps', {
            userId,
            status,
            limit,
            offset
        });
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const swaps = await DEXService.getUserSwaps(userId, {
            status: status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({
            success: true,
            data: swaps,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: swaps.length
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user swaps failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Swap Details
 * GET /api/dex/swaps/:swapId
 */
router.get('/swaps/:swapId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { swapId } = req.params;
        const { userId } = req.user;
        logger_1.LoggerService.info('Fetching swap details', {
            swapId,
            userId
        });
        if (!swapId) {
            res.status(400).json({
                success: false,
                error: 'Swap ID is required',
                code: 'MISSING_SWAP_ID'
            });
            return;
        }
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const swap = await DEXService.getSwapById(swapId);
        if (!swap) {
            res.status(404).json({
                success: false,
                error: 'Swap not found',
                code: 'SWAP_NOT_FOUND'
            });
            return;
        }
        // Verify swap belongs to user
        if (swap.userId !== userId) {
            res.status(403).json({
                success: false,
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
            return;
        }
        res.json({
            success: true,
            data: swap
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get swap details failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// LIQUIDITY MANAGEMENT ROUTES
// =============================================================================
/**
 * Add Liquidity
 * POST /api/dex/liquidity/add
 */
router.post('/liquidity/add', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    poolId: joi_1.default.string().required(),
    token0Amount: joi_1.default.string().required(),
    token1Amount: joi_1.default.string().required(),
    slippage: joi_1.default.number().min(0.1).max(10.0).default(0.5)
})), async (req, res) => {
    try {
        const { userId } = req.user;
        const { poolId, token0Amount, token1Amount, slippage } = req.body;
        logger_1.LoggerService.info('Adding liquidity', {
            userId,
            poolId,
            token0Amount,
            token1Amount,
            slippage
        });
        const position = await dex_1.DEXService.addLiquidity(userId, poolId, token0Amount, token1Amount, slippage);
        res.status(201).json({
            success: true,
            data: position,
            message: 'Liquidity added successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Add liquidity failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Remove Liquidity
 * POST /api/dex/liquidity/remove
 */
router.post('/liquidity/remove', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    positionId: joi_1.default.string().required(),
    lpTokenAmount: joi_1.default.string().required(),
    slippage: joi_1.default.number().min(0.1).max(10.0).default(0.5)
})), async (req, res) => {
    try {
        const { userId } = req.user;
        const { positionId, lpTokenAmount, slippage } = req.body;
        logger_1.LoggerService.info('Removing liquidity', {
            userId,
            positionId,
            lpTokenAmount,
            slippage
        });
        const position = await dex_1.DEXService.removeLiquidity(userId, positionId, lpTokenAmount, slippage);
        res.json({
            success: true,
            data: position,
            message: 'Liquidity removed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Remove liquidity failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get User Liquidity Positions
 * GET /api/dex/liquidity/positions
 */
router.get('/liquidity/positions', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { poolId, isActive } = req.query;
        logger_1.LoggerService.info('Fetching user liquidity positions', {
            userId,
            poolId,
            isActive
        });
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const positions = await DEXService.getUserLiquidityPositions(userId);
        res.json({
            success: true,
            data: positions
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user liquidity positions failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// POOL MANAGEMENT ROUTES
// =============================================================================
/**
 * Get Liquidity Pools
 * GET /api/dex/pools
 */
router.get('/pools', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { dex, token0, token1, isActive } = req.query;
        logger_1.LoggerService.info('Fetching liquidity pools', {
            dex,
            token0,
            token1,
            isActive
        });
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const pools = await DEXService.getLiquidityPools({
            dex: dex,
            token0: token0,
            token1: token1,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
        });
        res.json({
            success: true,
            data: pools
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get liquidity pools failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Pool Details
 * GET /api/dex/pools/:poolId
 */
router.get('/pools/:poolId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { poolId } = req.params;
        logger_1.LoggerService.info('Fetching pool details', {
            poolId
        });
        if (!poolId) {
            res.status(400).json({
                success: false,
                error: 'Pool ID is required',
                code: 'MISSING_POOL_ID'
            });
            return;
        }
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const pool = await DEXService.getPoolById(poolId);
        if (!pool) {
            res.status(404).json({
                success: false,
                error: 'Pool not found',
                code: 'POOL_NOT_FOUND'
            });
            return;
        }
        res.json({
            success: true,
            data: pool
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get pool details failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// STATISTICS AND REPORTING ROUTES
// =============================================================================
/**
 * Get DEX Statistics
 * GET /api/dex/stats
 */
router.get('/stats', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        logger_1.LoggerService.info('Fetching DEX statistics');
        const stats = await dex_1.DEXService.getDEXStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get DEX stats failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Price Feeds
 * GET /api/dex/prices
 */
router.get('/prices', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tokens } = req.query;
        logger_1.LoggerService.info('Fetching price feeds', {
            tokens
        });
        // Fetch from DEXService
        const { DEXService } = await import('../services/dex');
        const tokenList = tokens
            ? (typeof tokens === 'string'
                ? tokens.split(',')
                : Array.isArray(tokens)
                    ? tokens
                    : [])
            : undefined;
        const priceFeeds = await DEXService.getPriceFeeds(tokenList);
        res.json({
            success: true,
            data: priceFeeds.map(feed => ({
                token: feed.token,
                price: feed.price,
                change24h: feed.change24h,
                volume24h: feed.volume24h,
                marketCap: feed.marketCap,
                lastUpdated: feed.lastUpdated
            }))
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get price feeds failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * DEX Service Health Check
 * GET /api/dex/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = dex_1.DEXService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            service: 'DEX Service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.LoggerService.error('DEX health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'DEX Service',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=dex.js.map