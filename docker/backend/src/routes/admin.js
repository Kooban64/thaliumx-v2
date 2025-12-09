"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sequelize_1 = require("sequelize");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const dashboard_1 = require("../services/dashboard");
const metrics_1 = require("../services/metrics");
const database_1 = require("../services/database");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(error_handler_1.authenticateToken);
// Prometheus metrics endpoint
router.get('/prometheus/metrics', async (req, res, next) => {
    try {
        const metrics = await metrics_1.MetricsService.getMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    }
    catch (error) {
        next(error);
    }
});
// Prometheus metrics as JSON
router.get('/prometheus/metrics/json', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const metrics = await metrics_1.MetricsService.getMetricsAsJSON();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
// Metrics endpoint
router.get('/metrics', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const metrics = logger_1.LoggerService.getMetrics();
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
    }
    catch (error) {
        next(error);
    }
});
// System information (platform)
router.get('/system-info', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const info = await dashboard_1.DashboardService.getSystemInfo();
        res.json({ success: true, data: info });
    }
    catch (error) {
        next(error);
    }
});
// Platform dashboard snapshot
router.get('/dashboard/platform', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const data = await dashboard_1.DashboardService.getPlatformDashboard();
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// Broker dashboard snapshot
router.get('/dashboard/broker/:brokerId', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { brokerId } = req.params;
        if (!brokerId) {
            res.status(400).json({ success: false, error: 'Broker ID is required' });
            return;
        }
        const data = await dashboard_1.DashboardService.getBrokerDashboard(brokerId);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
// Admin dashboard routes
router.get('/dashboard', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const UserModel = database_1.DatabaseService.getModel('User');
        const TxModel = database_1.DatabaseService.getModel('Transaction');
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const [totalUsers, totalTransactions, activeTenants] = await Promise.all([
            UserModel.count(),
            TxModel.count(),
            TenantModel.count({ where: { isActive: true } })
        ]);
        const kycPending = await UserModel.count({ where: { kycStatus: 'pending_review' } });
        const recentActivity = await TxModel.findAll({ order: [['createdAt', 'DESC']], limit: 10 });
        res.json({
            success: true,
            data: {
                totalUsers,
                totalTransactions,
                totalRevenue: 0,
                activeTenants,
                kycPending,
                recentActivity: recentActivity.map((r) => r.toJSON())
            },
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] || 'unknown'
        });
    }
    catch (error) {
        next(error);
    }
});
// User management routes
router.get('/users', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, role, status } = req.query;
        const UserModel = database_1.DatabaseService.getModel('User');
        const where = {};
        if (role)
            where.role = role;
        if (status)
            where.isActive = status === 'active';
        if (search)
            where.username = { [sequelize_1.Op.like]: `%${search}%` };
        const offset = (Number(page) - 1) * Number(limit);
        const { rows, count } = await UserModel.findAndCountAll({ where, offset, limit: Number(limit), order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: rows.map((r) => r.toJSON()), pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / Number(limit)), hasNext: offset + Number(limit) < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/users/:id', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const UserModel = database_1.DatabaseService.getModel('User');
        const user = await UserModel.findByPk(id);
        res.json({ success: true, data: user ? user.toJSON() : null, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
    }
    catch (error) {
        next(error);
    }
});
router.put('/users/:id', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ success: false, error: 'User ID is required' });
            return;
        }
        const updateData = req.body;
        const UserModel = database_1.DatabaseService.getModel('User');
        const user = await UserModel.findByPk(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        await user.update(updateData);
        res.json({ success: true, data: user.toJSON(), timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/users/:id', (0, error_handler_1.requireRole)(['super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ success: false, error: 'User ID is required' });
            return;
        }
        const UserModel = database_1.DatabaseService.getModel('User');
        const user = await UserModel.findByPk(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        await user.destroy();
        res.json({ success: true, message: 'User deleted', timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
    }
    catch (error) {
        next(error);
    }
});
// Transaction management routes
router.get('/transactions', (0, error_handler_1.requireRole)(['admin', 'super_admin', 'finance']), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, type, userId } = req.query;
        const TxModel = database_1.DatabaseService.getModel('Transaction');
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        if (userId)
            where.userId = userId;
        const offset = (Number(page) - 1) * Number(limit);
        const { rows, count } = await TxModel.findAndCountAll({ where, offset, limit: Number(limit), order: [['createdAt', 'DESC']] });
        res.json({ success: true, data: rows.map((r) => r.toJSON()), pagination: { page: Number(page), limit: Number(limit), total: count, totalPages: Math.ceil(count / Number(limit)), hasNext: offset + Number(limit) < count, hasPrev: offset > 0 }, timestamp: new Date(), requestId: req.headers['x-request-id'] || 'unknown' });
    }
    catch (error) {
        next(error);
    }
});
router.put('/transactions/:id', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes, metadata } = req.body;
        // Get transaction from database
        const TransactionModel = database_1.DatabaseService.getModel('Transaction');
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
        const updateData = {};
        if (status)
            updateData.status = status;
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
        logger_1.LoggerService.info('Transaction updated by admin', {
            transactionId: id,
            updatedBy: req.user?.userId,
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
    }
    catch (error) {
        next(error);
    }
});
// KYC management routes
router.get('/kyc', (0, error_handler_1.requireRole)(['admin', 'super_admin', 'compliance']), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, level, brokerId } = req.query;
        // Get all KYC users from the service
        const { KYCService } = await import('../services/kyc');
        // KYCService stores users in a Map, get all of them
        const allUsers = Array.from(KYCService.users?.values() || []);
        // Apply filters
        let filteredUsers = allUsers;
        if (status) {
            filteredUsers = filteredUsers.filter((user) => user.status === status);
        }
        if (level) {
            filteredUsers = filteredUsers.filter((user) => user.kycLevel === level);
        }
        if (brokerId) {
            filteredUsers = filteredUsers.filter((user) => user.brokerId === brokerId);
        }
        // Sort by createdAt descending
        filteredUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    }
    catch (error) {
        next(error);
    }
});
router.put('/kyc/:id', (0, error_handler_1.requireRole)(['admin', 'super_admin', 'compliance']), async (req, res, next) => {
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
            const updatedUser = { ...user, status: status };
            KYCService.users.set(id, updatedUser);
        }
        // Update level if provided
        if (level) {
            await KYCService.updateKYCLevel(id, level, 'admin_update');
        }
        logger_1.LoggerService.info('KYC status updated by admin', {
            kycUserId: id,
            updatedBy: req.user?.userId,
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
    }
    catch (error) {
        next(error);
    }
});
// System settings routes
router.get('/settings', (0, error_handler_1.requireRole)(['super_admin']), async (req, res, next) => {
    try {
        // Get system settings from ConfigService
        const { ConfigService } = await import('../services/config');
        const config = ConfigService.getConfig();
        // Return sanitized config (remove sensitive data like private keys)
        const safeConfig = {
            server: {
                port: config.server?.port,
                environment: config.server?.environment,
                host: config.server?.host
            },
            database: {
                host: config.database.host,
                port: config.database.port,
                name: config.database.name,
                ssl: config.database.ssl
            },
            redis: {
                host: config.redis.host,
                port: config.redis.port,
                enabled: config.redis.enabled ?? true
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
            features: config.features || {}
        };
        res.json({
            success: true,
            data: safeConfig,
            message: 'System settings retrieved successfully',
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.put('/settings', (0, error_handler_1.requireRole)(['super_admin']), async (req, res, next) => {
    try {
        const settingsData = req.body;
        // Note: ConfigService doesn't have a direct update method
        // Settings should be updated via environment variables and config reload
        // For now, we'll return the settings data and log the update request
        logger_1.LoggerService.info('System settings update requested by super_admin', {
            updatedBy: req.user?.userId,
            settings: Object.keys(settingsData),
            note: 'Settings require environment variable changes and service restart'
        });
        // Reload config if ConfigService supports it
        try {
            const { ConfigService } = await import('../services/config');
            if (ConfigService.reloadConfig) {
                ConfigService.reloadConfig();
            }
        }
        catch (error) {
            logger_1.LoggerService.warn('Could not reload config', { error });
        }
        res.json({
            success: true,
            data: settingsData,
            message: 'Settings update request received. Changes may require environment variable updates and service restart.',
            timestamp: new Date(),
            warning: 'For production, update environment variables and restart services'
        });
    }
    catch (error) {
        next(error);
    }
});
// Audit logs routes
router.get('/audit-logs', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
        // Get audit logs from database (EventStreamingService stores events in Kafka)
        // For now, we'll query the database for audit-related events
        // In production, this would query Kafka or an audit log database
        const AuditLogModel = database_1.DatabaseService.getModel('AuditLog');
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
        const where = {};
        if (action)
            where.action = action;
        if (userId)
            where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt[sequelize_1.Op.gte] = new Date(startDate);
            if (endDate)
                where.createdAt[sequelize_1.Op.lte] = new Date(endDate);
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
            data: logs.map((log) => ({
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
    }
    catch (error) {
        next(error);
    }
});
// System health and metrics
router.get('/health', (0, error_handler_1.requireRole)(['admin', 'super_admin']), async (req, res, next) => {
    try {
        // Check service health
        const { DatabaseService } = await import('../services/database');
        const { RedisService } = await import('../services/redis');
        const healthChecks = {
            database: 'unknown',
            redis: 'unknown',
            kafka: 'unknown'
        };
        // Check database
        try {
            const dbHealthy = await DatabaseService.healthCheck();
            healthChecks.database = dbHealthy ? 'healthy' : 'unhealthy';
        }
        catch (error) {
            healthChecks.database = 'unhealthy';
        }
        // Check Redis
        try {
            const redisHealthy = RedisService.isHealthy ? RedisService.isHealthy() : true;
            healthChecks.redis = redisHealthy ? 'healthy' : 'unhealthy';
        }
        catch (error) {
            healthChecks.redis = 'unhealthy';
        }
        // Check Kafka (EventStreamingService)
        try {
            const { EventStreamingService } = await import('../services/event-streaming');
            const kafkaHealthy = EventStreamingService.isConnected || false;
            healthChecks.kafka = kafkaHealthy ? 'healthy' : 'degraded';
        }
        catch (error) {
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map