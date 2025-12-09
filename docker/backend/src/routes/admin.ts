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
import { authenticateToken, requireRole, requirePermission } from '../middleware/error-handler';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { DashboardService } from '../services/dashboard';
import { MetricsService } from '../services/metrics';
import { createError } from '../utils';
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
    const { page = 1, limit = 10, search, role, status } = req.query as any;
    const UserModel: any = DatabaseService.getModel('User');
    const where: any = {};
    if (role) where.role = role;
    if (status) where.isActive = status === 'active';
    if (search) where.username = { [Op.like]: `%${search}%` } as any;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await UserModel.findAndCountAll({ where, offset, limit: Number(limit), order: [['createdAt','DESC']] });
    res.json({ success: true, data: rows.map((r: any) => r.toJSON()), pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / Number(limit)), hasNext: offset + Number(limit) < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
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
    const { page = 1, limit = 10, status, type, userId } = req.query as any;
    const TxModel: any = DatabaseService.getModel('Transaction');
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (userId) where.userId = userId;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await TxModel.findAndCountAll({ where, offset, limit: Number(limit), order: [['createdAt','DESC']] });
    res.json({ success: true, data: rows.map((r: any) => r.toJSON()), pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / Number(limit)), hasNext: offset + Number(limit) < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
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
    const { page = 1, limit = 10, status, level, brokerId } = req.query;
    
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
        port: (config as any).server?.port,
        environment: (config as any).server?.environment,
        host: (config as any).server?.host
      },
      database: {
        host: config.database.host,
        port: config.database.port,
        name: (config.database as any).name,
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
      keycloak: {
        baseUrl: config.keycloak.baseUrl,
        realm: config.keycloak.realm,
        timeout: config.keycloak.timeout
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
        (ConfigService as any).reloadConfig();
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
    const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
    
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
    } catch (error) {
      healthChecks.database = 'unhealthy';
    }
    
    // Check Redis
    try {
      const redisHealthy = (RedisService as any).isHealthy ? (RedisService as any).isHealthy() : true;
      healthChecks.redis = redisHealthy ? 'healthy' : 'unhealthy';
    } catch (error) {
      healthChecks.redis = 'unhealthy';
    }
    
    // Check Kafka (EventStreamingService)
    try {
      const { EventStreamingService } = await import('../services/event-streaming');
      const kafkaHealthy = (EventStreamingService as any).isConnected || false;
      healthChecks.kafka = kafkaHealthy ? 'healthy' : 'degraded';
    } catch (error) {
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

export default router;
