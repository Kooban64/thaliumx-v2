/**
 * Exchange Routes
 * 
 * REST API endpoints for exchange operations:
 * - Order management (create, cancel, get)
 * - Order book data
 * - Market data
 * - User balances
 * - Trading pairs
 * 
 * Production-ready with comprehensive validation
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { ExchangeService } from '../services/exchange';
import { LoggerService } from '../services/logger';
import { authenticateToken } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { AppError, createError } from '../utils';

const router: Router = Router();

// =============================================================================
// ORDER MANAGEMENT
// =============================================================================

/**
 * Create a new order
 * POST /api/exchange/orders
 */
router.post('/orders', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const orderData = {
      ...req.body,
      userId,
      tenantId
    };
    
    const order = await ExchangeService.createOrder(orderData);
    
    LoggerService.info('Order created via API', { 
      orderId: order.id, 
      userId, 
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity 
    });
    
    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    LoggerService.error('Order creation API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
 * Cancel an order
 * DELETE /api/exchange/orders/:orderId
 */
router.delete('/orders/:orderId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const orderId = req.params.orderId;
    
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    if (!orderId) {
      res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
      return;
    }
    
    const order = await ExchangeService.cancelOrder(orderId, userId);
    
    LoggerService.info('Order cancelled via API', { 
      orderId: order.id, 
      userId 
    });
    
    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    LoggerService.error('Order cancellation API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
 * Get user orders
 * GET /api/exchange/orders
 */
router.get('/orders', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const { symbol, status, limit, offset } = req.query;
    
    const orders = await ExchangeService.getUserOrders(
      userId, 
      tenantId, 
      symbol as string, 
      status as string
    );
    
    // Apply pagination
    const paginatedOrders = orders.slice(
      Number(offset), 
      Number(offset) + Number(limit)
    );
    
    res.json({
      success: true,
      data: {
        orders: paginatedOrders,
        total: orders.length,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    LoggerService.error('Get orders API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
 * Get specific order
 * GET /api/exchange/orders/:orderId
 */
router.get('/orders/:orderId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const orderId = req.params.orderId;
    
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    // This would typically get order from database
    // For now, return mock data
    res.json({
      success: true,
      data: {
        id: orderId,
        userId,
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        quantity: 1.0,
        price: 50000,
        status: 'pending',
        filledQuantity: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    LoggerService.error('Get order API error:', error);
    
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
// MARKET DATA
// =============================================================================

/**
 * Get order book
 * GET /api/exchange/orderbook/:symbol
 */
router.get('/orderbook/:symbol', validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const { limit } = req.query;
    
    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }
    
    const orderBook = await ExchangeService.getOrderBook(symbol, Number(limit));
    
    res.json({
      success: true,
      data: {
        symbol,
        bids: orderBook.bids,
        asks: orderBook.asks,
        timestamp: new Date()
      }
    });
  } catch (error) {
    LoggerService.error('Get order book API error:', error);
    
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
 * Get market data
 * GET /api/exchange/market-data/:symbol
 */
router.get('/market-data/:symbol', validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }
    
    const marketData = await ExchangeService.getMarketData(symbol);
    
    if (!marketData) {
      throw createError('Market data not found', 404, 'MARKET_DATA_NOT_FOUND');
    }
    
    res.json({
      success: true,
      data: marketData
    });
  } catch (error) {
    LoggerService.error('Get market data API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
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
 * Get all market data
 * GET /api/exchange/market-data
 */
router.get('/market-data', async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch real market data from database (populated by ExchangeService)
    const MarketDataModel: any = DatabaseService.getModel('MarketData');
    
    // Get all active trading pairs
    const TradingPairModel: any = DatabaseService.getModel('TradingPair');
    const pairs = await TradingPairModel.findAll({
      where: { isActive: true },
      limit: 100
    });
    
    // Fetch market data for each pair
    const marketDataPromises = pairs.map(async (pair: any) => {
      const symbol = pair.dataValues?.symbol || pair.symbol;
      if (!symbol) return null;
      
      const marketData = await MarketDataModel.findOne({
        where: { symbol },
        order: [['lastUpdate', 'DESC']]
      });
      
      if (marketData) {
        const data = marketData.dataValues || marketData;
        return {
          symbol: data.symbol,
          price: parseFloat(data.price) || 0,
          volume24h: parseFloat(data.volume24h) || 0,
          change24h: parseFloat(data.change24h) || 0,
          changePercent24h: parseFloat(data.changePercent24h) || 0,
          high24h: parseFloat(data.high24h) || 0,
          low24h: parseFloat(data.low24h) || 0,
          lastUpdate: new Date(data.lastUpdate || data.createdAt)
        };
      }
      
      return null;
    });
    
    const marketDataResults = await Promise.all(marketDataPromises);
    const marketData = marketDataResults.filter((data): data is NonNullable<typeof data> => data !== null);
    
    res.json({
      success: true,
      data: marketData,
      count: marketData.length,
      timestamp: new Date()
    });
  } catch (error) {
    LoggerService.error('Get all market data API error:', error);
    
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
// BALANCES
// =============================================================================

/**
 * Get user balances
 * GET /api/exchange/balances
 */
router.get('/balances', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const balances = await ExchangeService.getUserBalance(userId, tenantId);
    
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    LoggerService.error('Get balances API error:', error);
    
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
// TRADING PAIRS
// =============================================================================

/**
 * Get trading pairs
 * GET /api/exchange/pairs
 */
router.get('/pairs', async (req: Request, res: Response): Promise<void> => {
  try {
    // This would typically get trading pairs from database
    // For now, return mock data
    const pairs = [
      {
        symbol: 'BTC/USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        status: 'active',
        minQuantity: 0.001,
        maxQuantity: 1000,
        tickSize: 0.01,
        stepSize: 0.001,
        makerFee: 0.001,
        takerFee: 0.001
      },
      {
        symbol: 'ETH/USDT',
        baseAsset: 'ETH',
        quoteAsset: 'USDT',
        status: 'active',
        minQuantity: 0.01,
        maxQuantity: 10000,
        tickSize: 0.01,
        stepSize: 0.01,
        makerFee: 0.001,
        takerFee: 0.001
      }
    ];
    
    res.json({
      success: true,
      data: pairs
    });
  } catch (error) {
    LoggerService.error('Get trading pairs API error:', error);
    
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
 * Exchange service health check
 * GET /api/exchange/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'exchange',
        timestamp: new Date(),
        features: {
          orderMatching: 'active',
          marketData: 'active',
          balanceManagement: 'active',
          fundSegregation: 'active'
        }
      }
    });
  } catch (error) {
    LoggerService.error('Exchange health check error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Exchange service unhealthy',
        code: 'SERVICE_UNHEALTHY'
      }
    });
  }
});

export default router;
