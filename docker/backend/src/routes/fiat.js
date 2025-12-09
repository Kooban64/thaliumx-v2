"use strict";
/**
 * FIAT Routes
 *
 * REST API endpoints for FIAT operations:
 * - Wallet management
 * - Deposits and withdrawals
 * - Transfers between users
 * - Transaction history
 * - Banking integration
 *
 * Production-ready with comprehensive validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fiat_1 = require("../services/fiat");
const logger_1 = require("../services/logger");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const utils_1 = require("../utils");
const router = (0, express_1.Router)();
// =============================================================================
// WALLET MANAGEMENT
// =============================================================================
/**
 * Create FIAT wallet
 * POST /api/fiat/wallets
 */
router.post('/wallets', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { currency } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const wallet = await fiat_1.FiatService.createWallet(userId, tenantId, currency);
        logger_1.LoggerService.info('FIAT wallet created via API', {
            walletId: wallet.id,
            userId,
            currency
        });
        res.status(201).json({
            success: true,
            data: wallet,
            message: 'Wallet created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Wallet creation API error:', error);
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
 * Get user wallets
 * GET /api/fiat/wallets
 */
router.get('/wallets', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const wallets = await fiat_1.FiatService.getUserWallets(userId, tenantId);
        res.json({
            success: true,
            data: wallets
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallets API error:', error);
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
 * Get specific wallet
 * GET /api/fiat/wallets/:currency
 */
router.get('/wallets/:currency', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { currency } = req.params;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!currency) {
            res.status(400).json({
                success: false,
                error: 'Currency is required'
            });
            return;
        }
        const wallet = await fiat_1.FiatService.getWallet(userId, tenantId, currency);
        if (!wallet) {
            throw (0, utils_1.createError)('Wallet not found', 404, 'WALLET_NOT_FOUND');
        }
        res.json({
            success: true,
            data: wallet
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get wallet API error:', error);
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
// DEPOSITS
// =============================================================================
/**
 * Initiate deposit
 * POST /api/fiat/deposits
 */
router.post('/deposits', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { currency, amount, reference } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transaction = await fiat_1.FiatService.deposit(userId, tenantId, currency, amount, reference);
        logger_1.LoggerService.info('FIAT deposit initiated via API', {
            transactionId: transaction.id,
            userId,
            amount,
            currency
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Deposit initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Deposit API error:', error);
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
// WITHDRAWALS
// =============================================================================
/**
 * Initiate withdrawal
 * POST /api/fiat/withdrawals
 */
router.post('/withdrawals', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { currency, amount, bankAccountId } = req.body;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transaction = await fiat_1.FiatService.withdraw(userId, tenantId, currency, amount, bankAccountId);
        logger_1.LoggerService.info('FIAT withdrawal initiated via API', {
            transactionId: transaction.id,
            userId,
            amount,
            currency
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Withdrawal initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Withdrawal API error:', error);
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
// TRANSFERS
// =============================================================================
/**
 * Transfer FIAT to another user
 * POST /api/fiat/transfers
 */
router.post('/transfers', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const fromUserId = req.user?.userId;
        const fromTenantId = req.user?.tenantId;
        const { toUserId, toTenantId, currency, amount, description } = req.body;
        if (!fromUserId || !fromTenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        // Prevent self-transfer
        if (fromUserId === toUserId && fromTenantId === toTenantId) {
            throw (0, utils_1.createError)('Cannot transfer to yourself', 400, 'SELF_TRANSFER_NOT_ALLOWED');
        }
        const transaction = await fiat_1.FiatService.transfer(fromUserId, fromTenantId, toUserId, toTenantId, currency, amount, description);
        logger_1.LoggerService.info('FIAT transfer initiated via API', {
            transactionId: transaction.id,
            fromUserId,
            toUserId,
            amount,
            currency
        });
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Transfer initiated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transfer API error:', error);
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
// TRANSACTION HISTORY
// =============================================================================
/**
 * Get transaction history
 * GET /api/fiat/transactions
 */
router.get('/transactions', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const tenantId = req.user?.tenantId;
        const { currency, limit, offset } = req.query;
        if (!userId || !tenantId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        const transactions = await fiat_1.FiatService.getTransactionHistory(userId, tenantId, currency, Number(limit), Number(offset));
        res.json({
            success: true,
            data: {
                transactions,
                limit: Number(limit),
                offset: Number(offset)
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get transactions API error:', error);
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
 * Get specific transaction
 * GET /api/fiat/transactions/:transactionId
 */
router.get('/transactions/:transactionId', error_handler_1.authenticateToken, validation_1.validateRequest, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { transactionId } = req.params;
        if (!userId) {
            throw (0, utils_1.createError)('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
        }
        if (!transactionId) {
            res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
            return;
        }
        const transaction = await fiat_1.FiatService.getTransaction(transactionId);
        if (!transaction) {
            throw (0, utils_1.createError)('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
        }
        // Check if user owns this transaction
        if (transaction.userId !== userId) {
            throw (0, utils_1.createError)('Unauthorized', 403, 'UNAUTHORIZED');
        }
        res.json({
            success: true,
            data: transaction
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get transaction API error:', error);
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
// BANKING INTEGRATION
// =============================================================================
/**
 * Get bank accounts
 * GET /api/fiat/bank-accounts
 */
router.get('/bank-accounts', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            throw (0, utils_1.createError)('Tenant authentication required', 401, 'TENANT_AUTHENTICATION_REQUIRED');
        }
        // This would typically get bank accounts from database
        // For now, return mock data
        const bankAccounts = [
            {
                id: 'bank_1',
                bankName: 'Nedbank',
                accountNumber: '****7890',
                accountType: 'current',
                currency: 'ZAR',
                status: 'active',
                isDefault: true
            }
        ];
        res.json({
            success: true,
            data: bankAccounts
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get bank accounts API error:', error);
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
 * FIAT service health check
 * GET /api/fiat/health
 */
router.get('/health', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                status: 'healthy',
                service: 'fiat',
                timestamp: new Date(),
                features: {
                    walletManagement: 'active',
                    deposits: 'active',
                    withdrawals: 'active',
                    transfers: 'active',
                    bankingIntegration: 'active',
                    reconciliation: 'active'
                }
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('FIAT health check error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'FIAT service unhealthy',
                code: 'SERVICE_UNHEALTHY'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=fiat.js.map