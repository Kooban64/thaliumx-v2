/**
 * Trading API Routes
 *
 * Provides trading endpoints that map to the native CEX functionality
 * This serves as a compatibility layer for frontend trading components
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authenticateToken } from '../middleware/error-handler';
import { createError } from '../utils';
import {
  requireBrokerContext,
  requireBrokerCustomerMatch,
  requireMandateScopes,
  resolveBrokerChannelContext,
} from '../middleware/broker-context';
import { LoggerService } from '../services/logger';

const router: Router = Router();

const resolveDelegatedCustomerId = (req: Request): string | undefined => {
  const body = req.body as { customerId?: string; customer_id?: string };
  return body?.customerId || body?.customer_id;
};

const requireDelegatedTradingContext = (req: Request, _res: Response, next: NextFunction): void => {
  const customerId = resolveDelegatedCustomerId(req);
  if (!customerId) {
    next();
    return;
  }

  const channel = req.channel || req.user?.channel;
  const brokerId = req.brokerId || req.user?.brokerId;

  if (channel !== 'broker' || !brokerId) {
    next(
      createError(
        'Delegated customer trading requires broker channel with broker context',
        403,
        'BROKER_CHANNEL_REQUIRED',
      ),
    );
    return;
  }

  next();
};

// Forward trading order requests to CEX orders
router.post(
  '/order',
  authenticateToken,
  resolveBrokerChannelContext,
  requireDelegatedTradingContext,
  requireMandateScopes(['trade:place']),
  requireBrokerCustomerMatch(req => {
    const body = req.body as { brokerId?: string; broker_id?: string };
    return body?.brokerId || body?.broker_id;
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Import the native CEX router dynamically to avoid circular dependencies
    const { default: nativeCEXRouter } = await import('./native-cex');

    // Create a mock request/response to forward to the CEX orders endpoint
    const mockReq = {
      ...req,
      body: {
        userId: req.user?.id || req.user?.userId,
        tenantId: req.user?.tenantId,
        brokerId: req.brokerId || req.user?.brokerId,
        channel: req.channel || req.user?.channel,
        broker_slug: req.brokerSlug || req.user?.brokerSlug,
        customer_id: resolveDelegatedCustomerId(req),
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
router.get('/prices/:symbol', authenticateToken, resolveBrokerChannelContext, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

router.get('/broker/context', authenticateToken, resolveBrokerChannelContext, requireBrokerContext, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      channel: req.channel,
      brokerId: req.brokerId,
      brokerSlug: req.brokerSlug,
      authContext: req.authContext,
    },
    timestamp: new Date(),
  });
});

export default router;
