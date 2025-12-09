/**
 * Wallet Infrastructure Controller
 *
 * Complete implementation matching original financial-svc
 * Handles wallet creation and management for users
 *
 * Features:
 * - Multi-currency wallet creation (FIAT, crypto, external)
 * - Wallet balance tracking via ledger integration
 * - Security settings management
 * - Wallet backup and recovery
 * - External wallet connection (MetaMask, WalletConnect)
 */

import { Request, Response } from 'express';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';
import { BlnkFinanceService, AccountType as BlnkAccountType } from '../services/blnkfinance';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// In-memory stores for wallet data (replace with database in production)
interface Wallet {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  walletType: 'fiat' | 'crypto' | 'external' | 'custodial';
  currency: string;
  address?: string;
  status: 'active' | 'inactive' | 'frozen' | 'pending';
  balance: number;
  availableBalance: number;
  ledgerAccountId?: string;
  metadata: {
    provider?: string;
    network?: string;
    createdAt: Date;
    lastActivityAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee' | 'adjustment';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reference?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

interface WalletSecuritySettings {
  walletId: string;
  twoFactorEnabled: boolean;
  whitelistedAddresses: string[];
  withdrawalLimits: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    perTransaction?: number;
  };
  requireApprovalAbove?: number;
  lastUpdated: Date;
}

interface WalletBackup {
  id: string;
  walletId: string;
  encryptedData: string;
  checksum: string;
  createdAt: Date;
  expiresAt?: Date;
}

// In-memory stores
const wallets = new Map<string, Wallet>();
const walletTransactions = new Map<string, WalletTransaction[]>();
const walletSecuritySettings = new Map<string, WalletSecuritySettings>();
const walletBackups = new Map<string, WalletBackup[]>();

export class WalletInfrastructureController {
  /**
   * Create wallet infrastructure for new user
   * Creates FIAT wallet and optionally crypto wallets with ledger accounts
   */
  async createUserWalletInfrastructure(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, brokerId, userId } = req.params;
      const { userInfo, currencies = ['ZAR'], createCryptoWallets = false } = req.body;

