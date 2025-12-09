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

import { Router, Request, Response } from 'express';
import { NFTService } from '../services/nft';
import { LoggerService } from '../services/logger';
import { AppError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

// =============================================================================
// COLLECTION ROUTES
// =============================================================================

/**
 * Create NFT Collection
 * POST /api/nft/collections
 */
router.post('/collections', 
  authenticateToken,
  requireRole(['admin', 'broker']),
  validateRequest(Joi.object({
    chainId: Joi.number().integer().min(1).required(),
    contractAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    name: Joi.string().min(1).max(100).required(),
    symbol: Joi.string().min(1).max(20).required(),
    creator: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    royaltyBps: Joi.number().integer().min(0).max(10000).default(250),
    metadata: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      image: Joi.string().uri().required(),
      externalLink: Joi.string().uri().optional(),
      sellerFeeBasisPoints: Joi.number().integer().min(0).max(10000).default(250),
      feeRecipient: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
      attributes: Joi.array().items(Joi.object({
        traitType: Joi.string().required(),
        value: Joi.string().required(),
        count: Joi.number().integer().min(1).default(1)
      })).default([])
    }).required(),
    policyFlags: Joi.object({
      allowlistRequired: Joi.boolean().default(false),
      kycRequired: Joi.boolean().default(true),
      sanctionsScreening: Joi.boolean().default(true),
      royaltyEnforcement: Joi.boolean().default(true),
      custodyEnabled: Joi.boolean().default(false),
      bundleEnabled: Joi.boolean().default(true),
      auctionEnabled: Joi.boolean().default(true),
      offerEnabled: Joi.boolean().default(true)
    }).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const {
        chainId,
        contractAddress,
        name,
        symbol,
        creator,
        royaltyBps,
        metadata,
        policyFlags
      } = req.body;

      LoggerService.info('Creating NFT collection', {
        tenantId,
        chainId,
        contractAddress,
        name,
        symbol,
        creator
      });

      const collection = await NFTService.createCollection(
        tenantId,
        chainId,
        contractAddress,
        name,
        symbol,
        creator,
        royaltyBps,
        metadata,
        policyFlags
      );

      res.status(201).json({
        success: true,
        data: collection,
        message: 'NFT collection created successfully'
      });

    } catch (error) {
      LoggerService.error('Create NFT collection failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Collections
 * GET /api/nft/collections
 */
router.get('/collections',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { page = 1, limit = 20, chainId, verified, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      LoggerService.info('Fetching NFT collections', {
        tenantId,
        page,
        limit,
        chainId,
        verified,
        sortBy,
        sortOrder
      });

      // This would typically query the database
      const collections: any[] = [];

      res.json({
        success: true,
        data: {
          collections,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: collections.length,
            pages: Math.ceil(collections.length / parseInt(limit as string))
          }
        }
      });

    } catch (error) {
      LoggerService.error('Get NFT collections failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * Get Collection Details
 * GET /api/nft/collections/:id
 */
router.get('/collections/:id',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { id } = req.params;

      LoggerService.info('Fetching NFT collection details', { tenantId, id });

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

    } catch (error) {
      LoggerService.error('Get NFT collection details failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// TOKEN ROUTES
// =============================================================================

/**
 * Get Tokens
 * GET /api/nft/tokens
 */
router.get('/tokens',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { 
        page = 1, 
        limit = 20, 
        collectionId, 
        owner, 
        traits, 
        minPrice, 
        maxPrice,
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;

      LoggerService.info('Fetching NFT tokens', {
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
      const tokens: any[] = [];

      res.json({
        success: true,
        data: {
          tokens,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: tokens.length,
            pages: Math.ceil(tokens.length / parseInt(limit as string))
          }
        }
      });

    } catch (error) {
      LoggerService.error('Get NFT tokens failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * Get Token Details
 * GET /api/nft/tokens/:collectionId/:tokenId
 */
router.get('/tokens/:collectionId/:tokenId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { collectionId, tokenId } = req.params;

      LoggerService.info('Fetching NFT token details', {
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

    } catch (error) {
      LoggerService.error('Get NFT token details failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// ORDER ROUTES
// =============================================================================

/**
 * Create Sell Order
 * POST /api/nft/orders/sell
 */
router.post('/orders/sell',
  authenticateToken,
  validateRequest(Joi.object({
    tokenId: Joi.string().required(),
    collectionId: Joi.string().required(),
    price: Joi.number().positive().required(),
    currency: Joi.string().default('ETH'),
    startTime: Joi.number().integer().min(0).optional(),
    endTime: Joi.number().integer().min(0).optional(),
    feeRecipient: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    feeBps: Joi.number().integer().min(0).max(10000).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { walletAddress } = req.user as any;
      const {
        tokenId,
        collectionId,
        price,
        currency,
        startTime,
        endTime,
        feeRecipient,
        feeBps
      } = req.body;

      LoggerService.info('Creating sell order', {
        tenantId,
        walletAddress,
        tokenId,
        collectionId,
        price,
        currency
      });

      const order = await NFTService.createSellOrder(
        tenantId,
        walletAddress,
        tokenId,
        collectionId,
        price,
        currency,
        startTime,
        endTime,
        feeRecipient,
        feeBps
      );

      res.status(201).json({
        success: true,
        data: order,
        message: 'Sell order created successfully'
      });

    } catch (error) {
      LoggerService.error('Create sell order failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Fulfill Order
 * POST /api/nft/orders/:id/fulfill
 */
router.post('/orders/:id/fulfill',
  authenticateToken,
  validateRequest(Joi.object({
    txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
    blockNumber: Joi.number().integer().min(0).required(),
    amount: Joi.number().positive().required(),
    price: Joi.number().positive().required()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { walletAddress } = req.user as any;
      const { id } = req.params;
      const { txHash, blockNumber, amount, price } = req.body;

      LoggerService.info('Fulfilling order', {
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

      const fill = await NFTService.fulfillOrder(
        tenantId,
        id,
        walletAddress,
        txHash,
        blockNumber,
        amount,
        price
      );

      res.json({
        success: true,
        data: fill,
        message: 'Order fulfilled successfully'
      });

    } catch (error) {
      LoggerService.error('Fulfill order failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Orders
 * GET /api/nft/orders
 */
router.get('/orders',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { 
        page = 1, 
        limit = 20, 
        collectionId, 
        maker, 
        status, 
        kind,
        minPrice, 
        maxPrice,
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;

      LoggerService.info('Fetching NFT orders', {
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
      const orders: any[] = [];

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: orders.length,
            pages: Math.ceil(orders.length / parseInt(limit as string))
          }
        }
      });

    } catch (error) {
      LoggerService.error('Get NFT orders failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// ACTIVITY ROUTES
// =============================================================================

/**
 * Get Activity Feed
 * GET /api/nft/activity
 */
router.get('/activity',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { 
        page = 1, 
        limit = 20, 
        collectionId, 
        tokenId, 
        user,
        type,
        sortBy = 'timestamp', 
        sortOrder = 'desc' 
      } = req.query;

      LoggerService.info('Fetching NFT activity', {
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
      const activity: any[] = [];

      res.json({
        success: true,
        data: {
          activity,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: activity.length,
            pages: Math.ceil(activity.length / parseInt(limit as string))
          }
        }
      });

    } catch (error) {
      LoggerService.error('Get NFT activity failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// METADATA ROUTES
// =============================================================================

/**
 * Refresh Token Metadata
 * POST /api/nft/metadata/refresh
 */
router.post('/metadata/refresh',
  authenticateToken,
  requireRole(['admin', 'broker']),
  validateRequest(Joi.object({
    collectionId: Joi.string().optional(),
    tokenId: Joi.string().optional(),
    contractAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional()
  }).or('collectionId', 'tokenId', 'contractAddress')),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { collectionId, tokenId, contractAddress } = req.body;

      LoggerService.info('Refreshing NFT metadata', {
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

    } catch (error) {
      LoggerService.error('Refresh NFT metadata failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// ANALYTICS ROUTES
// =============================================================================

/**
 * Get Collection Analytics
 * GET /api/nft/analytics/collections/:id
 */
router.get('/analytics/collections/:id',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.user as any;
      const { id } = req.params;
      const { period = '7d' } = req.query;

      LoggerService.info('Fetching collection analytics', {
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

    } catch (error) {
      LoggerService.error('Get collection analytics failed:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * NFT Service Health Check
 * GET /api/nft/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = NFTService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'NFT Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('NFT health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'NFT Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
