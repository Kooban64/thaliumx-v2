/**
 * Native CEX API Routes
 * 
 * Provides comprehensive CEX trading endpoints including:
 * - Trading engine management
 * - Order placement and management
 * - Market data aggregation
 * - THAL token rewards and incentives
 * - Liquidity provider rewards
 * - Risk management integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { NativeCEXService, TradingEngine, TradingPair, CEXOrder, MarketData, LiquidityIncentive, THALBusinessModel } from '../services/native-cex';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';

const router: Router = Router();
let nativeCEXService: NativeCEXService;

// Initialize service
export const initializeNativeCEX = async () => {
  try {
    nativeCEXService = new NativeCEXService(DatabaseService.getSequelize());
    await nativeCEXService.initialize();
    LoggerService.info('Native CEX routes initialized');
  } catch (error) {
    LoggerService.error('Failed to initialize Native CEX', { error });
    throw error;
  }
};

// ==================== TRADING ENGINES ====================

// Get trading engines status
router.get('/engines', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const engines = nativeCEXService.getTradingEngines();
    
    res.json({
      success: true,
      data: {
        engines: engines.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          status: e.status,
          capabilities: e.capabilities,
          metadata: {
            version: e.metadata.version,
            lastHealthCheck: e.metadata.lastHealthCheck
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== TRADING PAIRS ====================

// Get all trading pairs
router.get('/pairs', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pairs = nativeCEXService.getTradingPairs();
    
    res.json({
      success: true,
      data: {
        pairs: pairs.map(p => ({
          id: p.id,
          symbol: p.symbol,
          baseAsset: p.baseAsset,
          quoteAsset: p.quoteAsset,
          status: p.status,
          precision: p.precision,
          limits: p.limits,
          fees: p.fees,
          engines: p.engines,
          metadata: {
            createdAt: p.metadata.createdAt,
            updatedAt: p.metadata.updatedAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get THAL trading pairs (promoted)
router.get('/pairs/thal', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const thalPairs = nativeCEXService.getTHALTradingPairs();
    
    res.json({
      success: true,
      data: {
        thalPairs: thalPairs.map(p => ({
          id: p.id,
          symbol: p.symbol,
          baseAsset: p.baseAsset,
          quoteAsset: p.quoteAsset,
          status: p.status,
          precision: p.precision,
          limits: p.limits,
          fees: {
            maker: p.fees.maker,
            taker: p.fees.taker,
            thalDiscount: p.fees.thalDiscount
          },
          engines: p.engines,
          promotion: {
            thalRewardRate: '0.001', // 0.1% reward
            feeDiscount: p.fees.thalDiscount,
            liquidityIncentive: '0.002' // 0.2% for liquidity providers
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ORDER MANAGEMENT ====================

// Place order
router.post('/orders', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, tenantId, brokerId, tradingPairId, side, type, quantity, price, stopPrice, timeInForce } = req.body;
    
    if (!userId || !tenantId || !brokerId || !tradingPairId || !side || !type || !quantity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, tenantId, brokerId, tradingPairId, side, type, quantity'
      });
      return;
    }
    
    const order = await nativeCEXService.placeOrder(
      userId,
      tenantId,
      brokerId,
      {
        tradingPairId,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce
      }
    );
    
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          userId: order.userId,
          brokerId: order.brokerId,
          tradingPairId: order.tradingPairId,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stopPrice,
          timeInForce: order.timeInForce,
          status: order.status,
          filledQuantity: order.filledQuantity,
          remainingQuantity: order.remainingQuantity,
          averagePrice: order.averagePrice,
          fees: order.fees,
          thalRewards: order.thalRewards,
          thalFeeDiscount: order.thalFeeDiscount,
          engine: order.engine,
          riskScore: order.riskScore,
          metadata: {
            createdAt: order.metadata.createdAt,
            updatedAt: order.metadata.updatedAt
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to place CEX order', { error, body: req.body });
    next(error);
  }
});

// Get order by ID
router.get('/orders/:orderId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
      return;
    }
    
    const order = nativeCEXService.getOrder(orderId);
    
    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          userId: order.userId,
          brokerId: order.brokerId,
          tradingPairId: order.tradingPairId,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stopPrice,
          timeInForce: order.timeInForce,
          status: order.status,
          filledQuantity: order.filledQuantity,
          remainingQuantity: order.remainingQuantity,
          averagePrice: order.averagePrice,
          fees: order.fees,
          thalRewards: order.thalRewards,
          thalFeeDiscount: order.thalFeeDiscount,
          engine: order.engine,
          riskScore: order.riskScore,
          metadata: {
            createdAt: order.metadata.createdAt,
            updatedAt: order.metadata.updatedAt,
            executionLog: order.metadata.executionLog
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get user's orders
router.get('/orders/user/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, limit = 100, offset = 0 } = req.query;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    let orders = nativeCEXService.getUserOrders(userId);
    
    // Filter by status if provided
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    
    // Apply pagination
    const paginatedOrders = orders.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: {
        userId,
        orders: paginatedOrders.map(o => ({
          id: o.id,
          tradingPairId: o.tradingPairId,
          side: o.side,
          type: o.type,
          quantity: o.quantity,
          price: o.price,
          status: o.status,
          filledQuantity: o.filledQuantity,
          remainingQuantity: o.remainingQuantity,
          averagePrice: o.averagePrice,
          fees: o.fees,
          thalRewards: o.thalRewards,
          thalFeeDiscount: o.thalFeeDiscount,
          engine: o.engine,
          riskScore: o.riskScore,
          metadata: {
            createdAt: o.metadata.createdAt,
            updatedAt: o.metadata.updatedAt
          }
        })),
        pagination: {
          total: orders.length,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < orders.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.delete('/orders/:orderId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }
    
    if (!orderId) {
      res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
      return;
    }
    
    const success = await nativeCEXService.cancelOrder(orderId, userId);
    
    res.json({
      success,
      data: {
        orderId,
        cancelled: success
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to cancel order', { error, orderId: req.params.orderId });
    next(error);
  }
});

// ==================== MARKET DATA ====================

// Get market data for symbol
router.get('/market-data/:symbol', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }
    
    const marketData = await nativeCEXService.getMarketData(symbol);
    
    res.json({
      success: true,
      data: {
        marketData: {
          symbol: marketData.symbol,
          price: marketData.price,
          volume24h: marketData.volume24h,
          change24h: marketData.change24h,
          high24h: marketData.high24h,
          low24h: marketData.low24h,
          bid: marketData.bid,
          ask: marketData.ask,
          spread: marketData.spread,
          depth: marketData.depth,
          timestamp: marketData.timestamp
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to get market data', { error, symbol: req.params.symbol });
    next(error);
  }
});

// Get market data for all THAL pairs
router.get('/market-data/thal/all', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const thalPairs = nativeCEXService.getTHALTradingPairs();
    const marketDataPromises = thalPairs.map(pair => 
      nativeCEXService.getMarketData(pair.symbol).catch(error => {
        LoggerService.warn('Failed to get market data for THAL pair', { error, symbol: pair.symbol });
        return null;
      })
    );
    
    const marketDataResults = await Promise.all(marketDataPromises);
    const validMarketData = marketDataResults.filter(data => data !== null);
    
    res.json({
      success: true,
      data: {
        thalMarketData: validMarketData.map(data => ({
          symbol: data!.symbol,
          price: data!.price,
          volume24h: data!.volume24h,
          change24h: data!.change24h,
          high24h: data!.high24h,
          low24h: data!.low24h,
          bid: data!.bid,
          ask: data!.ask,
          spread: data!.spread,
          timestamp: data!.timestamp
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== THAL TOKEN REWARDS ====================

// Get THAL business model
router.get('/thal/business-model', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const businessModel = nativeCEXService.getTHALBusinessModel();
    
    res.json({
      success: true,
      data: {
        businessModel: {
          feeDiscounts: businessModel.feeDiscounts,
          rewards: businessModel.rewards,
          staking: businessModel.staking,
          governance: businessModel.governance
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get user's liquidity incentives
router.get('/thal/incentives/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const incentives = nativeCEXService.getUserLiquidityIncentives(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        incentives: incentives.map(i => ({
          id: i.id,
          tradingPairId: i.tradingPairId,
          incentiveType: i.incentiveType,
          amount: i.amount,
          currency: i.currency,
          status: i.status,
          expiresAt: i.expiresAt,
          metadata: {
            sourceOrderId: i.metadata.sourceOrderId,
            volumeTraded: i.metadata.volumeTraded,
            multiplier: i.metadata.multiplier,
            createdAt: i.metadata.createdAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Credit THAL rewards for order
router.post('/thal/credit-rewards', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, orderId } = req.body;
    
    if (!userId || !orderId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, orderId'
      });
      return;
    }
    
    await nativeCEXService.creditTHALRewards(userId, orderId);
    
    res.json({
      success: true,
      data: {
        userId,
        orderId,
        rewardsCredited: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to credit THAL rewards', { error, body: req.body });
    next(error);
  }
});

// ==================== DASHBOARD & ANALYTICS ====================

// Get CEX dashboard for user
router.get('/dashboard/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const orders = nativeCEXService.getUserOrders(userId);
    const incentives = nativeCEXService.getUserLiquidityIncentives(userId);
    const thalPairs = nativeCEXService.getTHALTradingPairs();
    
    const dashboard = {
      userId,
      trading: {
        totalOrders: orders.length,
        openOrders: orders.filter(o => o.status === 'open').length,
        filledOrders: orders.filter(o => o.status === 'filled').length,
        totalVolume: orders.reduce((sum, o) => sum + parseFloat(o.quantity), 0).toString(),
        totalFees: orders.reduce((sum, o) => sum + parseFloat(o.fees), 0).toString(),
        totalThalRewards: orders.reduce((sum, o) => sum + parseFloat(o.thalRewards), 0).toString()
      },
      thal: {
        availablePairs: thalPairs.length,
        totalIncentives: incentives.length,
        totalIncentiveAmount: incentives.reduce((sum, i) => sum + parseFloat(i.amount), 0).toString(),
        pendingIncentives: incentives.filter(i => i.status === 'pending').length,
        creditedIncentives: incentives.filter(i => i.status === 'credited').length
      },
      engines: {
        dingirStatus: 'active', // Would get from health check
        liquibookStatus: 'active',
        hybridRouting: true
      }
    };
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get platform CEX analytics (admin only)
router.get('/analytics/platform', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const engines = nativeCEXService.getTradingEngines();
    const pairs = nativeCEXService.getTradingPairs();
    const thalPairs = nativeCEXService.getTHALTradingPairs();
    
    const analytics = {
      engines: {
        total: engines.length,
        active: engines.filter(e => e.status === 'active').length,
        degraded: engines.filter(e => e.status === 'degraded').length,
        down: engines.filter(e => e.status === 'down').length
      },
      pairs: {
        total: pairs.length,
        thalPairs: thalPairs.length,
        activePairs: pairs.filter(p => p.status === 'active').length,
        suspendedPairs: pairs.filter(p => p.status === 'suspended').length
      },
      thalPromotion: {
        thalPairsCount: thalPairs.length,
        averageThalDiscount: thalPairs.reduce((sum, p) => sum + parseFloat(p.fees.thalDiscount), 0) / thalPairs.length,
        thalRewardRate: '0.001', // 0.1%
        liquidityIncentiveRate: '0.002' // 0.2%
      }
    };
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
