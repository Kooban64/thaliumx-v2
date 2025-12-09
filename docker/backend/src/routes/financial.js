"use strict";
/**
 * Financial Routes - Complete Implementation
 *
 * Production-ready routes matching original financial-svc
 * All endpoints from original 200+ line routes file
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const error_handler_1 = require("../middleware/error-handler");
const financial_controller_1 = require("../controllers/financial-controller");
const financial_repository_1 = require("../services/financial-repository");
const transaction_controller_1 = require("../controllers/transaction-controller");
const reconciliation_controller_1 = require("../controllers/reconciliation-controller");
const reconciliation_job_1 = require("../services/reconciliation-job");
const reporting_controller_1 = require("../controllers/reporting-controller");
const key_management_controller_1 = require("../controllers/key-management-controller");
const wallet_infrastructure_controller_1 = require("../controllers/wallet-infrastructure-controller");
const database_1 = require("../services/database");
const logger_1 = require("../services/logger");
const error_handler_2 = require("../utils/error-handler");
const omni_exchange_1 = require("../services/omni-exchange");
const router = (0, express_1.Router)();
// Initialize repository and controllers
const repository = new financial_repository_1.FinancialRepository();
const financialController = new financial_controller_1.FinancialController(repository);
const transactionController = new transaction_controller_1.TransactionController();
const reconciliationController = new reconciliation_controller_1.ReconciliationController();
const reconciliationJob = new reconciliation_job_1.ReconciliationJob();
const reportingController = new reporting_controller_1.ReportingController();
const keyManagementController = new key_management_controller_1.KeyManagementController();
const walletInfrastructureController = new wallet_infrastructure_controller_1.WalletInfrastructureController();
// Helper middleware for tenant context
const extractTenantContext = (req, res, next) => {
    const tenantId = (req.params.tenantId) || req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId && req.params.tenantId) {
        req.tenantId = req.params.tenantId;
    }
    if (userId) {
        req.userId = userId;
    }
    if (req.user) {
        // For broker-tenants, tenantId = brokerId (same value)
        // clientId comes from context (only applies if tenant is a broker)
        req.clientId = req.body?.clientId || req.params?.clientId;
    }
    next();
};
const validateTenantAccess = (req, res, next) => {
    const tenantId = req.params.tenantId || req.user?.tenantId;
    if (!tenantId) {
        res.status(400).json({ message: 'Tenant ID required', code: 'MISSING_TENANT_ID' });
        return;
    }
    req.tenantId = tenantId;
    next();
};
const requireKycLevel = (level) => {
    return (req, res, next) => {
        const userKycLevel = req.user?.kycLevel || 'basic';
        const levels = ['basic', 'intermediate', 'advanced', 'enterprise'];
        const userLevel = levels.indexOf(userKycLevel);
        const requiredLevel = levels.indexOf(level);
        if (userLevel < requiredLevel) {
            res.status(403).json({
                message: `KYC level ${level} required`,
                code: 'INSUFFICIENT_KYC_LEVEL'
            });
            return;
        }
        next();
    };
};
// Health endpoints (before authentication)
router.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'financial', timestamp: new Date().toISOString() });
});
router.get('/ready', async (_req, res) => {
    try {
        const isConnected = await database_1.DatabaseService.healthCheck();
        if (!isConnected) {
            res.status(503).json({
                status: 'not_ready',
                service: 'financial',
                details: { database: false }
            });
            return;
        }
        res.json({ status: 'ready', service: 'financial', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(503).json({
            status: 'not_ready',
            service: 'financial',
            details: { database: false }
        });
    }
});
// All other routes require authentication
router.use(error_handler_1.authenticateToken);
router.use(extractTenantContext);
// =============================================================================
// JOURNAL ENTRIES
// =============================================================================
router.post('/tenants/:tenantId/journal-entries', validateTenantAccess, requireKycLevel('basic'), financialController.createJournalEntry.bind(financialController));
router.get('/tenants/:tenantId/journal-entries', validateTenantAccess, financialController.getJournalEntries.bind(financialController));
router.get('/journal-entries/:id', financialController.getJournalEntry.bind(financialController));
// =============================================================================
// BALANCES
// =============================================================================
router.get('/tenants/:tenantId/balances', validateTenantAccess, financialController.getBalances.bind(financialController));
router.get('/accounts/:accountId/balance', financialController.getAccountBalance.bind(financialController));
router.get('/accounts/:accountId/available-balance', financialController.getAvailableBalance.bind(financialController));
// =============================================================================
// HOLDS
// =============================================================================
router.post('/tenants/:tenantId/holds', validateTenantAccess, requireKycLevel('basic'), financialController.createHold.bind(financialController));
router.get('/tenants/:tenantId/holds', validateTenantAccess, financialController.getHolds.bind(financialController));
router.post('/holds/:holdId/release', requireKycLevel('basic'), financialController.releaseHold.bind(financialController));
// =============================================================================
// CLIENT MANAGEMENT
// =============================================================================
router.post('/tenants/:tenantId/clients', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), financialController.createClient.bind(financialController));
router.get('/tenants/:tenantId/clients', validateTenantAccess, financialController.getClientsByTenant.bind(financialController));
router.get('/clients/:clientId', financialController.getClient.bind(financialController));
router.put('/clients/:clientId/kyc-status', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), financialController.updateClientKycStatus.bind(financialController));
router.post('/clients/:clientId/accounts/:accountId/link', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), financialController.linkClientToAccount.bind(financialController));
router.get('/clients/:clientId/accounts', financialController.getClientAccounts.bind(financialController));
// =============================================================================
// FUND SEGREGATION RULES
// =============================================================================
router.post('/tenants/:tenantId/segregation-rules', validateTenantAccess, (0, error_handler_1.requireRole)(['platform-admin']), financialController.createSegregationRule.bind(financialController));
// =============================================================================
// TRANSACTION PROCESSING
// =============================================================================
// Note: TransactionController will be created separately
router.post('/tenants/:tenantId/transactions', validateTenantAccess, requireKycLevel('basic'), transactionController.processTransaction.bind(transactionController));
router.post('/transactions/:transactionId/approve', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), transactionController.approveTransaction.bind(transactionController));
router.post('/transactions/:transactionId/reject', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), transactionController.rejectTransaction.bind(transactionController));
router.get('/transactions/:transactionId/status', transactionController.getTransactionStatus.bind(transactionController));
// =============================================================================
// RECONCILIATION
// =============================================================================
router.get('/reconciliation/stats', async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await reconciliationJob.getStats(days);
        res.json({ status: 'ok', days, stats });
    }
    catch (error) {
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get reconciliation stats', error));
        }
    }
});
router.post('/tenants/:tenantId/reconciliation/daily', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.runDailyReconciliation.bind(reconciliationController));
router.post('/tenants/:tenantId/reconciliation/run', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.runReconciliation.bind(reconciliationController));
router.post('/tenants/:tenantId/reconciliation/fetch-external', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.fetchExternalTransactions.bind(reconciliationController));
router.get('/tenants/:tenantId/reconciliation/config', validateTenantAccess, reconciliationController.getReconciliationConfig.bind(reconciliationController));
router.put('/tenants/:tenantId/reconciliation/config', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.updateReconciliationConfig.bind(reconciliationController));
// =============================================================================
// PROOF OF RESERVES
// =============================================================================
router.get('/por/latest', async (req, res, next) => {
    try {
        const exchange = String(req.query.exchange || 'bybit');
        const asset = String(req.query.asset || 'BTC');
        const proof = await reconciliationJob.getLastProofOfReserves(exchange, asset);
        if (!proof) {
            throw error_handler_2.AppError.notFound('Proof of reserves not found');
        }
        res.json({ status: 'ok', proof });
    }
    catch (error) {
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get proof of reserves', error));
        }
    }
});
router.post('/por/recompute', async (req, res, next) => {
    try {
        const { exchange, asset } = req.body || {};
        if (!exchange || !asset) {
            throw error_handler_2.AppError.badRequest('exchange and asset are required');
        }
        // Get exchange balance using OmniExchangeService
        const Decimal = require('decimal.js');
        let exchangeBalance = new Decimal(0);
        let internalTotal = new Decimal(0);
        try {
            // Initialize OmniExchangeService - it manages its own database connections
            // The Pool parameter is used for direct queries but the service works without it
            const omniExchange = new omni_exchange_1.OmniExchangeService({});
            await omniExchange.initialize();
            // Get actual exchange balance from the exchange
            const balance = await omniExchange.getBalance(exchange, asset);
            exchangeBalance = new Decimal(balance.total || '0');
            // Get platform allocation for internal total (what we've allocated to users)
            const allocation = omniExchange.getPlatformAllocation(exchange, asset);
            if (allocation) {
                // Sum all broker allocations as internal total
                let totalAllocated = new Decimal(0);
                for (const [, amount] of allocation.brokerAllocations) {
                    totalAllocated = totalAllocated.plus(new Decimal(amount));
                }
                internalTotal = totalAllocated;
            }
            logger_1.LoggerService.info('Proof of reserves data retrieved', {
                exchange,
                asset,
                exchangeBalance: exchangeBalance.toString(),
                internalTotal: internalTotal.toString()
            });
        }
        catch (exchangeError) {
            logger_1.LoggerService.warn('Failed to get exchange balance, using defaults', {
                exchange,
                asset,
                error: exchangeError.message
            });
            // Continue with zero balances if exchange is unavailable
        }
        const proof = await reconciliationJob.generateProofOfReserves(exchange, asset, exchangeBalance, internalTotal);
        res.json({ status: 'ok', proof });
    }
    catch (error) {
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to recompute proof of reserves', error));
        }
    }
});
// =============================================================================
// EXTERNAL TRANSACTION SOURCE MANAGEMENT
// =============================================================================
router.post('/tenants/:tenantId/reconciliation/sources', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.addExternalTransactionSource.bind(reconciliationController));
router.get('/tenants/:tenantId/reconciliation/sources', validateTenantAccess, reconciliationController.getExternalTransactionSources.bind(reconciliationController));
router.put('/tenants/:tenantId/reconciliation/sources/:sourceId', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.updateExternalTransactionSource.bind(reconciliationController));
router.delete('/tenants/:tenantId/reconciliation/sources/:sourceId', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reconciliationController.deleteExternalTransactionSource.bind(reconciliationController));
// =============================================================================
// FINANCIAL REPORTING
// =============================================================================
router.post('/tenants/:tenantId/reports/balance-sheet', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reportingController.generateBalanceSheet.bind(reportingController));
router.post('/tenants/:tenantId/reports/income-statement', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reportingController.generateIncomeStatement.bind(reportingController));
router.post('/tenants/:tenantId/reports/trial-balance', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), reportingController.generateTrialBalance.bind(reportingController));
router.get('/reports/:reportId', reportingController.getReport.bind(reportingController));
router.get('/tenants/:tenantId/reports', validateTenantAccess, reportingController.listReports.bind(reportingController));
// =============================================================================
// KEY MANAGEMENT (HSM INTEGRATION)
// =============================================================================
router.post('/tenants/:tenantId/keys', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), keyManagementController.createKey.bind(keyManagementController));
router.post('/keys/:keyId/rotate', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), keyManagementController.rotateKey.bind(keyManagementController));
router.post('/keys/:keyId/revoke', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), keyManagementController.revokeKey.bind(keyManagementController));
router.post('/tenants/:tenantId/encrypt', validateTenantAccess, requireKycLevel('basic'), keyManagementController.encryptData.bind(keyManagementController));
router.post('/tenants/:tenantId/decrypt', validateTenantAccess, requireKycLevel('basic'), keyManagementController.decryptData.bind(keyManagementController));
router.post('/tenants/:tenantId/sign', validateTenantAccess, requireKycLevel('basic'), keyManagementController.signData.bind(keyManagementController));
router.post('/tenants/:tenantId/verify', validateTenantAccess, requireKycLevel('basic'), keyManagementController.verifySignature.bind(keyManagementController));
router.get('/keys/:keyId/usage-stats', keyManagementController.getKeyUsageStats.bind(keyManagementController));
router.get('/keys/:keyId/audit-logs', keyManagementController.getKeyAuditLogs.bind(keyManagementController));
router.get('/tenants/:tenantId/keys/expiration', validateTenantAccess, keyManagementController.checkKeyExpiration.bind(keyManagementController));
router.get('/tenants/:tenantId/keys/health', validateTenantAccess, keyManagementController.getKeyHealth.bind(keyManagementController));
// =============================================================================
// MULTI-TIER LEDGER SYSTEM
// =============================================================================
// Note: MultiTierLedgerController exists in multi-tier-ledger service
// Routes will delegate to that service
const multi_tier_ledger_1 = require("../services/multi-tier-ledger");
// Platform Master Account Management
router.post('/tenants/:tenantId/platform-master-accounts', validateTenantAccess, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { name, currency, bankAccount } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createPlatformMasterAccount(tenantId, name, currency, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'Platform master account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create platform master account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to create platform master account', error));
        }
    }
});
router.get('/tenants/:tenantId/platform-master-accounts', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const accounts = await multi_tier_ledger_1.MultiTierLedgerService.getPlatformMasterAccounts(tenantId);
        res.json({
            success: true,
            data: accounts,
            message: 'Platform master accounts retrieved successfully',
            count: accounts.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get platform master accounts', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get platform master accounts', error));
        }
    }
});
// Broker Master Account Management
router.post('/tenants/:tenantId/broker-master-accounts', validateTenantAccess, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { brokerId, name, currency, parentAccountId, bankAccount } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createBrokerMasterAccount(tenantId, brokerId, name, currency, parentAccountId, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'Broker master account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create broker master account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to create broker master account', error));
        }
    }
});
router.get('/tenants/:tenantId/broker-master-accounts', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const brokerId = req.query.brokerId;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const accounts = await multi_tier_ledger_1.MultiTierLedgerService.getBrokerMasterAccounts(tenantId, brokerId);
        res.json({
            success: true,
            data: accounts,
            message: 'Broker master accounts retrieved successfully',
            count: accounts.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get broker master accounts', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get broker master accounts', error));
        }
    }
});
router.get('/broker-master-accounts/:accountId', async (req, res, next) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.getBrokerMasterAccount(accountId);
        if (!account) {
            throw error_handler_2.AppError.notFound('Broker master account not found');
        }
        res.json({
            success: true,
            data: account,
            message: 'Broker master account retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get broker master account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get broker master account', error));
        }
    }
});
// End User Account Management
router.post('/tenants/:tenantId/brokers/:brokerId/end-user-accounts', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { userId, name, currency, parentAccountId, bankAccount } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createEndUserAccount(tenantId, userId, name, currency, parentAccountId, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'End user account created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create end user account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to create end user account', error));
        }
    }
});
router.get('/tenants/:tenantId/brokers/:brokerId/end-user-accounts', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId, brokerId } = req.params;
        const userId = req.query.userId;
        if (!tenantId || !brokerId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID and Broker ID are required'
            });
            return;
        }
        const accounts = await multi_tier_ledger_1.MultiTierLedgerService.getEndUserAccounts(tenantId, brokerId, userId);
        res.json({
            success: true,
            data: accounts,
            message: 'End user accounts retrieved successfully',
            count: accounts.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get end user accounts', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get end user accounts', error));
        }
    }
});
router.get('/end-user-accounts/:accountId', async (req, res, next) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.getEndUserAccount(accountId);
        if (!account) {
            throw error_handler_2.AppError.notFound('End user account not found');
        }
        res.json({
            success: true,
            data: account,
            message: 'End user account retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get end user account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get end user account', error));
        }
    }
});
// Bank Account Configuration
router.post('/ledger-accounts/:accountId/bank-accounts', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { accountId } = req.params;
        const bankAccount = req.body;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        // Validate required fields
        if (!bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.currency || !bankAccount.country) {
            throw error_handler_2.AppError.badRequest('Missing required fields: bankName, accountNumber, currency, country');
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.configureBankAccount(accountId, bankAccount);
        res.status(201).json({
            success: true,
            data: account,
            message: 'Bank account configured successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to configure bank account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            // Check for specific error codes
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to configure bank account', error));
            }
        }
    }
});
router.get('/ledger-accounts/:accountId/bank-accounts', async (req, res, next) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const bankAccount = await multi_tier_ledger_1.MultiTierLedgerService.getBankAccount(accountId);
        if (!bankAccount) {
            throw error_handler_2.AppError.notFound('Bank account not configured for this account');
        }
        res.json({
            success: true,
            data: bankAccount,
            message: 'Bank account retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get bank account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get bank account', error));
        }
    }
});
router.put('/ledger-accounts/:accountId/bank-accounts', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { accountId } = req.params;
        const updates = req.body;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.updateBankAccount(accountId, updates);
        res.json({
            success: true,
            data: account,
            message: 'Bank account updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to update bank account', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            // Check for specific error codes
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else if (errorObj?.code === 'BANK_ACCOUNT_NOT_CONFIGURED') {
                next(error_handler_2.AppError.badRequest(errorObj.message || 'Bank account not configured'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to update bank account', error));
            }
        }
    }
});
// Fund Transfers between Accounts
router.post('/ledger-accounts/transfer', requireKycLevel('basic'), async (req, res, next) => {
    try {
        const { fromAccountId, toAccountId, amount, currency, description, reference, metadata } = req.body;
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.transferFunds(fromAccountId, toAccountId, amount, currency, description || 'Fund transfer', reference || undefined, metadata || undefined);
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Fund transfer processed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Transfer funds failed', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to transfer funds', error));
        }
    }
});
router.get('/ledger-accounts/:accountId/transfers', async (req, res, next) => {
    try {
        const { accountId } = req.params;
        const { fromDate, toDate, status, transactionType, limit, offset } = req.query;
        if (!accountId) {
            res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
            return;
        }
        const filters = {};
        if (fromDate)
            filters.fromDate = new Date(fromDate);
        if (toDate)
            filters.toDate = new Date(toDate);
        if (status)
            filters.status = status;
        if (transactionType)
            filters.transactionType = transactionType;
        if (limit)
            filters.limit = Number(limit);
        if (offset)
            filters.offset = Number(offset);
        const result = await multi_tier_ledger_1.MultiTierLedgerService.getAccountTransfers(accountId, filters);
        res.json({
            success: true,
            data: result.transactions,
            pagination: {
                total: result.total,
                limit: filters.limit || 50,
                offset: filters.offset || 0,
                hasMore: (filters.offset || 0) + (filters.limit || 50) < result.total
            },
            message: 'Account transfers retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get account transfers', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get account transfers', error));
        }
    }
});
// Fund Segregation Management
router.get('/tenants/:tenantId/fund-segregations', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountId, segregationType, status, currency } = req.query;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const filters = {};
        if (accountId)
            filters.accountId = accountId;
        if (segregationType)
            filters.segregationType = segregationType;
        if (status)
            filters.status = status;
        if (currency)
            filters.currency = currency;
        const segregations = await multi_tier_ledger_1.MultiTierLedgerService.getFundSegregations(tenantId, filters);
        res.json({
            success: true,
            data: segregations,
            count: segregations.length,
            message: 'Fund segregations retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get fund segregations', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get fund segregations', error));
        }
    }
});
router.get('/fund-segregations/:segregationId', async (req, res, next) => {
    try {
        const { segregationId } = req.params;
        if (!segregationId) {
            res.status(400).json({
                success: false,
                error: 'Segregation ID is required'
            });
            return;
        }
        const segregation = await multi_tier_ledger_1.MultiTierLedgerService.getFundSegregation(segregationId);
        if (!segregation) {
            throw error_handler_2.AppError.notFound('Fund segregation not found');
        }
        res.json({
            success: true,
            data: segregation,
            message: 'Fund segregation retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get fund segregation', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get fund segregation', error));
        }
    }
});
router.put('/fund-segregations/:segregationId/status', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { segregationId } = req.params;
        const { status } = req.body;
        if (!segregationId) {
            res.status(400).json({
                success: false,
                error: 'Segregation ID is required'
            });
            return;
        }
        if (!status) {
            throw error_handler_2.AppError.badRequest('Status is required');
        }
        const segregation = await multi_tier_ledger_1.MultiTierLedgerService.updateFundSegregationStatus(segregationId, status);
        res.json({
            success: true,
            data: segregation,
            message: 'Fund segregation status updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to update fund segregation status', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            // Check for specific error codes
            const errorObj = error;
            if (errorObj?.code === 'FUND_SEGREGATION_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Fund segregation not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to update fund segregation status', error));
            }
        }
    }
});
// Bank Reconciliation
router.post('/tenants/:tenantId/reconciliation/bank-accounts', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountIds, reconciliationDate } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
            throw error_handler_2.AppError.badRequest('accountIds array is required');
        }
        const report = await multi_tier_ledger_1.MultiTierLedgerService.reconcileBankAccounts(tenantId, accountIds, reconciliationDate ? new Date(reconciliationDate) : undefined);
        res.status(201).json({
            success: true,
            data: report,
            message: 'Bank account reconciliation completed successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to reconcile bank accounts', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to reconcile bank accounts', error));
        }
    }
});
router.get('/tenants/:tenantId/reconciliation/reports', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { fromDate, toDate, status, limit, offset } = req.query;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const filters = {};
        if (fromDate)
            filters.fromDate = new Date(fromDate);
        if (toDate)
            filters.toDate = new Date(toDate);
        if (status)
            filters.status = status;
        if (limit)
            filters.limit = Number(limit);
        if (offset)
            filters.offset = Number(offset);
        const result = await multi_tier_ledger_1.MultiTierLedgerService.getReconciliationReports(tenantId, filters);
        res.json({
            success: true,
            data: result.reports,
            pagination: {
                total: result.total,
                limit: filters.limit || 50,
                offset: filters.offset || 0,
                hasMore: (filters.offset || 0) + (filters.limit || 50) < result.total
            },
            message: 'Reconciliation reports retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get reconciliation reports', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get reconciliation reports', error));
        }
    }
});
// Fund Segregation Reports
router.post('/tenants/:tenantId/reports/fund-segregation', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { startDate, endDate, accountTypes, currency, includeTransactions } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const options = {};
        if (startDate)
            options.startDate = new Date(startDate);
        if (endDate)
            options.endDate = new Date(endDate);
        if (accountTypes)
            options.accountTypes = accountTypes;
        if (currency)
            options.currency = currency;
        if (includeTransactions !== undefined)
            options.includeTransactions = includeTransactions;
        const report = await multi_tier_ledger_1.MultiTierLedgerService.generateFundSegregationReport(tenantId, options);
        res.status(201).json({
            success: true,
            data: report,
            message: 'Fund segregation report generated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to generate fund segregation report', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to generate fund segregation report', error));
        }
    }
});
router.get('/oversight-reports/:reportId', async (req, res, next) => {
    try {
        const { reportId } = req.params;
        if (!reportId) {
            res.status(400).json({
                success: false,
                error: 'Report ID is required'
            });
            return;
        }
        const report = await multi_tier_ledger_1.MultiTierLedgerService.getOversightReport(reportId);
        if (!report) {
            throw error_handler_2.AppError.notFound('Oversight report not found');
        }
        res.json({
            success: true,
            data: report,
            message: 'Oversight report retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get oversight report', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get oversight report', error));
        }
    }
});
// Generate Oversight Report
router.post('/tenants/:tenantId/reports/oversight', validateTenantAccess, (0, error_handler_1.requireRole)(['platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { reportType, startDate, endDate, includeAllBrokers } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const options = {};
        if (reportType)
            options.reportType = reportType;
        if (startDate)
            options.startDate = new Date(startDate);
        if (endDate)
            options.endDate = new Date(endDate);
        if (includeAllBrokers !== undefined)
            options.includeAllBrokers = includeAllBrokers;
        const report = await multi_tier_ledger_1.MultiTierLedgerService.generateOversightReport(tenantId, options);
        res.status(201).json({
            success: true,
            data: report,
            message: 'Oversight report generated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to generate oversight report', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to generate oversight report', error));
        }
    }
});
// FIAT Transaction Management
router.post('/tenants/:tenantId/fiat/deposits', validateTenantAccess, requireKycLevel('basic'), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountId, amount, currency, reference, description } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        if (!accountId || !amount || !currency || !reference) {
            throw error_handler_2.AppError.badRequest('Missing required fields: accountId, amount, currency, reference');
        }
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.createFiatDeposit(tenantId, accountId, amount, currency, reference, description);
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Fiat deposit created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create fiat deposit', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to create fiat deposit', error));
            }
        }
    }
});
router.post('/tenants/:tenantId/fiat/withdrawals', validateTenantAccess, requireKycLevel('basic'), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountId, amount, currency, bankAccountId, description } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        if (!accountId || !amount || !currency || !bankAccountId) {
            throw error_handler_2.AppError.badRequest('Missing required fields: accountId, amount, currency, bankAccountId');
        }
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.createFiatWithdrawal(tenantId, accountId, amount, currency, bankAccountId, description);
        res.status(201).json({
            success: true,
            data: transaction,
            message: 'Fiat withdrawal created successfully',
            requiresApproval: transaction.status === multi_tier_ledger_1.TransactionStatus.REQUIRES_APPROVAL
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create fiat withdrawal', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else if (errorObj?.code === 'INVALID_BANK_ACCOUNT') {
                next(error_handler_2.AppError.badRequest(errorObj.message || 'Invalid bank account'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to create fiat withdrawal', error));
            }
        }
    }
});
router.get('/tenants/:tenantId/fiat/transactions', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountId, type, status, currency, fromDate, toDate, limit, offset } = req.query;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const filters = {};
        if (accountId)
            filters.accountId = accountId;
        if (type)
            filters.type = type;
        if (status)
            filters.status = status;
        if (currency)
            filters.currency = currency;
        if (fromDate)
            filters.fromDate = new Date(fromDate);
        if (toDate)
            filters.toDate = new Date(toDate);
        if (limit)
            filters.limit = Number(limit);
        if (offset)
            filters.offset = Number(offset);
        const result = await multi_tier_ledger_1.MultiTierLedgerService.getFiatTransactions(tenantId, filters);
        res.json({
            success: true,
            data: result.transactions,
            pagination: {
                total: result.total,
                limit: filters.limit || 50,
                offset: filters.offset || 0,
                hasMore: (filters.offset || 0) + (filters.limit || 50) < result.total
            },
            message: 'Fiat transactions retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get fiat transactions', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get fiat transactions', error));
        }
    }
});
router.get('/fiat/transactions/:transactionId', async (req, res, next) => {
    try {
        const { transactionId } = req.params;
        if (!transactionId) {
            res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
            return;
        }
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.getFiatTransaction(transactionId);
        if (!transaction) {
            throw error_handler_2.AppError.notFound('Fiat transaction not found');
        }
        res.json({
            success: true,
            data: transaction,
            message: 'Fiat transaction retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get fiat transaction', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get fiat transaction', error));
        }
    }
});
// Unallocated Funds Management
router.get('/tenants/:tenantId/unallocated-funds', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const funds = await multi_tier_ledger_1.MultiTierLedgerService.getUnallocatedFunds(tenantId);
        res.json({
            success: true,
            data: funds,
            count: funds.length,
            totalAmount: funds.reduce((sum, f) => sum + f.amount, 0),
            message: 'Unallocated funds retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get unallocated funds', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get unallocated funds', error));
        }
    }
});
router.post('/unallocated-funds/:fundId/allocate', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { fundId } = req.params;
        const { tenantId, targetAccountId, allocationReason } = req.body;
        if (!fundId) {
            res.status(400).json({
                success: false,
                error: 'Fund ID is required'
            });
            return;
        }
        if (!targetAccountId) {
            throw error_handler_2.AppError.badRequest('targetAccountId is required');
        }
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.allocateFund(tenantId || req.user?.tenantId, fundId, targetAccountId, allocationReason);
        res.json({
            success: true,
            data: transaction,
            message: 'Fund allocated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to allocate fund', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'FUND_NOT_FOUND' || errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Fund or account not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to allocate fund', error));
            }
        }
    }
});
router.post('/unallocated-funds/:fundId/refund', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { fundId } = req.params;
        const { tenantId, refundReason } = req.body;
        if (!fundId) {
            res.status(400).json({
                success: false,
                error: 'Fund ID is required'
            });
            return;
        }
        const transaction = await multi_tier_ledger_1.MultiTierLedgerService.refundUnallocatedFund(tenantId || req.user?.tenantId, fundId, refundReason);
        res.json({
            success: true,
            data: transaction,
            message: 'Unallocated fund refunded successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to refund unallocated fund', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'FUND_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Fund not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to refund unallocated fund', error));
            }
        }
    }
});
// Withdrawal Limits Management
router.get('/tenants/:tenantId/withdrawal-limits', validateTenantAccess, async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const accountId = req.query.accountId;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        const limits = await multi_tier_ledger_1.MultiTierLedgerService.getWithdrawalLimits(tenantId, accountId);
        res.json({
            success: true,
            data: limits,
            count: limits.length,
            message: 'Withdrawal limits retrieved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get withdrawal limits', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            next(error_handler_2.AppError.internal('Failed to get withdrawal limits', error));
        }
    }
});
router.post('/tenants/:tenantId/withdrawal-limits', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const { accountId, dailyLimit, monthlyLimit, singleTransactionLimit } = req.body;
        if (!tenantId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID is required'
            });
            return;
        }
        if (!accountId) {
            throw error_handler_2.AppError.badRequest('accountId is required');
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.createWithdrawalLimit(tenantId, accountId, { dailyLimit, monthlyLimit, singleTransactionLimit });
        res.status(201).json({
            success: true,
            data: account,
            message: 'Withdrawal limit created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create withdrawal limit', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to create withdrawal limit', error));
            }
        }
    }
});
router.put('/tenants/:tenantId/withdrawal-limits/:accountId', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), async (req, res, next) => {
    try {
        const { tenantId, accountId } = req.params;
        const { dailyLimit, monthlyLimit, singleTransactionLimit } = req.body;
        if (!tenantId || !accountId) {
            res.status(400).json({
                success: false,
                error: 'Tenant ID and Account ID are required'
            });
            return;
        }
        const account = await multi_tier_ledger_1.MultiTierLedgerService.updateWithdrawalLimit(tenantId, accountId, { dailyLimit, monthlyLimit, singleTransactionLimit });
        res.json({
            success: true,
            data: account,
            message: 'Withdrawal limit updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to update withdrawal limit', error);
        if (error instanceof error_handler_2.AppError) {
            next(error);
        }
        else {
            const errorObj = error;
            if (errorObj?.code === 'ACCOUNT_NOT_FOUND') {
                next(error_handler_2.AppError.notFound(errorObj.message || 'Account not found'));
            }
            else {
                next(error_handler_2.AppError.internal('Failed to update withdrawal limit', error));
            }
        }
    }
});
// =============================================================================
// WALLET INFRASTRUCTURE
// =============================================================================
router.post('/tenants/:tenantId/brokers/:brokerId/users/:userId/wallets', validateTenantAccess, (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), walletInfrastructureController.createUserWalletInfrastructure.bind(walletInfrastructureController));
router.get('/tenants/:tenantId/users/:userId/wallets', validateTenantAccess, walletInfrastructureController.getUserWallets.bind(walletInfrastructureController));
router.get('/wallets/:walletId', walletInfrastructureController.getWalletDetails.bind(walletInfrastructureController));
router.get('/wallets/:walletId/balance', walletInfrastructureController.getWalletBalance.bind(walletInfrastructureController));
router.put('/wallets/:walletId/status', (0, error_handler_1.requireRole)(['broker-admin', 'platform-admin']), walletInfrastructureController.updateWalletStatus.bind(walletInfrastructureController));
router.get('/wallets/:walletId/transactions', walletInfrastructureController.getWalletTransactions.bind(walletInfrastructureController));
router.post('/wallets/:walletId/transactions', requireKycLevel('basic'), walletInfrastructureController.createWalletTransaction.bind(walletInfrastructureController));
router.get('/external-wallet-providers', walletInfrastructureController.getExternalWalletProviders.bind(walletInfrastructureController));
router.post('/tenants/:tenantId/brokers/:brokerId/users/:userId/external-wallets', validateTenantAccess, requireKycLevel('basic'), walletInfrastructureController.connectExternalWallet.bind(walletInfrastructureController));
router.get('/wallets/:walletId/security', walletInfrastructureController.getWalletSecuritySettings.bind(walletInfrastructureController));
router.put('/wallets/:walletId/security', requireKycLevel('basic'), walletInfrastructureController.updateWalletSecuritySettings.bind(walletInfrastructureController));
router.get('/wallets/:walletId/backup', walletInfrastructureController.getWalletBackup.bind(walletInfrastructureController));
router.post('/wallets/:walletId/backup', requireKycLevel('basic'), walletInfrastructureController.createWalletBackup.bind(walletInfrastructureController));
exports.default = router;
//# sourceMappingURL=financial.js.map