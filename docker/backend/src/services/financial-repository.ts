/**
 * Financial Repository Service
 * 
 * Core repository for all financial database operations with double-entry bookkeeping.
 * 
 * Features:
 * - Journal entries with strict double-entry validation (debits = credits)
 * - Account management with balance tracking
 * - Fund segregation rules enforcement (client funds vs platform funds)
 * - Hold management (reserving funds for pending transactions)
 * - Client account relationships
 * - Comprehensive audit logging for all financial operations
 * - Transaction safety with Sequelize transactions
 * - Idempotency support to prevent duplicate entries
 * 
 * Double-Entry Bookkeeping:
 * - All journal entries must balance (total debits = total credits)
 * - Validation occurs before database commit
 * - Supports multi-currency transactions
 * 
 * Fund Segregation:
 * - Validates transfers between client and platform accounts
 * - Enforces segregation rules per tenant
 * - Prevents unauthorized fund mixing
 * 
 * Account Operations:
 * - Create and manage financial accounts
 * - Track account balances with Decimal precision
 * - Support for multiple currencies
 * - Account holds for pending operations
 * 
 * Audit Trail:
 * - All operations logged with full context
 * - Includes user, IP, session, and operation details
 * - Immutable audit logs for compliance
 * 
 * Production Features:
 * - Comprehensive error handling
 * - Transaction rollback on errors
 * - Decimal precision for financial calculations
 * - Thread-safe operations
 */

import { DatabaseService } from './database';
import { LoggerService } from './logger';
import { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import Decimal from 'decimal.js';
import { createError } from '../utils';

interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  currency: string;
  description?: string;
}

interface AuditContext {
  clientId?: string;
  brokerId?: string; // Broker for fund segregation tracking
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface FundSegregationCheck {
  allowed: boolean;
  reason?: string;
  requiresDualAuth?: boolean;
}

export class FinancialRepository {
  private sequelize = DatabaseService.getSequelize();

  /**
   * Create journal entry with double-entry bookkeeping validation
   */
  async createJournalEntry(
    tenantId: string,
    description: string,
    lines: JournalEntryLine[],
    idempotencyKey?: string,
    metadata?: any,
    context?: AuditContext
  ): Promise<any> {
    const t = await this.sequelize.transaction();
    try {
      // Check idempotency
      if (idempotencyKey) {
        const JournalEntryModel = DatabaseService.getModel('JournalEntry');
        const existing = await JournalEntryModel.findOne({
          where: { idempotencyKey },
          transaction: t
        });
        if (existing) {
          await t.commit();
          const lines = await this.getJournalEntryLines(existing.get('id') as string, t);
          return { ...existing.toJSON(), lines };
        }
      }

      // Validate double-entry bookkeeping
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);
      
      for (const line of lines) {
        totalDebits = totalDebits.plus(line.debit || 0);
        totalCredits = totalCredits.plus(line.credit || 0);
      }

      if (totalDebits.minus(totalCredits).abs().greaterThan(0.01)) {
        throw new Error('Journal entry must balance (debits must equal credits)');
      }

      // Validate fund segregation rules for all account pairs
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const sourceAccount = lines[i];
          const targetAccount = lines[j];
          
          if (!sourceAccount || !targetAccount || sourceAccount.accountId === targetAccount.accountId) continue;

          const amount = Math.max(sourceAccount.debit || 0, sourceAccount.credit || 0);
          const segregationCheck = await this.validateFundSegregation(
            tenantId,
            sourceAccount.accountId,
            targetAccount.accountId,
            amount,
            t
          );

          if (!segregationCheck.allowed) {
            throw new Error(`Fund segregation violation: ${segregationCheck.reason}`);
          }

          if (segregationCheck.requiresDualAuth && !metadata?.dualAuthorized) {
            throw new Error('Dual authorization required for this transaction');
          }
        }
      }

      // Create journal entry
      const JournalEntryModel = DatabaseService.getModel('JournalEntry');
      const entry = await JournalEntryModel.create({
        tenantId,
        description,
        idempotencyKey,
        metadata: metadata || {}
      }, { transaction: t });

      // Create journal entry lines and update account balances
      const JournalEntryLineModel = DatabaseService.getModel('JournalEntryLine');
      const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
      const createdLines = [];

