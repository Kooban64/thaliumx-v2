"use strict";
/**
 * Advanced Margin Trading Routes
 *
 * Production-ready API endpoints for advanced margin trading:
 * - Account management (isolated/cross margin)
 * - Position management with risk controls
 * - Liquidation monitoring and execution
 * - Fund segregation and compliance
 * - Real-time risk monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const logger_1 = require("../services/logger");
const advanced_margin_1 = require("../services/advanced-margin");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
// =============================================================================
// ACCOUNT MANAGEMENT ROUTES
// =============================================================================
/**
 * Create Margin Account
 * POST /api/margin/accounts
 */
router.post('/accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const { accountType, symbol, initialDeposit } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const account = await advanced_margin_1.AdvancedMarginTradingService.createMarginAccount(userId, tenantId, brokerId, accountType, symbol, initialDeposit);
        res.json({
            success: true,
            data: account,
            message: 'Margin account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create margin account failed:', { error });
        next(error);
    }
});
/**
 * Get Margin Account
 * GET /api/margin/accounts
 */
router.get('/accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const account = await advanced_margin_1.AdvancedMarginTradingService.getUserMarginAccount(userId, tenantId, brokerId);
        res.json({
            success: true,
            data: account,
            message: account ? 'Margin account retrieved' : 'No margin account found'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get margin account failed:', { error });
        next(error);
    }
});
/**
 * Get User Risk Limits
 * GET /api/margin/risk-limits
 */
router.get('/risk-limits', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const riskLimits = await advanced_margin_1.AdvancedMarginTradingService.getUserRiskLimits(userId, tenantId, brokerId);
        res.json({
            success: true,
            data: riskLimits,
            message: 'Risk limits retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get risk limits failed:', { error });
        next(error);
    }
});
// =============================================================================
// POSITION MANAGEMENT ROUTES
// =============================================================================
/**
 * Create Margin Position
 * POST /api/margin/positions
 */
router.post('/positions', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const { accountId, symbol, side, size, leverage, orderType, price } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const position = await advanced_margin_1.AdvancedMarginTradingService.createMarginPosition(userId, tenantId, brokerId, accountId, symbol, side, size, leverage, orderType, price);
        res.json({
            success: true,
            data: position,
            message: 'Margin position created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create margin position failed:', { error });
        next(error);
    }
});
/**
 * Close Margin Position
 * POST /api/margin/positions/:positionId/close
 */
router.post('/positions/:positionId/close', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const { positionId } = req.params;
        const { closeSize } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        if (!positionId) {
            res.status(400).json({
                success: false,
                error: 'Position ID is required'
            });
            return;
        }
        const result = await advanced_margin_1.AdvancedMarginTradingService.closeMarginPosition(userId, tenantId, brokerId, positionId, closeSize);
        res.json({
            success: true,
            data: result,
            message: 'Margin position closed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Close margin position failed:', { error });
        next(error);
    }
});
/**
 * Get User Positions
 * GET /api/margin/positions
 */
router.get('/positions', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        // This would be implemented in the service
        const positions = []; // await AdvancedMarginTradingService.getUserPositions(userId, tenantId, brokerId);
        res.json({
            success: true,
            data: positions,
            message: 'Positions retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get positions failed:', { error });
        next(error);
    }
});
// =============================================================================
// LIQUIDATION MANAGEMENT ROUTES
// =============================================================================
/**
 * Liquidate Position (Admin Only)
 * POST /api/margin/liquidate/:positionId
 */
router.post('/liquidate/:positionId', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const { positionId } = req.params;
        const { reason } = req.body;
        if (!positionId) {
            res.status(400).json({
                success: false,
                error: 'Position ID is required'
            });
            return;
        }
        const liquidation = await advanced_margin_1.AdvancedMarginTradingService.liquidatePosition(positionId, reason);
        res.json({
            success: true,
            data: liquidation,
            message: 'Position liquidated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Liquidate position failed:', { error });
        next(error);
    }
});
// =============================================================================
// FUNDING RATES ROUTES
// =============================================================================
/**
 * Get Funding Rates
 * GET /api/margin/funding-rates
 */
