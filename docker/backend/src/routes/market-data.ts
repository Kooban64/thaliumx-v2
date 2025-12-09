/**
 * Market Data Routes
 *
 * API endpoints for cryptocurrency market data
 * Provides real-time prices, historical data, and market statistics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { marketDataService } from '../services/market-data';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';
import { rateLimiter } from '../middleware/error-handler';

const router: Router = Router();

/**
 * GET /api/market/prices/:symbol
 * Get current price for a specific cryptocurrency
 */
router.get('/prices/:symbol', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { symbol } = req.params;

    if (!symbol || typeof symbol !== 'string') {
      return next(createError('Symbol parameter is required', 400, 'MISSING_SYMBOL'));
    }

    const price = await marketDataService.getPrice(symbol.toUpperCase());

    if (!price) {
      return next(createError(`Price data not found for symbol: ${symbol}`, 404, 'PRICE_NOT_FOUND'));
    }

    res.json({
      success: true,
      data: price,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Error fetching price:', error);
    next(error);
  }
});

/**
 * GET /api/market/prices
 * Get current prices for multiple cryptocurrencies
 * Query params: symbols (comma-separated)
 */
router.get('/prices', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbolsParam = req.query.symbols as string;

    if (!symbolsParam) {
      return next(createError('Symbols parameter is required', 400, 'MISSING_SYMBOLS'));
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);

    if (symbols.length === 0) {
      return next(createError('At least one valid symbol is required', 400, 'INVALID_SYMBOLS'));
    }

    if (symbols.length > 50) {
      return next(createError('Maximum 50 symbols allowed per request', 400, 'TOO_MANY_SYMBOLS'));
    }

    const prices = await marketDataService.getPrices(symbols);

    res.json({
      success: true,
      data: {
        prices: Object.fromEntries(prices),
        count: prices.size,
        requested: symbols.length,
        found: prices.size
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Error fetching prices:', error);
    next(error);
  }
});

/**
 * GET /api/market/historical/:symbol
 * Get historical price data for a cryptocurrency
 * Query params: days (default: 7, max: 365)
 */
router.get('/historical/:symbol', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { symbol } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    if (!symbol || typeof symbol !== 'string') {
      return next(createError('Symbol parameter is required', 400, 'MISSING_SYMBOL'));
    }

    if (days < 1 || days > 365) {
      return next(createError('Days must be between 1 and 365', 400, 'INVALID_DAYS'));
    }

    const historicalData = await marketDataService.getHistoricalPrices(symbol.toUpperCase(), days);

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        days,
        prices: historicalData,
        count: historicalData.length
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Error fetching historical data:', error);
    next(error);
  }
});

/**
 * GET /api/market/stats
 * Get global market statistics
 */
router.get('/stats', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await marketDataService.getMarketStats();

    if (!stats) {
      return next(createError('Market statistics not available', 503, 'STATS_UNAVAILABLE'));
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Error fetching market stats:', error);
    next(error);
  }
});

/**
 * POST /api/market/cache/clear
 * Clear market data cache (admin only)
 * Query params: symbol (optional - clear specific symbol cache)
 */
router.post('/cache/clear', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add admin authentication check
    const symbol = req.query.symbol as string;

    await marketDataService.clearCache(symbol);

    res.json({
      success: true,
      message: `Cache cleared${symbol ? ` for symbol: ${symbol}` : ' for all symbols'}`,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Error clearing cache:', error);
    next(error);
  }
});

/**
 * GET /api/market/health
 * Health check for market data service
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await marketDataService.isHealthy();

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'market-data',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Market data health check failed:', error);
    next(error);
  }
});

export default router;