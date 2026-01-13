/**
 * Admin Broker Routes
 * 
 * Admin-specific broker management endpoints
 * These wrap the broker-management service for admin access
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/brokers
 * Get all brokers (admin view)
 */
router.get('/', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { BrokerManagementService } = await import('../services/broker-management');
    const brokers = BrokerManagementService.getAllBrokers();

    // Get user count per broker
    const UserModel: any = DatabaseService.getModel('User');
    const brokersWithUserCount = await Promise.all(
      brokers.map(async (broker) => {
        const userCount = await UserModel.count({ where: { brokerId: broker.id } });
        return {
          id: broker.id,
          name: broker.name,
          slug: broker.slug,
          domain: broker.domain,
          status: broker.status,
          tier: broker.tier,
          userCount,
          createdAt: broker.createdAt,
          updatedAt: broker.updatedAt,
          lastActivityAt: broker.lastActivityAt
        };
      })
    );

    res.json({
      success: true,
      data: brokersWithUserCount,
      brokers: brokersWithUserCount, // For backward compatibility
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Get brokers failed:', error);
    next(error);
  }
});

/**
 * GET /api/admin/brokers/:id
 * Get specific broker (admin view)
 */
router.get('/:id', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Broker ID is required',
        code: 'BROKER_ID_REQUIRED'
      });
      return;
    }
    const { BrokerManagementService } = await import('../services/broker-management');
    const broker = BrokerManagementService.getBroker(id);

    if (!broker) {
      res.status(404).json({
        success: false,
        error: 'Broker not found',
        code: 'BROKER_NOT_FOUND'
      });
      return;
    }

    // Get user count
    const UserModel: any = DatabaseService.getModel('User');
    const userCount = await UserModel.count({ where: { brokerId: id || '' } });

    res.json({
      success: true,
      data: {
        ...broker,
        userCount
      },
      broker: {
        ...broker,
        userCount
      }, // For backward compatibility
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    LoggerService.error('Get broker failed:', error);
    next(error);
  }
});

export default router;