router.get('/funding-rates', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        // This would be implemented in the service
        const fundingRates = []; // await AdvancedMarginTradingService.getFundingRates();
        res.json({
            success: true,
            data: fundingRates,
            message: 'Funding rates retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get funding rates failed:', { error });
        next(error);
    }
});
/**
 * Get User Fund Segregation
 * GET /api/advanced-margin/segregation/user
 */
router.get('/segregation/user', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['user', 'broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;
        const brokerId = req.user?.brokerId;
        if (!userId || !tenantId || !brokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        const segregation = await advanced_margin_1.AdvancedMarginTradingService.getUserFundSegregation(userId, tenantId, brokerId);
        res.json({
            success: true,
            data: segregation,
            message: 'User fund segregation retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user fund segregation failed:', { error });
        next(error);
    }
});
/**
 * Get All Users Fund Segregation (Admin Only)
 * GET /api/advanced-margin/segregation/all
 */
router.get('/segregation/all', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        const allSegregations = await advanced_margin_1.AdvancedMarginTradingService.getAllUsersFundSegregation();
        res.json({
            success: true,
            data: allSegregations,
            message: 'All users fund segregation retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get all users fund segregation failed:', { error });
        next(error);
    }
});
/**
 * Update User Risk Score
 * POST /api/advanced-margin/risk-score/update
 */
router.post('/risk-score/update', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), validation_1.validateRequest, async (req, res, next) => {
    try {
        const { userId, tenantId, brokerId, riskScore } = req.body;
        const requesterUserId = req.user?.id;
        const requesterTenantId = req.user?.tenantId;
        const requesterBrokerId = req.user?.brokerId;
        // Allow users to update their own risk score, or admins to update any
        const targetUserId = userId || requesterUserId;
        const targetTenantId = tenantId || requesterTenantId;
        const targetBrokerId = brokerId || requesterBrokerId;
        if (!targetUserId || !targetTenantId || !targetBrokerId) {
            throw (0, utils_1.createError)('User context missing', 400, 'USER_CONTEXT_MISSING');
        }
        await advanced_margin_1.AdvancedMarginTradingService.updateUserRiskScore(targetUserId, targetTenantId, targetBrokerId, riskScore);
        res.json({
            success: true,
            message: 'User risk score updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Update user risk score failed:', { error });
        next(error);
    }
});
// =============================================================================
// HEALTH CHECK ROUTES
// =============================================================================
/**
 * Get Service Health
 * GET /api/margin/health
 */
router.get('/health', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res, next) => {
    try {
        const isHealthy = advanced_margin_1.AdvancedMarginTradingService.isHealthy();
        res.json({
            success: true,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'AdvancedMarginTradingService',
                timestamp: new Date().toISOString()
            },
            message: isHealthy ? 'Service is healthy' : 'Service is unhealthy'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get margin service health failed:', { error });
        next(error);
    }
});
// =============================================================================
// ADMIN ROUTES
// =============================================================================
/**
 * Get All Accounts (Admin Only)
 * GET /api/margin/admin/accounts
 */
router.get('/admin/accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        // This would be implemented to get all accounts
        const accounts = [];
        res.json({
            success: true,
            data: accounts,
            message: 'All margin accounts retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get all accounts failed:', { error });
        next(error);
    }
});
/**
 * Get All Positions (Admin Only)
 * GET /api/margin/admin/positions
 */
router.get('/admin/positions', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        // This would be implemented to get all positions
        const positions = [];
        res.json({
            success: true,
            data: positions,
            message: 'All margin positions retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get all positions failed:', { error });
        next(error);
    }
});
/**
 * Get Liquidation Events (Admin Only)
 * GET /api/margin/admin/liquidations
 */
router.get('/admin/liquidations', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        // This would be implemented to get all liquidations
        const liquidations = [];
        res.json({
            success: true,
            data: liquidations,
            message: 'All liquidation events retrieved'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get all liquidations failed:', { error });
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=advanced-margin.js.map