/**
 * Admin Routes
 * 
 * Express router for administrative endpoints and system management.
 * 
 * Endpoints:
 * - GET /prometheus/metrics - Prometheus metrics (public, text format)
 * - GET /prometheus/metrics/json - Prometheus metrics as JSON (admin only)
 * - GET /dashboard - System dashboard data (admin only)
 * - GET /health - Detailed health check (admin only)
 * - GET /system/info - System information (admin only)
 * - GET /system/stats - System statistics (admin only)
 * - GET /logs - Application logs (admin only)
 * - GET /audit - Audit logs (admin only)
 * 
 * Security:
 * - Most routes require authentication
 * - Admin/super_admin role required for sensitive endpoints
 * - Metrics endpoint is public for Prometheus scraping
 * 
 * Features:
 * - System monitoring and metrics
 * - Health check aggregation
 * - Log access and filtering
 * - Audit trail access
 */

import { Router } from 'express';
import { Op } from 'sequelize';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { DashboardService } from '../services/dashboard';
import { MetricsService } from '../services/metrics';
// createError imported but not used in this file
import { DatabaseService } from '../services/database';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

// Prometheus metrics endpoint
router.get('/prometheus/metrics', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const metrics = await MetricsService.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    next(error);
  }
});

// Prometheus metrics as JSON
router.get('/prometheus/metrics/json', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const metrics = await MetricsService.getMetricsAsJSON();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Metrics endpoint
router.get('/metrics', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const metrics = LoggerService.getMetrics();
    
    res.json({
      success: true,
      data: {
        logging: metrics,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error) {
    next(error);
  }
});

// System information (platform)
router.get('/system-info', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const info = await DashboardService.getSystemInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    next(error);
  }
});

// Platform dashboard snapshot
router.get('/dashboard/platform', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await DashboardService.getPlatformDashboard();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Broker dashboard snapshot
router.get('/dashboard/broker/:brokerId', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId } = req.params;
    if (!brokerId) {
      res.status(400).json({ success: false, error: 'Broker ID is required' });
      return;
    }
    const data = await DashboardService.getBrokerDashboard(brokerId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Admin dashboard routes
router.get('/dashboard', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const UserModel: any = DatabaseService.getModel('User');
    const TxModel: any = DatabaseService.getModel('Transaction');
    const TenantModel: any = DatabaseService.getModel('Tenant');

    const [totalUsers, totalTransactions, activeTenants] = await Promise.all([
      UserModel.count(),
      TxModel.count(),
      TenantModel.count({ where: { isActive: true } })
    ]);

    const kycPending = await UserModel.count({ where: { kycStatus: 'pending_review' } });
    const recentActivity = await TxModel.findAll({ order: [['createdAt','DESC']], limit: 10 });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTransactions,
        totalRevenue: 0,
        activeTenants,
        kycPending,
        recentActivity: recentActivity.map((r: any) => r.toJSON())
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    next(error);
  }
});

// User management routes
router.get('/users', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;
    const UserModel: any = DatabaseService.getModel('User');
    const where: any = {};
    if (role) where.role = role;
    if (status) where.isActive = status === 'active';
    if (search) where.username = { [Op.like]: `%${search}%` } as any;
    const offset = (page - 1) * limit;
    const { rows, count } = await UserModel.findAndCountAll({ where, offset, limit, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rows.map((r: any) => r.toJSON()), pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit), hasNext: offset + limit < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
  } catch (error) { next(error); }
});

router.get('/users/:id', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const UserModel: any = DatabaseService.getModel('User');
    const user = await UserModel.findByPk(id);
    res.json({ success: true, data: user ? user.toJSON() : null, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
  } catch (error) { next(error); }
});

router.put('/users/:id', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }
    const updateData = req.body;
    const UserModel: any = DatabaseService.getModel('User');
    const user = await UserModel.findByPk(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    await user.update(updateData);
    res.json({ success: true, data: user.toJSON(), timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
  } catch (error) { next(error); }
});

router.delete('/users/:id', requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }
    const UserModel: any = DatabaseService.getModel('User');
    const user = await UserModel.findByPk(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    await user.destroy();
    res.json({ success: true, message: 'User deleted', timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
  } catch (error) { next(error); }
});

// Transaction management routes
router.get('/transactions', requireRole(['admin', 'super_admin', 'finance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string | undefined;
    const TxModel: any = DatabaseService.getModel('Transaction');
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (userId) where.userId = userId;
    const offset = (page - 1) * limit;
    const { rows, count } = await TxModel.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rows.map((r: any) => r.toJSON()), pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit), hasNext: offset + limit < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
  } catch (error) { next(error); }
});