      for (const line of lines) {
        // Create line
        const lineRecord = await JournalEntryLineModel.create({
          journalEntryId: entry.get('id') as string,
          accountId: line.accountId,
          debit: line.debit || 0,
          credit: line.credit || 0,
          currency: line.currency || 'USD',
          description: line.description
        }, { transaction: t });

        createdLines.push(lineRecord.toJSON());

        // Ensure account exists
        await this.ensureAccountExists(
          line.accountId,
          tenantId,
          line.currency || 'USD',
          context?.clientId,
          t
        );

        // Update account balance
        const balanceChange = new Decimal(line.debit || 0).minus(line.credit || 0);
        
        await FinancialAccountModel.update(
          {
            balance: this.sequelize.literal(`balance + ${balanceChange}`),
            availableBalance: this.sequelize.literal(`available_balance + ${balanceChange}`)
          },
          {
            where: { id: line.accountId, tenantId },
            transaction: t
          }
        );
      }

      // Audit log
      await this.createAuditLog(
        tenantId,
        'journal_entry',
        entry.get('id') as string,
        'create',
        {
          description,
          lines: createdLines.length,
          totalAmount: totalDebits.abs().toNumber()
        },
        context,
        t
      );

      // Emit audit event via LoggerService
      try {
        await LoggerService.logAudit(
          'journal_entry_created',
          'journal_entry',
          { userId: context?.userId, tenantId, brokerId: tenantId }, // For broker-tenants, tenantId = brokerId
          {
            entryId: entry.get('id'),
            description,
            lines: createdLines.length,
            totalAmount: totalDebits.abs().toNumber(),
            ip: context?.ipAddress,
            userAgent: context?.userAgent,
            sessionId: context?.sessionId
          }
        );
      } catch (e) {
        LoggerService.error('Audit log emit failed (journal_entry_created)', { error: (e as Error).message });
        // Don't throw - audit logging failure shouldn't block transaction
      }

      await t.commit();
      
