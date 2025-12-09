/**
 * Wallet System API Routes
 * 
 * Provides comprehensive wallet management endpoints including:
 * - Wallet infrastructure creation and management
 * - Unique reference generation and validation
 * - FIAT deposit processing
 * - Crypto wallet operations
 * - CEX integration
 * - THAL token rewards
 * - Pool account management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { WalletSystemService, Wallet, UniqueReference, PoolAccount, CEXOrder, THALReward } from '../services/wallet-system';
import { NedbankService } from '../services/nedbank';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';

const router: Router = Router();
let walletSystemService: WalletSystemService;

// Initialize service
export const initializeWalletSystem = async () => {
  try {
    walletSystemService = new WalletSystemService(DatabaseService.getSequelize());
    await walletSystemService.initialize();
    await NedbankService.initialize();
    LoggerService.info('Wallet System routes initialized');
  } catch (error) {
    LoggerService.error('Failed to initialize Wallet System', { error });
    throw error;
  }
};

// ==================== WALLET MANAGEMENT ====================

// Create wallet infrastructure for new user
router.post('/infrastructure', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, tenantId, brokerId, userInfo } = req.body;
    
    if (!userId || !tenantId || !brokerId || !userInfo) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, tenantId, brokerId, userInfo'
      });
      return;
    }
    
    const wallets = await walletSystemService.createUserWalletInfrastructure(
      userId,
      tenantId,
      brokerId,
      userInfo
    );
    
    res.json({
      success: true,
      data: {
        userId,
        tenantId,
        brokerId,
        wallets: wallets.map(w => ({
          id: w.id,
          walletType: w.walletType,
          currency: w.currency,
          address: w.address,
          status: w.status,
          balance: w.balance
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to create wallet infrastructure', { error, body: req.body });
    next(error);
  }
});

// Get user's wallets
router.get('/user/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const wallets = walletSystemService.getUserWallets(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        wallets: wallets.map(w => ({
          id: w.id,
          walletType: w.walletType,
          currency: w.currency,
          address: w.address,
          status: w.status,
          balance: w.balance,
          metadata: {
            mfaEnabled: w.metadata.mfaEnabled,
            createdAt: w.metadata.createdAt,
            updatedAt: w.metadata.updatedAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get specific wallet
router.get('/wallet/:walletId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletId } = req.params;
    
    if (!walletId) {
      res.status(400).json({
        success: false,
        error: 'Wallet ID is required'
      });
      return;
    }

    const wallet = walletSystemService.getWallet(walletId);
    
    if (!wallet) {
      res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          tenantId: wallet.tenantId,
          brokerId: wallet.brokerId,
          walletType: wallet.walletType,
          currency: wallet.currency,
          address: wallet.address,
          status: wallet.status,
          balance: wallet.balance,
          metadata: {
            mfaEnabled: wallet.metadata.mfaEnabled,
            createdAt: wallet.metadata.createdAt,
            updatedAt: wallet.metadata.updatedAt
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== UNIQUE REFERENCE SYSTEM ====================

// Generate unique reference for FIAT deposit
router.post('/reference/generate', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, tenantId, brokerId, referenceType, currency, expectedAmount } = req.body;
    
    if (!userId || !tenantId || !brokerId || !referenceType || !currency) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, tenantId, brokerId, referenceType, currency'
      });
      return;
    }
    
    const reference = await walletSystemService.generateUniqueReference(
      userId,
      tenantId,
      brokerId,
      referenceType,
      currency,
      expectedAmount
    );
    
    res.json({
      success: true,
      data: {
        reference: reference.reference,
        referenceType: reference.referenceType,
        brokerCode: reference.brokerCode,
        userInitials: reference.userInitials,
        currency: reference.currency,
        expectedAmount: reference.expectedAmount,
        expiresAt: reference.expiresAt,
        status: reference.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to generate unique reference', { error, body: req.body });
    next(error);
  }
});

// Get persistent FIAT deposit reference (alphanumeric)
router.get('/reference/persistent/:currency', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId || 'default-tenant';
    const brokerId = (req as any).brokerId || 'default-broker';
    const { currency } = req.params;

    if (!userId || !currency) {
      res.status(400).json({ success: false, error: 'Missing required fields: userId, currency' });
      return;
    }

    const ref = await walletSystemService.getOrCreatePersistentReference(userId, tenantId, brokerId, currency);

    res.json({
      success: true,
      data: {
        reference: ref.reference,
        currency: ref.currency,
        isPersistent: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Validate unique reference
router.get('/reference/:reference', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      res.status(400).json({
        success: false,
        error: 'Reference is required'
      });
      return;
    }
    
    const ref = walletSystemService.getReference(reference);
    
    if (!ref) {
      res.status(404).json({
        success: false,
        error: 'Reference not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        reference: ref.reference,
        referenceType: ref.referenceType,
        brokerCode: ref.brokerCode,
        userInitials: ref.userInitials,
        currency: ref.currency,
        expectedAmount: ref.expectedAmount,
        status: ref.status,
        expiresAt: ref.expiresAt,
        createdAt: ref.createdAt
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== CONVERSIONS (FIAT ↔ USDT) ====================

// Get conversion quote
router.get('/convert/quote', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId || 'default-tenant';
    const brokerId = (req as any).brokerId || 'default-broker';
    const { from, to, amount } = req.query as any;

    if (!userId || !from || !to || !amount) {
      res.status(400).json({ success: false, error: 'Missing required query: from, to, amount' });
      return;
    }

    const quote = await walletSystemService.getConversionQuote({
      userId,
      tenantId,
      brokerId,
      fromCurrency: String(from),
      toCurrency: String(to),
      amount: String(amount)
    });

    res.json({ success: true, data: quote, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Confirm conversion
router.post('/convert/confirm', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId || 'default-tenant';
    const brokerId = (req as any).brokerId || 'default-broker';
    const { fromCurrency, toCurrency, amount, quoteId, acceptFees } = req.body;

    if (!userId || !fromCurrency || !toCurrency || !amount || !quoteId || acceptFees !== true) {
      res.status(400).json({ success: false, error: 'Missing required fields or fees not accepted' });
      return;
    }

    const result = await walletSystemService.confirmConversion({
      userId,
      tenantId,
      brokerId,
      fromCurrency,
      toCurrency,
      amount,
      quoteId,
      acceptFees
    });

    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Process FIAT deposit
router.post('/deposit/fiat', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reference, actualAmount, bankTransaction } = req.body;
    
    if (!reference || !actualAmount) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: reference, actualAmount'
      });
      return;
    }
    
    const result = await walletSystemService.processFiatDeposit(
      reference,
      actualAmount,
      bankTransaction
    );
    
    res.json({
      success: result.success,
      data: {
        reference,
        actualAmount,
        walletId: result.walletId
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to process FIAT deposit', { error, body: req.body });
    next(error);
  }
});

// ==================== POOL ACCOUNT MANAGEMENT ====================

// Create pool account
router.post('/pool-accounts', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId, accountType, bankDetails } = req.body;
    
    if (!brokerId || !accountType || !bankDetails) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: brokerId, accountType, bankDetails'
      });
      return;
    }
    
    const poolAccount = await walletSystemService.createPoolAccount(
      brokerId,
      accountType,
      bankDetails
    );
    
    res.json({
      success: true,
      data: {
        poolAccount: {
          id: poolAccount.id,
          brokerId: poolAccount.brokerId,
          accountType: poolAccount.accountType,
          bankAccountNumber: poolAccount.bankAccountNumber,
          bankReference: poolAccount.bankReference,
          currency: poolAccount.currency,
          balance: poolAccount.balance,
          availableBalance: poolAccount.availableBalance,
          metadata: {
            bankName: poolAccount.metadata.bankName,
            accountHolder: poolAccount.metadata.accountHolder,
            createdAt: poolAccount.metadata.createdAt
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to create pool account', { error, body: req.body });
    next(error);
  }
});

// ==================== BANK WITHDRAWALS (Nedbank) ====================

router.post('/withdrawals/bank', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { brokerId, poolAccountNumber, beneficiary, amount, currency, reference } = req.body;

    if (!userId || !beneficiary || !amount || !currency || !reference) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const payout = await NedbankService.initiatePayout({
      brokerId,
      poolAccountNumber,
      beneficiary,
      amount,
      currency,
      reference,
      metadata: { userId }
    });

    res.json({ success: payout.success, data: payout, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ==================== DEPOSIT SCRAPING (Nedbank) ====================

router.get('/deposits/scrape', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId, poolAccountNumber, fromDate, toDate } = req.query as any;
    const records = await NedbankService.scrapeDeposits({
      brokerId: brokerId ? String(brokerId) : undefined,
      poolAccountNumber: poolAccountNumber ? String(poolAccountNumber) : undefined,
      fromDate: fromDate ? String(fromDate) : undefined,
      toDate: toDate ? String(toDate) : undefined
    });

    res.json({ success: true, data: { records }, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// ==================== FIAT ADMIN (UNALLOCATED & MULTI-SIG) ====================

// Record an unallocated deposit (manual entry)
router.post('/fiat-admin/unallocated', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    walletSystemService.recordUnallocatedDeposit(req.body);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// List unallocated deposits
router.get('/fiat-admin/unallocated', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId, currency, status } = req.query as any;
    const items = walletSystemService.listUnallocatedDeposits({ brokerId: brokerId ? String(brokerId) : undefined, currency: currency ? String(currency) : undefined, status: status ? String(status) : undefined });
    res.json({ success: true, data: items, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Create allocation proposal (multi-sig)
router.post('/fiat-admin/allocation/propose', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { depositId, proposedBy, target, amount, approvalsRequired, approvers } = req.body;
    const prop = walletSystemService.createAllocationProposal({ depositId, proposedBy, target, amount, approvalsRequired, approvers });
    res.json({ success: true, data: prop, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Approve allocation proposal
router.post('/fiat-admin/allocation/approve', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { proposalId, approverId } = req.body;
    const prop = walletSystemService.approveAllocationProposal(proposalId, approverId);
    res.json({ success: true, data: prop, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Reject allocation proposal
router.post('/fiat-admin/allocation/reject', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { proposalId, approverId, reason } = req.body;
    const prop = walletSystemService.rejectAllocationProposal(proposalId, approverId, reason);
    res.json({ success: true, data: prop, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Execute allocation (after approvals threshold met)
router.post('/fiat-admin/allocation/execute', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { proposalId } = req.body;
    const result = await walletSystemService.executeAllocation(proposalId);
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Scrape and auto-apply deposits to FIAT wallets via persistent references
router.post('/deposits/apply', authenticateToken, requireRole(['admin', 'super_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId, poolAccountNumber, fromDate, toDate, dryRun = true } = req.body || {};

    const records = await NedbankService.scrapeDeposits({
      brokerId,
      poolAccountNumber,
      fromDate,
      toDate
    });

    const results: Array<{
      recordId: string;
      matched: boolean;
      userId?: string;
      brokerId?: string;
      tenantId?: string;
      credited?: boolean;
      message?: string;
    }> = [];

    for (const rec of records) {
      const match = walletSystemService.autoMatchDepositToReference({ reference: rec.reference, amount: rec.amount, currency: rec.currency });
      if (!match.matched) {
        results.push({ recordId: rec.id, matched: false, message: 'No matching reference' });
        continue;
      }

      if (dryRun) {
        results.push({ recordId: rec.id, matched: true, userId: match.userId, brokerId: match.brokerId, tenantId: match.tenantId, credited: false, message: 'Dry run' });
        continue;
      }

      try {
        const processed = await walletSystemService.processFiatDeposit(rec.reference, rec.amount, rec);
        results.push({ recordId: rec.id, matched: true, userId: match.userId, brokerId: match.brokerId, tenantId: match.tenantId, credited: processed.success });
      } catch (e: any) {
        results.push({ recordId: rec.id, matched: true, userId: match.userId, brokerId: match.brokerId, tenantId: match.tenantId, credited: false, message: e?.message || 'Error crediting' });
      }
    }

    res.json({ success: true, data: { count: records.length, results }, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// Get broker pool accounts
router.get('/pool-accounts/:brokerId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brokerId } = req.params;
    
    if (!brokerId) {
      res.status(400).json({
        success: false,
        error: 'Broker ID is required'
      });
      return;
    }
    
    const poolAccounts = walletSystemService.getBrokerPoolAccounts(brokerId);
    
    res.json({
      success: true,
      data: {
        brokerId,
        poolAccounts: poolAccounts.map(p => ({
          id: p.id,
          accountType: p.accountType,
          bankAccountNumber: p.bankAccountNumber,
          bankReference: p.bankReference,
          currency: p.currency,
          balance: p.balance,
          availableBalance: p.availableBalance,
          metadata: {
            bankName: p.metadata.bankName,
            accountHolder: p.metadata.accountHolder,
            createdAt: p.metadata.createdAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== CEX INTEGRATION ====================

// Place CEX order
router.post('/cex/orders', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, tenantId, brokerId, tradingPair, side, type, quantity, price, stopPrice } = req.body;
    
    if (!userId || !tenantId || !brokerId || !tradingPair || !side || !type || !quantity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, tenantId, brokerId, tradingPair, side, type, quantity'
      });
      return;
    }
    
    const order = await walletSystemService.placeCEXOrder(
      userId,
      tenantId,
      brokerId,
      {
        tradingPair,
        side,
        type,
        quantity,
        price,
        stopPrice
      }
    );
    
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          userId: order.userId,
          brokerId: order.brokerId,
          tradingPair: order.tradingPair,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          price: order.price,
          status: order.status,
          filledQuantity: order.filledQuantity,
          averagePrice: order.averagePrice,
          fees: order.fees,
          thalRewards: order.thalRewards,
          engine: order.engine,
          metadata: {
            createdAt: order.metadata.createdAt,
            updatedAt: order.metadata.updatedAt
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to place CEX order', { error, body: req.body });
    next(error);
  }
});

// Get user's CEX orders
router.get('/cex/orders/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const orders = walletSystemService.getUserCEXOrders(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        orders: orders.map(o => ({
          id: o.id,
          tradingPair: o.tradingPair,
          side: o.side,
          type: o.type,
          quantity: o.quantity,
          price: o.price,
          status: o.status,
          filledQuantity: o.filledQuantity,
          averagePrice: o.averagePrice,
          fees: o.fees,
          thalRewards: o.thalRewards,
          engine: o.engine,
          metadata: {
            createdAt: o.metadata.createdAt,
            updatedAt: o.metadata.updatedAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== THAL TOKEN REWARDS ====================

// Get user's THAL rewards
router.get('/thal/rewards/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const rewards = walletSystemService.getUserTHALRewards(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        rewards: rewards.map(r => ({
          id: r.id,
          rewardType: r.rewardType,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          expiresAt: r.expiresAt,
          metadata: {
            sourceOrderId: r.metadata.sourceOrderId,
            multiplier: r.metadata.multiplier,
            createdAt: r.metadata.createdAt
          }
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== WALLET RECOVERY ====================

// Recover hot wallet
router.post('/recovery/hot-wallet', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, mfaCode, recoveryMethod } = req.body;
    
    if (!userId || !mfaCode || !recoveryMethod) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, mfaCode, recoveryMethod'
      });
      return;
    }
    
    const result = await walletSystemService.recoverHotWallet(
      userId,
      mfaCode,
      recoveryMethod
    );
    
    res.json({
      success: result.success,
      data: {
        userId,
        walletId: result.wallet?.id,
        walletType: result.wallet?.walletType,
        address: result.wallet?.address,
        recoveryData: result.recoveryData
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Failed to recover hot wallet', { error, body: req.body });
    next(error);
  }
});

// ==================== DASHBOARD & ANALYTICS ====================

// Get wallet dashboard
router.get('/dashboard/:userId', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const wallets = walletSystemService.getUserWallets(userId);
    const cexOrders = walletSystemService.getUserCEXOrders(userId);
    const thalRewards = walletSystemService.getUserTHALRewards(userId);
    
    const dashboard = {
      userId,
      wallets: {
        total: wallets.length,
        byType: wallets.reduce((acc, w) => {
          acc[w.walletType] = (acc[w.walletType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalBalance: wallets.reduce((sum, w) => sum + parseFloat(w.balance), 0).toString()
      },
      cexOrders: {
        total: cexOrders.length,
        open: cexOrders.filter(o => o.status === 'open').length,
        filled: cexOrders.filter(o => o.status === 'filled').length,
        totalVolume: cexOrders.reduce((sum, o) => sum + parseFloat(o.quantity), 0).toString()
      },
      thalRewards: {
        total: thalRewards.length,
        totalAmount: thalRewards.reduce((sum, r) => sum + parseFloat(r.amount), 0).toString(),
        pending: thalRewards.filter(r => r.status === 'pending').length,
        credited: thalRewards.filter(r => r.status === 'credited').length
      }
    };
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== STATEMENTS & TAX REPORTS ====================

// Generate wallet statement CSV for a date range
router.get('/statements', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletId, from, to } = req.query as any;
    if (!walletId) {
      res.status(400).json({ success: false, error: 'walletId is required' });
      return;
    }

    const csv = await walletSystemService.generateWalletStatementCSV({ walletId: String(walletId), from: from ? String(from) : undefined, to: to ? String(to) : undefined });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=statement_${walletId}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

// Generate tax report CSV for a date range and method
router.get('/tax-report', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { from, to, method = 'fifo', baseCurrency = 'ZAR' } = req.query as any;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const csv = await walletSystemService.generateTaxReportCSV({ userId, from: from ? String(from) : undefined, to: to ? String(to) : undefined, method: method as 'fifo' | 'lifo', baseCurrency: String(baseCurrency) });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tax_${userId}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
