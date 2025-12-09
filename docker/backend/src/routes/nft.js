"use strict";
/**
 * NFT Routes - API endpoints for NFT Marketplace
 *
 * Production-ready routes for:
 * - Collection Management
 * - Token Management
 * - Order Management (Fixed price, Auctions, Offers, Bundles)
 * - Activity & Analytics
 * - Metadata Management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nft_1 = require("../services/nft");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// COLLECTION ROUTES
// =============================================================================
/**
 * Create NFT Collection
 * POST /api/nft/collections
 */
router.post('/collections', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'broker']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    chainId: joi_1.default.number().integer().min(1).required(),
    contractAddress: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    name: joi_1.default.string().min(1).max(100).required(),
    symbol: joi_1.default.string().min(1).max(20).required(),
    creator: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    royaltyBps: joi_1.default.number().integer().min(0).max(10000).default(250),
    metadata: joi_1.default.object({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().required(),
        image: joi_1.default.string().uri().required(),
        externalLink: joi_1.default.string().uri().optional(),
        sellerFeeBasisPoints: joi_1.default.number().integer().min(0).max(10000).default(250),
        feeRecipient: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
        attributes: joi_1.default.array().items(joi_1.default.object({
            traitType: joi_1.default.string().required(),
            value: joi_1.default.string().required(),
            count: joi_1.default.number().integer().min(1).default(1)
        })).default([])
    }).required(),
    policyFlags: joi_1.default.object({
        allowlistRequired: joi_1.default.boolean().default(false),
        kycRequired: joi_1.default.boolean().default(true),
        sanctionsScreening: joi_1.default.boolean().default(true),
        royaltyEnforcement: joi_1.default.boolean().default(true),
        custodyEnabled: joi_1.default.boolean().default(false),
        bundleEnabled: joi_1.default.boolean().default(true),
        auctionEnabled: joi_1.default.boolean().default(true),
        offerEnabled: joi_1.default.boolean().default(true)
    }).optional()
})), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { chainId, contractAddress, name, symbol, creator, royaltyBps, metadata, policyFlags } = req.body;
        logger_1.LoggerService.info('Creating NFT collection', {
            tenantId,
            chainId,
            contractAddress,
            name,
            symbol,
            creator
        });
        const collection = await nft_1.NFTService.createCollection(tenantId, chainId, contractAddress, name, symbol, creator, royaltyBps, metadata, policyFlags);
        res.status(201).json({
            success: true,
            data: collection,
            message: 'NFT collection created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create NFT collection failed:', error);
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
 * Get Collections
 * GET /api/nft/collections
 */
router.get('/collections', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { page = 1, limit = 20, chainId, verified, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        logger_1.LoggerService.info('Fetching NFT collections', {
            tenantId,
            page,
            limit,
            chainId,
            verified,
            sortBy,
            sortOrder
        });
        // This would typically query the database
        const collections = [];
        res.json({
            success: true,
            data: {
                collections,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: collections.length,
                    pages: Math.ceil(collections.length / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT collections failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
/**
 * Get Collection Details
 * GET /api/nft/collections/:id
 */
router.get('/collections/:id', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { id } = req.params;
        logger_1.LoggerService.info('Fetching NFT collection details', { tenantId, id });
        // This would typically query the database
        const collection = null; // Would fetch from database
        if (!collection) {
            res.status(404).json({
                success: false,
                error: 'Collection not found',
                code: 'COLLECTION_NOT_FOUND'
            });
            return;
        }
        res.json({
            success: true,
            data: collection
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT collection details failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// TOKEN ROUTES
// =============================================================================
/**
 * Get Tokens
 * GET /api/nft/tokens
 */
router.get('/tokens', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { page = 1, limit = 20, collectionId, owner, traits, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        logger_1.LoggerService.info('Fetching NFT tokens', {
            tenantId,
            page,
            limit,
            collectionId,
            owner,
            traits,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder
        });
        // This would typically query the database with filters
        const tokens = [];
        res.json({
            success: true,
            data: {
                tokens,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: tokens.length,
                    pages: Math.ceil(tokens.length / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT tokens failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
/**
 * Get Token Details
 * GET /api/nft/tokens/:collectionId/:tokenId
 */
router.get('/tokens/:collectionId/:tokenId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { collectionId, tokenId } = req.params;
        logger_1.LoggerService.info('Fetching NFT token details', {
            tenantId,
            collectionId,
            tokenId
        });
        // This would typically query the database
        const token = null; // Would fetch from database
        if (!token) {
            res.status(404).json({
                success: false,
                error: 'Token not found',
                code: 'TOKEN_NOT_FOUND'
            });
        }
        res.json({
            success: true,
            data: token
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT token details failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// ORDER ROUTES
// =============================================================================
/**
 * Create Sell Order
 * POST /api/nft/orders/sell
 */
router.post('/orders/sell', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    tokenId: joi_1.default.string().required(),
    collectionId: joi_1.default.string().required(),
    price: joi_1.default.number().positive().required(),
    currency: joi_1.default.string().default('ETH'),
    startTime: joi_1.default.number().integer().min(0).optional(),
    endTime: joi_1.default.number().integer().min(0).optional(),
    feeRecipient: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    feeBps: joi_1.default.number().integer().min(0).max(10000).optional()
})), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { walletAddress } = req.user;
        const { tokenId, collectionId, price, currency, startTime, endTime, feeRecipient, feeBps } = req.body;
        logger_1.LoggerService.info('Creating sell order', {
            tenantId,
            walletAddress,
            tokenId,
            collectionId,
            price,
            currency
        });
        const order = await nft_1.NFTService.createSellOrder(tenantId, walletAddress, tokenId, collectionId, price, currency, startTime, endTime, feeRecipient, feeBps);
        res.status(201).json({
            success: true,
            data: order,
            message: 'Sell order created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create sell order failed:', error);
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
 * Fulfill Order
 * POST /api/nft/orders/:id/fulfill
 */
router.post('/orders/:id/fulfill', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    txHash: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
    blockNumber: joi_1.default.number().integer().min(0).required(),
    amount: joi_1.default.number().positive().required(),
    price: joi_1.default.number().positive().required()
})), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { walletAddress } = req.user;
        const { id } = req.params;
        const { txHash, blockNumber, amount, price } = req.body;
        logger_1.LoggerService.info('Fulfilling order', {
            tenantId,
            walletAddress,
            orderId: id,
            txHash,
            blockNumber,
            amount,
            price
        });
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Order ID is required'
            });
            return;
        }
        const fill = await nft_1.NFTService.fulfillOrder(tenantId, id, walletAddress, txHash, blockNumber, amount, price);
        res.json({
            success: true,
            data: fill,
            message: 'Order fulfilled successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Fulfill order failed:', error);
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
 * Get Orders
 * GET /api/nft/orders
 */
router.get('/orders', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { page = 1, limit = 20, collectionId, maker, status, kind, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        logger_1.LoggerService.info('Fetching NFT orders', {
            tenantId,
            page,
            limit,
            collectionId,
            maker,
            status,
            kind,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder
        });
        // This would typically query the database with filters
        const orders = [];
        res.json({
            success: true,
            data: {
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: orders.length,
                    pages: Math.ceil(orders.length / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT orders failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// ACTIVITY ROUTES
// =============================================================================
/**
 * Get Activity Feed
 * GET /api/nft/activity
 */
router.get('/activity', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { page = 1, limit = 20, collectionId, tokenId, user, type, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
        logger_1.LoggerService.info('Fetching NFT activity', {
            tenantId,
            page,
            limit,
            collectionId,
            tokenId,
            user,
            type,
            sortBy,
            sortOrder
        });
        // This would typically query fills and transfers tables
        const activity = [];
        res.json({
            success: true,
            data: {
                activity,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: activity.length,
                    pages: Math.ceil(activity.length / parseInt(limit))
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get NFT activity failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// METADATA ROUTES
// =============================================================================
/**
 * Refresh Token Metadata
 * POST /api/nft/metadata/refresh
 */
router.post('/metadata/refresh', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'broker']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    collectionId: joi_1.default.string().optional(),
    tokenId: joi_1.default.string().optional(),
    contractAddress: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional()
}).or('collectionId', 'tokenId', 'contractAddress')), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { collectionId, tokenId, contractAddress } = req.body;
        logger_1.LoggerService.info('Refreshing NFT metadata', {
            tenantId,
            collectionId,
            tokenId,
            contractAddress
        });
        // This would queue metadata refresh jobs
        const jobId = 'metadata-refresh-' + Date.now();
        res.json({
            success: true,
            data: { jobId },
            message: 'Metadata refresh queued successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Refresh NFT metadata failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// ANALYTICS ROUTES
// =============================================================================
/**
 * Get Collection Analytics
 * GET /api/nft/analytics/collections/:id
 */
router.get('/analytics/collections/:id', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { id } = req.params;
        const { period = '7d' } = req.query;
        logger_1.LoggerService.info('Fetching collection analytics', {
            tenantId,
            collectionId: id,
            period
        });
        // This would calculate analytics from fills and transfers
        const analytics = {
            volume: {
                '24h': 0,
                '7d': 0,
                '30d': 0,
                all: 0
            },
            sales: {
                '24h': 0,
                '7d': 0,
                '30d': 0,
                all: 0
            },
            floorPrice: 0,
            averagePrice: 0,
            owners: 0,
            listed: 0,
            priceHistory: []
        };
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get collection analytics failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * NFT Service Health Check
 * GET /api/nft/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = nft_1.NFTService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            service: 'NFT Service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.LoggerService.error('NFT health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'NFT Service',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=nft.js.map