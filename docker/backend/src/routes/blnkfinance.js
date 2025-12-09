"use strict";
/**
 * BlnkFinance Routes
 *
 * API endpoints for comprehensive double-entry bookkeeping:
 * - Account management and chart of accounts
 * - Transaction recording and processing
 * - Ledger management and balance tracking
 * - Financial reporting (P&L, Balance Sheet, Cash Flow)
 * - Account reconciliation
 * - Multi-currency support
 * - Broker fund segregation
 * - Compliance reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const blnkfinance_1 = require("../services/blnkfinance");
const error_handler_1 = require("../middleware/error-handler");
const logger_1 = require("../services/logger");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const createAccountSchema = joi_1.default.object({
    code: joi_1.default.string().required().min(3).max(10),
    name: joi_1.default.string().required().min(3).max(100),
    type: joi_1.default.string().valid(...Object.values(blnkfinance_1.AccountType)).required(),
    currency: joi_1.default.string().required().length(3),
    brokerId: joi_1.default.string().uuid().optional(),
    parentId: joi_1.default.string().uuid().optional(),
    description: joi_1.default.string().max(500).optional(),
    metadata: joi_1.default.object().optional()
});
const recordTransactionSchema = joi_1.default.object({
    description: joi_1.default.string().required().min(3).max(200),
    entries: joi_1.default.array().items(joi_1.default.object({
        accountId: joi_1.default.string().uuid().required(),
        debitAmount: joi_1.default.number().min(0).optional(),
        creditAmount: joi_1.default.number().min(0).optional(),
        description: joi_1.default.string().required().min(3).max(100),
        reference: joi_1.default.string().max(50).optional()
    })).min(2).required(),
    brokerId: joi_1.default.string().uuid().optional(),
    currency: joi_1.default.string().length(3).default('USD'),
    type: joi_1.default.string().valid(...Object.values(blnkfinance_1.TransactionType)).default('TRANSFER'),
    reference: joi_1.default.string().max(50).optional(),
    metadata: joi_1.default.object().optional()
});
const accountStatementSchema = joi_1.default.object({
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required(),
    brokerId: joi_1.default.string().uuid().optional()
});
const financialReportSchema = joi_1.default.object({
    reportType: joi_1.default.string().valid(...Object.values(blnkfinance_1.ReportType)).required(),
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required(),
    brokerId: joi_1.default.string().uuid().optional(),
    currency: joi_1.default.string().length(3).default('USD')
});
const reconciliationSchema = joi_1.default.object({
    externalSource: joi_1.default.string().required().min(3).max(50),
    externalReference: joi_1.default.string().required().min(3).max(100),
    internalAmount: joi_1.default.number().required(),
    externalAmount: joi_1.default.number().required(),
    notes: joi_1.default.string().max(500).optional()
});
// =============================================================================
// ACCOUNT MANAGEMENT
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/accounts:
 *   post:
 *     summary: Create a new account
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - type
 *               - currency
 *             properties:
 *               code:
 *                 type: string
 *                 description: Account code
 *               name:
 *                 type: string
 *                 description: Account name
 *               type:
 *                 type: string
 *                 enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, BANK, CASH, RECEIVABLE, PAYABLE, INVESTMENT, TRADING, MARGIN, STAKING, NFT, DEFI]
 *                 description: Account type
 *               currency:
 *                 type: string
 *                 description: Account currency
 *               brokerId:
 *                 type: string
 *                 description: Broker ID
 *               parentId:
 *                 type: string
 *                 description: Parent account ID
 *               description:
 *                 type: string
 *                 description: Account description
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/accounts', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { error, value } = createAccountSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.details[0]?.message || 'Validation failed'
            });
            return;
        }
        const { code, name, type, currency, brokerId, parentId, description, metadata } = value;
        const account = await blnkfinance_1.BlnkFinanceService.createAccount(code, name, type, currency, brokerId, parentId, description, metadata);
        logger_1.LoggerService.info(`Account created: ${account.id}`, {
            code: account.code,
            name: account.name
        });
        res.status(201).json({
            success: true,
            account
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Create account failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create account',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/blnkfinance/accounts:
 *   get:
 *     summary: Get all accounts
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: brokerId
 *         schema:
 *           type: string
 *         description: Filter by broker ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by account type
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency
 *     responses:
 *       200:
 *         description: Accounts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/accounts', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { brokerId, type, currency } = req.query;
        // This would typically filter accounts from database
        const accounts = [];
        res.json({
            success: true,
            accounts,
            count: accounts.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get accounts failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get accounts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * @swagger
 * /api/blnkfinance/accounts/{accountId}/balance:
 *   get:
 *     summary: Get account balance
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Account balance retrieved successfully
 *       404:
 *         description: Account not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/accounts/:accountId/balance', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const balance = await blnkfinance_1.BlnkFinanceService.getAccountBalance(accountId);
        if (!balance) {
            res.status(404).json({
                success: false,
                error: 'Account not found'
            });
            return;
        }
        res.json({
            success: true,
            balance
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get account balance failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get account balance',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// TRANSACTION MANAGEMENT
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/transactions:
 *   post:
 *     summary: Record a double-entry transaction
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - entries
 *             properties:
 *               description:
 *                 type: string
 *                 description: Transaction description
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     accountId:
 *                       type: string
 *                       description: Account ID
 *                     debitAmount:
 *                       type: number
 *                       description: Debit amount
 *                     creditAmount:
 *                       type: number
 *                       description: Credit amount
 *                     description:
 *                       type: string
 *                       description: Entry description
 *                     reference:
 *                       type: string
 *                       description: Entry reference
 *               brokerId:
 *                 type: string
 *                 description: Broker ID
 *               currency:
 *                 type: string
 *                 description: Transaction currency
 *               type:
 *                 type: string
 *                 description: Transaction type
 *               reference:
 *                 type: string
 *                 description: Transaction reference
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Transaction recorded successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/transactions', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { error, value } = recordTransactionSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.details[0]?.message || 'Validation failed'
            });
            return;
        }
        const { description, entries, brokerId, currency, type, reference, metadata } = value;
        const transaction = await blnkfinance_1.BlnkFinanceService.recordTransaction(description, entries, brokerId, currency, type, reference, metadata);
        logger_1.LoggerService.info(`Transaction recorded: ${transaction.id}`, {
            transactionNumber: transaction.transactionNumber,
            totalAmount: transaction.totalAmount
        });
        res.status(201).json({
            success: true,
            transaction
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Record transaction failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// ACCOUNT STATEMENTS
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/accounts/{accountId}/statement:
 *   get:
 *     summary: Get account statement
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date
 *       - in: query
 *         name: brokerId
 *         schema:
 *           type: string
 *         description: Broker ID
 *     responses:
 *       200:
 *         description: Account statement retrieved successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/accounts/:accountId/statement', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { accountId } = req.params;
        const { error, value } = accountStatementSchema.validate(req.query);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.details[0]?.message || 'Validation failed'
            });
            return;
        }
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const { startDate, endDate, brokerId } = value;
        const statement = await blnkfinance_1.BlnkFinanceService.getAccountStatement(accountId, startDate, endDate, brokerId);
        res.json({
            success: true,
            statement,
            count: statement.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get account statement failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get account statement',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// FINANCIAL REPORTS
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/reports:
 *   post:
 *     summary: Generate financial report
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - startDate
 *               - endDate
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [PROFIT_LOSS, BALANCE_SHEET, CASH_FLOW, TRIAL_BALANCE, GENERAL_LEDGER, ACCOUNT_STATEMENT, BROKER_SUMMARY, COMPLIANCE_REPORT]
 *                 description: Type of report
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date
 *               brokerId:
 *                 type: string
 *                 description: Broker ID
 *               currency:
 *                 type: string
 *                 description: Report currency
 *     responses:
 *       200:
 *         description: Report generated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/reports', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { error, value } = financialReportSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.details[0]?.message || 'Validation failed'
            });
            return;
        }
        const { reportType, startDate, endDate, brokerId, currency } = value;
        const report = await blnkfinance_1.BlnkFinanceService.generateFinancialReport(reportType, startDate, endDate, brokerId, currency);
        logger_1.LoggerService.info(`Financial report generated: ${reportType}`, {
            period: report.period,
            brokerId: report.brokerId
        });
        res.json({
            success: true,
            report
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Generate financial report failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate financial report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// RECONCILIATION
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/accounts/{accountId}/reconcile:
 *   post:
 *     summary: Reconcile account with external source
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - externalSource
 *               - externalReference
 *               - internalAmount
 *               - externalAmount
 *             properties:
 *               externalSource:
 *                 type: string
 *                 description: External source name
 *               externalReference:
 *                 type: string
 *                 description: External reference
 *               internalAmount:
 *                 type: number
 *                 description: Internal amount
 *               externalAmount:
 *                 type: number
 *                 description: External amount
 *               notes:
 *                 type: string
 *                 description: Reconciliation notes
 *     responses:
 *       201:
 *         description: Reconciliation created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/accounts/:accountId/reconcile', error_handler_1.authenticateToken, error_handler_1.validateRequest, async (req, res) => {
    try {
        const { accountId } = req.params;
        const { error, value } = reconciliationSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.details[0]?.message || 'Validation failed'
            });
            return;
        }
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const { externalSource, externalReference, internalAmount, externalAmount, notes } = value;
        const reconciliation = await blnkfinance_1.BlnkFinanceService.reconcileAccount(accountId, externalSource, externalReference, internalAmount, externalAmount, notes);
        logger_1.LoggerService.info(`Account reconciled: ${reconciliation.id}`, {
            accountId,
            status: reconciliation.status,
            difference: reconciliation.difference
        });
        res.status(201).json({
            success: true,
            reconciliation
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Reconcile account failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reconcile account',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// CHART OF ACCOUNTS
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/chart-of-accounts:
 *   get:
 *     summary: Get chart of accounts
 *     tags: [BlnkFinance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: brokerId
 *         schema:
 *           type: string
 *         description: Filter by broker ID
 *     responses:
 *       200:
 *         description: Chart of accounts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/chart-of-accounts', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { brokerId } = req.query;
        // This would typically load chart of accounts from database
        const chartOfAccounts = {
            assets: [],
            liabilities: [],
            equity: [],
            revenue: [],
            expenses: []
        };
        res.json({
            success: true,
            chartOfAccounts
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Get chart of accounts failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get chart of accounts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// =============================================================================
// HEALTH CHECK
// =============================================================================
/**
 * @swagger
 * /api/blnkfinance/health:
 *   get:
 *     summary: Get BlnkFinance service health status
 *     tags: [BlnkFinance]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 service:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 details:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                     accountsCount:
 *                       type: number
 *                     balancesCount:
 *                       type: number
 *                     transactionsCount:
 *                       type: number
 */
router.get('/health', async (req, res) => {
    try {
        const isHealthy = blnkfinance_1.BlnkFinanceService.isHealthy();
        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            service: 'blnkfinance',
            timestamp: new Date().toISOString(),
            details: {
                initialized: blnkfinance_1.BlnkFinanceService.isHealthy(),
                accountsCount: 0, // Would be from service
                balancesCount: 0, // Would be from service
                transactionsCount: 0 // Would be from service
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('BlnkFinance health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            service: 'blnkfinance',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=blnkfinance.js.map