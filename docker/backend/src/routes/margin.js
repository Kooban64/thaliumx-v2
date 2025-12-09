"use strict";
/**
 * Margin Trading Routes
 *
 * REST API endpoints for margin trading operations:
 * - Margin account management
 * - Position management
 * - Order management
 * - Risk management
 * - Funding rates
 *
 * Production-ready with comprehensive validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const margin_1 = require("../services/margin");
const logger_1 = require("../services/logger");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
// =============================================================================
// ACCOUNT MANAGEMENT
// =============================================================================
/**
 * Create margin account
 * POST /api/margin/accounts
 */
router.post('/accounts', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { accountType } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (accountType && !['cross', 'isolated'].includes(accountType)) {
            throw (0, utils_1.createError)('Invalid account type. Must be "cross" or "isolated"', 400, 'INVALID_ACCOUNT_TYPE');
        }
        const account = await margin_1.MarginTradingService.createMarginAccount(userId, tenantId, accountType);
        logger_1.LoggerService.info('Margin account created via API', {
            accountId: account.id,
            userId,
            accountType: account.accountType
        });
        res.status(201).json({
            success: true,
            data: account,
            message: 'Margin account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Margin account creation API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Get margin account
 * GET /api/margin/accounts
 */
router.get('/accounts', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const account = await margin_1.MarginTradingService.getMarginAccount(userId, tenantId);
        if (!account) {
            throw (0, utils_1.createError)('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
        }
        res.json({
            success: true,
            data: account
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get margin account API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// MARGIN TRANSFERS
// =============================================================================
/**
 * Deposit margin
 * POST /api/margin/deposits
 */
router.post('/deposits', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { asset, amount } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!asset || !amount) {
            throw (0, utils_1.createError)('Missing required fields: asset, amount', 400, 'MISSING_REQUIRED_FIELDS');
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw (0, utils_1.createError)('Invalid amount', 400, 'INVALID_AMOUNT');
        }
        const transfer = await margin_1.MarginTradingService.depositMargin(userId, tenantId, asset, amount);
        logger_1.LoggerService.info('Margin deposit initiated via API', {
            transferId: transfer.id,
            userId,
            amount,
            asset
        });
        res.status(201).json({
            success: true,
            data: transfer,
            message: 'Margin deposit initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Margin deposit API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Withdraw margin
 * POST /api/margin/withdrawals
 */
router.post('/withdrawals', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { asset, amount } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!asset || !amount) {
            throw (0, utils_1.createError)('Missing required fields: asset, amount', 400, 'MISSING_REQUIRED_FIELDS');
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw (0, utils_1.createError)('Invalid amount', 400, 'INVALID_AMOUNT');
        }
        const transfer = await margin_1.MarginTradingService.withdrawMargin(userId, tenantId, asset, amount);
        logger_1.LoggerService.info('Margin withdrawal initiated via API', {
            transferId: transfer.id,
            userId,
            amount,
            asset
        });
        res.status(201).json({
            success: true,
            data: transfer,
            message: 'Margin withdrawal initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Margin withdrawal API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// ORDER MANAGEMENT
// =============================================================================
/**
 * Create margin order
 * POST /api/margin/orders
 */
router.post('/orders', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { symbol, side, type, quantity, leverage, price, stopPrice } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!symbol || !side || !type || !quantity || !leverage) {
            throw (0, utils_1.createError)('Missing required fields: symbol, side, type, quantity, leverage', 400, 'MISSING_REQUIRED_FIELDS');
        }
        if (!['buy', 'sell'].includes(side)) {
            throw (0, utils_1.createError)('Invalid side. Must be "buy" or "sell"', 400, 'INVALID_SIDE');
        }
        if (!['market', 'limit', 'stop', 'stop_limit'].includes(type)) {
            throw (0, utils_1.createError)('Invalid order type', 400, 'INVALID_ORDER_TYPE');
        }
        if (typeof quantity !== 'number' || quantity <= 0) {
            throw (0, utils_1.createError)('Invalid quantity', 400, 'INVALID_QUANTITY');
        }
        if (typeof leverage !== 'number' || leverage < 1) {
            throw (0, utils_1.createError)('Invalid leverage', 400, 'INVALID_LEVERAGE');
        }
        const order = await margin_1.MarginTradingService.createMarginOrder(userId, tenantId, symbol, side, type, quantity, leverage, price, stopPrice);
        logger_1.LoggerService.info('Margin order created via API', {
            orderId: order.id,
            userId,
            symbol,
            side,
            quantity,
            leverage
        });
        res.status(201).json({
            success: true,
            data: order,
            message: 'Margin order created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Margin order creation API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
/**
 * Get user orders
 * GET /api/margin/orders
 */
router.get('/orders', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const orders = await margin_1.MarginTradingService.getUserOrders(userId, tenantId);
        res.json({
            success: true,
            data: orders
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get margin orders API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
// =============================================================================
// POSITION MANAGEMENT
// =============================================================================
/**
 * Get user positions
 * GET /api/margin/positions
 */
router.get('/positions', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const positions = await margin_1.MarginTradingService.getUserPositions(userId, tenantId);
        res.json({
            success: true,
            data: positions
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get margin positions API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
/**
 * Close margin position
 * POST /api/margin/positions/:positionId/close
 */
router.post('/positions/:positionId/close', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { positionId } = req.params;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!positionId) {
            res.status(400).json({
                success: false,
                error: 'Position ID is required'
            });
            return;
        }
        const position = await margin_1.MarginTradingService.closeMarginPosition(userId, tenantId, positionId);
        logger_1.LoggerService.info('Margin position closed via API', {
            positionId: position.id,
            userId,
            symbol: position.symbol
        });
        res.json({
            success: true,
            data: position,
            message: 'Position closed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Close margin position API error:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: {
                    message: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                }
            });
        }
    }
});
// =============================================================================
// FUNDING RATES
// =============================================================================
/**
 * Get funding rates
 * GET /api/margin/funding-rates
 */
router.get('/funding-rates', async (req, res) => {
    try {
        const fundingRates = await margin_1.MarginTradingService.getFundingRates();
        res.json({
            success: true,
            data: fundingRates
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get funding rates API error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * Margin trading service health check
 * GET /api/margin/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = margin_1.MarginTradingService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'margin-trading',
                timestamp: new Date().toISOString(),
                features: {
                    marginAccounts: 'active',
                    leveragedTrading: 'active',
                    riskManagement: 'active',
                    liquidationProtection: 'active',
                    fundingRates: 'active',
                    positionManagement: 'active',
                    multiTenantSupport: 'active'
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Margin trading health check error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Margin trading service unhealthy',
                code: 'SERVICE_UNHEALTHY'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=margin.js.map