/**
 * Omni Exchange Routes
 * 
 * Express router for omni-exchange (multi-exchange aggregation) endpoints.
 * 
 * Endpoints:
 * - Exchange order management
 * - Trade execution
 * - Balance queries
 * - Order book access
 * - Market data
 * 
 * Features:
 * - Rate limiting for auditor endpoints
 * - Service initialization on first request
 * - Comprehensive error handling
 * - Authentication and authorization
 * 
 * Security:
 * - All routes require authentication
 * - Role-based access control
 * - Rate limiting on sensitive endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, validateRequest as validate } from '../middleware/error-handler';
import { requirePermission } from '../middleware/error-handler';
import rateLimit from 'express-rate-limit';
import { OmniExchangeService } from '../services/omni-exchange';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';

const router: Router = Router();
let omniExchangeService: OmniExchangeService;

// Rate limiter for auditor endpoints (more restrictive)
const auditorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } }
});

// Initialize service
export const initializeOmniExchange = async () => {
  try {
    // Initialize with database from DatabaseService
    omniExchangeService = new OmniExchangeService({} as any);
    await omniExchangeService.initialize();
    LoggerService.info('Omni Exchange routes initialized');
  } catch (error) {
    LoggerService.error('Failed to initialize Omni Exchange', { error });
    throw error;
  }
};

// Get available exchanges
router.get('/exchanges', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exchanges = omniExchangeService.getAvailableExchanges();
    
    res.json({
      success: true,
      data: exchanges.map(exchange => ({
        id: exchange.id,
        name: exchange.name,
        type: exchange.type,
        status: exchange.status,
        priority: exchange.priority,
        capabilities: exchange.capabilities,
        health: exchange.health,
        limits: exchange.limits
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get exchange health
router.get('/exchanges/:exchangeId/health', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId } = req.params;
    
    if (!exchangeId) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID is required'
      });
      return;
    }
    
    const health = omniExchangeService.getExchangeHealth(exchangeId);
    
    if (!health) {
      res.status(404).json({
        success: false,
        error: 'Exchange not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Place order with platform-level fund segregation
router.post('/orders', authenticateToken, requirePermission('orders','create'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId || 'default-tenant';
    const brokerId = (req as any).brokerId || 'default-broker';
    const userId = (req as any).user?.id || 'default-user';
    
    if (!userId || !tenantId || !brokerId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const { symbol, side, type, amount, price } = req.body;
    
    // Validate request
    if (!symbol || !side || !type || !amount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, type, amount'
      });
      return;
    }
    
    // Place order with fund segregation
    const internalOrder = await omniExchangeService.placeOrder(
      tenantId as string,
      brokerId as string,
      userId,
      { symbol, side, type, amount, price }
    );
    await LoggerService.logAudit('order.create', internalOrder.id, { userId, tenantId: tenantId as string, brokerId: brokerId as string }, { symbol, side, type, amount, price, exchangeId: internalOrder.exchangeId });
    
    res.json({
      success: true,
      data: {
        internalOrder,
        fundSegregation: {
          platformAccount: 'single_platform_account',
          brokerAllocation: brokerId,
          customerAllocation: userId,
          allocatedAmount: amount
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to place order with fund segregation', { error, body: req.body });
    await LoggerService.logAudit('order.create.failed', 'order', { userId: (req as any).user?.id, tenantId: (req as any).tenantId, brokerId: (req as any).brokerId }, { error: (error as Error).message });
    next(error);
  }
});

// Get order status
router.get('/orders/:orderId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { exchangeId } = req.query;
    
    if (!exchangeId) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID required'
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
    
    const order = await omniExchangeService.getOrderStatus(orderId, exchangeId as string);
    
    res.json({
      success: true,
      data: order,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.post('/orders/:orderId/cancel', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { exchangeId } = req.query;
    
    if (!exchangeId) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID required'
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
    
    await omniExchangeService.cancelOrder(orderId, exchangeId as string);
    
    res.json({
      success: true,
      data: { orderId, cancelled: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get balance
router.get('/exchanges/:exchangeId/balance/:asset', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId, asset } = req.params;
    
    if (!exchangeId || !asset) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID and Asset are required'
      });
      return;
    }
    
    const balance = await omniExchangeService.getBalance(exchangeId, asset);
    
    res.json({
      success: true,
      data: balance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Determine best exchange for order
router.post('/exchanges/best', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { symbol, side, amount } = req.body;
    
    if (!symbol || !side || !amount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, amount'
      });
      return;
    }
    
    const routingDecision = await omniExchangeService.determineBestExchange(symbol, side, amount);
    
    res.json({
      success: true,
      data: routingDecision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== FUND ALLOCATION MANAGEMENT ====================

// Get platform fund allocations
router.get('/allocations', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allocations = omniExchangeService.getPlatformAllocations();
    
    res.json({
      success: true,
      data: allocations.map(allocation => ({
        id: allocation.id,
        exchangeId: allocation.exchangeId,
        asset: allocation.asset,
        totalPlatformBalance: allocation.totalPlatformBalance,
        availableForAllocation: allocation.availableForAllocation,
        brokerAllocations: Object.fromEntries(allocation.brokerAllocations),
        customerAllocations: Object.fromEntries(
          Array.from(allocation.customerAllocations.entries()).map(([brokerId, customers]) => [
            brokerId,
            Object.fromEntries(customers)
          ])
        ),
        lastUpdated: allocation.lastUpdated
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get specific platform allocation
router.get('/allocations/:exchangeId/:asset', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId, asset } = req.params;
    
    if (!exchangeId || !asset) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID and Asset are required'
      });
      return;
    }
    
    const allocation = omniExchangeService.getPlatformAllocation(exchangeId, asset);
    
    if (!allocation) {
      res.status(404).json({
        success: false,
        error: 'Allocation not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        id: allocation.id,
        exchangeId: allocation.exchangeId,
        asset: allocation.asset,
        totalPlatformBalance: allocation.totalPlatformBalance,
        availableForAllocation: allocation.availableForAllocation,
        brokerAllocations: Object.fromEntries(allocation.brokerAllocations),
        customerAllocations: Object.fromEntries(
          Array.from(allocation.customerAllocations.entries()).map(([brokerId, customers]) => [
            brokerId,
            Object.fromEntries(customers)
          ])
        ),
        lastUpdated: allocation.lastUpdated
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Allocate funds to broker/customer
router.post('/allocations/allocate', authenticateToken, requirePermission('allocations','allocate'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId, asset, brokerId, customerId, amount } = req.body;
    
    if (!exchangeId || !asset || !brokerId || !customerId || !amount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: exchangeId, asset, brokerId, customerId, amount'
      });
      return;
    }
    
    const success = await omniExchangeService.allocateFunds(exchangeId, asset, brokerId, customerId, amount);
    await LoggerService.logAudit('allocations.allocate', `${exchangeId}_${asset}`, { userId: (req as any).user?.id, tenantId: (req as any).tenantId, brokerId }, { customerId, amount, success });
    
    res.json({
      success,
      data: {
        exchangeId,
        asset,
        brokerId,
        customerId,
        amount,
        allocated: success
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await LoggerService.logAudit('allocations.allocate.failed', `${req.body?.exchangeId || ''}_${req.body?.asset || ''}`, { userId: (req as any).user?.id, tenantId: (req as any).tenantId, brokerId: req.body?.brokerId }, { error: (error as Error).message });
    next(error);
  }
});

// Deallocate funds from broker/customer
router.post('/allocations/deallocate', authenticateToken, requirePermission('allocations','deallocate'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId, asset, brokerId, customerId, amount } = req.body;
    
    if (!exchangeId || !asset || !brokerId || !customerId || !amount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: exchangeId, asset, brokerId, customerId, amount'
      });
      return;
    }
    
    const success = await omniExchangeService.deallocateFunds(exchangeId, asset, brokerId, customerId, amount);
    await LoggerService.logAudit('allocations.deallocate', `${exchangeId}_${asset}`, { userId: (req as any).user?.id, tenantId: (req as any).tenantId, brokerId }, { customerId, amount, success });
    
    res.json({
      success,
      data: {
        exchangeId,
        asset,
        brokerId,
        customerId,
        amount,
        deallocated: success
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await LoggerService.logAudit('allocations.deallocate.failed', `${req.body?.exchangeId || ''}_${req.body?.asset || ''}`, { userId: (req as any).user?.id, tenantId: (req as any).tenantId, brokerId: req.body?.brokerId }, { error: (error as Error).message });
    next(error);
  }
});

// Get available balance for broker/customer
router.get('/balance/:exchangeId/:asset/:brokerId/:customerId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { exchangeId, asset, brokerId, customerId } = req.params;
    
    if (!exchangeId || !asset || !brokerId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Exchange ID, Asset, Broker ID, and Customer ID are required'
      });
      return;
    }
    
    const balance = omniExchangeService.getAvailableBalance(exchangeId, asset, brokerId, customerId);
    
    res.json({
      success: true,
      data: {
        exchangeId,
        asset,
        brokerId,
        customerId,
        availableBalance: balance,
        platformAccount: 'single_platform_account'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get internal orders for broker/customer
router.get('/orders/internal/:brokerId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId } = req.params;
    const { customerId } = req.query;
    
    if (!brokerId) {
      res.status(400).json({
        success: false,
        error: 'Broker ID is required'
      });
      return;
    }
    
    const orders = omniExchangeService.getInternalOrders(brokerId, customerId as string);
    
    res.json({
      success: true,
      data: orders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== COMPLIANCE ROUTES ====================

// Get Travel Rule messages
router.get('/compliance/travel-rule', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc', format = 'json' } = req.query as any;
    const messages = omniExchangeService.getTravelRuleMessages();
    let filtered = status ? messages.filter(m => m.status === status) : messages;
    
    // Server-side sorting
    const sortField = sortBy || 'createdAt';
    const order = (sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      const aVal = a[sortField] || a.data?.[sortField] || 0;
      const bVal = b[sortField] || b.data?.[sortField] || 0;
      if (aVal instanceof Date && bVal instanceof Date) {
        return order * (aVal.getTime() - bVal.getTime());
      }
      return order * (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
    });
    
    // Export formats
    if (format === 'csv') {
      const csv = [
        ['Message ID', 'Status', 'Transaction ID', 'Created At'].join(','),
        ...filtered.map((m: any) => [
          m.messageId || '',
          m.status || '',
          m.transactionId || m.data?.transactionId || '',
          m.createdAt || m.data?.transaction?.timestamp || ''
        ].join(','))
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=travel-rule-messages.csv');
      res.send(csv);
    }
    
    // Pagination for JSON
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const start = (p - 1) * l;
    const end = start + l;
    const slice = filtered.slice(start, end);
    
    res.json({
      success: true,
      data: slice,
      pagination: { page: p, limit: l, total: filtered.length, totalPages: Math.ceil(filtered.length / l), hasNext: end < filtered.length, hasPrev: start > 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Submit Travel Rule message
router.post('/compliance/travel-rule/:messageId/submit', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { messageId } = req.params;
    
    if (!messageId) {
      res.status(400).json({
        success: false,
        error: 'Message ID is required'
      });
      return;
    }
    
    const success = await omniExchangeService.submitTravelRuleMessage(messageId);
    
    res.json({
      success,
      data: {
        messageId,
        submitted: success
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get Travel Rule message by ID
router.get('/compliance/travel-rule/:messageId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { messageId } = req.params;
    const messages = omniExchangeService.getTravelRuleMessages();
    const message = messages.find(m => m.messageId === messageId) || null;
    res.json({ success: true, data: message, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// Get CARF reports
router.get('/compliance/carf', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc', format = 'json' } = req.query as any;
    const reports = omniExchangeService.getCARFReports();
    let filtered = status ? reports.filter(r => r.status === status) : reports;
    
    // Server-side sorting
    const sortField = sortBy || 'createdAt';
    const order = (sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    filtered.sort((a: any, b: any) => {
      const aVal = a[sortField] || a.data?.[sortField] || 0;
      const bVal = b[sortField] || b.data?.[sortField] || 0;
      if (aVal instanceof Date && bVal instanceof Date) {
        return order * (aVal.getTime() - bVal.getTime());
      }
      return order * (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
    });
    
    // Export formats
    if (format === 'csv') {
      const csv = [
        ['Report ID', 'Status', 'Transaction ID', 'Created At'].join(','),
        ...filtered.map((r: any) => [
          r.reportId || '',
          r.status || '',
          r.transactionId || r.data?.transactionId || '',
          r.createdAt || r.data?.reportingPeriod?.startDate || ''
        ].join(','))
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=carf-reports.csv');
      res.send(csv);
    }
    
    // Pagination for JSON
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const start = (p - 1) * l;
    const end = start + l;
    const slice = filtered.slice(start, end);
    
    res.json({
      success: true,
      data: slice,
      pagination: { page: p, limit: l, total: filtered.length, totalPages: Math.ceil(filtered.length / l), hasNext: end < filtered.length, hasPrev: start > 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Submit CARF report
router.post('/compliance/carf/:reportId/submit', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reportId } = req.params;
    
    if (!reportId) {
      res.status(400).json({
        success: false,
        error: 'Report ID is required'
      });
      return;
    }
    
    const success = await omniExchangeService.submitCARFReport(reportId);
    
    res.json({
      success,
      data: {
        reportId,
        submitted: success
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get CARF report by ID
router.get('/compliance/carf/:reportId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reportId } = req.params;
    const reports = omniExchangeService.getCARFReports();
    const report = reports.find(r => r.reportId === reportId) || null;
    res.json({ success: true, data: report, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// Get compliance dashboard
router.get('/compliance/dashboard', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const travelRuleMessages = omniExchangeService.getTravelRuleMessages();
    const carfReports = omniExchangeService.getCARFReports();
    
    const dashboard = {
      travelRule: {
        total: travelRuleMessages.length,
        pending: travelRuleMessages.filter(m => m.status === 'pending').length,
        sent: travelRuleMessages.filter(m => m.status === 'sent').length,
        acknowledged: travelRuleMessages.filter(m => m.status === 'acknowledged').length,
        failed: travelRuleMessages.filter(m => m.status === 'failed').length
      },
      carf: {
        total: carfReports.length,
        pending: carfReports.filter(r => r.status === 'pending').length,
        submitted: carfReports.filter(r => r.status === 'submitted').length,
        acknowledged: carfReports.filter(r => r.status === 'acknowledged').length,
        rejected: carfReports.filter(r => r.status === 'rejected').length
      },
      riskAssessment: {
        highRisk: 0, // Would be calculated from recent orders
        mediumRisk: 0,
        lowRisk: 0,
        criticalRisk: 0
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

// Run internal compliance self-test (no external dependencies)
router.post('/compliance/self-test', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, brokerId } = (req as any).user || {};
    const payload = req.body || {};
    const effectiveUserId = payload.userId || userId || 'test-user';
    const effectiveBrokerId = payload.brokerId || brokerId || 'test-broker';

    const result = await omniExchangeService.runComplianceSelfTest(effectiveBrokerId, effectiveUserId);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ASSET VISIBILITY ROUTES ====================

// Get user's asset distribution across all exchanges
router.get('/assets/user/:userId/:brokerId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, brokerId } = req.params;
    
    if (!userId || !brokerId) {
      res.status(400).json({
        success: false,
        error: 'User ID and Broker ID are required'
      });
      return;
    }
    
    const distribution = await omniExchangeService.getUserAssetDistribution(userId, brokerId);
    
    res.json({
      success: true,
      data: {
        userId: distribution.userId,
        brokerId: distribution.brokerId,
        totalAssets: Object.fromEntries(distribution.totalAssets),
        exchangeBreakdown: Object.fromEntries(
          Array.from(distribution.exchangeBreakdown.entries()).map(([exchangeId, assets]) => [
            exchangeId,
            Object.fromEntries(assets)
          ])
        ),
        lastUpdated: distribution.lastUpdated
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get user's detailed asset breakdown
router.get('/assets/user/:userId/:brokerId/detailed', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, brokerId } = req.params;
    
    if (!userId || !brokerId) {
      res.status(400).json({
        success: false,
        error: 'User ID and Broker ID are required'
      });
      return;
    }
    
    const detailedAssets = await omniExchangeService.getUserDetailedAssets(userId, brokerId);
    
    res.json({
      success: true,
      data: detailedAssets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get broker's total assets across all exchanges
router.get('/assets/broker/:brokerId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId } = req.params;
    
    if (!brokerId) {
      res.status(400).json({
        success: false,
        error: 'Broker ID is required'
      });
      return;
    }
    
    const distribution = await omniExchangeService.getBrokerAssetDistribution(brokerId);
    
    res.json({
      success: true,
      data: {
        brokerId: distribution.brokerId,
        totalAssets: Object.fromEntries(distribution.totalAssets),
        exchangeBreakdown: Object.fromEntries(
          Array.from(distribution.exchangeBreakdown.entries()).map(([exchangeId, assets]) => [
            exchangeId,
            Object.fromEntries(assets)
          ])
        ),
        customerCount: distribution.customerCount,
        lastUpdated: distribution.lastUpdated
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get platform-level asset reconciliation
router.get('/assets/platform/reconciliation', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reconciliation = await omniExchangeService.getPlatformAssetReconciliation();
    
    res.json({
      success: true,
      data: {
        platformTotals: Object.fromEntries(reconciliation.platformTotals),
        exchangeBalances: Object.fromEntries(
          Array.from(reconciliation.exchangeBalances.entries()).map(([exchangeId, assets]) => [
            exchangeId,
            Object.fromEntries(assets)
          ])
        ),
        internalAllocations: Object.fromEntries(
          Array.from(reconciliation.internalAllocations.entries()).map(([exchangeId, assets]) => [
            exchangeId,
            Object.fromEntries(assets)
          ])
        ),
        reconciliation: Object.fromEntries(reconciliation.reconciliation),
        lastUpdated: reconciliation.lastUpdated
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get platform asset summary
router.get('/assets/platform/summary', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reconciliation = await omniExchangeService.getPlatformAssetReconciliation();
    
    const summary = {
      totalAssets: Object.fromEntries(reconciliation.platformTotals),
      exchangeCount: reconciliation.exchangeBalances.size,
      reconciliationStatus: {
        balanced: 0,
        overAllocated: 0,
        underAllocated: 0
      },
      lastUpdated: reconciliation.lastUpdated
    };
    
    // Count reconciliation statuses
    for (const reconciliationItem of reconciliation.reconciliation.values()) {
      const statusKey = reconciliationItem.status === 'over_allocated' ? 'overAllocated' : 
                       reconciliationItem.status === 'under_allocated' ? 'underAllocated' : 
                       'balanced';
      summary.reconciliationStatus[statusKey]++;
    }
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get latest reconciliation snapshot (read-only for auditors)
router.get('/reconciliation/snapshots/latest', authenticateToken, requireRole(['admin','super_admin','platform-compliance']), auditorRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const Model: any = DatabaseService.getModel('ReconciliationSnapshot');
    const row = await Model.findOne({ order: [['snapshotAt','DESC']] });
    res.json({ success: true, data: row ? row.toJSON() : null, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Run comprehensive compliance test suite
router.post('/compliance/test-suite', authenticateToken, requireRole(['platform-admin', 'platform-compliance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const testResults = await omniExchangeService.runComplianceTestSuite();
    res.json({
      success: true,
      message: 'Compliance test suite completed.',
      data: testResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Compliance test suite failed:', { error });
    next(error);
  }
});

// Get compliance dashboard data
router.get('/compliance/dashboard', authenticateToken, requireRole(['platform-admin', 'platform-compliance', 'broker-compliance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dashboardData = omniExchangeService.getComplianceDashboard();
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to get compliance dashboard:', { error });
    next(error);
  }
});

export default router;

