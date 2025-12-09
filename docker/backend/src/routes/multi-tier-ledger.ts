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

import { Router, Request, Response } from 'express';
import { MultiTierLedgerService, AccountType, AccountStatus } from '../services/multi-tier-ledger';
import { LoggerService } from '../services/logger';
import { AppError, createError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

// =============================================================================
// ACCOUNT MANAGEMENT ROUTES
// =============================================================================

/**
 * Create Platform Master Account
 * POST /api/ledger/platform-accounts
 */
router.post('/platform-accounts',
  authenticateToken,
  requireRole(['platform-admin']),
  validateRequest(Joi.object({
    tenantId: Joi.string().required(),
    name: Joi.string().min(3).max(100).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    bankAccount: Joi.object({
      bankName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      routingNumber: Joi.string().optional(),
      swiftCode: Joi.string().optional(),
      iban: Joi.string().optional(),
      accountType: Joi.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
      currency: Joi.string().required(),
      country: Joi.string().required()
    }).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, name, currency, bankAccount } = req.body;

      LoggerService.info('Creating platform master account', {
        tenantId,
        name,
        currency
      });

      const account = await MultiTierLedgerService.createPlatformMasterAccount(
        tenantId,
        name,
        currency,
        bankAccount
      );

      res.status(201).json({
        success: true,
        data: account,
        message: 'Platform master account created successfully'
      });

    } catch (error) {
      LoggerService.error('Create platform master account failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Create Broker Master Account
 * POST /api/ledger/broker-accounts
 */
router.post('/broker-accounts',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  validateRequest(Joi.object({
    tenantId: Joi.string().required(),
    brokerId: Joi.string().required(),
    name: Joi.string().min(3).max(100).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    parentAccountId: Joi.string().required(),
    bankAccount: Joi.object({
      bankName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      routingNumber: Joi.string().optional(),
      swiftCode: Joi.string().optional(),
      iban: Joi.string().optional(),
      accountType: Joi.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
      currency: Joi.string().required(),
      country: Joi.string().required()
    }).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, brokerId, name, currency, parentAccountId, bankAccount } = req.body;

      LoggerService.info('Creating broker master account', {
        tenantId,
        brokerId,
        name,
        currency,
        parentAccountId
      });

      const account = await MultiTierLedgerService.createBrokerMasterAccount(
        tenantId,
        brokerId,
        name,
        currency,
        parentAccountId,
        bankAccount
      );

      res.status(201).json({
        success: true,
        data: account,
        message: 'Broker master account created successfully'
      });

    } catch (error) {
      LoggerService.error('Create broker master account failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Create End User Account
 * POST /api/ledger/user-accounts
 */
router.post('/user-accounts',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  validateRequest(Joi.object({
    tenantId: Joi.string().required(),
    userId: Joi.string().required(),
    name: Joi.string().min(3).max(100).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').default('USD'),
    parentAccountId: Joi.string().required(),
    bankAccount: Joi.object({
      bankName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      routingNumber: Joi.string().optional(),
      swiftCode: Joi.string().optional(),
      iban: Joi.string().optional(),
      accountType: Joi.string().valid('checking', 'savings', 'business', 'escrow', 'custody').required(),
      currency: Joi.string().required(),
      country: Joi.string().required()
    }).optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, userId, name, currency, parentAccountId, bankAccount } = req.body;

      LoggerService.info('Creating end user account', {
        tenantId,
        userId,
        name,
        currency,
        parentAccountId
      });

      const account = await MultiTierLedgerService.createEndUserAccount(
        tenantId,
        userId,
        name,
        currency,
        parentAccountId,
        bankAccount
      );

      res.status(201).json({
        success: true,
        data: account,
        message: 'End user account created successfully'
      });

    } catch (error) {
      LoggerService.error('Create end user account failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// FUND TRANSFER ROUTES
// =============================================================================

/**
 * Transfer Funds
 * POST /api/ledger/transfers
 */
router.post('/transfers',
  authenticateToken,
  validateRequest(Joi.object({
    fromAccountId: Joi.string().required(),
    toAccountId: Joi.string().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'THAL').required(),
    description: Joi.string().min(10).max(500).required(),
    reference: Joi.string().optional(),
    metadata: Joi.object().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromAccountId, toAccountId, amount, currency, description, reference, metadata } = req.body;

      LoggerService.info('Processing fund transfer', {
        fromAccountId,
        toAccountId,
        amount,
        currency,
        description
      });

      const transaction = await MultiTierLedgerService.transferFunds(
        fromAccountId,
        toAccountId,
        amount,
        currency,
        description,
        reference,
        metadata
      );

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Fund transfer processed successfully'
      });

    } catch (error) {
      LoggerService.error('Transfer funds failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Transfer History
 * GET /api/ledger/transfers
 */
router.get('/transfers',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountId, status, limit = 50, offset = 0 } = req.query;

      const { tenantId, userId, brokerId } = req.user as any;
      if (!tenantId) {
        throw createError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      LoggerService.info('Fetching transfer history', {
        accountId,
        status,
        limit,
        offset,
        tenantId,
        userId,
        brokerId
      });

      // Get transactions with client-level isolation
      const transactions = Array.from(MultiTierLedgerService['transactions'].values())
        .filter(t => {
          // Filter by tenant (client-level isolation)
          const fromAccount = MultiTierLedgerService['accounts'].get(t.fromAccountId);
          const toAccount = MultiTierLedgerService['accounts'].get(t.toAccountId);
          
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
        .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string))
        .map(t => {
          const fromAccount = MultiTierLedgerService['accounts'].get(t.fromAccountId);
          const toAccount = MultiTierLedgerService['accounts'].get(t.toAccountId);
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

      const total = Array.from(MultiTierLedgerService['transactions'].values())
        .filter(t => {
          const fromAccount = MultiTierLedgerService['accounts'].get(t.fromAccountId);
          const toAccount = MultiTierLedgerService['accounts'].get(t.toAccountId);
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
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total,
          hasNext: parseInt(offset as string) + parseInt(limit as string) < total,
          hasPrev: parseInt(offset as string) > 0
        }
      });

    } catch (error) {
      LoggerService.error('Get transfer history failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Transfer Details
 * GET /api/ledger/transfers/:transferId
 */
router.get('/transfers/:transferId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { transferId } = req.params;

      const { tenantId, userId, brokerId } = req.user as any;
      if (!tenantId) {
        throw createError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      LoggerService.info('Fetching transfer details', {
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
      const transaction = MultiTierLedgerService['transactions'].get(transferId);
      
      if (!transaction) {
        res.status(404).json({
          success: false,
          error: 'Transfer not found',
          code: 'TRANSFER_NOT_FOUND'
        });
        return;
      }

      // Verify client-level access (tenant isolation)
      const fromAccount = MultiTierLedgerService['accounts'].get(transaction.fromAccountId);
      const toAccount = MultiTierLedgerService['accounts'].get(transaction.toAccountId);
      
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

    } catch (error) {
      LoggerService.error('Get transfer details failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// STATISTICS AND REPORTING ROUTES
// =============================================================================

/**
 * Get Ledger Statistics
 * GET /api/ledger/stats
 */
router.get('/stats',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Fetching ledger statistics');

      const stats = await MultiTierLedgerService.getLedgerStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      LoggerService.error('Get ledger stats failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Account Hierarchy
 * GET /api/ledger/hierarchy
 */
router.get('/hierarchy',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId: queryTenantId } = req.query;
      const { tenantId: userTenantId, userId, brokerId } = req.user as any;
      
      // Use query tenantId if provided and user has platform-admin role, otherwise use user's tenantId
      const tenantId = (req.user as any)?.roles?.includes('platform-admin') && queryTenantId 
        ? queryTenantId as string 
        : userTenantId;

      if (!tenantId) {
        throw createError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      LoggerService.info('Fetching account hierarchy', {
        tenantId,
        userId,
        brokerId
      });

      // Get all accounts for this tenant with client-level isolation
      const accounts = Array.from(MultiTierLedgerService['accounts'].values())
        .filter(a => a.tenantId === tenantId);

      // Build hierarchy with client-level separation
      const platformAccounts = accounts.filter(a => a.accountType === AccountType.PLATFORM_MASTER);
      const brokerAccounts = accounts.filter(a => a.accountType === AccountType.BROKER_MASTER);
      const userAccounts = accounts.filter(a => a.accountType === AccountType.END_USER);

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
          activeAccounts: accounts.filter(a => a.status === AccountStatus.ACTIVE).length,
          suspendedAccounts: accounts.filter(a => a.status === AccountStatus.SUSPENDED).length
        }
      };

      res.json({
        success: true,
        data: hierarchy
      });

    } catch (error) {
      LoggerService.error('Get account hierarchy failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Multi-Tier Ledger Service Health Check
 * GET /api/ledger/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = MultiTierLedgerService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'Multi-Tier Ledger Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Multi-tier ledger health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'Multi-Tier Ledger Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
