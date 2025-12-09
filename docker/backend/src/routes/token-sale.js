"use strict";
/**
 * Token Sale Routes - API endpoints for Token Sale Platform
 *
 * Production-ready routes for:
 * - Presale Phase Management
 * - Investment Processing
 * - Vesting Management
 * - Statistics and Reporting
 * - Eligibility Checking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const token_sale_1 = require("../services/token-sale");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// PRESALE PHASE MANAGEMENT ROUTES
// =============================================================================
/**
 * Create Presale Phase
 * POST /api/token-sale/phases
 */
router.post('/phases', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    name: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().min(10).max(500).required(),
    phaseType: joi_1.default.string().valid('PRIVATE', 'PUBLIC', 'COMMUNITY', 'INSTITUTIONAL').required(),
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required(),
    tokenPrice: joi_1.default.number().positive().required(),
    minInvestment: joi_1.default.number().positive().required(),
    maxInvestment: joi_1.default.number().positive().required(),
    totalTokensAllocated: joi_1.default.number().positive().required(),
    kycLevelRequired: joi_1.default.string().valid('L0', 'L1', 'L2', 'L3').required(),
    vestingScheduleId: joi_1.default.string().optional()
})), async (req, res) => {
    try {
        const { name, description, phaseType, startDate, endDate, tokenPrice, minInvestment, maxInvestment, totalTokensAllocated, kycLevelRequired, vestingScheduleId } = req.body;
        logger_1.LoggerService.info('Creating presale phase', {
            name,
            phaseType,
            tokenPrice,
            totalTokensAllocated
        });
        const phase = await token_sale_1.TokenSaleService.createPresalePhase(name, description, phaseType, new Date(startDate), new Date(endDate), tokenPrice, minInvestment, maxInvestment, totalTokensAllocated, kycLevelRequired, vestingScheduleId);
        res.status(201).json({
            success: true,
            data: phase,
            message: 'Presale phase created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create presale phase failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get All Presale Phases
 * GET /api/token-sale/phases
 */
router.get('/phases', error_handler_1.authenticateToken, async (req, res) => {
    try {
        logger_1.LoggerService.info('Fetching presale phases');
        const { activeOnly } = req.query;
        const phases = await token_sale_1.TokenSaleService.getPresalePhases(activeOnly === 'true');
        res.json({
            success: true,
            data: phases,
            count: phases.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get presale phases failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Presale Phase Details
 * GET /api/token-sale/phases/:phaseId
 */
router.get('/phases/:phaseId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { phaseId } = req.params;
        logger_1.LoggerService.info('Fetching presale phase details', {
            phaseId
        });
        if (!phaseId) {
            res.status(400).json({
                success: false,
                error: 'Phase ID is required'
            });
            return;
        }
        const phase = await token_sale_1.TokenSaleService.getPresalePhase(phaseId);
        if (!phase) {
            res.status(404).json({
                success: false,
                error: 'Presale phase not found',
                code: 'PHASE_NOT_FOUND'
            });
            return;
        }
        res.json({
            success: true,
            data: phase
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get presale phase details failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// INVESTMENT PROCESSING ROUTES
// =============================================================================
/**
 * Process Investment
 * POST /api/token-sale/investments
 */
router.post('/investments', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    phaseId: joi_1.default.string().required(),
    walletAddress: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    investmentAmountUSD: joi_1.default.number().positive().required(),
    paymentMethod: joi_1.default.string().valid('USDT', 'USDC', 'ETH', 'BTC', 'BANK_TRANSFER').required(),
    paymentTxHash: joi_1.default.string().optional()
})), async (req, res) => {
    try {
        const { tenantId, brokerId, userId } = req.user;
        const { phaseId, walletAddress, investmentAmountUSD, paymentMethod, paymentTxHash } = req.body;
        logger_1.LoggerService.info('Processing investment', {
            userId,
            tenantId,
            brokerId,
            phaseId,
            investmentAmountUSD,
            paymentMethod
        });
        const investment = await token_sale_1.TokenSaleService.processInvestment(userId, tenantId, brokerId, phaseId, walletAddress, investmentAmountUSD, paymentMethod, paymentTxHash);
        res.status(201).json({
            success: true,
            data: investment,
            message: 'Investment processed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Process investment failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Check Investment Eligibility
 * POST /api/token-sale/eligibility
 */
router.post('/eligibility', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    phaseId: joi_1.default.string().required(),
    investmentAmountUSD: joi_1.default.number().positive().required()
})), async (req, res) => {
    try {
        const { userId } = req.user;
        const { phaseId, investmentAmountUSD } = req.body;
        logger_1.LoggerService.info('Checking investment eligibility', {
            userId,
            phaseId,
            investmentAmountUSD
        });
        const eligibility = await token_sale_1.TokenSaleService.checkInvestmentEligibility(userId, phaseId, investmentAmountUSD);
        res.json({
            success: true,
            data: eligibility
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Check investment eligibility failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get User Investments
 * GET /api/token-sale/investments
 */
router.get('/investments', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { phaseId, status } = req.query;
        logger_1.LoggerService.info('Fetching user investments', {
            userId,
            phaseId,
            status
        });
        const investments = await token_sale_1.TokenSaleService.getUserInvestments(userId, phaseId, status);
        res.json({
            success: true,
            data: investments,
            count: investments.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user investments failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Investment Details
 * GET /api/token-sale/investments/:investmentId
 */
router.get('/investments/:investmentId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { investmentId } = req.params;
        const { userId } = req.user;
        logger_1.LoggerService.info('Fetching investment details', {
            investmentId,
            userId
        });
        if (!investmentId) {
            res.status(400).json({
                success: false,
                error: 'Investment ID is required'
            });
            return;
        }
        const investment = await token_sale_1.TokenSaleService.getInvestment(investmentId);
        if (!investment) {
            res.status(404).json({
                success: false,
                error: 'Investment not found',
                code: 'INVESTMENT_NOT_FOUND'
            });
            return;
        }
        // Verify investment belongs to user
        if (investment.userId !== userId) {
            res.status(403).json({
                success: false,
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
            return;
        }
        res.json({
            success: true,
            data: investment
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get investment details failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// STATISTICS AND REPORTING ROUTES
// =============================================================================
/**
 * Get Token Sale Statistics
 * GET /api/token-sale/stats
 */
router.get('/stats', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        logger_1.LoggerService.info('Fetching token sale statistics');
        const stats = await token_sale_1.TokenSaleService.getTokenSaleStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get token sale stats failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get Phase Statistics
 * GET /api/token-sale/phases/:phaseId/stats
 */
router.get('/phases/:phaseId/stats', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        const { phaseId } = req.params;
        logger_1.LoggerService.info('Fetching phase statistics', {
            phaseId
        });
        if (!phaseId) {
            res.status(400).json({
                success: false,
                error: 'Phase ID is required'
            });
            return;
        }
        const stats = await token_sale_1.TokenSaleService.getPhaseStats(phaseId);
        if (!stats) {
            res.status(404).json({
                success: false,
                error: 'Presale phase not found',
                code: 'PHASE_NOT_FOUND'
            });
            return;
        }
        // Calculate average investment
        const averageInvestment = stats.investments > 0
            ? stats.usdRaised / stats.investments
            : 0;
        res.json({
            success: true,
            data: {
                ...stats,
                averageInvestment
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get phase stats failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// VESTING MANAGEMENT ROUTES
// =============================================================================
/**
 * Get Vesting Schedules
 * GET /api/token-sale/vesting/schedules
 */
router.get('/vesting/schedules', error_handler_1.authenticateToken, async (req, res) => {
    try {
        logger_1.LoggerService.info('Fetching vesting schedules');
        const { activeOnly } = req.query;
        const schedules = await token_sale_1.TokenSaleService.getVestingSchedules(activeOnly === 'true');
        res.json({
            success: true,
            data: schedules,
            count: schedules.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get vesting schedules failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
/**
 * Get User Vesting Entries
 * GET /api/token-sale/vesting/entries
 */
router.get('/vesting/entries', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        logger_1.LoggerService.info('Fetching user vesting entries', {
            userId
        });
        const entries = await token_sale_1.TokenSaleService.getUserVestingEntries(userId);
        res.json({
            success: true,
            data: entries,
            count: entries.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get user vesting entries failed:', error);
        if (error instanceof utils_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * Token Sale Service Health Check
 * GET /api/token-sale/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = token_sale_1.TokenSaleService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            service: 'Token Sale Service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Token sale health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'Token Sale Service',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=token-sale.js.map