/**
 * Trading API Routes
 *
 * Provides trading endpoints that map to the native CEX functionality
 * This serves as a compatibility layer for frontend trading components
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';

const router: Router = Router();

// Forward trading order requests to CEX orders
router.post('/order', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Import the native CEX router dynamically to avoid circular dependencies
    const { default: nativeCEXRouter } = await import('./native-cex');

    // Create a mock request/response to forward to the CEX orders endpoint
    const mockReq = {
      ...req,
      body: {
        userId: (req as any).user?.id,
        tenantId: (req as any).user?.tenantId || 'default',
        brokerId: (req as any).user?.brokerId || 'default',
        ...req.body
      }
    } as Request;

    const mockRes = {
      ...res,
      json: (data: any) => {
        res.json(data);
      },
      status: (code: number) => {
        res.status(code);
        return mockRes;
      }
    } as Response;

    // Find and execute the CEX orders POST handler
    const routeStack = (nativeCEXRouter as any).stack;
    const ordersRoute = routeStack.find((layer: any) =>
      layer.route && layer.route.path === '/orders' && layer.route.methods.post
    );

    if (ordersRoute) {
      // Execute the CEX orders handler
      await ordersRoute.route.stack[0].handle(mockReq, mockRes, next);
    } else {
      res.status(404).json({
        success: false,
        error: 'Trading service temporarily unavailable'
      });
    }
  } catch (error) {
    LoggerService.error('Failed to process trading order', { error, body: req.body });
    next(error);
  }
});

// Forward market data requests
router.get('/prices/:symbol', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Import the native CEX router dynamically
    const { default: nativeCEXRouter } = await import('./native-cex');

    // Create a mock request/response to forward to the CEX market data endpoint
    const mockReq = {
      ...req,
      params: { symbol: req.params.symbol }
    } as unknown as Request;

    const mockRes = {
      ...res,
      json: (data: any) => {
        res.json(data);
      },
      status: (code: number) => {
        res.status(code);
        return mockRes;
      }
    } as Response;

    // Find and execute the CEX market data GET handler
    const routeStack = (nativeCEXRouter as any).stack;
    const marketDataRoute = routeStack.find((layer: any) =>
      layer.route && layer.route.path === '/market-data/:symbol' && layer.route.methods.get
    );

    if (marketDataRoute) {
      // Execute the CEX market data handler
      await marketDataRoute.route.stack[0].handle(mockReq, mockRes, next);
    } else {
      res.status(404).json({
        success: false,
        error: 'Market data service temporarily unavailable'
      });
    }
  } catch (error) {
    LoggerService.error('Failed to fetch market data', { error, symbol: req.params.symbol });
    next(error);
  }
});

export default router;