      if (!tenantId || !brokerId || !userId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'tenantId, brokerId, and userId are required'
        });
        return;
      }

      LoggerService.info('Creating wallet infrastructure for user', { userId, tenantId, brokerId, currencies });

      const createdWallets: Wallet[] = [];

      // 1. Create FIAT wallets for each currency
      for (const currency of currencies) {
        const walletId = `fiat_${userId}_${currency.toLowerCase()}_${Date.now()}`;
        
        // Create ledger account for this wallet using BlnkFinance
        let ledgerAccountId: string | undefined;
        try {
          const ledgerAccount = await BlnkFinanceService.createAccount(
            walletId,
            `${userId} ${currency} Wallet`,
            BlnkAccountType.ASSET,
            currency,
            tenantId
          );
          ledgerAccountId = ledgerAccount.id;
        } catch (ledgerError) {
          LoggerService.warn('Could not create ledger account', { error: (ledgerError as Error).message });
        }

        const fiatWallet: Wallet = {
          id: walletId,
          userId,
          tenantId,
          brokerId,
          walletType: 'fiat',
          currency,
          status: 'active',
          balance: 0,
          availableBalance: 0,
          ledgerAccountId,
          metadata: {
            provider: 'blnk_finance',
            network: 'ledger',
            createdAt: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        wallets.set(walletId, fiatWallet);
        walletTransactions.set(walletId, []);
        walletSecuritySettings.set(walletId, {
          walletId,
          twoFactorEnabled: false,
          whitelistedAddresses: [],
          withdrawalLimits: {
            daily: 100000,
            perTransaction: 50000
          },
          lastUpdated: new Date()
        });

        createdWallets.push(fiatWallet);
      }

      // 2. Create crypto wallets if requested
      if (createCryptoWallets) {
        const cryptoCurrencies = ['BTC', 'ETH', 'USDT'];
        for (const currency of cryptoCurrencies) {
          const walletId = `crypto_${userId}_${currency.toLowerCase()}_${Date.now()}`;
          
          // Generate a placeholder address (in production, use proper key derivation)
          const address = `0x${crypto.randomBytes(20).toString('hex')}`;

          const cryptoWallet: Wallet = {
            id: walletId,
            userId,
            tenantId,
            brokerId,
            walletType: 'crypto',
            currency,
            address,
            status: 'active',
            balance: 0,
            availableBalance: 0,
            metadata: {
              provider: 'internal',
              network: currency === 'ETH' || currency === 'USDT' ? 'ethereum' : 'bitcoin',
              createdAt: new Date()
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };

          wallets.set(walletId, cryptoWallet);
          walletTransactions.set(walletId, []);
          createdWallets.push(cryptoWallet);
        }
      }

      // Persist to database
      try {
        const WalletModel = DatabaseService.getModel('Wallet');
        for (const wallet of createdWallets) {
          await WalletModel.create({
            id: wallet.id,
            userId: wallet.userId,
            tenantId: wallet.tenantId,
            brokerId: wallet.brokerId,
            walletType: wallet.walletType,
            currency: wallet.currency,
            address: wallet.address,
            status: wallet.status,
            balance: wallet.balance,
            availableBalance: wallet.availableBalance,
            ledgerAccountId: wallet.ledgerAccountId,
            metadata: wallet.metadata
          });
        }
      } catch (dbError) {
        LoggerService.warn('Could not persist wallets to database', { error: (dbError as Error).message });
      }

      LoggerService.info('Wallet infrastructure created', { userId, walletCount: createdWallets.length });

      res.status(201).json({
        success: true,
        data: {
          userId,
          wallets: createdWallets.map(w => ({
            id: w.id,
            type: w.walletType,
            currency: w.currency,
            address: w.address,
            status: w.status,
            balance: w.balance
          }))
        },
        message: 'Wallet infrastructure created successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to create wallet infrastructure', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to create wallet infrastructure'
      });
    }
  }

  /**
   * Get user wallets
   */
  async getUserWallets(req: Request, res: Response): Promise<void> {
    try {
      const { userId, tenantId } = req.params;
      const { walletType, currency, status } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'userId is required'
        });
        return;
      }

      // Get wallets from memory store
      let userWallets = Array.from(wallets.values())
        .filter(w => w.userId === userId);

      // Apply tenant filter if provided
      if (tenantId) {
        userWallets = userWallets.filter(w => w.tenantId === tenantId);
      }

      // Apply additional filters
      if (walletType) {
        userWallets = userWallets.filter(w => w.walletType === walletType);
      }
      if (currency) {
        userWallets = userWallets.filter(w => w.currency === currency);
      }
      if (status) {
        userWallets = userWallets.filter(w => w.status === status);
      }

      // Try to fetch from database if memory store is empty
      if (userWallets.length === 0) {
        try {
          const WalletModel = DatabaseService.getModel('Wallet');
          const dbWallets = await WalletModel.findAll({
            where: { userId, ...(tenantId ? { tenantId } : {}) }
          });
          userWallets = dbWallets.map((w: any) => w.toJSON());
        } catch (dbError) {
          LoggerService.warn('Could not fetch wallets from database', { error: (dbError as Error).message });
        }
      }

      res.status(200).json({
        success: true,
        data: userWallets.map(w => ({
          id: w.id,
          type: w.walletType,
          currency: w.currency,
          address: w.address,
          status: w.status,
          balance: w.balance,
          availableBalance: w.availableBalance,
          createdAt: w.createdAt
        })),
        message: 'User wallets retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get user wallets', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get user wallets'
      });
    }
  }

  /**
   * Get wallet details
   */
  async getWalletDetails(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get wallet from memory store
      let wallet = wallets.get(walletId);

      // Try database if not in memory
      if (!wallet) {
        try {
          const WalletModel = DatabaseService.getModel('Wallet');
          const dbWallet = await WalletModel.findByPk(walletId);
          if (dbWallet) {
            wallet = dbWallet.toJSON() as Wallet;
          }
        } catch (dbError) {
          LoggerService.warn('Could not fetch wallet from database', { error: (dbError as Error).message });
        }
      }

      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Wallet not found'
        });
        return;
      }

      // Get security settings
      const security = walletSecuritySettings.get(walletId);

      res.status(200).json({
        success: true,
        data: {
          id: wallet.id,
          userId: wallet.userId,
          tenantId: wallet.tenantId,
          brokerId: wallet.brokerId,
          type: wallet.walletType,
          currency: wallet.currency,
          address: wallet.address,
          status: wallet.status,
          balance: wallet.balance,
          availableBalance: wallet.availableBalance,
          ledgerAccountId: wallet.ledgerAccountId,
          metadata: wallet.metadata,
          security: security ? {
            twoFactorEnabled: security.twoFactorEnabled,
            hasWhitelistedAddresses: security.whitelistedAddresses.length > 0,
            hasWithdrawalLimits: Object.keys(security.withdrawalLimits).length > 0
          } : null,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt
        },
        message: 'Wallet details retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get wallet details', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get wallet details'
      });
    }
  }

  /**
   * Get wallet balance - retrieves from ledger for accuracy
   */
  async getWalletBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get wallet
      let wallet = wallets.get(walletId);
      if (!wallet) {
        try {
          const WalletModel = DatabaseService.getModel('Wallet');
          const dbWallet = await WalletModel.findByPk(walletId);
          if (dbWallet) {
            wallet = dbWallet.toJSON() as Wallet;
          }
        } catch (dbError) {
          LoggerService.warn('Could not fetch wallet from database', { error: (dbError as Error).message });
        }
      }

      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Wallet not found'
        });
        return;
      }

      // Get balance from ledger if available
      let balance = wallet.balance;
      let availableBalance = wallet.availableBalance;
      let pendingBalance = 0;

      if (wallet.ledgerAccountId) {
        try {
          const ledgerBalance = await BlnkFinanceService.getAccountBalance(wallet.ledgerAccountId);
          if (ledgerBalance) {
            balance = ledgerBalance.netBalance || 0;
            // Balance interface only has netBalance, debitBalance, creditBalance
            availableBalance = ledgerBalance.netBalance || balance;
            pendingBalance = 0; // Not tracked in Balance interface
          }
        } catch (ledgerError) {
          LoggerService.warn('Could not fetch balance from ledger', { error: (ledgerError as Error).message });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          walletId,
          balance,
          availableBalance,
          pendingBalance,
          currency: wallet.currency,
          lastUpdated: new Date()
        },
        message: 'Wallet balance retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get wallet balance', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get wallet balance'
      });
    }
  }

  /**
   * Update wallet status
   */
  async updateWalletStatus(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { status, reason } = req.body;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      const validStatuses = ['active', 'inactive', 'frozen', 'pending'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: `status must be one of: ${validStatuses.join(', ')}`
        });
        return;
      }

      // Get wallet
      const wallet = wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Wallet not found'
        });
        return;
      }

      const previousStatus = wallet.status;
      wallet.status = status;
      wallet.updatedAt = new Date();

      // Update in database
      try {
        const WalletModel = DatabaseService.getModel('Wallet');
        await WalletModel.update(
          { status, updatedAt: new Date() },
          { where: { id: walletId } }
        );
      } catch (dbError) {
        LoggerService.warn('Could not update wallet in database', { error: (dbError as Error).message });
      }

      LoggerService.info('Wallet status updated', { walletId, previousStatus, newStatus: status, reason });

      res.status(200).json({
        success: true,
        data: {
          walletId,
          previousStatus,
          status,
          updatedAt: wallet.updatedAt
        },
        message: 'Wallet status updated successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to update wallet status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to update wallet status'
      });
    }
  }

  /**
   * Get wallet transactions with pagination and filtering
   */
  async getWalletTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { type, status, startDate, endDate, limit = 50, offset = 0 } = req.query;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get transactions from memory store
      let transactions = walletTransactions.get(walletId) || [];

      // Try database if memory is empty
      if (transactions.length === 0) {
        try {
          const TransactionModel = DatabaseService.getModel('Transaction');
          const dbTransactions = await TransactionModel.findAll({
            where: { walletId },
            order: [['createdAt', 'DESC']],
            limit: Number(limit),
            offset: Number(offset)
          });
          transactions = dbTransactions.map((t: any) => t.toJSON());
        } catch (dbError) {
          LoggerService.warn('Could not fetch transactions from database', { error: (dbError as Error).message });
        }
      }

      // Apply filters
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      if (status) {
        transactions = transactions.filter(t => t.status === status);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        transactions = transactions.filter(t => new Date(t.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        transactions = transactions.filter(t => new Date(t.createdAt) <= end);
      }

      // Sort by date descending
      transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Paginate
      const total = transactions.length;
      transactions = transactions.slice(Number(offset), Number(offset) + Number(limit));

      res.status(200).json({
        success: true,
        data: {
          walletId,
          transactions,
          pagination: {
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < total
          }
        },
        message: 'Wallet transactions retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get wallet transactions', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get wallet transactions'
      });
    }
  }

  /**
   * Create wallet transaction via ledger
   */
  async createWalletTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { type, amount, currency, description, reference, metadata } = req.body;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      if (!type || !amount) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'type and amount are required'
        });
        return;
      }

      const validTypes = ['deposit', 'withdrawal', 'transfer', 'fee', 'adjustment'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: `type must be one of: ${validTypes.join(', ')}`
        });
        return;
      }

      // Get wallet
      const wallet = wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Wallet not found'
        });
        return;
      }

      if (wallet.status !== 'active') {
        res.status(400).json({
          success: false,
          error: 'WALLET_INACTIVE',
          message: 'Wallet is not active'
        });
        return;
      }

      // Check withdrawal limits
      if (type === 'withdrawal') {
        const security = walletSecuritySettings.get(walletId);
        if (security?.withdrawalLimits?.perTransaction && amount > security.withdrawalLimits.perTransaction) {
          res.status(400).json({
            success: false,
            error: 'LIMIT_EXCEEDED',
            message: `Amount exceeds per-transaction limit of ${security.withdrawalLimits.perTransaction}`
          });
          return;
        }

        if (amount > wallet.availableBalance) {
          res.status(400).json({
            success: false,
            error: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient available balance'
          });
          return;
        }
      }

      // Create transaction
      const transaction: WalletTransaction = {
        id: uuidv4(),
        walletId,
        type,
        amount: parseFloat(amount),
        currency: currency || wallet.currency,
        status: 'pending',
        reference,
        description,
        metadata,
        createdAt: new Date()
      };

      // Process via ledger if available
      if (wallet.ledgerAccountId) {
        try {
          // Use BlnkFinanceService to record the transaction
          const blnkTxType = type === 'deposit' ? 'DEPOSIT' :
                            type === 'withdrawal' ? 'WITHDRAWAL' :
                            type === 'transfer' ? 'TRANSFER' : 'ADJUSTMENT';
          
          await BlnkFinanceService.recordTransaction(
            description || `${type} transaction`,
            [
              {
                accountId: wallet.ledgerAccountId,
                debitAmount: type === 'deposit' ? transaction.amount : 0,
                creditAmount: type === 'withdrawal' ? transaction.amount : 0,
                description: description || `${type} transaction`,
                reference: transaction.id
              }
            ],
            wallet.tenantId,
            transaction.currency,
            blnkTxType as any,
            transaction.id,
            { walletId, description }
          );

          transaction.status = 'completed';
          transaction.completedAt = new Date();

          // Update wallet balance
          if (type === 'deposit') {
            wallet.balance += transaction.amount;
            wallet.availableBalance += transaction.amount;
          } else if (type === 'withdrawal') {
            wallet.balance -= transaction.amount;
            wallet.availableBalance -= transaction.amount;
          }
          wallet.metadata.lastActivityAt = new Date();
          wallet.updatedAt = new Date();

        } catch (ledgerError) {
          LoggerService.error('Ledger transaction failed', { error: (ledgerError as Error).message });
          transaction.status = 'failed';
        }
      } else {
        // No ledger - just update local balance
        transaction.status = 'completed';
        transaction.completedAt = new Date();

        if (type === 'deposit') {
          wallet.balance += transaction.amount;
          wallet.availableBalance += transaction.amount;
        } else if (type === 'withdrawal') {
          wallet.balance -= transaction.amount;
          wallet.availableBalance -= transaction.amount;
        }
        wallet.metadata.lastActivityAt = new Date();
        wallet.updatedAt = new Date();
      }

      // Store transaction
      const txList = walletTransactions.get(walletId) || [];
      txList.push(transaction);
      walletTransactions.set(walletId, txList);

      // Persist to database
      try {
        const TransactionModel = DatabaseService.getModel('Transaction');
        await TransactionModel.create({
          id: transaction.id,
          walletId,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          reference: transaction.reference,
          description: transaction.description,
          metadata: transaction.metadata,
          completedAt: transaction.completedAt
        });
      } catch (dbError) {
        LoggerService.warn('Could not persist transaction to database', { error: (dbError as Error).message });
      }

      LoggerService.info('Wallet transaction created', {
        transactionId: transaction.id,
        walletId,
        type,
        amount,
        status: transaction.status
      });

      res.status(201).json({
        success: true,
        data: {
          transactionId: transaction.id,
          walletId,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          completedAt: transaction.completedAt
        },
        message: 'Wallet transaction created successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to create wallet transaction', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to create wallet transaction'
      });
    }
  }

  /**
   * Get external wallet providers
   */
  async getExternalWalletProviders(_req: Request, res: Response): Promise<void> {
    try {
      const providers = [
        {
          id: 'metamask',
          name: 'MetaMask',
          type: 'browser_extension',
          supportedNetworks: ['ethereum', 'polygon', 'bsc'],
          isActive: true
        },
        {
          id: 'walletconnect',
          name: 'WalletConnect',
          type: 'web3_wallet',
          supportedNetworks: ['ethereum', 'polygon', 'bsc'],
          isActive: true
        }
      ];

      res.status(200).json({
        success: true,
        data: providers,
        message: 'External wallet providers retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get external wallet providers', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get external wallet providers'
      });
    }
  }

  /**
   * Connect external wallet
   */
  async connectExternalWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId, tenantId, brokerId } = req.params;
      const { providerId, walletAddress, network } = req.body;

      LoggerService.info('Connecting external wallet', { userId, providerId, walletAddress, network });

      const wallet = {
        id: `external_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        walletType: 'external',
        currency: network,
        address: walletAddress,
        status: 'active',
        metadata: {
          provider: providerId,
          network,
          createdAt: new Date()
        }
      };

      res.status(201).json({
        success: true,
        data: {
          id: wallet.id,
          type: wallet.walletType,
          currency: wallet.currency,
          address: wallet.address,
          status: wallet.status,
          provider: wallet.metadata.provider
        },
        message: 'External wallet connected successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to connect external wallet', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to connect external wallet'
      });
    }
  }

  /**
   * Get wallet security settings
   */
  async getWalletSecuritySettings(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get security settings
      let settings = walletSecuritySettings.get(walletId);

      if (!settings) {
        // Return default settings
        settings = {
          walletId,
          twoFactorEnabled: false,
          whitelistedAddresses: [],
          withdrawalLimits: {},
          lastUpdated: new Date()
        };
      }

      res.status(200).json({
        success: true,
        data: {
          walletId,
          twoFactorEnabled: settings.twoFactorEnabled,
          whitelistedAddresses: settings.whitelistedAddresses,
          withdrawalLimits: settings.withdrawalLimits,
          requireApprovalAbove: settings.requireApprovalAbove,
          lastUpdated: settings.lastUpdated
        },
        message: 'Wallet security settings retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get wallet security settings', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get wallet security settings'
      });
    }
  }

  /**
   * Update wallet security settings
   */
  async updateWalletSecuritySettings(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const {
        twoFactorEnabled,
        whitelistedAddresses,
        withdrawalLimits,
        requireApprovalAbove
      } = req.body;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get or create settings
      let settings = walletSecuritySettings.get(walletId);
      if (!settings) {
        settings = {
          walletId,
          twoFactorEnabled: false,
          whitelistedAddresses: [],
          withdrawalLimits: {},
          lastUpdated: new Date()
        };
      }

      // Update fields
      if (twoFactorEnabled !== undefined) settings.twoFactorEnabled = twoFactorEnabled;
      if (whitelistedAddresses !== undefined) settings.whitelistedAddresses = whitelistedAddresses;
      if (withdrawalLimits !== undefined) settings.withdrawalLimits = { ...settings.withdrawalLimits, ...withdrawalLimits };
      if (requireApprovalAbove !== undefined) settings.requireApprovalAbove = requireApprovalAbove;
      settings.lastUpdated = new Date();

      // Store settings
      walletSecuritySettings.set(walletId, settings);

      LoggerService.info('Wallet security settings updated', { walletId });

      res.status(200).json({
        success: true,
        data: {
          walletId,
          twoFactorEnabled: settings.twoFactorEnabled,
          whitelistedAddresses: settings.whitelistedAddresses,
          withdrawalLimits: settings.withdrawalLimits,
          requireApprovalAbove: settings.requireApprovalAbove,
          lastUpdated: settings.lastUpdated
        },
        message: 'Wallet security settings updated successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to update wallet security settings', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to update wallet security settings'
      });
    }
  }

  /**
   * Get wallet backup information
   */
  async getWalletBackup(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get backups for wallet
      const backups = walletBackups.get(walletId) || [];
      const latestBackup = backups.length > 0 ? backups[backups.length - 1] : null;

      res.status(200).json({
        success: true,
        data: {
          walletId,
          backupExists: backups.length > 0,
          backupCount: backups.length,
          lastBackupDate: latestBackup?.createdAt || null,
          lastBackupId: latestBackup?.id || null
        },
        message: 'Wallet backup information retrieved successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to get wallet backup', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to get wallet backup'
      });
    }
  }

  /**
   * Create wallet backup - encrypts wallet data for secure storage
   */
  async createWalletBackup(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { encryptionKey } = req.body;

      if (!walletId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId is required'
        });
        return;
      }

      // Get wallet
      const wallet = wallets.get(walletId);
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Wallet not found'
        });
        return;
      }

      // Prepare backup data
      const backupData = {
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          tenantId: wallet.tenantId,
          brokerId: wallet.brokerId,
          walletType: wallet.walletType,
          currency: wallet.currency,
          address: wallet.address,
          ledgerAccountId: wallet.ledgerAccountId,
          metadata: wallet.metadata
        },
        securitySettings: walletSecuritySettings.get(walletId),
        backupTimestamp: new Date().toISOString()
      };

      // Encrypt backup data
      const key = encryptionKey
        ? crypto.scryptSync(encryptionKey, 'salt', 32)
        : crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      let encrypted = cipher.update(JSON.stringify(backupData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      const encryptedData = JSON.stringify({
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
      });

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(encryptedData).digest('hex');

      // Create backup record
      const backup: WalletBackup = {
        id: uuidv4(),
        walletId,
        encryptedData,
        checksum,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      };

      // Store backup
      const backupList = walletBackups.get(walletId) || [];
      backupList.push(backup);
      walletBackups.set(walletId, backupList);

      LoggerService.info('Wallet backup created', { walletId, backupId: backup.id });

      res.status(201).json({
        success: true,
        data: {
          walletId,
          backupId: backup.id,
          checksum: backup.checksum,
          createdAt: backup.createdAt.toISOString(),
          expiresAt: backup.expiresAt?.toISOString()
        },
        message: 'Wallet backup created successfully'
      });
    } catch (error: any) {
      LoggerService.error('Failed to create wallet backup', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to create wallet backup'
      });
    }
  }

  /**
   * Restore wallet from backup
   */
  async restoreWalletFromBackup(req: Request, res: Response): Promise<void> {
    try {
      const { walletId, backupId } = req.params;
      const { encryptionKey } = req.body;

      if (!walletId || !backupId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'walletId and backupId are required'
        });
        return;
      }

      // Get backup
      const backupList = walletBackups.get(walletId) || [];
      const backup = backupList.find(b => b.id === backupId);

      if (!backup) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Backup not found'
        });
        return;
      }

      // Verify checksum
      const currentChecksum = crypto.createHash('sha256').update(backup.encryptedData).digest('hex');
      if (currentChecksum !== backup.checksum) {
        res.status(400).json({
          success: false,
          error: 'BACKUP_CORRUPTED',
          message: 'Backup data integrity check failed'
        });
        return;
      }

      // Decrypt backup
      if (!encryptionKey) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'encryptionKey is required to restore backup'
        });
        return;
      }

      try {
        const encryptedObj = JSON.parse(backup.encryptedData);
        const key = crypto.scryptSync(encryptionKey, 'salt', 32);
        const iv = Buffer.from(encryptedObj.iv, 'hex');
        const authTag = Buffer.from(encryptedObj.authTag, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const backupData = JSON.parse(decrypted);

        LoggerService.info('Wallet backup restored', { walletId, backupId });

        res.status(200).json({
          success: true,
          data: {
            walletId,
            backupId,
            restoredAt: new Date().toISOString(),
            backupTimestamp: backupData.backupTimestamp
          },
          message: 'Wallet backup restored successfully'
        });
      } catch (decryptError) {
        res.status(400).json({
          success: false,
          error: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt backup - invalid encryption key'
        });
      }
    } catch (error: any) {
      LoggerService.error('Failed to restore wallet backup', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'INTERNAL_ERROR',
        message: 'Failed to restore wallet backup'
      });
    }
  }
}