      return {
        ...entry.toJSON(),
        lines: createdLines
      };
    } catch (error) {
      await t.rollback();
      LoggerService.error('Failed to create journal entry', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get journal entries for tenant
   */
  async getJournalEntries(tenantId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    const JournalEntryModel = DatabaseService.getModel('JournalEntry');
    const JournalEntryLineModel = DatabaseService.getModel('JournalEntryLine');

    const entries = await JournalEntryModel.findAll({
      where: { tenantId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: JournalEntryLineModel,
        as: 'lines'
      }]
    });

    return entries.map(e => e.toJSON());
  }

  /**
   * Get single journal entry
   */
  async getJournalEntry(id: string): Promise<any | null> {
    const JournalEntryModel = DatabaseService.getModel('JournalEntry');
    const JournalEntryLineModel = DatabaseService.getModel('JournalEntryLine');

    const entry = await JournalEntryModel.findByPk(id, {
      include: [{
        model: JournalEntryLineModel,
        as: 'lines'
      }]
    });

    return entry ? entry.toJSON() : null;
  }

  /**
   * Get journal entry lines (helper)
   */
  private async getJournalEntryLines(journalEntryId: string, transaction?: Transaction): Promise<any[]> {
    const JournalEntryLineModel = DatabaseService.getModel('JournalEntryLine');
    const lines = await JournalEntryLineModel.findAll({
      where: { journalEntryId },
      transaction
    });
    return lines.map(l => l.toJSON());
  }

  /**
   * Ensure account exists, create if not
   */
  async ensureAccountExists(
    accountId: string,
    tenantId: string,
    currency: string,
    clientId?: string,
    transaction?: Transaction
  ): Promise<void> {
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    
    const where: any = { id: accountId, tenantId };
    if (clientId) {
      where.clientId = clientId;
      // Validate that client belongs to this tenant (tenant must be broker)
      const ClientModel = DatabaseService.getModel('Client');
      const client = await ClientModel.findByPk(clientId);
      if (client) {
        const clientData = client.toJSON();
        if (clientData.tenantId !== tenantId) {
          throw createError('Client does not belong to this tenant', 400, 'CLIENT_TENANT_MISMATCH');
        }
      }
    }
    
    const existing = await FinancialAccountModel.findOne({
      where,
      transaction
    });

    if (!existing) {
      await FinancialAccountModel.create({
        id: accountId,
        tenantId, // Tenant ID is the broker ID if tenant is a broker
        clientId: clientId || null,
        name: accountId,
        type: 'general',
        accountType: 'client_trading',
        currency,
        balance: 0,
        availableBalance: 0,
        segregationLevel: 'client'
      }, { transaction });
    }
  }

  /**
   * Get account
   */
  async getAccount(accountId: string): Promise<any | null> {
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    const account = await FinancialAccountModel.findByPk(accountId);
    return account ? account.toJSON() : null;
  }

  /**
   * Get accounts by tenant
   */
  async getAccountsByTenant(tenantId: string): Promise<any[]> {
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    const accounts = await FinancialAccountModel.findAll({
      where: { tenantId },
      order: [['createdAt', 'DESC']]
    });
    return accounts.map(a => a.toJSON());
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<any | null> {
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    const account = await FinancialAccountModel.findOne({
      where: { id: accountId, isActive: true },
      attributes: ['balance', 'availableBalance']
    });
    
    if (!account) return null;
    
    const data = account.toJSON();
    return {
      balance: new Decimal(data.balance),
      available_balance: new Decimal(data.availableBalance)
    };
  }

  /**
   * Create hold on account balance
   */
  async createHold(
    tenantId: string,
    accountId: string,
    amount: number,
    currency: string,
    description?: string,
    expiresAt?: Date,
    metadata?: any
  ): Promise<any> {
    const t = await this.sequelize.transaction();
    try {
      const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
      const HoldModel = DatabaseService.getModel('Hold');

      // Check if account has sufficient available balance (with row lock)
      const account = await FinancialAccountModel.findOne({
        where: { id: accountId, tenantId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const accountData = account.toJSON();
      if (new Decimal(accountData.availableBalance).lessThan(amount)) {
        throw new Error('Insufficient available balance');
      }

      // Create hold
      const hold = await HoldModel.create({
        tenantId,
        accountId,
        amount,
        currency,
        description,
        status: 'active',
        expiresAt,
        metadata: metadata || {}
      }, { transaction: t });

      // Update available balance atomically using database-level operation
      // This prevents race conditions by ensuring the update happens at the database level
      // The WHERE clause includes the balance check to prevent negative balances
      const updateResult = await FinancialAccountModel.update(
        {
          availableBalance: this.sequelize.literal(`available_balance - ${amount}`)
        },
        {
          where: {
            id: accountId,
            tenantId,
            // Ensure balance is sufficient before update (database-level check)
            availableBalance: {
              [Op.gte]: amount
            }
          },
          transaction: t
        }
      );

      // Check if update affected any rows (if 0, balance was insufficient)
      if (updateResult[0] === 0) {
        throw new Error('Insufficient available balance or account not found');
      }

      // Audit log
      await this.createAuditLog(
        tenantId,
        'hold',
        hold.get('id') as string,
        'create',
        { accountId, amount, currency },
        undefined,
        t
      );

      // Emit audit event
      try {
        await LoggerService.logAudit(
          'hold_created',
          'hold',
          { tenantId },
          { holdId: hold.get('id'), accountId, amount, currency }
        );
      } catch (e) {
        LoggerService.error('Audit log emit failed (hold_created)', { error: (e as Error).message });
      }

      await t.commit();
      LoggerService.info('Hold created', { holdId: hold.get('id'), accountId, amount });
      return hold.toJSON();
    } catch (error) {
      await t.rollback();
      LoggerService.error('Failed to create hold', { error, accountId });
      throw error;
    }
  }

  /**
   * Release hold
   */
  async releaseHold(holdId: string): Promise<void> {
    const t = await this.sequelize.transaction();
    try {
      const HoldModel = DatabaseService.getModel('Hold');
      const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');

      // Get hold with lock
      const hold = await HoldModel.findOne({
        where: { id: holdId, status: 'active' },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!hold) {
        throw new Error('Hold not found or already released');
      }

      const holdData = hold.toJSON();

      // Update hold status
      await hold.update({
        status: 'released',
        releasedAt: new Date()
      }, { transaction: t });

      // Restore available balance
      await FinancialAccountModel.update(
        {
          availableBalance: this.sequelize.literal(`available_balance + ${holdData.amount}`)
        },
        {
          where: { id: holdData.accountId, tenantId: holdData.tenantId },
          transaction: t
        }
      );

      // Audit log
      await this.createAuditLog(
        holdData.tenantId,
        'hold',
        holdId,
        'release',
        { accountId: holdData.accountId, amount: holdData.amount },
        undefined,
        t
      );

      // Emit audit event
      try {
        await LoggerService.logAudit(
          'hold_released',
          'hold',
          { tenantId: holdData.tenantId },
          { holdId, accountId: holdData.accountId, amount: holdData.amount }
        );
      } catch (e) {
        LoggerService.error('Audit log emit failed (hold_released)', { error: (e as Error).message });
      }

      await t.commit();
      LoggerService.info('Hold released', { holdId, accountId: holdData.accountId });
    } catch (error) {
      await t.rollback();
      LoggerService.error('Failed to release hold', { error, holdId });
      throw error;
    }
  }

  /**
   * Get holds for tenant
   */
  async getHolds(tenantId: string, status?: string): Promise<any[]> {
    const HoldModel = DatabaseService.getModel('Hold');
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const holds = await HoldModel.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    return holds.map(h => h.toJSON());
  }

  /**
   * Create client - only allowed for broker-tenants
   */
  async createClient(
    tenantId: string,
    name: string,
    externalId?: string,
    email?: string,
    phone?: string,
    metadata?: any
  ): Promise<any> {
    // Validate that tenant is a broker
    const TenantModel = DatabaseService.getModel('Tenant');
    const tenant = await TenantModel.findByPk(tenantId);
    if (!tenant) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    
    const tenantData = tenant.toJSON();
    if (tenantData.tenantType !== 'broker') {
      throw createError('Only broker-tenants can have clients', 400, 'NOT_A_BROKER_TENANT');
    }

    const ClientModel = DatabaseService.getModel('Client');
    const client = await ClientModel.create({
      tenantId, // tenantId is the broker ID (for broker-tenants)
      externalId,
      name,
      email,
      phone,
      metadata: metadata || {}
    });
    return client.toJSON();
  }

  /**
   * Get client
   */
  async getClient(clientId: string): Promise<any | null> {
    const ClientModel = DatabaseService.getModel('Client');
    const client = await ClientModel.findByPk(clientId);
    return client ? client.toJSON() : null;
  }

  /**
   * Get clients by tenant - only returns clients for broker-tenants
   */
  async getClientsByTenant(tenantId: string, status?: string): Promise<any[]> {
    // Validate that tenant is a broker
    const TenantModel = DatabaseService.getModel('Tenant');
    const tenant = await TenantModel.findByPk(tenantId);
    if (!tenant) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    
    const tenantData = tenant.toJSON();
    if (tenantData.tenantType !== 'broker') {
      // Return empty array for non-broker tenants
      return [];
    }

    const ClientModel = DatabaseService.getModel('Client');
    const where: any = { tenantId };
    if (status) {
      where.kycStatus = status;
    }

    const clients = await ClientModel.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    return clients.map(c => c.toJSON());
  }

  /**
   * Update client KYC status
   */
  async updateClientKycStatus(clientId: string, kycStatus: string, completedAt?: Date): Promise<void> {
    const ClientModel = DatabaseService.getModel('Client');
    await ClientModel.update(
      {
        kycStatus,
        kycCompletedAt: completedAt,
        updatedAt: new Date()
      },
      { where: { id: clientId } }
    );
  }

  /**
   * Link client to account
   */
  async linkClientToAccount(
    clientId: string,
    accountId: string,
    relationshipType: string = 'owner',
    permissions: any = {}
  ): Promise<any> {
    const ClientAccountModel = DatabaseService.getModel('ClientAccount');
    const link = await ClientAccountModel.create({
      clientId,
      accountId,
      relationshipType,
      canDebit: permissions.canDebit ?? true,
      canCredit: permissions.canCredit ?? true,
      dailyLimit: permissions.dailyLimit,
      monthlyLimit: permissions.monthlyLimit
    });
    return link.toJSON();
  }

  /**
   * Get client accounts
   */
  async getClientAccounts(clientId: string): Promise<any[]> {
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    const ClientAccountModel = DatabaseService.getModel('ClientAccount');

    const accounts = await FinancialAccountModel.findAll({
      include: [{
        model: ClientAccountModel,
        as: 'clientRelationships',
        where: { clientId },
        required: true
      }],
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    return accounts.map(a => a.toJSON());
  }

  /**
   * Create fund segregation rule
   */
  async createSegregationRule(
    tenantId: string,
    ruleName: string,
    segregationType: string,
    options: any = {}
  ): Promise<any> {
    const FundSegregationRuleModel = DatabaseService.getModel('FundSegregationRule');
    const rule = await FundSegregationRuleModel.create({
      tenantId,
      ruleName,
      segregationType,
      sourceAccountPattern: options.sourceAccountPattern,
      targetAccountPattern: options.targetAccountPattern,
      allowInterClientTransfers: options.allowInterClientTransfers ?? false,
      requireDualAuthorization: options.requireDualAuthorization ?? false,
      maxTransactionAmount: options.maxTransactionAmount,
      conditions: options.conditions || {}
    });
    return rule.toJSON();
  }

  /**
   * Validate fund segregation rules
   */
  async validateFundSegregation(
    tenantId: string,
    sourceAccountId: string,
    targetAccountId: string,
    amount: number,
    transaction?: Transaction
  ): Promise<FundSegregationCheck> {
    // Get account details
    const FinancialAccountModel = DatabaseService.getModel('FinancialAccount');
    const sourceAccount = await FinancialAccountModel.findByPk(sourceAccountId, { transaction });
    const targetAccount = await FinancialAccountModel.findByPk(targetAccountId, { transaction });

    if (!sourceAccount || !targetAccount) {
      return { allowed: false, reason: 'Account not found' };
    }

    const sourceData = sourceAccount.toJSON();
    const targetData = targetAccount.toJSON();

    // Check if accounts belong to same tenant
    if (sourceData.tenantId !== targetData.tenantId) {
      return { allowed: false, reason: 'Cross-tenant transfers not allowed' };
    }

    // Check segregation rules
    const FundSegregationRuleModel = DatabaseService.getModel('FundSegregationRule');
    const rules = await FundSegregationRuleModel.findAll({
      where: { tenantId, isActive: true },
      transaction
    });

    for (const rule of rules) {
      const ruleData = rule.toJSON();
      const sourceMatches = !ruleData.sourceAccountPattern ||
        new RegExp(ruleData.sourceAccountPattern).test(sourceAccountId);
      const targetMatches = !ruleData.targetAccountPattern ||
        new RegExp(ruleData.targetAccountPattern).test(targetAccountId);

      if (sourceMatches && targetMatches) {
        // Check amount limits
        if (ruleData.maxTransactionAmount && amount > ruleData.maxTransactionAmount) {
          return { allowed: false, reason: `Amount exceeds limit (${ruleData.maxTransactionAmount})` };
        }

        // Check client segregation
        if (sourceData.clientId !== targetData.clientId && !ruleData.allowInterClientTransfers) {
          return { allowed: false, reason: 'Inter-client transfers not allowed by segregation rule' };
        }

        return {
          allowed: true,
          requiresDualAuth: ruleData.requireDualAuthorization
        };
      }
    }

    // Default: allow same-client transfers, deny different clients
    if (sourceData.clientId !== targetData.clientId) {
      return { allowed: false, reason: 'Inter-client transfers require explicit segregation rule' };
    }

    return { allowed: true };
  }

  /**
   * Create audit log
   */
  private async createAuditLog(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    changes: any,
    context?: AuditContext,
    transaction?: Transaction
  ): Promise<void> {
    const FinancialAuditLogModel = DatabaseService.getModel('FinancialAuditLog');
    await FinancialAuditLogModel.create({
      tenantId,
      clientId: context?.clientId,
      userId: context?.userId,
      entityType,
      entityId,
      action,
      changes,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId
    }, { transaction });
  }
}