router.put('/transactions/:id', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, metadata } = req.body;
    
    // Get transaction from database
    const TransactionModel: any = DatabaseService.getModel('Transaction');
    const transaction = await TransactionModel.findByPk(id);
    
    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
      return;
    }
    
    // Prepare update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) {
      const currentMetadata = transaction.dataValues?.metadata || transaction.metadata || {};
      updateData.metadata = { ...currentMetadata, adminNotes: notes };
    }
    if (metadata) {
      const currentMetadata = transaction.dataValues?.metadata || transaction.metadata || {};
      updateData.metadata = { ...currentMetadata, ...metadata };
    }
    
    // Update transaction
    await transaction.update(updateData);
    
    LoggerService.info('Transaction updated by admin', {
      transactionId: id,
      updatedBy: (req.user as any)?.userId,
      changes: updateData
    });
    
    res.json({
      success: true,
      data: {
        id: transaction.dataValues?.id || transaction.id,
        ...updateData,
        updatedAt: new Date()
      },
      message: 'Transaction updated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// KYC management routes
router.get('/kyc', requireRole(['admin', 'super_admin', 'compliance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;
    const level = req.query.level as string | undefined;
    const brokerId = req.query.brokerId as string | undefined;
    
    // Get all KYC users from the service
    const { KYCService } = await import('../services/kyc');
    
    // KYCService stores users in a Map, get all of them
    const allUsers = Array.from((KYCService as any).users?.values() || []);
    
    // Apply filters
    let filteredUsers = allUsers;
    
    if (status) {
      filteredUsers = filteredUsers.filter((user: any) => user.status === status);
    }
    
    if (level) {
      filteredUsers = filteredUsers.filter((user: any) => user.kycLevel === level);
    }
    
    if (brokerId) {
      filteredUsers = filteredUsers.filter((user: any) => user.brokerId === brokerId);
    }
    
    // Sort by createdAt descending
    filteredUsers.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Apply pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedUsers = filteredUsers.slice(offset, offset + limitNum);
    
    res.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.put('/kyc/:id', requireRole(['admin', 'super_admin', 'compliance']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
    const { id } = req.params;
    const { status, notes, level } = req.body;
    
    // Get KYC user
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
      return;
    }
    
    const { KYCService } = await import('../services/kyc');
    const user = await KYCService.getUserById(id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'KYC user not found',
        code: 'KYC_USER_NOT_FOUND'
      });
      return;
    }
    
    // Update status if provided
    if (status) {
      // Use KYCService to update status
      // Since KYCService doesn't expose updateStatus directly, we'll update the user object
      const updatedUser = { ...user, status: status as any };
      (KYCService as any).users.set(id, updatedUser);
    }
    
    // Update level if provided
    if (level) {
      await KYCService.updateKYCLevel(id, level as any, 'admin_update');
    }
    
    LoggerService.info('KYC status updated by admin', {
      kycUserId: id,
      updatedBy: (req.user as any)?.userId,
      status,
      level,
      notes
    });
    
    const updatedUser = await KYCService.getUserById(id);
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'KYC status updated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// System settings routes
router.get('/settings', requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get system settings from ConfigService
    const { ConfigService } = await import('../services/config');
    const config = ConfigService.getConfig();
    
    // Return sanitized config (remove sensitive data like private keys)
    const safeConfig = {
      server: {
        port: (config as any).port,
        environment: (config as any).env,
        host: process.env.HOST || '0.0.0.0'
      },
      database: {
        host: config.database.host,
        port: config.database.port,
        name: (config.database as any).database,
        ssl: config.database.ssl
      },
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        enabled: (config.redis as any).enabled ?? true
      },
      blockchain: {
        rpcUrl: config.blockchain.rpcUrl,
        networkId: config.blockchain.networkId,
        confirmations: config.blockchain.confirmations
      },
      zitadel: {
        issuer: config.zitadel.issuer,
        jwksUri: config.zitadel.jwksUri,
        audience: config.zitadel.audience
      },
      kafka: {
        brokers: config.kafka.brokers,
        ssl: config.kafka.ssl
      },
      features: (config as any).features || {}
    };
    
    res.json({
      success: true,
      data: safeConfig,
      message: 'System settings retrieved successfully',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', requireRole(['super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settingsData = req.body;
    
    // Note: ConfigService doesn't have a direct update method
    // Settings should be updated via environment variables and config reload
    // For now, we'll return the settings data and log the update request
    
    LoggerService.info('System settings update requested by super_admin', {
      updatedBy: (req.user as any)?.userId,
      settings: Object.keys(settingsData),
      note: 'Settings require environment variable changes and service restart'
    });
    
    // Reload config if ConfigService supports it
    try {
      const { ConfigService } = await import('../services/config');
      if ((ConfigService as any).reloadConfig) {
        await (ConfigService as any).reloadConfig();
      }
    } catch (error) {
      LoggerService.warn('Could not reload config', { error });
    }
    
    res.json({
      success: true,
      data: settingsData,
      message: 'Settings update request received. Changes may require environment variable updates and service restart.',
      timestamp: new Date(),
      warning: 'For production, update environment variables and restart services'
    });
  } catch (error) {
    next(error);
  }
});

// Audit logs routes
router.get('/audit-logs', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    // Get audit logs from database (EventStreamingService stores events in Kafka)
    // For now, we'll query the database for audit-related events
    // In production, this would query Kafka or an audit log database
    
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');
    if (!AuditLogModel) {
      // If no AuditLog model, return empty with note
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
        message: 'Audit logs not available (AuditLog model not configured)',
        timestamp: new Date()
      });
    }
    
    // Build query
    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate as string);
    }
    
    // Get total count
    const total = await AuditLogModel.count({ where });
    
    // Get paginated results
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const logs = await AuditLogModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
                offset
    });
    
    const totalPages = Math.ceil(total / limitNum);
    
    res.json({
      success: true,
      data: logs.map((log: any) => ({
        id: log.dataValues?.id || log.id,
        action: log.dataValues?.action || log.action,
        userId: log.dataValues?.userId || log.userId,
        resource: log.dataValues?.resource || log.resource,
        resourceId: log.dataValues?.resourceId || log.resourceId,
        ipAddress: log.dataValues?.ipAddress || log.ipAddress,
        userAgent: log.dataValues?.userAgent || log.userAgent,
        metadata: log.dataValues?.metadata || log.metadata,
        createdAt: log.dataValues?.createdAt || log.createdAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// System health and metrics
router.get('/health', requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check service health
    const { DatabaseService } = await import('../services/database');
    const { RedisService } = await import('../services/redis');
    
    const healthChecks: any = {
      database: 'unknown',
      redis: 'unknown',
      kafka: 'unknown'
    };
    
    // Check database
    try {
      const dbHealthy = await DatabaseService.healthCheck();
      healthChecks.database = dbHealthy ? 'healthy' : 'unhealthy';
    } catch {
      healthChecks.database = 'unhealthy';
    }
    
    // Check Redis
    try {
      const redisHealthy = (RedisService as any).isHealthy ? (RedisService as any).isHealthy() : true;
      healthChecks.redis = redisHealthy ? 'healthy' : 'unhealthy';
    } catch {
      healthChecks.redis = 'unhealthy';
    }
    
    // Check Kafka (EventStreamingService)
    try {
      const { EventStreamingService } = await import('../services/event-streaming');
      const kafkaHealthy = (EventStreamingService as any).isConnected || false;
      healthChecks.kafka = kafkaHealthy ? 'healthy' : 'degraded';
    } catch {
      healthChecks.kafka = 'unknown';
    }
    
    // Overall status
    const allHealthy = Object.values(healthChecks).every(status => status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 
                         Object.values(healthChecks).some(status => status === 'unhealthy') ? 'unhealthy' : 'degraded';
    
    res.json({
      success: true,
      data: {
        status: overallStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        services: healthChecks,
        timestamp: new Date()
      },
      message: 'System health check completed',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/user-limits/:userId
 * Get user transaction limits and usage
 */
router.get('/user-limits/:userId', requireRole(['admin', 'super_admin', 'user']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req.user as any)?.userId || (req.user as any)?.id;
    const requestingRole = (req.user as any)?.role;

    // Users can only view their own limits unless they're admin
    if (requestingRole !== 'admin' && requestingRole !== 'super_admin' && userId !== requestingUserId) {
      return next({ status: 403, message: 'Access denied', code: 'ACCESS_DENIED' });
    }

    // Import services
    const { TransactionVolumeTrackerService } = await import('../services/transaction-volume-tracker.service');
    const { KYCService } = await import('../services/kyc');
    const { DatabaseService } = await import('../services/database');

    // Get user's tenant ID
    const UserModel = DatabaseService.getModel('User');
    const user = await UserModel.findByPk(userId);
    if (!user) {
      return next({ status: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const tenantId = (user as any).tenantId || '10000000-0000-0000-0000-000000000000';

    // Ensure userId is a string
    if (!userId || typeof userId !== 'string') {
      return next({ status: 400, message: 'Invalid user ID', code: 'INVALID_USER_ID' });
    }

    // Import TimePeriod enum
    const { TimePeriod } = await import('../services/transaction-volume-tracker.service');

    // Get KYC status
    let kycStatus: any = { kycLevel: 'L0', status: 'not_started' };
    try {
      kycStatus = await KYCService.getKYCStatus(userId);
    } catch {
      // Default to L0 if KYC not found
    }

    // Get transaction limits for different types
    const investmentLimit = await TransactionVolumeTrackerService.checkLimit(
      userId,
      tenantId,
      'investment',
      0,
      TimePeriod.TOTAL
    );

    const tradingLimit = await TransactionVolumeTrackerService.checkLimit(
      userId,
      tenantId,
      'trading',
      0,
      TimePeriod.TOTAL
    );

    const withdrawalLimit = await TransactionVolumeTrackerService.checkLimit(
      userId,
      tenantId,
      'withdrawal',
      0,
      TimePeriod.TOTAL
    );

    // Get daily usage
    const dailyInvestment = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'investment',
      TimePeriod.DAILY
    );

    const dailyTrading = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'trading',
      TimePeriod.DAILY
    );

    const dailyWithdrawal = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'withdrawal',
      TimePeriod.DAILY
    );

    // Get monthly usage
    const monthlyInvestment = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'investment',
      TimePeriod.MONTHLY
    );

    const monthlyTrading = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'trading',
      TimePeriod.MONTHLY
    );

    const monthlyWithdrawal = await TransactionVolumeTrackerService.getCumulativeUsage(
      userId,
      tenantId,
      'withdrawal',
      TimePeriod.MONTHLY
    );

    // Calculate max values
    const maxDaily = Math.max(
      investmentLimit.limit,
      tradingLimit.limit,
      withdrawalLimit.limit
    );
    const maxMonthly = Math.max(
      investmentLimit.limit,
      tradingLimit.limit,
      withdrawalLimit.limit
    );
    const maxSingle = Math.max(
      investmentLimit.limit,
      tradingLimit.limit,
      withdrawalLimit.limit
    );
    
    const dailyUsed = Math.max(
      dailyInvestment.total || 0,
      dailyTrading.total || 0,
      dailyWithdrawal.total || 0
    );
    const monthlyUsed = Math.max(
      monthlyInvestment.total || 0,
      monthlyTrading.total || 0,
      monthlyWithdrawal.total || 0
    );
    
    const dailyRemaining = Math.max(0, maxDaily - dailyUsed);
    const monthlyRemaining = Math.max(0, maxMonthly - monthlyUsed);
    
    // Get risk score (default to 0 if not available)
    const riskScore = kycStatus.riskScore || 0;
    
    // Calculate account age
    const accountCreatedAt = (user as any).createdAt ? new Date((user as any).createdAt) : new Date();
    const accountAgeDays = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      data: {
        userId,
        kycLevel: kycStatus.kycLevel || 'L0',
        kycStatus: kycStatus.status || 'not_started',
        riskScore,
        accountAgeDays,
        limits: {
          maxDaily: maxDaily || 0,
          maxMonthly: maxMonthly || 0,
          maxSingle: maxSingle || 0,
          dailyUsed: dailyUsed || 0,
          monthlyUsed: monthlyUsed || 0,
          dailyRemaining: dailyRemaining || 0,
          monthlyRemaining: monthlyRemaining || 0,
          currencies: ['USD', 'USDT', 'BTC', 'ETH'] // Default supported currencies
        },
        access: {
          accountAccess: true,
          tradingAccess: true,
          withdrawalAccess: kycStatus.status === 'approved',
          depositAccess: true,
          availableFeatures: []
        },
        breakdown: {
          investment: {
            daily: dailyInvestment.total || 0,
            monthly: monthlyInvestment.total || 0,
            limit: investmentLimit.limit || 0
          },
          trading: {
            daily: dailyTrading.total || 0,
            monthly: monthlyTrading.total || 0,
            limit: tradingLimit.limit || 0
          },
          withdrawal: {
            daily: dailyWithdrawal.total || 0,
            monthly: monthlyWithdrawal.total || 0,
            limit: withdrawalLimit.limit || 0
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Get user limits failed:', error);
    next(error);
  }
});

export default router;
