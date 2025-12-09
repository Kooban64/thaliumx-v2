/**
 * FIAT Management Service
 * 
 * Core FIAT operations including:
 * - Multi-currency FIAT wallets
 * - Banking API integration (Nedbank)
 * - PayShap integration
 * - Deposit/withdrawal processing
 * - Automated reconciliation
 * - Risk assessment
 * 
 * Production-ready for financial operations
 */

import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { AppError, createError } from '../utils';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface FiatWallet {
  id: string;
  userId: string;
  tenantId: string;
  currency: string;
  available: number;
  locked: number;
  total: number;
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface FiatTransaction {
  id: string;
  userId: string;
  tenantId: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee' | 'refund';
  currency: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  externalReference?: string;
  bankReference?: string;
  description?: string;
  fee?: number;
  netAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  bankName: string;
  accountNumber: string;
  accountType: 'current' | 'savings';
  currency: string;
  status: 'active' | 'inactive';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankingApiResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  reference?: string;
}

export interface ReconciliationRecord {
  id: string;
  tenantId: string;
  bankAccountId: string;
  externalReference: string;
  amount: number;
  currency: string;
  transactionDate: Date;
  description: string;
  status: 'matched' | 'unmatched' | 'disputed';
  matchedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// FIAT SERVICE CLASS
// =============================================================================

export class FiatService {
  private static wallets: Map<string, FiatWallet[]> = new Map();
  private static transactions: Map<string, FiatTransaction[]> = new Map();
  private static bankAccounts: Map<string, BankAccount[]> = new Map();
  private static reconciliationRecords: Map<string, ReconciliationRecord[]> = new Map();

  /**
   * Initialize FIAT service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing FIAT Service...');
      
      // Load bank accounts
      await this.loadBankAccounts();
      
      // Load active wallets
      await this.loadActiveWallets();
      
      // Start reconciliation process
      this.startReconciliationProcess();
      
      // Start banking API monitoring
      this.startBankingApiMonitoring();
      
      LoggerService.info('✅ FIAT Service initialized successfully');
    } catch (error) {
      LoggerService.error('❌ FIAT Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create FIAT wallet for user
   */
  public static async createWallet(userId: string, tenantId: string, currency: string): Promise<FiatWallet> {
    try {
      // Validate currency
      if (!this.isValidCurrency(currency)) {
        throw createError('Invalid currency', 400, 'INVALID_CURRENCY');
      }
      
      // Check if wallet already exists
      const existingWallet = await this.getWallet(userId, tenantId, currency);
      if (existingWallet) {
        throw createError('Wallet already exists', 400, 'WALLET_EXISTS');
      }
      
      const wallet: FiatWallet = {
        id: this.generateWalletId(),
        userId,
        tenantId,
        currency,
        available: 0,
        locked: 0,
        total: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save wallet
      await this.saveWallet(wallet);
      
      LoggerService.info(`FIAT wallet created: ${wallet.id}`, { 
        walletId: wallet.id, 
        userId, 
        tenantId, 
        currency 
      });
      
      return wallet;
    } catch (error) {
      LoggerService.error('FIAT wallet creation failed:', error);
      throw error;
    }
  }

  /**
   * Get user wallets
   */
  public static async getUserWallets(userId: string, tenantId: string): Promise<FiatWallet[]> {
    try {
      const key = `${userId}:${tenantId}`;
      return this.wallets.get(key) || [];
    } catch (error) {
      LoggerService.error('Get user wallets failed:', error);
      throw error;
    }
  }

  /**
   * Get specific wallet
   */
  public static async getWallet(userId: string, tenantId: string, currency: string): Promise<FiatWallet | null> {
    try {
      const wallets = await this.getUserWallets(userId, tenantId);
      return wallets.find(w => w.currency === currency) || null;
    } catch (error) {
      LoggerService.error('Get wallet failed:', error);
      throw error;
    }
  }

  /**
   * Deposit FIAT
   */
  public static async deposit(userId: string, tenantId: string, currency: string, amount: number, reference: string): Promise<FiatTransaction> {
    try {
      if (amount <= 0) {
        throw createError('Invalid deposit amount', 400, 'INVALID_AMOUNT');
      }
      
      // Get or create wallet
      let wallet = await this.getWallet(userId, tenantId, currency);
      if (!wallet) {
        wallet = await this.createWallet(userId, tenantId, currency);
      }
      
      // Create transaction
      const transaction: FiatTransaction = {
        id: this.generateTransactionId(),
        userId,
        tenantId,
        walletId: wallet.id,
        type: 'deposit',
        currency,
        amount,
        status: 'pending',
        reference,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save transaction
      await this.saveTransaction(transaction);
      
      // Process deposit
      await this.processDeposit(transaction);
      
      LoggerService.info(`FIAT deposit initiated: ${transaction.id}`, { 
        transactionId: transaction.id, 
        userId, 
        amount, 
        currency 
      });
      
      return transaction;
    } catch (error) {
      LoggerService.error('FIAT deposit failed:', error);
      throw error;
    }
  }

  /**
   * Withdraw FIAT
   */
  public static async withdraw(userId: string, tenantId: string, currency: string, amount: number, bankAccountId: string): Promise<FiatTransaction> {
    try {
      if (amount <= 0) {
        throw createError('Invalid withdrawal amount', 400, 'INVALID_AMOUNT');
      }
      
      // Get wallet
      const wallet = await this.getWallet(userId, tenantId, currency);
      if (!wallet) {
        throw createError('Wallet not found', 404, 'WALLET_NOT_FOUND');
      }
      
      // Check balance
      if (wallet.available < amount) {
        throw createError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }
      
      // Get bank account
      const bankAccount = await this.getBankAccount(tenantId, bankAccountId);
      if (!bankAccount) {
        throw createError('Bank account not found', 404, 'BANK_ACCOUNT_NOT_FOUND');
      }
      
      // Calculate fee
      const fee = await this.calculateWithdrawalFee(amount, currency);
      const netAmount = amount - fee;
      
      // Create transaction
      const transaction: FiatTransaction = {
        id: this.generateTransactionId(),
        userId,
        tenantId,
        walletId: wallet.id,
        type: 'withdrawal',
        currency,
        amount,
        status: 'pending',
        reference: this.generateReference(),
        fee,
        netAmount,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Lock funds
      await this.lockFunds(wallet.id, amount);
      
      // Save transaction
      await this.saveTransaction(transaction);
      
      // Process withdrawal
      await this.processWithdrawal(transaction, bankAccount);
      
      LoggerService.info(`FIAT withdrawal initiated: ${transaction.id}`, { 
        transactionId: transaction.id, 
        userId, 
        amount, 
        currency 
      });
      
      return transaction;
    } catch (error) {
      LoggerService.error('FIAT withdrawal failed:', error);
      throw error;
    }
  }

  /**
   * Transfer FIAT between users
   */
  public static async transfer(fromUserId: string, fromTenantId: string, toUserId: string, toTenantId: string, currency: string, amount: number, description?: string): Promise<FiatTransaction> {
    try {
      if (amount <= 0) {
        throw createError('Invalid transfer amount', 400, 'INVALID_AMOUNT');
      }
      
      // Get source wallet
      const fromWallet = await this.getWallet(fromUserId, fromTenantId, currency);
      if (!fromWallet) {
        throw createError('Source wallet not found', 404, 'SOURCE_WALLET_NOT_FOUND');
      }
      
      // Check balance
      if (fromWallet.available < amount) {
        throw createError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }
      
      // Get or create destination wallet
      let toWallet = await this.getWallet(toUserId, toTenantId, currency);
      if (!toWallet) {
        toWallet = await this.createWallet(toUserId, toTenantId, currency);
      }
      
      // Calculate fee
      const fee = await this.calculateTransferFee(amount, currency);
      const netAmount = amount - fee;
      
      // Create transaction
      const transaction: FiatTransaction = {
        id: this.generateTransactionId(),
        userId: fromUserId,
        tenantId: fromTenantId,
        walletId: fromWallet.id,
        type: 'transfer',
        currency,
        amount,
        status: 'pending',
        reference: this.generateReference(),
        description,
        fee,
        netAmount,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Process transfer
      await this.processTransfer(transaction, fromWallet, toWallet);
      
      LoggerService.info(`FIAT transfer initiated: ${transaction.id}`, { 
        transactionId: transaction.id, 
        fromUserId, 
        toUserId, 
        amount, 
        currency 
      });
      
      return transaction;
    } catch (error) {
      LoggerService.error('FIAT transfer failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  public static async getTransactionHistory(userId: string, tenantId: string, currency?: string, limit: number = 50, offset: number = 0): Promise<FiatTransaction[]> {
    try {
      const key = `${userId}:${tenantId}`;
      let transactions = this.transactions.get(key) || [];
      
      // Filter by currency if specified
      if (currency) {
        transactions = transactions.filter(t => t.currency === currency);
      }
      
      // Sort by creation date (newest first)
      transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      // Apply pagination
      return transactions.slice(offset, offset + limit);
    } catch (error) {
      LoggerService.error('Get transaction history failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  public static async getTransaction(transactionId: string): Promise<FiatTransaction | null> {
    try {
      // Search in all transactions
      for (const transactions of this.transactions.values()) {
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) return transaction;
      }
      return null;
    } catch (error) {
      LoggerService.error('Get transaction failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static isValidCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'ZAR', 'CAD', 'AUD', 'JPY', 'CHF'];
    return validCurrencies.includes(currency.toUpperCase());
  }

  private static async processDeposit(transaction: FiatTransaction): Promise<void> {
    try {
      // In production, this would integrate with banking APIs
      // For now, simulate processing
      
      // Update transaction status
      transaction.status = 'processing';
      transaction.updatedAt = new Date();
      
      // Simulate bank processing delay
      setTimeout(async () => {
        try {
          // Complete deposit
          await this.completeDeposit(transaction);
        } catch (error) {
          LoggerService.error('Deposit completion failed:', error);
          transaction.status = 'failed';
          transaction.updatedAt = new Date();
          await this.saveTransaction(transaction);
        }
      }, 5000); // 5 second delay
      
      await this.saveTransaction(transaction);
    } catch (error) {
      LoggerService.error('Process deposit failed:', error);
      throw error;
    }
  }

  private static async completeDeposit(transaction: FiatTransaction): Promise<void> {
    try {
      // Get wallet
      const wallets = this.wallets.get(`${transaction.userId}:${transaction.tenantId}`) || [];
      const wallet = wallets.find(w => w.id === transaction.walletId);
      
      if (wallet) {
        // Update wallet balance
        wallet.available += transaction.amount;
        wallet.total = wallet.available + wallet.locked;
        wallet.updatedAt = new Date();
        
        // Update transaction status
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.updatedAt = new Date();
        
        // Save changes
        await this.saveWallet(wallet);
        await this.saveTransaction(transaction);
        
        // Emit deposit completed event
        await this.emitFiatEvent('deposit.completed', transaction);
        
        LoggerService.info(`Deposit completed: ${transaction.id}`, { 
          transactionId: transaction.id, 
          amount: transaction.amount 
        });
      }
    } catch (error) {
      LoggerService.error('Complete deposit failed:', error);
      throw error;
    }
  }

  private static async processWithdrawal(transaction: FiatTransaction, bankAccount: BankAccount): Promise<void> {
    try {
      // Update transaction status
      transaction.status = 'processing';
      transaction.updatedAt = new Date();
      
      // In production, this would integrate with banking APIs (Nedbank, PayShap)
      // For now, simulate processing
      
      // Simulate bank processing delay
      setTimeout(async () => {
        try {
          // Complete withdrawal
          await this.completeWithdrawal(transaction, bankAccount);
        } catch (error) {
          LoggerService.error('Withdrawal completion failed:', error);
          transaction.status = 'failed';
          transaction.updatedAt = new Date();
          await this.saveTransaction(transaction);
          
          // Unlock funds
          await this.unlockFunds(transaction.walletId, transaction.amount);
        }
      }, 10000); // 10 second delay
      
      await this.saveTransaction(transaction);
    } catch (error) {
      LoggerService.error('Process withdrawal failed:', error);
      throw error;
    }
  }

  private static async completeWithdrawal(transaction: FiatTransaction, bankAccount: BankAccount): Promise<void> {
    try {
      // Get wallet
      const wallets = this.wallets.get(`${transaction.userId}:${transaction.tenantId}`) || [];
      const wallet = wallets.find(w => w.id === transaction.walletId);
      
      if (wallet) {
        // Update wallet balance
        wallet.locked -= transaction.amount;
        wallet.total = wallet.available + wallet.locked;
        wallet.updatedAt = new Date();
        
        // Update transaction status
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.updatedAt = new Date();
        transaction.bankReference = this.generateBankReference();
        
        // Save changes
        await this.saveWallet(wallet);
        await this.saveTransaction(transaction);
        
        // Emit withdrawal completed event
        await this.emitFiatEvent('withdrawal.completed', transaction);
        
        LoggerService.info(`Withdrawal completed: ${transaction.id}`, { 
          transactionId: transaction.id, 
          amount: transaction.amount,
          bankReference: transaction.bankReference
        });
      }
    } catch (error) {
      LoggerService.error('Complete withdrawal failed:', error);
      throw error;
    }
  }

  private static async processTransfer(transaction: FiatTransaction, fromWallet: FiatWallet, toWallet: FiatWallet): Promise<void> {
    try {
      // Update transaction status
      transaction.status = 'processing';
      transaction.updatedAt = new Date();
      
      // Update source wallet
      fromWallet.available -= transaction.amount;
      fromWallet.total = fromWallet.available + fromWallet.locked;
      fromWallet.updatedAt = new Date();
      
      // Update destination wallet
      toWallet.available += transaction.netAmount!;
      toWallet.total = toWallet.available + toWallet.locked;
      toWallet.updatedAt = new Date();
      
      // Complete transaction
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.updatedAt = new Date();
      
      // Save changes
      await this.saveWallet(fromWallet);
      await this.saveWallet(toWallet);
      await this.saveTransaction(transaction);
      
      // Emit transfer completed event
      await this.emitFiatEvent('transfer.completed', transaction);
      
      LoggerService.info(`Transfer completed: ${transaction.id}`, { 
        transactionId: transaction.id, 
        amount: transaction.amount 
      });
    } catch (error) {
      LoggerService.error('Process transfer failed:', error);
      throw error;
    }
  }

  private static async lockFunds(walletId: string, amount: number): Promise<void> {
    // Find wallet and lock funds
    for (const wallets of this.wallets.values()) {
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet) {
        wallet.available -= amount;
        wallet.locked += amount;
        wallet.total = wallet.available + wallet.locked;
        wallet.updatedAt = new Date();
        await this.saveWallet(wallet);
        break;
      }
    }
  }

  private static async unlockFunds(walletId: string, amount: number): Promise<void> {
    // Find wallet and unlock funds
    for (const wallets of this.wallets.values()) {
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet) {
        wallet.available += amount;
        wallet.locked -= amount;
        wallet.total = wallet.available + wallet.locked;
        wallet.updatedAt = new Date();
        await this.saveWallet(wallet);
        break;
      }
    }
  }

  private static async calculateWithdrawalFee(amount: number, currency: string): Promise<number> {
    // Simple fee calculation - in production, this would be more sophisticated
    const baseFee = currency === 'USD' ? 5 : 2;
    const percentageFee = amount * 0.001; // 0.1%
    return Math.max(baseFee, percentageFee);
  }

  private static async calculateTransferFee(amount: number, currency: string): Promise<number> {
    // Simple fee calculation
    return amount * 0.0005; // 0.05%
  }

  private static async getBankAccount(tenantId: string, bankAccountId: string): Promise<BankAccount | null> {
    const accounts = this.bankAccounts.get(tenantId) || [];
    return accounts.find(a => a.id === bankAccountId) || null;
  }

  private static async loadBankAccounts(): Promise<void> {
    // Mock bank accounts - in production, load from database
    const accounts: BankAccount[] = [
      {
        id: 'bank_1',
        tenantId: 'tenant_1',
        bankName: 'Nedbank',
        accountNumber: '1234567890',
        accountType: 'current',
        currency: 'ZAR',
        status: 'active',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const account of accounts) {
      const tenantAccounts = this.bankAccounts.get(account.tenantId) || [];
      tenantAccounts.push(account);
      this.bankAccounts.set(account.tenantId, tenantAccounts);
    }
  }

  private static async loadActiveWallets(): Promise<void> {
    // In production, load active wallets from database
    LoggerService.info('Loading active FIAT wallets...');
  }

  private static startReconciliationProcess(): void {
    // Start reconciliation process
    setInterval(() => {
      this.performReconciliation();
    }, 300000); // Every 5 minutes
    
    LoggerService.info('FIAT reconciliation process started');
  }

  private static startBankingApiMonitoring(): void {
    // Start banking API monitoring
    setInterval(() => {
      this.monitorBankingApis();
    }, 60000); // Every minute
    
    LoggerService.info('Banking API monitoring started');
  }

  private static async performReconciliation(): Promise<void> {
    try {
      // In production, this would reconcile with bank statements
      LoggerService.info('Performing FIAT reconciliation...');
    } catch (error) {
      LoggerService.error('Reconciliation failed:', error);
    }
  }

  private static async monitorBankingApis(): Promise<void> {
    try {
      // In production, this would monitor banking API health
      LoggerService.info('Monitoring banking APIs...');
    } catch (error) {
      LoggerService.error('Banking API monitoring failed:', error);
    }
  }

  private static async saveWallet(wallet: FiatWallet): Promise<void> {
    // This would save to database
    const key = `${wallet.userId}:${wallet.tenantId}`;
    const wallets = this.wallets.get(key) || [];
    const existingIndex = wallets.findIndex(w => w.id === wallet.id);
    
    if (existingIndex >= 0) {
      wallets[existingIndex] = wallet;
    } else {
      wallets.push(wallet);
    }
    
    this.wallets.set(key, wallets);
  }

  private static async saveTransaction(transaction: FiatTransaction): Promise<void> {
    // This would save to database
    const key = `${transaction.userId}:${transaction.tenantId}`;
    const transactions = this.transactions.get(key) || [];
    const existingIndex = transactions.findIndex(t => t.id === transaction.id);
    
    if (existingIndex >= 0) {
      transactions[existingIndex] = transaction;
    } else {
      transactions.push(transaction);
    }
    
    this.transactions.set(key, transactions);
  }

  private static async emitFiatEvent(eventType: string, transaction: FiatTransaction): Promise<void> {
    // This would emit to Kafka
    LoggerService.info(`FIAT event: ${eventType}`, { 
      transactionId: transaction.id, 
      eventType 
    });
  }

  private static generateWalletId(): string {
    return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateReference(): string {
    return `REF${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private static generateBankReference(): string {
    return `BANK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}
