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
import type { Request, Response, NextFunction } from 'express';
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    
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
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          brokerId,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const offset = (page - 1) * limit;
      const { rows, count } = await UserModel.findAndCountAll({
        where,
        offset,
        limit,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['passwordHash'] }
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => r.toJSON()),
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
          hasNext: offset + limit < count,
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string | undefined;
    
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
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          brokerId,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Build where clause
      const where: any = {
        userId: { [Op.in]: userIds }
      };
      if (status) where.status = status;
      if (type) where.type = type;
      if (userId) where.userId = userId;
      
      const offset = (page - 1) * limit;
      const { rows, count } = await TransactionModel.findAndCountAll({
        where,
        offset,
        limit,
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
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
          hasNext: offset + limit < count,
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
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
      
      const offset = (page - 1) * limit;
      const { rows, count } = await AuditLogModel.findAndCountAll({
        where,
        offset,
        limit,
        order: [['createdAt', 'DESC']]
      });
      
      res.json({
        success: true,
        data: rows.map((r: any) => r.toJSON()),
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
          hasNext: offset + limit < count,
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

/**
 * Get Broker Compliance Status
 * GET /api/broker/compliance
 */
router.get('/compliance', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_COMPLIANCE]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    // Get compliance status for broker
    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    const compliance = broker.compliance || {} as any;
    const complianceStatus = {
      brokerId,
      status: compliance.auditStatus === 'passed' ? 'compliant' : (compliance.auditStatus || 'compliant'),
      requirements: {
        kyc: compliance.kycRequired ? 'complete' : 'not_required',
        aml: compliance.amlRequired ? 'complete' : 'not_required',
        reporting: compliance.reporting ? 'up_to_date' : 'not_required'
      },
      lastAudit: compliance.lastAuditDate?.toISOString() || new Date().toISOString(),
      nextAudit: compliance.nextAuditDate?.toISOString() || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: compliance.violations?.filter((v: any) => v.status === 'open') || [],
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: complianceStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Broker Trading Configuration
 * GET /api/broker/trading/config
 */
router.get('/trading/config', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_TRADING]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    // Get trading configuration for broker
    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    const tradingConfig = {
      brokerId,
      pairs: (broker.features as any)?.tradingPairs || [],
      fees: (broker.features as any)?.tradingFees || {
        maker: 0.001,
        taker: 0.002
      },
      limits: broker.limits || {
        minOrderSize: 10,
        maxOrderSize: 1000000
      },
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: tradingConfig });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Broker Trading Configuration
 * PUT /api/broker/trading/config
 */
router.put('/trading/config', requireRole([UserRole.BROKER_ADMIN, UserRole.BROKER_TRADING]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { pairs, fees, limits } = req.body;

    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Update broker configuration
    broker.features = {
      ...broker.features,
      ...(pairs ? { tradingPairs: pairs } : {}),
      ...(fees ? { tradingFees: fees } : {})
    } as any;
    broker.limits = {
      ...broker.limits,
      ...limits
    };
    broker.updatedAt = new Date();

    // Save to database via BrokerManagementService
    await BrokerManagementService.updateBroker(brokerId, {
      features: broker.features,
      limits: broker.limits
    });

    LoggerService.info('Broker trading config updated', { brokerId, pairs, fees, limits });

    res.json({
      success: true,
      data: {
        brokerId,
        pairs: pairs || [],
        fees: fees || { maker: 0.001, taker: 0.002 },
        limits: limits || { minOrderSize: 10, maxOrderSize: 1000000 }
      },
      message: 'Trading configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Broker Settings
 * GET /api/broker/settings
 */
router.get('/settings', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const brokerConfig = BrokerManagementService.getBroker(brokerId);
    if (!brokerConfig) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Get settings from broker configuration
    const brokerSettings = (brokerConfig as any).settings || {};
    const settings = {
      brokerId,
      features: brokerConfig.features || {},
      notifications: brokerSettings.notifications || {
        email: true,
        sms: false
      },
      security: brokerSettings.security || {
        twoFactorRequired: false,
        sessionTimeout: 3600
      },
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Broker Settings
 * PUT /api/broker/settings
 */
router.put('/settings', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const settings = req.body;

    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Update broker settings (stored as metadata in BrokerConfig)
    const brokerSettings = (broker as any).settings || {};
    (broker as any).settings = {
      ...brokerSettings,
      ...settings
    };
    broker.updatedAt = new Date();

    // Save to database via BrokerManagementService
    await BrokerManagementService.updateBroker(brokerId, {
      ...(settings ? { settings: (broker as any).settings } : {})
    } as any);

    LoggerService.info('Broker settings updated', { brokerId, settings });

    res.json({
      success: true,
      data: {
        brokerId,
        ...settings
      },
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Broker Branding
 * GET /api/broker/settings/branding
 */
router.get('/settings/branding', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    // Get branding from broker configuration
    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    const branding = {
      brokerId,
      logo: broker.branding?.logo || null,
      primaryColor: broker.branding?.primaryColor || '#6366f1',
      secondaryColor: broker.branding?.secondaryColor || '#8b5cf6',
      customCSS: broker.branding?.customCss || '',
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: branding });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Broker Branding
 * PUT /api/broker/settings/branding
 */
router.put('/settings/branding', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const { logo, primaryColor, secondaryColor, customCSS } = req.body;

    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Update broker branding
    broker.branding = {
      ...broker.branding,
      logo: logo || broker.branding?.logo,
      primaryColor: primaryColor || broker.branding?.primaryColor,
      secondaryColor: secondaryColor || broker.branding?.secondaryColor,
      customCss: customCSS || broker.branding?.customCss || ''
    };
    broker.updatedAt = new Date();

    // Save to database via BrokerManagementService
    await BrokerManagementService.updateBroker(brokerId, {
      branding: broker.branding
    });

    LoggerService.info('Broker branding updated', { brokerId, primaryColor, secondaryColor });

    res.json({
      success: true,
      data: {
        brokerId,
        logo,
        primaryColor: primaryColor || '#6366f1',
        secondaryColor: secondaryColor || '#8b5cf6',
        customCSS: customCSS || ''
      },
      message: 'Branding updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Broker Limits
 * GET /api/broker/settings/limits
 */
router.get('/settings/limits', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    // Get limits from broker configuration
    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    const limits = {
      brokerId,
      maxDailyVolume: broker.limits?.maxTradingVolume || 1000000,
      maxMonthlyVolume: (broker.limits?.maxTradingVolume || 1000000) * 30,
      maxSingleTransaction: broker.limits?.maxWithdrawalAmount || 100000,
      maxDailyWithdrawal: broker.limits?.maxWithdrawalAmount || 50000,
      maxMonthlyWithdrawal: (broker.limits?.maxWithdrawalAmount || 50000) * 10,
      maxDailyDeposit: broker.limits?.maxDepositAmount || 100000,
      maxMonthlyDeposit: (broker.limits?.maxDepositAmount || 100000) * 10,
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, data: limits });
  } catch (error) {
    next(error);
  }
});

/**
 * Update Broker Limits
 * PUT /api/broker/settings/limits
 */
router.put('/settings/limits', requireRole([UserRole.BROKER_ADMIN]), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brokerId = req.user?.brokerId;
    if (!brokerId) {
      throw createError('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
    }

    const limits = req.body;

    const broker = BrokerManagementService.getBroker(brokerId);
    if (!broker) {
      throw createError('Broker not found', 404, 'BROKER_NOT_FOUND');
    }

    // Update broker limits
    broker.limits = {
      ...broker.limits,
      maxTradingVolume: limits.maxDailyVolume || broker.limits?.maxTradingVolume,
      maxWithdrawalAmount: limits.maxDailyWithdrawal || broker.limits?.maxWithdrawalAmount,
      maxDepositAmount: limits.maxDailyDeposit || broker.limits?.maxDepositAmount
    };
    broker.updatedAt = new Date();

    // Save to database via BrokerManagementService
    await BrokerManagementService.updateBroker(brokerId, {
      limits: broker.limits
    });

    LoggerService.info('Broker limits updated', { brokerId, limits });

    res.json({
      success: true,
      data: {
        brokerId,
        ...limits
      },
      message: 'Limits updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
