"use strict";
/**
 * Financial Controller
 *
 * Complete implementation matching original financial-svc controller
 * Handles all HTTP request/response for financial operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialController = void 0;
const logger_1 = require("../services/logger");
// Removed unused import: createError
class FinancialController {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async createJournalEntry(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const { description, lines, idempotencyKey, metadata } = req.body;
            // Validate lines
            if (!lines || !Array.isArray(lines) || lines.length === 0) {
                res.status(400).json({
                    message: 'Invalid journal entry lines',
                    code: 'INVALID_LINES'
                });
                return;
            }
            const entry = await this.repository.createJournalEntry(tenantId, description || '', lines.map(l => ({
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                currency: l.currency,
                description: l.description
            })), idempotencyKey, metadata, {
                clientId: req.clientId,
                userId: req.userId || req.user?.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.sessionId
            });
            logger_1.LoggerService.info('Journal entry created', { entryId: entry.id, tenantId });
            res.status(201).json(entry);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create journal entry', { error: error.message });
            res.status(500).json({
                message: 'Failed to create journal entry',
                code: 'INTERNAL_ERROR',
                details: error.message
            });
        }
    }
    async getJournalEntries(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const entries = await this.repository.getJournalEntries(tenantId, limit, offset);
            res.json({
                entries,
                total: entries.length,
                limit,
                offset
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get journal entries', { error: error.message });
            res.status(500).json({
                message: 'Failed to get journal entries',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getJournalEntry(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                res.status(400).json({ message: 'id is required', code: 'INVALID_REQUEST' });
                return;
            }
            const entry = await this.repository.getJournalEntry(id);
            if (!entry) {
                res.status(404).json({
                    message: 'Journal entry not found',
                    code: 'NOT_FOUND'
                });
                return;
            }
            res.json(entry);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get journal entry', { error: error.message });
            res.status(500).json({
                message: 'Failed to get journal entry',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getBalances(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const accounts = await this.repository.getAccountsByTenant(tenantId);
            res.json({
                accounts,
                total: accounts.length
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get balances', { error: error.message });
            res.status(500).json({
                message: 'Failed to get balances',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getAccountBalance(req, res) {
        try {
            const accountId = req.params.accountId;
            if (!accountId) {
                res.status(400).json({ message: 'accountId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const balance = await this.repository.getAccountBalance(accountId);
            if (!balance) {
                res.status(404).json({
                    message: 'Account not found',
                    code: 'NOT_FOUND'
                });
                return;
            }
            res.json({
                accountId,
                balance: parseFloat(balance.balance.toString()),
                availableBalance: parseFloat(balance.available_balance.toString())
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get account balance', { error: error.message });
            res.status(500).json({
                message: 'Failed to get account balance',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getAvailableBalance(req, res) {
        try {
            const accountId = req.params.accountId;
            if (!accountId) {
                res.status(400).json({ message: 'accountId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const balance = await this.repository.getAccountBalance(accountId);
            if (!balance) {
                res.status(404).json({
                    message: 'Account not found',
                    code: 'NOT_FOUND'
                });
                return;
            }
            res.json({
                accountId,
                availableBalance: parseFloat(balance.available_balance.toString())
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get available balance', { error: error.message });
            res.status(500).json({
                message: 'Failed to get available balance',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async createHold(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const { accountId, amount, currency, description, expiresAt, metadata } = req.body;
            if (!accountId || !amount || amount <= 0) {
                res.status(400).json({
                    message: 'Invalid hold parameters',
                    code: 'INVALID_PARAMETERS'
                });
                return;
            }
            const hold = await this.repository.createHold(tenantId, accountId, amount, currency || 'USD', description, expiresAt ? new Date(expiresAt) : undefined, metadata);
            logger_1.LoggerService.info('Hold created', { holdId: hold.id, tenantId, accountId });
            res.status(201).json(hold);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create hold', { error: error.message });
            if (error.message === 'Insufficient available balance') {
                res.status(400).json({
                    message: error.message,
                    code: 'INSUFFICIENT_BALANCE'
                });
                return;
            }
            res.status(500).json({
                message: 'Failed to create hold',
                code: 'INTERNAL_ERROR',
                details: error.message
            });
        }
    }
    async getHolds(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const status = req.query.status;
            const holds = await this.repository.getHolds(tenantId, status);
            res.json({
                holds,
                total: holds.length
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get holds', { error: error.message });
            res.status(500).json({
                message: 'Failed to get holds',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async releaseHold(req, res) {
        try {
            const holdId = req.params.holdId;
            if (!holdId) {
                res.status(400).json({ message: 'holdId is required', code: 'INVALID_REQUEST' });
                return;
            }
            await this.repository.releaseHold(holdId);
            logger_1.LoggerService.info('Hold released', { holdId });
            res.json({
                message: 'Hold released successfully',
                holdId
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to release hold', { error: error.message });
            if (error.message === 'Hold not found or already released') {
                res.status(404).json({
                    message: error.message,
                    code: 'NOT_FOUND'
                });
                return;
            }
            res.status(500).json({
                message: 'Failed to release hold',
                code: 'INTERNAL_ERROR',
                details: error.message
            });
        }
    }
    // Client Management
    async createClient(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const { name, externalId, email, phone, metadata } = req.body;
            if (!name) {
                res.status(400).json({
                    message: 'Client name is required',
                    code: 'INVALID_PARAMETERS'
                });
                return;
            }
            // Tenant must be a broker-tenant (validated in repository)
            const client = await this.repository.createClient(tenantId, name, externalId, email, phone, metadata);
            logger_1.LoggerService.info('Client created', { clientId: client.id, tenantId });
            res.status(201).json(client);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create client', { error: error.message });
            if (error.code === 'NOT_A_BROKER_TENANT' || error.code === 'TENANT_NOT_FOUND') {
                res.status(400).json({
                    message: error.message,
                    code: error.code
                });
            }
            else {
                res.status(500).json({
                    message: 'Failed to create client',
                    code: 'INTERNAL_ERROR',
                    details: error.message
                });
            }
        }
    }
    async getClient(req, res) {
        try {
            const clientId = req.params.clientId;
            if (!clientId) {
                res.status(400).json({ message: 'clientId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const client = await this.repository.getClient(clientId);
            if (!client) {
                res.status(404).json({
                    message: 'Client not found',
                    code: 'NOT_FOUND'
                });
                return;
            }
            res.json(client);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get client', { error: error.message });
            res.status(500).json({
                message: 'Failed to get client',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getClientsByTenant(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const status = req.query.status;
            const clients = await this.repository.getClientsByTenant(tenantId, status);
            res.json({
                clients,
                total: clients.length,
                tenantId,
                tenantType: 'broker' // Only broker-tenants can have clients
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get clients', { error: error.message });
            res.status(500).json({
                message: 'Failed to get clients',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async updateClientKycStatus(req, res) {
        try {
            const clientId = req.params.clientId;
            if (!clientId) {
                res.status(400).json({ message: 'clientId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const { kycStatus, completedAt } = req.body;
            await this.repository.updateClientKycStatus(clientId, kycStatus, completedAt ? new Date(completedAt) : undefined);
            logger_1.LoggerService.info('Client KYC status updated', { clientId, kycStatus });
            res.json({
                message: 'Client KYC status updated successfully'
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update client KYC status', { error: error.message });
            res.status(500).json({
                message: 'Failed to update client KYC status',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async linkClientToAccount(req, res) {
        try {
            const clientId = req.params.clientId;
            const accountId = req.params.accountId;
            if (!clientId || !accountId) {
                res.status(400).json({ message: 'clientId and accountId are required', code: 'INVALID_REQUEST' });
                return;
            }
            const { relationshipType, permissions } = req.body;
            const link = await this.repository.linkClientToAccount(clientId, accountId, relationshipType, permissions);
            logger_1.LoggerService.info('Client linked to account', { clientId, accountId, linkId: link.id });
            res.status(201).json(link);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to link client to account', { error: error.message });
            res.status(500).json({
                message: 'Failed to link client to account',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async getClientAccounts(req, res) {
        try {
            const clientId = req.params.clientId;
            if (!clientId) {
                res.status(400).json({ message: 'clientId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const accounts = await this.repository.getClientAccounts(clientId);
            res.json({
                accounts,
                total: accounts.length
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get client accounts', { error: error.message });
            res.status(500).json({
                message: 'Failed to get client accounts',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    async createSegregationRule(req, res) {
        try {
            const tenantId = req.params.tenantId;
            if (!tenantId) {
                res.status(400).json({ message: 'tenantId is required', code: 'INVALID_REQUEST' });
                return;
            }
            const { ruleName, segregationType, ...options } = req.body;
            const rule = await this.repository.createSegregationRule(tenantId, ruleName, segregationType, options);
            logger_1.LoggerService.info('Fund segregation rule created', { ruleId: rule.id, tenantId });
            res.status(201).json(rule);
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create segregation rule', { error: error.message });
            res.status(500).json({
                message: 'Failed to create segregation rule',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}
exports.FinancialController = FinancialController;
//# sourceMappingURL=financial-controller.js.map