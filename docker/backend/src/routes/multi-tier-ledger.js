"use strict";
/**
 * Multi-Tier Ledger Routes - API endpoints for Multi-Tier Ledger System
 *
 * Production-ready routes for:
 * - Account Management (Platform, Broker, End User)
 * - Fund Transfers
 * - Fund Segregation
 * - Reconciliation
 * - Statistics and Reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multi_tier_ledger_1 = require("../services/multi-tier-ledger");
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
const error_handler_1 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// ACCOUNT MANAGEMENT ROUTES
// =============================================================================
/**
 * Create Platform Master Account
 * POST /api/ledger/platform-accounts
 */
router.post('/platform-accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().min(3).max(100).required(),
    currency: joi_1.default.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    bankAccount: joi_1.default.object({
        bankName: joi_1.default.string().required(),
        accountNumber: joi_1.default.string().required(),
        routingNumber: joi_1.default.string().optional(),
        swiftCode: joi_1.default.string().optional(),
        iban: joi_1.default.string().optional(),
        accountType: joi_1.default.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
        currency: joi_1.default.string().required(),
        country: joi_1.default.string().required()
    }).optional()
})), async (req, res) => {
    try {
        const { tenantId, name, currency, bankAccount } = req.body;
        logger_1.LoggerService.info('Creating platform master account', {
            tenantId,
            name,
            currency
        });
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createPlatformMasterAccount(tenantId, name, currency, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'Platform master account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create platform master account failed:', error);
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
 * Create Broker Master Account
 * POST /api/ledger/broker-accounts
 */
router.post('/broker-accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    brokerId: joi_1.default.string().required(),
    name: joi_1.default.string().min(3).max(100).required(),
    currency: joi_1.default.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    parentAccountId: joi_1.default.string().required(),
    bankAccount: joi_1.default.object({
        bankName: joi_1.default.string().required(),
        accountNumber: joi_1.default.string().required(),
        routingNumber: joi_1.default.string().optional(),
        swiftCode: joi_1.default.string().optional(),
        iban: joi_1.default.string().optional(),
        accountType: joi_1.default.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
        currency: joi_1.default.string().required(),
        country: joi_1.default.string().required()
    }).optional()
})), async (req, res) => {
    try {
        const { tenantId, brokerId, name, currency, parentAccountId, bankAccount } = req.body;
        logger_1.LoggerService.info('Creating broker master account', {
            tenantId,
            brokerId,
            name,
            currency,
            parentAccountId
        });
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createBrokerMasterAccount(tenantId, brokerId, name, currency, parentAccountId, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'Broker master account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create broker master account failed:', error);
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
 * Create End User Account
 * POST /api/ledger/user-accounts
 */
router.post('/user-accounts', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), (0, error_handler_1.validateRequest)(joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    userId: joi_1.default.string().required(),
    name: joi_1.default.string().min(3).max(100).required(),
    currency: joi_1.default.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    parentAccountId: joi_1.default.string().required(),
    bankAccount: joi_1.default.object({
        bankName: joi_1.default.string().required(),
        accountNumber: joi_1.default.string().required(),
        routingNumber: joi_1.default.string().optional(),
        swiftCode: joi_1.default.string().optional(),
        iban: joi_1.default.string().optional(),
        accountType: joi_1.default.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
        currency: joi_1.default.string().required(),
        country: joi_1.default.string().required()
    }).optional()
})), async (req, res) => {
    try {
        const { tenantId, userId, name, currency, parentAccountId, bankAccount } = req.body;
        logger_1.LoggerService.info('Creating end user account', {
            tenantId,
            userId,
            name,
            currency,
            parentAccountId
        });
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createEndUserAccount(tenantId, userId, name, currency, parentAccountId, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'End user account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create end user account failed:', error);
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
// FUND TRANSFER ROUTES
// =============================================================================
/**
 * Transfer Funds
 * POST /api/ledger/transfers
 */
router.post('/transfers', error_handler_1.authenticateToken, (0, error_handler_1.validateRequest)(joi_1.default.object({
    fromAccountId: joi_1.default.string().required(),
    toAccountId: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    currency: joi_1.default.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').required(),
    description: joi_1.default.string().min(10).max(500).required(),
    reference: joi_1.default.string().optional(),
    metadata: joi_1.default.object().optional()
})), async (req, res) => {
    try {
        const { fromAccountId, toAccountId, amount, currency, description, reference, metadata } = req.body;
        logger_1.LoggerService.info('Processing fund transfer', {
            fromAccountId,
            toAccountId,
            amount,
            currency,
            description
        });
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.transferFunds(fromAccountId, toAccountId, amount, currency, description, reference, metadata);
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Fund transfer processed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transfer funds failed:', error);
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
 * Get Transfer History
 * GET /api/ledger/transfers
 */
router.get('/transfers', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { accountId, status, limit = 50, offset = 0 } = req.query;
        const { tenantId, userId, brokerId } = req.user;
        if (!tenantId) {
            throw (0, utils_1.createError)('Tenant context required', 400, 'TENANT_REQUIRED');
        }
        logger_1.LoggerService.info('Fetching transfer history', {
            accountId,
            status,
            limit,
            offset,
            tenantId,
            userId,
            brokerId
        });
        // Get transactions with client-level isolation
        const transactions = Array.from(multi_tier_ledger_1.MultiTierLedgerService['transactions'].values())
            .filter(t => {
            // Filter by tenant (client-level isolation)
            const fromAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.fromAccountId);
            const toAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.toAccountId);
            // Only show transactions where both accounts belong to the tenant
            if (fromAccount?.tenantId !== tenantId || toAccount?.tenantId !== tenantId) {
                return false;
            }
            // Filter by account if specified
            if (accountId && t.fromAccountId !== accountId && t.toAccountId !== accountId) {
                return false;
            }
            // Filter by status if specified
            if (status && t.status !== status) {
                return false;
            }
            return true;
        })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
            .map(t => {
            const fromAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.fromAccountId);
            const toAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.toAccountId);
            return {
                id: t.id,
                fromAccountId: t.fromAccountId,
                fromAccountName: fromAccount?.name || 'Unknown',
                fromAccountType: fromAccount?.accountType || 'Unknown',
                toAccountId: t.toAccountId,
                toAccountName: toAccount?.name || 'Unknown',
                toAccountType: toAccount?.accountType || 'Unknown',
                amount: t.amount,
                currency: t.currency,
                status: t.status,
                transactionType: t.transactionType,
                description: t.description,
                reference: t.reference,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                metadata: t.metadata
            };
        });
        const total = Array.from(multi_tier_ledger_1.MultiTierLedgerService['transactions'].values())
            .filter(t => {
            const fromAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.fromAccountId);
            const toAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(t.toAccountId);
            if (fromAccount?.tenantId !== tenantId || toAccount?.tenantId !== tenantId) {
                return false;
            }
            if (accountId && t.fromAccountId !== accountId && t.toAccountId !== accountId) {
                return false;
            }
            if (status && t.status !== status) {
                return false;
            }
            return true;
        }).length;
        res.json({
            success: true,
            data: transactions,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total,
                hasNext: parseInt(offset) + parseInt(limit) < total,
                hasPrev: parseInt(offset) > 0
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get transfer history failed:', error);
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
 * Get Transfer Details
 * GET /api/ledger/transfers/:transferId
 */
router.get('/transfers/:transferId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { transferId } = req.params;
        const { tenantId, userId, brokerId } = req.user;
        if (!tenantId) {
            throw (0, utils_1.createError)('Tenant context required', 400, 'TENANT_REQUIRED');
        }
        logger_1.LoggerService.info('Fetching transfer details', {
            transferId,
            tenantId
        });
        if (!transferId) {
            res.status(400).json({
                success: false,
                error: 'Transfer ID is required'
            });
            return;
        }
        // Get transfer with client-level isolation
        const transaction = multi_tier_ledger_1.MultiTierLedgerService['transactions'].get(transferId);
        if (!transaction) {
            res.status(404).json({
                success: false,
                error: 'Transfer not found',
                code: 'TRANSFER_NOT_FOUND'
            });
            return;
        }
        // Verify client-level access (tenant isolation)
        const fromAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(transaction.fromAccountId);
        const toAccount = multi_tier_ledger_1.MultiTierLedgerService['accounts'].get(transaction.toAccountId);
        if (!fromAccount || !toAccount ||
            fromAccount.tenantId !== tenantId || toAccount.tenantId !== tenantId) {
            res.status(403).json({
                success: false,
                error: 'Access denied - transfer does not belong to your tenant',
                code: 'ACCESS_DENIED'
            });
            return;
        }
        const transfer = {
            id: transaction.id,
            fromAccount: {
                id: fromAccount.id,
                name: fromAccount.name,
                accountType: fromAccount.accountType,
                accountLevel: fromAccount.accountLevel,
                currency: fromAccount.currency,
                status: fromAccount.status
            },
            toAccount: {
                id: toAccount.id,
                name: toAccount.name,
                accountType: toAccount.accountType,
                accountLevel: toAccount.accountLevel,
                currency: toAccount.currency,
                status: toAccount.status
            },
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            transactionType: transaction.transactionType,
            description: transaction.description,
            reference: transaction.reference,
            metadata: transaction.metadata,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
        };
        res.json({
            success: true,
            data: transfer
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get transfer details failed:', error);
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
 * Get Ledger Statistics
 * GET /api/ledger/stats
 */
router.get('/stats', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        logger_1.LoggerService.info('Fetching ledger statistics');
        const stats = await multi_tier_ledger_1.MultiTierLedgerService.getLedgerStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get ledger stats failed:', error);
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
 * Get Account Hierarchy
 * GET /api/ledger/hierarchy
 */
router.get('/hierarchy', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['platform-admin', 'broker-admin']), async (req, res) => {
    try {
        const { tenantId: queryTenantId } = req.query;
        const { tenantId: userTenantId, userId, brokerId } = req.user;
        // Use query tenantId if provided and user has platform-admin role, otherwise use user's tenantId
        const tenantId = req.user?.roles?.includes('platform-admin') && queryTenantId
            ? queryTenantId
            : userTenantId;
        if (!tenantId) {
            throw (0, utils_1.createError)('Tenant context required', 400, 'TENANT_REQUIRED');
        }
        logger_1.LoggerService.info('Fetching account hierarchy', {
            tenantId,
            userId,
            brokerId
        });
        // Get all accounts for this tenant with client-level isolation
        const accounts = Array.from(multi_tier_ledger_1.MultiTierLedgerService['accounts'].values())
            .filter(a => a.tenantId === tenantId);
        // Build hierarchy with client-level separation
        const platformAccounts = accounts.filter(a => a.accountType === multi_tier_ledger_1.AccountType.PLATFORM_MASTER);
        const brokerAccounts = accounts.filter(a => a.accountType === multi_tier_ledger_1.AccountType.BROKER_MASTER);
        const userAccounts = accounts.filter(a => a.accountType === multi_tier_ledger_1.AccountType.END_USER);
        const hierarchy = {
            tenant: {
                id: tenantId,
                platformAccounts: platformAccounts.map(a => ({
                    id: a.id,
                    name: a.name,
                    currency: a.currency,
                    accountLevel: a.accountLevel,
                    status: a.status,
                    childCount: brokerAccounts.filter(b => b.parentAccountId === a.id).length,
                    createdAt: a.createdAt
                })),
                totalPlatformBalance: 0, // Would calculate from BlnkFinance
                totalBrokers: brokerAccounts.length,
                totalUsers: userAccounts.length
            },
            brokers: brokerAccounts.map(broker => {
                const brokerUserAccounts = userAccounts.filter(u => u.parentAccountId === broker.id);
                return {
                    id: broker.id,
                    name: broker.name,
                    currency: broker.currency,
                    accountLevel: broker.accountLevel,
                    status: broker.status,
                    parentAccountId: broker.parentAccountId,
                    childCount: brokerUserAccounts.length,
                    users: brokerUserAccounts.map(user => ({
                        id: user.id,
                        name: user.name,
                        currency: user.currency,
                        accountLevel: user.accountLevel,
                        status: user.status,
                        parentAccountId: user.parentAccountId,
                        createdAt: user.createdAt
                    })),
                    createdAt: broker.createdAt
                };
            }),
            users: userAccounts.map(user => ({
                id: user.id,
                name: user.name,
                currency: user.currency,
                accountLevel: user.accountLevel,
                status: user.status,
                parentAccountId: user.parentAccountId,
                parentAccountName: brokerAccounts.find(b => b.id === user.parentAccountId)?.name || 'Unknown',
                createdAt: user.createdAt
            })),
            summary: {
                totalAccounts: accounts.length,
                platformAccounts: platformAccounts.length,
                brokerAccounts: brokerAccounts.length,
                userAccounts: userAccounts.length,
                activeAccounts: accounts.filter(a => a.status === multi_tier_ledger_1.AccountStatus.ACTIVE).length,
                suspendedAccounts: accounts.filter(a => a.status === multi_tier_ledger_1.AccountStatus.SUSPENDED).length
            }
        };
        res.json({
            success: true,
            data: hierarchy
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get account hierarchy failed:', error);
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
 * Multi-Tier Ledger Service Health Check
 * GET /api/ledger/health
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = multi_tier_ledger_1.MultiTierLedgerService.isHealthy();
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            service: 'Multi-Tier Ledger Service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Multi-tier ledger health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'Multi-Tier Ledger Service',
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=multi-tier-ledger.js.map