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

import { Router, Request, Response } from 'express';
import { DEXService } from '../services/dex';
import { LoggerService } from '../services/logger';
import { AppError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

// =============================================================================
// QUOTE MANAGEMENT ROUTES
// =============================================================================

/**
 * Get Best Quote
 * POST /api/dex/quotes
 */
router.post('/quotes',
  authenticateToken,
  validateRequest(Joi.object({
    tokenIn: Joi.string().required(),
    tokenOut: Joi.string().required(),
    amountIn: Joi.string().required(),
    slippage: Joi.number().min(0.1).max(10.0).default(0.5)
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenIn, tokenOut, amountIn, slippage, dexes, chainId } = req.body;

      LoggerService.info('Getting best quote', {
        tokenIn,
        tokenOut,
        amountIn,
        slippage
      });

      const quoteResult = await DEXService.getBestQuote(
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        { dexes, chainId }
      );

      res.json({
        success: true,
        data: quoteResult
      });

    } catch (error) {
      LoggerService.error('Get best quote failed:', error);
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

// =============================================================================
// SWAP EXECUTION ROUTES
// =============================================================================

/**
 * Execute Swap
 * POST /api/dex/swaps
 */
router.post('/swaps',
  authenticateToken,
  validateRequest(Joi.object({
    tokenIn: Joi.string().required(),
    tokenOut: Joi.string().required(),
    amountIn: Joi.string().required(),
    slippage: Joi.number().min(0.1).max(10.0).default(0.5),
    deadline: Joi.number().integer().min(Math.floor(Date.now() / 1000)).required(),
    route: Joi.array().items(Joi.object({
      tokenIn: Joi.string().required(),
      tokenOut: Joi.string().required(),
      fee: Joi.number().required(),
      poolAddress: Joi.string().optional(),
      dex: Joi.string().required()
    })).required()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, brokerId, userId } = req.user as any;
      const { tokenIn, tokenOut, amountIn, slippage, deadline, route } = req.body;

      LoggerService.info('Executing swap', {
        userId,
        tenantId,
        brokerId,
        tokenIn,
        tokenOut,
        amountIn,
        slippage
      });

      const swap = await DEXService.executeSwap(
        userId,
        tenantId,
        brokerId,
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        deadline,
        route
      );

      res.status(201).json({
        success: true,
        data: swap,
        message: 'Swap executed successfully'
      });

    } catch (error) {
      LoggerService.error('Execute swap failed:', error);
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
 * Get User Swaps
 * GET /api/dex/swaps
 */
router.get('/swaps',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { status, limit = 50, offset = 0 } = req.query;

      LoggerService.info('Fetching user swaps', {
        userId,
        status,
        limit,
        offset
      });

      // Fetch from DEXService
      const { DEXService } = await import('../services/dex');
      const swaps = await DEXService.getUserSwaps(userId, {
        status: status as any,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: swaps,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: swaps.length
        }
      });

    } catch (error) {
      LoggerService.error('Get user swaps failed:', error);
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
 * Get Swap Details
 * GET /api/dex/swaps/:swapId
 */
router.get('/swaps/:swapId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { swapId } = req.params;
      const { userId } = req.user as any;

      LoggerService.info('Fetching swap details', {
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

    } catch (error) {
      LoggerService.error('Get swap details failed:', error);
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

// =============================================================================
// LIQUIDITY MANAGEMENT ROUTES
// =============================================================================

/**
 * Add Liquidity
 * POST /api/dex/liquidity/add
 */
router.post('/liquidity/add',
  authenticateToken,
  validateRequest(Joi.object({
    poolId: Joi.string().required(),
    token0Amount: Joi.string().required(),
    token1Amount: Joi.string().required(),
    slippage: Joi.number().min(0.1).max(10.0).default(0.5)
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { poolId, token0Amount, token1Amount, slippage } = req.body;

      LoggerService.info('Adding liquidity', {
        userId,
        poolId,
        token0Amount,
        token1Amount,
        slippage
      });

      const position = await DEXService.addLiquidity(
        userId,
        poolId,
        token0Amount,
        token1Amount,
        slippage
      );

      res.status(201).json({
        success: true,
        data: position,
        message: 'Liquidity added successfully'
      });

    } catch (error) {
      LoggerService.error('Add liquidity failed:', error);
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
 * Remove Liquidity
 * POST /api/dex/liquidity/remove
 */
router.post('/liquidity/remove',
  authenticateToken,
  validateRequest(Joi.object({
    positionId: Joi.string().required(),
    lpTokenAmount: Joi.string().required(),
    slippage: Joi.number().min(0.1).max(10.0).default(0.5)
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { positionId, lpTokenAmount, slippage } = req.body;

      LoggerService.info('Removing liquidity', {
        userId,
        positionId,
        lpTokenAmount,
        slippage
      });

      const position = await DEXService.removeLiquidity(
        userId,
        positionId,
        lpTokenAmount,
        slippage
      );

      res.json({
        success: true,
        data: position,
        message: 'Liquidity removed successfully'
      });

    } catch (error) {
      LoggerService.error('Remove liquidity failed:', error);
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
 * Get User Liquidity Positions
 * GET /api/dex/liquidity/positions
 */
router.get('/liquidity/positions',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { poolId, isActive } = req.query;

      LoggerService.info('Fetching user liquidity positions', {
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

    } catch (error) {
      LoggerService.error('Get user liquidity positions failed:', error);
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

// =============================================================================
// POOL MANAGEMENT ROUTES
// =============================================================================

/**
 * Get Liquidity Pools
 * GET /api/dex/pools
 */
router.get('/pools',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { dex, token0, token1, isActive } = req.query;

      LoggerService.info('Fetching liquidity pools', {
        dex,
        token0,
        token1,
        isActive
      });

      // Fetch from DEXService
      const { DEXService } = await import('../services/dex');
      const pools = await DEXService.getLiquidityPools({
        dex: dex as string,
        token0: token0 as string,
        token1: token1 as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      });

      res.json({
        success: true,
        data: pools
      });

    } catch (error) {
      LoggerService.error('Get liquidity pools failed:', error);
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
 * Get Pool Details
 * GET /api/dex/pools/:poolId
 */
router.get('/pools/:poolId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;

      LoggerService.info('Fetching pool details', {
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

    } catch (error) {
      LoggerService.error('Get pool details failed:', error);
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

// =============================================================================
// STATISTICS AND REPORTING ROUTES
// =============================================================================

/**
 * Get DEX Statistics
 * GET /api/dex/stats
 */
router.get('/stats',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Fetching DEX statistics');

      const stats = await DEXService.getDEXStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      LoggerService.error('Get DEX stats failed:', error);
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
 * Get Price Feeds
 * GET /api/dex/prices
 */
router.get('/prices',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokens } = req.query;

      LoggerService.info('Fetching price feeds', {
        tokens
      });

      // Fetch from DEXService
      const { DEXService } = await import('../services/dex');
      const tokenList: string[] | undefined = tokens
        ? (typeof tokens === 'string'
            ? (tokens as string).split(',')
            : Array.isArray(tokens)
              ? (tokens as string[])
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

    } catch (error) {
      LoggerService.error('Get price feeds failed:', error);
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

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * DEX Service Health Check
 * GET /api/dex/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = DEXService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'DEX Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('DEX health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'DEX Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
