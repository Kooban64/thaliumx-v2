"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const dashboard_1 = require("../services/dashboard");
const broker_management_1 = require("../services/broker-management");
const types_1 = require("../types");
const utils_1 = require("../utils");
const error_handler_2 = require("../utils/error-handler");
const database_1 = require("../services/database");
const sequelize_1 = require("sequelize");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(error_handler_1.authenticateToken);
// Broker-scoped dashboard - read-only view for broker staff
router.get('/dashboard', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_COMPLIANCE, types_1.UserRole.BROKER_FINANCE, types_1.UserRole.BROKER_OPERATIONS, types_1.UserRole.BROKER_TRADING, types_1.UserRole.BROKER_SUPPORT]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const dashboardData = await dashboard_1.DashboardService.getBrokerDashboard(brokerId);
        res.json({
            success: true,
            data: dashboardData,
            permissions: {
                canViewFinancials: req.user?.roles?.includes(types_1.UserRole.BROKER_FINANCE) || req.user?.roles?.includes(types_1.UserRole.BROKER_ADMIN),
                canViewCompliance: req.user?.roles?.includes(types_1.UserRole.BROKER_COMPLIANCE) || req.user?.roles?.includes(types_1.UserRole.BROKER_ADMIN),
                canViewOperations: req.user?.roles?.includes(types_1.UserRole.BROKER_OPERATIONS) || req.user?.roles?.includes(types_1.UserRole.BROKER_ADMIN),
                canViewTrading: req.user?.roles?.includes(types_1.UserRole.BROKER_TRADING) || req.user?.roles?.includes(types_1.UserRole.BROKER_ADMIN)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped system health - limited view
router.get('/health', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_OPERATIONS]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const brokerConfig = broker_management_1.BrokerManagementService.getBroker(brokerId);
        if (!brokerConfig) {
            throw (0, utils_1.createError)('Broker not found', 404, 'BROKER_NOT_FOUND');
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
                brokerManagement: broker_management_1.BrokerManagementService.isHealthy() ? 'healthy' : 'unhealthy',
                // Only show broker-relevant services
                api: 'running'
            },
            timestamp: new Date().toISOString()
        };
        res.json({ success: true, data: healthData });
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped metrics - read-only
router.get('/metrics', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_OPERATIONS]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const brokerConfig = broker_management_1.BrokerManagementService.getBroker(brokerId);
        if (!brokerConfig) {
            throw (0, utils_1.createError)('Broker not found', 404, 'BROKER_NOT_FOUND');
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
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped user management - read-only
router.get('/users', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_SUPPORT]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const { page = 1, limit = 10, search, status } = req.query;
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const WalletModel = database_1.DatabaseService.getModel('Wallet');
            // Build where clause - filter users by brokerId through wallets or metadata
            const where = {};
            if (status) {
                where.isActive = status === 'active';
            }
            if (search) {
                where[sequelize_1.Op.or] = [
                    { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                    { username: { [sequelize_1.Op.iLike]: `%${search}%` } },
                    { firstName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                    { lastName: { [sequelize_1.Op.iLike]: `%${search}%` } }
                ];
            }
            // Query users who have wallets with this brokerId
            const wallets = await WalletModel.findAll({
                where: { brokerId },
                attributes: ['userId'],
                raw: true
            });
            const userIds = [...new Set(wallets.map((w) => w.userId))];
            if (userIds.length > 0) {
                where.id = { [sequelize_1.Op.in]: userIds };
            }
            else {
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
                data: rows.map((r) => r.toJSON()),
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
        }
        catch (error) {
            logger_1.LoggerService.error('Broker-scoped user listing failed:', error);
            if (error instanceof error_handler_2.AppError) {
                throw error;
            }
            else {
                throw error_handler_2.AppError.internal('Failed to list broker users', error);
            }
        }
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped transaction overview - read-only
router.get('/transactions', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_FINANCE, types_1.UserRole.BROKER_TRADING]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const { page = 1, limit = 10, status, type, userId } = req.query;
        try {
            const TransactionModel = database_1.DatabaseService.getModel('Transaction');
            const WalletModel = database_1.DatabaseService.getModel('Wallet');
            // Get user IDs associated with this broker through wallets
            const wallets = await WalletModel.findAll({
                where: { brokerId },
                attributes: ['userId'],
                raw: true
            });
            const userIds = [...new Set(wallets.map((w) => w.userId))];
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
            const where = {
                userId: { [sequelize_1.Op.in]: userIds }
            };
            if (status)
                where.status = status;
            if (type)
                where.type = type;
            if (userId)
                where.userId = userId;
            const offset = (Number(page) - 1) * Number(limit);
            const { rows, count } = await TransactionModel.findAndCountAll({
                where,
                offset,
                limit: Number(limit),
                order: [['createdAt', 'DESC']],
                include: [{
                        model: database_1.DatabaseService.getModel('User'),
                        as: 'user',
                        attributes: ['id', 'email', 'username', 'firstName', 'lastName']
                    }]
            });
            res.json({
                success: true,
                data: rows.map((r) => r.toJSON()),
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
        }
        catch (error) {
            logger_1.LoggerService.error('Broker-scoped transaction listing failed:', error);
            if (error instanceof error_handler_2.AppError) {
                throw error;
            }
            else {
                throw error_handler_2.AppError.internal('Failed to list broker transactions', error);
            }
        }
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped KYC overview - read-only
router.get('/kyc', (0, error_handler_1.requireRole)([types_1.UserRole.BROKER_ADMIN, types_1.UserRole.BROKER_COMPLIANCE]), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const { page = 1, limit = 10, status, level } = req.query;
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const WalletModel = database_1.DatabaseService.getModel('Wallet');
            // Get user IDs associated with this broker through wallets
            const wallets = await WalletModel.findAll({
                where: { brokerId },
                attributes: ['userId'],
                raw: true
            });
            const userIds = [...new Set(wallets.map((w) => w.userId))];
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
            const where = {
                id: { [sequelize_1.Op.in]: userIds }
            };
            if (status)
                where.kycStatus = status;
            if (level)
                where.kycLevel = level;
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
                data: rows.map((r) => {
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
        }
        catch (error) {
            logger_1.LoggerService.error('Broker-scoped KYC listing failed:', error);
            if (error instanceof error_handler_2.AppError) {
                throw error;
            }
            else {
                throw error_handler_2.AppError.internal('Failed to list broker KYC records', error);
            }
        }
    }
    catch (error) {
        next(error);
    }
});
// Broker-scoped audit logs - read-only
router.get('/audit-logs', (0, error_handler_1.requireRole)(['broker-admin', 'broker-compliance']), async (req, res, next) => {
    try {
        const brokerId = req.user?.brokerId;
        if (!brokerId) {
            throw (0, utils_1.createError)('Broker ID not found in user context', 400, 'BROKER_ID_REQUIRED');
        }
        const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
        try {
            const AuditLogModel = database_1.DatabaseService.getModel('AuditLog');
            // Build where clause
            const where = {
                brokerId
            };
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
            const offset = (Number(page) - 1) * Number(limit);
            const { rows, count } = await AuditLogModel.findAndCountAll({
                where,
                offset,
                limit: Number(limit),
                order: [['createdAt', 'DESC']]
            });
            res.json({
                success: true,
                data: rows.map((r) => r.toJSON()),
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
        }
        catch (error) {
            logger_1.LoggerService.error('Broker-scoped audit log listing failed:', error);
            if (error instanceof error_handler_2.AppError) {
                throw error;
            }
            else {
                throw error_handler_2.AppError.internal('Failed to list broker audit logs', error);
            }
        }
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=broker-dashboard.js.map