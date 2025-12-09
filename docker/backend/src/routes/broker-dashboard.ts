/**
 * Broker Dashboard Routes
 * 
 * Express router for broker-scoped dashboard endpoints.
 * 
 * Endpoints:
 * - GET /dashboard - Broker dashboard data (broker roles only)
 * - Broker-specific statistics and metrics
 * - Broker user management
 * - Broker configuration
 * 
 * Security:
 * - All routes require authentication
 * - Restricted to broker roles:
 *   - BROKER_ADMIN
 *   - BROKER_COMPLIANCE
 *   - BROKER_FINANCE
 *   - BROKER_OPERATIONS
 *   - BROKER_TRADING
 *   - BROKER_SUPPORT
 * 
 * Features:
 * - Read-only view for broker staff
 * - Broker-scoped data filtering
 * - Comprehensive error handling
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { DashboardService } from '../services/dashboard';
import { BrokerManagementService } from '../services/broker-management';
import { UserRole } from '../types';
import { createError } from '../utils';
import { AppError } from '../utils/error-handler';
import { DatabaseService } from '../services/database';
import { Op } from 'sequelize';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

// Broker-scoped dashboard - read-only view for broker staff
router.get('/dashboard', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_COMPLIANCE, UserRole.BROKER_FINANCE, UserRole.BROKER_OPERATIONS, UserRole.BROKER_TRADING, UserRole.BROKER_SUPPORT]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const dashboardData = await DashboardService.getBrokerDashboard(brokerId);
    res.json({ 
      success: true, 
      data: dashboardData,
      permissions: {
        canViewFinancials: req.user?.roles?.includes(UserRole.BROKER_FINANCE) || req.user?.roles?.includes(UserRole.BROKER_ADMIN),
        canViewCompliance: req.user?.roles?.includes(UserRole.BROKER_COMPLIANCE) || req.user?.roles?.includes(UserRole.BROKER_ADMIN),
        canViewOperations: req.user?.roles?.includes(UserRole.BROKER_OPERATIONS) || req.user?.roles?.includes(UserRole.BROKER_ADMIN),
        canViewTrading: req.user?.roles?.includes(UserRole.BROKER_TRADING) || req.user?.roles?.includes(UserRole.BROKER_ADMIN)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Broker-scoped system health - limited view
router.get('/health', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_OPERATIONS]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const brokerConfig = BrokerManagementService.getBroker(brokerId);
    if (!brokerConfig) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Limited health check for broker context
    const healthData = {
      broker: {
        id: brokerConfig.id,
        name: brokerConfig.name,
        status: brokerConfig.status,
        tier: brokerConfig.tier,
        lastActivityAt: brokerConfig.lastActivityAt
      },
      services: {
        brokerManagement: BrokerManagementService.isHealthy() ? 'healthy' : 'unhealthy',
        // Only show broker-relevant services
        api: 'running'
      },
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: healthData });
  } catch (error) {
    next(error);
  }
});

// Broker-scoped metrics - read-only
router.get('/metrics', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_OPERATIONS]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const brokerConfig = BrokerManagementService.getBroker(brokerId);
    if (!brokerConfig) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Broker-specific metrics (limited scope)
    const brokerMetrics = {
      broker: {
        id: brokerConfig.id,
        name: brokerConfig.name,
        status: brokerConfig.status,
        tier: brokerConfig.tier
      },
      metrics: {
        // Only show broker-relevant metrics
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: brokerMetrics });
  } catch (error) {
    next(error);
  }
});

// Broker-scoped user management - read-only
router.get('/users', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_SUPPORT]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { page = 1, limit = 10, search, status } = req.query;
    
    try {
      const UserModel: any = DatabaseService.getModel('User');
      const WalletModel: any = DatabaseService.getModel('Wallet');
      
      // Build where clause - filter users by brokerId through wallets or metadata
      const where: any = {};
      if (status) {
        where.isActive = status === 'active';
      }
      if (search) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${search}%` } },
          { username: { [Op.iLike]: `%${search}%` } },
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      // Query users who have wallets with this brokerId
      const wallets = await WalletModel.findAll({
        where: { brokerId },
        attributes: ['userId'],
        raw: true
      });
      const userIds = [...new Set(wallets.map((w: any) => w.userId))];
      
      if (userIds.length > 0) {
        where.id = { [Op.in]: userIds };
      } else {
        // If no wallets found, return empty result
        res.json({
          success: true,
          data: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          brokerId,
          timestamp: new Date().toISOString()
        });
      }
      
      const offset = (Number(page) - 1) * Number(limit);
      const { rows, count } = await UserModel.findAndCountAll({
        where,
        offset,
        limit: Number(limit),
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['passwordHash'] }
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => r.toJSON()),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          totalPages: Math.ceil(count / Number(limit)),
          hasNext: offset + Number(limit) < count,
          hasPrev: offset > 0
        },
        brokerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      LoggerService.error('Broker-scoped user listing failed:', error);
      if (error instanceof AppError) {
        throw error;
      } else {
        throw AppError.internal('Failed to list broker users', error);
      }
    }
  } catch (error) {
    next(error);
  }
});

// Broker-scoped transaction overview - read-only
router.get('/transactions', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_FINANCE, UserRole.BROKER_TRADING]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { page = 1, limit = 10, status, type, userId } = req.query;
    
    try {
      const TransactionModel: any = DatabaseService.getModel('Transaction');
      const WalletModel: any = DatabaseService.getModel('Wallet');
      
      // Get user IDs associated with this broker through wallets
      const wallets = await WalletModel.findAll({
        where: { brokerId },
        attributes: ['userId'],
        raw: true
      });
      const userIds = [...new Set(wallets.map((w: any) => w.userId))];
      
      if (userIds.length === 0) {
        res.json({
          success: true,
          data: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          brokerId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Build where clause
      const where: any = {
        userId: { [Op.in]: userIds }
      };
      if (status) where.status = status;
      if (type) where.type = type;
      if (userId) where.userId = userId;
      
      const offset = (Number(page) - 1) * Number(limit);
      const { rows, count } = await TransactionModel.findAndCountAll({
        where,
        offset,
        limit: Number(limit),
        order: [['createdAt', 'DESC']],
        include: [{
          model: DatabaseService.getModel('User'),
          as: 'user',
          attributes: ['id', 'email', 'username', 'firstName', 'lastName']
        }]
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => r.toJSON()),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          totalPages: Math.ceil(count / Number(limit)),
          hasNext: offset + Number(limit) < count,
          hasPrev: offset > 0
        },
        brokerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      LoggerService.error('Broker-scoped transaction listing failed:', error);
      if (error instanceof AppError) {
        throw error;
      } else {
        throw AppError.internal('Failed to list broker transactions', error);
      }
    }
  } catch (error) {
    next(error);
  }
});

// Broker-scoped KYC overview - read-only
router.get('/kyc', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_COMPLIANCE]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { page = 1, limit = 10, status, level } = req.query;
    
    try {
      const UserModel: any = DatabaseService.getModel('User');
      const WalletModel: any = DatabaseService.getModel('Wallet');
      
      // Get user IDs associated with this broker through wallets
      const wallets = await WalletModel.findAll({
        where: { brokerId },
        attributes: ['userId'],
        raw: true
      });
      const userIds = [...new Set(wallets.map((w: any) => w.userId))];
      
      if (userIds.length === 0) {
        res.json({
          success: true,
          data: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          brokerId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Build where clause for user KYC status
      const where: any = {
        id: { [Op.in]: userIds }
      };
      if (status) where.kycStatus = status;
      if (level) where.kycLevel = level;
      
      const offset = (Number(page) - 1) * Number(limit);
      const { rows, count } = await UserModel.findAndCountAll({
        where,
        offset,
        limit: Number(limit),
        order: [['createdAt', 'DESC']],
        attributes: [
          'id', 'email', 'username', 'firstName', 'lastName',
          'kycStatus', 'kycLevel', 'isActive', 'isVerified',
          'createdAt', 'updatedAt'
        ]
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => {
          const user = r.toJSON();
          return {
            userId: user.id,
            email: user.email,
            username: user.username,
            name: `${user.firstName} ${user.lastName}`,
            kycStatus: user.kycStatus,
            kycLevel: user.kycLevel,
            isActive: user.isActive,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          };
        }),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          totalPages: Math.ceil(count / Number(limit)),
          hasNext: offset + Number(limit) < count,
          hasPrev: offset > 0
        },
        brokerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      LoggerService.error('Broker-scoped KYC listing failed:', error);
      if (error instanceof AppError) {
        throw error;
      } else {
        throw AppError.internal('Failed to list broker KYC records', error);
      }
    }
  } catch (error) {
    next(error);
  }
});

// Broker-scoped audit logs - read-only
router.get('/audit-logs', requireRole(['broker-admin', 'broker-compliance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
    
    try {
      const AuditLogModel: any = DatabaseService.getModel('AuditLog');
      
      // Build where clause
      const where: any = {
        brokerId
      };
      if (action) where.action = action;
      if (userId) where.userId = userId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate as string);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate as string);
      }
      
      const offset = (Number(page) - 1) * Number(limit);
      const { rows, count } = await AuditLogModel.findAndCountAll({
        where,
        offset,
        limit: Number(limit),
        order: [['createdAt', 'DESC']]
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => r.toJSON()),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          totalPages: Math.ceil(count / Number(limit)),
          hasNext: offset + Number(limit) < count,
          hasPrev: offset > 0
        },
        brokerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      LoggerService.error('Broker-scoped audit log listing failed:', error);
      if (error instanceof AppError) {
        throw error;
      } else {
        throw AppError.internal('Failed to list broker audit logs', error);
      }
    }
  } catch (error) {
    next(error);
  }
});

export default router;
