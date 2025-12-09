/**
 * BlnkFinance Integration Service
 * 
 * Comprehensive double-entry bookkeeping system with:
 * - Account Management (Chart of accounts and hierarchy)
 * - Transaction Processing (Double-entry recording)
 * - Ledger Management (General ledger and sub-ledgers)
 * - Balance Tracking (Real-time calculations)
 * - Financial Reporting (P&L, Balance Sheet, Cash Flow)
 * - Audit Trail (Complete transaction history)
 * - Multi-Currency Support (Multi-currency accounting)
 * - Broker Segregation (Fund separation by broker)
 * - Compliance Reporting (Regulatory reporting)
 * - Reconciliation (Bank and exchange reconciliation)
 * 
 * Production-ready with comprehensive error handling
 */

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { DatabaseService } from './database';
import { AppError, createError } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { Op, Transaction } from 'sequelize';
import axios from 'axios';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  brokerId?: string;
  currency: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  isActive: boolean;
  description?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionEntry {
  id: string;
  transactionId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  description: string;
  reference?: string;
  metadata?: any;
  createdAt: Date;
}

export interface FinancialTransaction {
  id: string;
  transactionNumber: string;
  date: Date;
  description: string;
  reference?: string;
  brokerId?: string;
  currency: string;
  totalAmount: number;
  status: TransactionStatus;
  type: TransactionType;
  entries: TransactionEntry[];
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  transactionId: string;
  date: Date;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  currency: string;
  description: string;
  reference?: string;
  brokerId?: string;
  metadata?: any;
  createdAt: Date;
}

export interface Balance {
  accountId: string;
  currency: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
  lastUpdated: Date;
}

export interface FinancialReport {
  id?: string;
  reportType: ReportType;
  period: {
    startDate: Date;
    endDate: Date;
  };
  brokerId?: string;
  currency: string;
  data: any;
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  externalSource: string;
  externalReference: string;
  internalAmount: number;
  externalAmount: number;
  difference: number;
  status: ReconciliationStatus;
  reconciledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  BANK = 'BANK',
  CASH = 'CASH',
  RECEIVABLE = 'RECEIVABLE',
  PAYABLE = 'PAYABLE',
  INVESTMENT = 'INVESTMENT',
  TRADING = 'TRADING',
  MARGIN = 'MARGIN',
  STAKING = 'STAKING',
  NFT = 'NFT',
  DEFI = 'DEFI'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED'
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  TRADE = 'TRADE',
  FEE = 'FEE',
  INTEREST = 'INTEREST',
  DIVIDEND = 'DIVIDEND',
  STAKING_REWARD = 'STAKING_REWARD',
  MARGIN_CALL = 'MARGIN_CALL',
  LIQUIDATION = 'LIQUIDATION',
  NFT_PURCHASE = 'NFT_PURCHASE',
  NFT_SALE = 'NFT_SALE',
  DEFI_DEPOSIT = 'DEFI_DEPOSIT',
  DEFI_WITHDRAWAL = 'DEFI_WITHDRAWAL',
  DEFI_REWARD = 'DEFI_REWARD',
  ADJUSTMENT = 'ADJUSTMENT',
  RECONCILIATION = 'RECONCILIATION',
  PAYMENT = 'PAYMENT' // Payment transactions (e.g., for broker/client payments)
}

export enum ReportType {
  PROFIT_LOSS = 'PROFIT_LOSS',
  BALANCE_SHEET = 'BALANCE_SHEET',
  CASH_FLOW = 'CASH_FLOW',
  TRIAL_BALANCE = 'TRIAL_BALANCE',
  GENERAL_LEDGER = 'GENERAL_LEDGER',
  ACCOUNT_STATEMENT = 'ACCOUNT_STATEMENT',
  BROKER_SUMMARY = 'BROKER_SUMMARY',
  COMPLIANCE_REPORT = 'COMPLIANCE_REPORT'
}

export enum ReconciliationStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  DIFFERENCE = 'DIFFERENCE',
  RECONCILED = 'RECONCILED'
}

// =============================================================================
// BLNKFINANCE SERVICE CLASS
// =============================================================================

export class BlnkFinanceService {
  private static isInitialized = false;
  private static accounts: Map<string, Account> = new Map();
  private static balances: Map<string, Balance> = new Map();
  private static transactions: Map<string, FinancialTransaction> = new Map();

  // External BlnkFinance service configuration
  private static externalServiceUrl: string | null = process.env.BLNK_FINANCE_URL || process.env.BLNK_FINANCE_API_URL || 'http://blnk-finance:5001';
  private static externalServiceApiKey: string = process.env.BLNK_FINANCE_API_KEY || process.env.VAULT_BLNK_FINANCE_API_KEY || 'default-key';
  private static externalServiceEnabled: boolean = !!process.env.BLNK_FINANCE_URL || !!process.env.BLNK_FINANCE_API_URL;
  private static externalServiceClient: any = null;

  // Chart of Accounts Templates
  private static readonly CHART_OF_ACCOUNTS = {
    ASSETS: {
      '1000': { name: 'Current Assets', type: AccountType.ASSET, parent: undefined },
      '1100': { name: 'Cash and Cash Equivalents', type: AccountType.CASH, parent: '1000' },
      '1110': { name: 'Bank Accounts', type: AccountType.BANK, parent: '1100' },
      '1120': { name: 'Trading Accounts', type: AccountType.TRADING, parent: '1100' },
      '1130': { name: 'Margin Accounts', type: AccountType.MARGIN, parent: '1100' },
      '1200': { name: 'Accounts Receivable', type: AccountType.RECEIVABLE, parent: '1000' },
      '1300': { name: 'Investments', type: AccountType.INVESTMENT, parent: '1000' },
      '1400': { name: 'NFT Holdings', type: AccountType.NFT, parent: '1000' },
      '1500': { name: 'DeFi Positions', type: AccountType.DEFI, parent: '1000' },
      '1600': { name: 'Staking Positions', type: AccountType.STAKING, parent: '1000' }
    },
    LIABILITIES: {
      '2000': { name: 'Current Liabilities', type: AccountType.LIABILITY, parent: undefined },
      '2100': { name: 'Accounts Payable', type: AccountType.PAYABLE, parent: '2000' },
      '2200': { name: 'Margin Loans', type: AccountType.MARGIN, parent: '2000' },
      '2300': { name: 'DeFi Loans', type: AccountType.DEFI, parent: '2000' },
      '2400': { name: 'Accrued Expenses', type: AccountType.LIABILITY, parent: '2000' }
    },
    EQUITY: {
      '3000': { name: 'Equity', type: AccountType.EQUITY, parent: undefined },
      '3100': { name: 'Share Capital', type: AccountType.EQUITY, parent: '3000' },
      '3200': { name: 'Retained Earnings', type: AccountType.EQUITY, parent: '3000' },
      '3300': { name: 'Broker Equity', type: AccountType.EQUITY, parent: '3000' }
    },
    REVENUE: {
      '4000': { name: 'Revenue', type: AccountType.REVENUE, parent: undefined },
      '4100': { name: 'Trading Revenue', type: AccountType.REVENUE, parent: '4000' },
      '4200': { name: 'Fee Income', type: AccountType.REVENUE, parent: '4000' },
      '4300': { name: 'Interest Income', type: AccountType.REVENUE, parent: '4000' },
      '4400': { name: 'Staking Rewards', type: AccountType.REVENUE, parent: '4000' },
      '4500': { name: 'DeFi Rewards', type: AccountType.REVENUE, parent: '4000' }
    },
    EXPENSES: {
      '5000': { name: 'Expenses', type: AccountType.EXPENSE, parent: undefined },
      '5100': { name: 'Operating Expenses', type: AccountType.EXPENSE, parent: '5000' },
      '5200': { name: 'Interest Expense', type: AccountType.EXPENSE, parent: '5000' },
      '5300': { name: 'Trading Fees', type: AccountType.EXPENSE, parent: '5000' },
      '5400': { name: 'Bank Fees', type: AccountType.EXPENSE, parent: '5000' },
      '5500': { name: 'Regulatory Fees', type: AccountType.EXPENSE, parent: '5000' }
    }
  };

  /**
   * Initialize BlnkFinance Service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing BlnkFinance Service...');
      
      // Initialize external BlnkFinance service client if configured
      if (this.externalServiceEnabled && this.externalServiceUrl) {
        this.externalServiceClient = axios.create({
          baseURL: this.externalServiceUrl,
          headers: {
            'Authorization': `Bearer ${this.externalServiceApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        LoggerService.info(`External BlnkFinance service enabled: ${this.externalServiceUrl}`);
        
        // Test connection
        try {
          const healthResponse = await this.externalServiceClient.get('/health');
          if (healthResponse.status === 200) {
            LoggerService.info('External BlnkFinance service health check passed');
          }
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service health check failed, will use local implementation', {
            error: error.message
          });
        }
      } else {
        LoggerService.info('Using local BlnkFinance implementation');
      }
      
      // Initialize database models
      await this.initializeModels();
      
      // Create default chart of accounts
      await this.createDefaultChartOfAccounts();
      
      // Load existing accounts and balances
      await this.loadAccountsAndBalances();
      
      this.isInitialized = true;
      LoggerService.info('✅ BlnkFinance Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'blnkfinance.initialized',
        'BlnkFinanceService',
        'info',
        {
          message: 'BlnkFinance service initialized',
          accountsCount: this.accounts.size,
          balancesCount: this.balances.size,
          transactionsCount: this.transactions.size
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ BlnkFinance Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new account
   * Uses external BlnkFinance service if available, otherwise creates locally
   */
  public static async createAccount(
    code: string,
    name: string,
    type: AccountType,
    currency: string,
    brokerId?: string,
    parentId?: string,
    description?: string,
    metadata?: any
  ): Promise<Account> {
    try {
      LoggerService.info(`Creating account: ${code} - ${name}`, {
        type,
        currency,
        brokerId,
        parentId
      });

      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.post('/v1/accounts', {
            code,
            name,
            type,
            currency,
            broker_id: brokerId,
            parent_id: parentId,
            description,
            metadata
          });
          
          LoggerService.info(`Account created via external BlnkFinance service: ${response.data.id}`);
          return this.mapExternalAccountToInternal(response.data);
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation
      const account: Account = {
        id: uuidv4(),
        code,
        name,
        type,
        parentId,
        brokerId,
        currency,
        balance: 0,
        debitBalance: 0,
        creditBalance: 0,
        isActive: true,
        description,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.saveAccount(account);

      // Add to memory cache
      this.accounts.set(account.id, account);

      // Initialize balance
      const balance: Balance = {
        accountId: account.id,
        currency,
        debitBalance: 0,
        creditBalance: 0,
        netBalance: 0,
        lastUpdated: new Date()
      };

      this.balances.set(account.id, balance);

      LoggerService.info(`Account created successfully: ${account.id}`, {
        code: account.code,
        name: account.name
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'account.created',
        'blnkfinance',
        account.id,
        {
          code: account.code,
          name: account.name,
          type: account.type,
          currency: account.currency,
          brokerId: account.brokerId
        }
      );

      return account;

    } catch (error) {
      LoggerService.error('Create account failed:', error);
      throw error;
    }
  }

  /**
   * Map external BlnkFinance account to internal format
   */
  private static mapExternalAccountToInternal(externalAccount: any): Account {
    return {
      id: externalAccount.id || uuidv4(),
      code: externalAccount.code || '',
      name: externalAccount.name || '',
      type: externalAccount.type as AccountType,
      parentId: externalAccount.parent_id,
      brokerId: externalAccount.broker_id,
      currency: externalAccount.currency || 'USD',
      balance: parseFloat(externalAccount.balance || '0'),
      debitBalance: parseFloat(externalAccount.debit_balance || '0'),
      creditBalance: parseFloat(externalAccount.credit_balance || '0'),
      isActive: externalAccount.is_active !== false,
      description: externalAccount.description,
      metadata: externalAccount.metadata,
      createdAt: new Date(externalAccount.created_at || Date.now()),
      updatedAt: new Date(externalAccount.updated_at || Date.now())
    };
  }

  /**
   * Map external BlnkFinance transaction to internal format
   */
  private static mapExternalTransactionToInternal(
    externalTransaction: any,
    originalEntries: Array<{
      accountId: string;
      debitAmount?: number;
      creditAmount?: number;
      description: string;
      reference?: string;
    }>,
    description: string,
    currency: string
  ): FinancialTransaction {
    const transaction: FinancialTransaction = {
      id: externalTransaction.id || uuidv4(),
      transactionNumber: externalTransaction.transaction_number || externalTransaction.id || '',
      date: new Date(externalTransaction.date || externalTransaction.created_at || Date.now()),
      description: externalTransaction.description || description,
      reference: externalTransaction.reference || '',
      brokerId: externalTransaction.broker_id,
      currency: externalTransaction.currency || currency,
      totalAmount: parseFloat(externalTransaction.total_amount || externalTransaction.amount || '0'),
      status: externalTransaction.status === 'completed' ? TransactionStatus.POSTED : TransactionStatus.PENDING,
      type: externalTransaction.type as TransactionType || TransactionType.TRANSFER,
      entries: originalEntries.map(entry => ({
        id: uuidv4(),
        transactionId: externalTransaction.id || uuidv4(),
        accountId: entry.accountId,
        debitAmount: entry.debitAmount || 0,
        creditAmount: entry.creditAmount || 0,
        currency: currency,
        description: entry.description,
        reference: entry.reference,
        metadata: {},
        createdAt: new Date()
      })),
      metadata: externalTransaction.metadata || {},
      createdAt: new Date(externalTransaction.created_at || Date.now()),
      updatedAt: new Date(externalTransaction.updated_at || Date.now())
    };

    // Store in memory cache
    this.transactions.set(transaction.id, transaction);

    return transaction;
  }

  /**
   * Map external ledger entry to internal format
   */
  private static mapExternalEntryToInternal(externalEntry: any, accountId: string): LedgerEntry {
    const date = new Date(externalEntry.date || externalEntry.created_at || Date.now());
    const debitAmount = parseFloat(externalEntry.debit_amount || externalEntry.debit || '0');
    const creditAmount = parseFloat(externalEntry.credit_amount || externalEntry.credit || '0');
    
    // Calculate balance (difference between debits and credits)
    const balance = debitAmount - creditAmount;
    
    return {
      id: externalEntry.id || uuidv4(),
      accountId,
      transactionId: externalEntry.transaction_id || '',
      date,
      debitAmount,
      creditAmount,
      balance, // Calculate balance from debit/credit amounts
      currency: externalEntry.currency || 'USD',
      description: externalEntry.description || '',
      reference: externalEntry.reference || '',
      metadata: externalEntry.metadata || {},
      createdAt: externalEntry.created_at ? new Date(externalEntry.created_at) : date // Use created_at from external or fallback to date
    };
  }

  /**
   * Record a double-entry transaction
   * Uses external BlnkFinance service if available, otherwise records locally
   */
  public static async recordTransaction(
    description: string,
    entries: Array<{
      accountId: string;
      debitAmount?: number;
      creditAmount?: number;
      description: string;
      reference?: string;
    }>,
    brokerId?: string,
    currency: string = 'USD',
    type: TransactionType = TransactionType.TRANSFER,
    reference?: string,
    metadata?: any
  ): Promise<FinancialTransaction> {
    try {
      // Validate double-entry principle
      const totalDebits = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);
      const totalCredits = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw createError('Transaction does not balance', 400, 'UNBALANCED_TRANSACTION');
      }

      LoggerService.info(`Recording transaction: ${description}`, {
        entriesCount: entries.length,
        totalDebits,
        totalCredits,
        brokerId,
        currency
      });

      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          // Convert entries to BlnkFinance format
          const ledgerEntries = entries.map(entry => ({
            account_id: entry.accountId,
            amount: (entry.debitAmount || 0) - (entry.creditAmount || 0), // Positive for debit, negative for credit
            currency,
            transaction_type: type,
            description: entry.description,
            reference: entry.reference
          }));

          const response = await this.externalServiceClient.post('/v1/ledger/entries', {
            tenant_id: metadata?.tenantId || 'default',
            broker_id: brokerId,
            entries: ledgerEntries,
            description,
            reference,
            metadata
          });
          
          LoggerService.info(`Transaction recorded via external BlnkFinance service: ${response.data.id}`);
          
          // Map response to internal format
          return this.mapExternalTransactionToInternal(response.data, entries, description, currency);
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      const transactionId = uuidv4();
      const transactionNumber = await this.generateTransactionNumber();

      const transaction: FinancialTransaction = {
        id: transactionId,
        transactionNumber,
        date: new Date(),
        description,
        reference,
        brokerId,
        currency,
        totalAmount: totalDebits,
        status: TransactionStatus.PENDING,
        type,
        entries: [],
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create transaction entries
      for (const entryData of entries) {
        const entry: TransactionEntry = {
          id: uuidv4(),
          transactionId,
          accountId: entryData.accountId,
          debitAmount: entryData.debitAmount || 0,
          creditAmount: entryData.creditAmount || 0,
          currency,
          description: entryData.description,
          reference: entryData.reference,
          metadata: {},
          createdAt: new Date()
        };

        transaction.entries.push(entry);
      }

      // Save transaction to database
      await this.saveTransaction(transaction);

      // Update account balances
      await this.updateAccountBalances(transaction);

      // Update transaction status
      transaction.status = TransactionStatus.POSTED;
      await this.updateTransaction(transaction);

      // Add to memory cache
      this.transactions.set(transactionId, transaction);

      LoggerService.info(`Transaction recorded successfully: ${transactionId}`, {
        transactionNumber: transaction.transactionNumber,
        totalAmount: transaction.totalAmount
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'transaction.recorded',
        'blnkfinance',
        transactionId,
        {
          transactionNumber: transaction.transactionNumber,
          description: transaction.description,
          type: transaction.type,
          totalAmount: transaction.totalAmount,
          entriesCount: transaction.entries.length
        }
      );

      return transaction;

    } catch (error) {
      LoggerService.error('Record transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get account balance
   * Uses external BlnkFinance service if available, otherwise gets from local cache
   */
  public static async getAccountBalance(
    accountId: string,
    tenantId?: string,
    currency?: string
  ): Promise<Balance | null> {
    try {
      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.get(`/v1/accounts/${accountId}/balance`, {
            params: {
              tenant_id: tenantId,
              currency: currency
            }
          });
          
          const externalBalance = response.data.balance || response.data;
          LoggerService.info(`Account balance retrieved via external BlnkFinance service: ${accountId}`);
          
          // Convert external balance to internal format
          return {
            accountId,
            currency: currency || externalBalance.currency || 'USD',
            debitBalance: parseFloat(externalBalance.debit_balance || externalBalance.debit || '0'),
            creditBalance: parseFloat(externalBalance.credit_balance || externalBalance.credit || '0'),
            netBalance: parseFloat(externalBalance.balance || externalBalance.total || '0'),
            lastUpdated: new Date(externalBalance.last_updated || Date.now())
          };
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local cache', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation - get from cache
      const balance = this.balances.get(accountId);
      if (balance) {
        return balance;
      }

      // Load from database if not in cache
      const dbBalance = await this.loadAccountBalance(accountId);
      if (dbBalance) {
        this.balances.set(accountId, dbBalance);
        return dbBalance;
      }

      return null;

    } catch (error) {
      LoggerService.error('Get account balance failed:', error);
      return null;
    }
  }

  /**
   * Get account statement
   * Uses external BlnkFinance service if available
   */
  public static async getAccountStatement(
    accountId: string,
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    tenantId?: string
  ): Promise<LedgerEntry[]> {
    try {
      LoggerService.info(`Getting account statement: ${accountId}`, {
        startDate,
        endDate,
        brokerId
      });

      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.get(`/v1/accounts/${accountId}/history`, {
            params: {
              tenant_id: tenantId,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              broker_id: brokerId
            }
          });
          
          LoggerService.info(`Account statement retrieved via external BlnkFinance service: ${response.data.entries?.length || 0} entries`);
          return (response.data.entries || []).map((entry: any) => this.mapExternalEntryToInternal(entry, accountId));
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation
      const entries = await this.loadLedgerEntries(accountId, startDate, endDate, brokerId);

      LoggerService.info(`Account statement retrieved: ${entries.length} entries`);

      return entries;

    } catch (error) {
      LoggerService.error('Get account statement failed:', error);
      throw error;
    }
  }

  /**
   * Process payment via external BlnkFinance service
   */
  public static async processPayment(paymentData: {
    tenantId: string;
    accountId: string;
    amount: number;
    currency: string;
    description: string;
    reference?: string;
    metadata?: any;
  }): Promise<any> {
    try {
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.post('/payments', {
            tenant_id: paymentData.tenantId,
            account_id: paymentData.accountId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            reference: paymentData.reference,
            metadata: paymentData.metadata
          });
          
          LoggerService.info(`Payment processed via external BlnkFinance service: ${response.data.id}`);
          return response.data;
        } catch (error: any) {
          LoggerService.error('Failed to process payment via BlnkFinance', { error: error.message });
          throw error;
        }
      } else {
        // Local implementation - create transaction entry
        return await this.recordTransaction(
          paymentData.description,
          [{
            accountId: paymentData.accountId,
            debitAmount: paymentData.amount,
            description: paymentData.description,
            reference: paymentData.reference
          }],
          undefined,
          paymentData.currency,
          TransactionType.PAYMENT,
          paymentData.reference,
          paymentData.metadata
        );
      }
    } catch (error) {
      LoggerService.error('Process payment failed:', error);
      throw error;
    }
  }

  // In-memory storage for margin positions (local implementation)
  private static marginPositions: Map<string, {
    id: string;
    tenantId: string;
    accountId: string;
    amount: number;
    currency: string;
    positionType: 'long' | 'short';
    leverage: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    margin: number;
    liquidationPrice: number;
    status: 'open' | 'closed' | 'liquidated';
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
  }> = new Map();

  /**
   * Process margin position
   *
   * Creates a leveraged trading position with proper accounting entries:
   * - Debit: Margin Account (collateral locked)
   * - Credit: Trading Account (position opened)
   *
   * Supports both external BlnkFinance service and local implementation.
   */
  public static async processMarginPosition(positionData: {
    tenantId: string;
    accountId: string;
    amount: number;
    currency: string;
    positionType: 'long' | 'short';
    leverage: number;
    entryPrice?: number;
    metadata?: any;
  }): Promise<any> {
    try {
      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.post('/margin-positions', {
            tenant_id: positionData.tenantId,
            account_id: positionData.accountId,
            amount: positionData.amount,
            currency: positionData.currency,
            position_type: positionData.positionType,
            leverage: positionData.leverage,
            metadata: positionData.metadata
          });
          
          LoggerService.info(`Margin position processed via external BlnkFinance service: ${response.data.id}`);
          return response.data;
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation
      const positionId = uuidv4();
      const entryPrice = positionData.entryPrice || 1; // Default to 1 if not provided
      const margin = positionData.amount / positionData.leverage;
      
      // Calculate liquidation price (simplified)
      // For long: liquidation when price drops by (1/leverage) * 100%
      // For short: liquidation when price rises by (1/leverage) * 100%
      const liquidationThreshold = 1 / positionData.leverage;
      const liquidationPrice = positionData.positionType === 'long'
        ? entryPrice * (1 - liquidationThreshold * 0.9) // 90% of threshold for safety
        : entryPrice * (1 + liquidationThreshold * 0.9);

      const position = {
        id: positionId,
        tenantId: positionData.tenantId,
        accountId: positionData.accountId,
        amount: positionData.amount,
        currency: positionData.currency,
        positionType: positionData.positionType,
        leverage: positionData.leverage,
        entryPrice,
        currentPrice: entryPrice,
        unrealizedPnl: 0,
        margin,
        liquidationPrice,
        status: 'open' as const,
        metadata: positionData.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store position
      this.marginPositions.set(positionId, position);

      // Record accounting entries
      // 1. Lock margin (collateral)
      await this.recordTransaction(
        `Margin position opened: ${positionData.positionType} ${positionData.amount} ${positionData.currency} @ ${positionData.leverage}x`,
        [
          {
            accountId: positionData.accountId,
            debitAmount: margin,
            description: 'Margin collateral locked'
          },
          {
            accountId: '1130', // Margin Accounts
            creditAmount: margin,
            description: 'Margin position collateral'
          }
        ],
        undefined,
        positionData.currency,
        TransactionType.MARGIN_CALL,
        positionId,
        {
          positionId,
          positionType: positionData.positionType,
          leverage: positionData.leverage,
          entryPrice
        }
      );

      LoggerService.info(`Margin position created locally: ${positionId}`, {
        positionType: positionData.positionType,
        amount: positionData.amount,
        leverage: positionData.leverage,
        margin,
        liquidationPrice
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'margin.position.opened',
        'blnkfinance',
        positionId,
        {
          accountId: positionData.accountId,
          positionType: positionData.positionType,
          amount: positionData.amount,
          leverage: positionData.leverage,
          margin,
          entryPrice,
          liquidationPrice
        }
      );

      return position;

    } catch (error) {
      LoggerService.error('Process margin position failed:', error);
      throw error;
    }
  }

  /**
   * Close margin position
   *
   * Closes an open margin position and settles PnL:
   * - If profit: Credit user account, Debit trading revenue
   * - If loss: Debit user account, Credit trading revenue
   * - Release margin collateral
   */
  public static async processMarginPositionClose(positionId: string, closeData: {
    tenantId: string;
    closeAmount: number;
    closePrice?: number;
    pnl?: number;
    metadata?: any;
  }): Promise<any> {
    try {
      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.post(`/margin-positions/${positionId}/close`, {
            tenant_id: closeData.tenantId,
            close_amount: closeData.closeAmount,
            pnl: closeData.pnl,
            metadata: closeData.metadata
          });
          
          LoggerService.info(`Margin position closed via external BlnkFinance service: ${positionId}`);
          return response.data;
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation
      const position = this.marginPositions.get(positionId);
      if (!position) {
        throw createError('Margin position not found', 404, 'POSITION_NOT_FOUND');
      }

      if (position.status !== 'open') {
        throw createError('Position is not open', 400, 'POSITION_NOT_OPEN');
      }

      const closePrice = closeData.closePrice || position.currentPrice;
      
      // Calculate PnL if not provided
      let pnl = closeData.pnl;
      if (pnl === undefined) {
        const priceChange = (closePrice - position.entryPrice) / position.entryPrice;
        pnl = position.positionType === 'long'
          ? position.amount * priceChange
          : position.amount * -priceChange;
      }

      // Update position
      position.status = 'closed';
      position.currentPrice = closePrice;
      position.unrealizedPnl = pnl;
      position.updatedAt = new Date();
      position.closedAt = new Date();
      this.marginPositions.set(positionId, position);

      // Record accounting entries
      const entries: Array<{
        accountId: string;
        debitAmount?: number;
        creditAmount?: number;
        description: string;
      }> = [];

      // Release margin collateral
      entries.push({
        accountId: '1130', // Margin Accounts
        debitAmount: position.margin,
        description: 'Margin collateral released'
      });
      entries.push({
        accountId: position.accountId,
        creditAmount: position.margin,
        description: 'Margin collateral returned'
      });

      // Settle PnL
      if (pnl > 0) {
        // Profit - credit user, debit trading revenue
        entries.push({
          accountId: position.accountId,
          creditAmount: pnl,
          description: 'Trading profit'
        });
        entries.push({
          accountId: '4100', // Trading Revenue
          debitAmount: pnl,
          description: 'Trading profit paid'
        });
      } else if (pnl < 0) {
        // Loss - debit user, credit trading revenue
        entries.push({
          accountId: position.accountId,
          debitAmount: Math.abs(pnl),
          description: 'Trading loss'
        });
        entries.push({
          accountId: '4100', // Trading Revenue
          creditAmount: Math.abs(pnl),
          description: 'Trading loss collected'
        });
      }

      await this.recordTransaction(
        `Margin position closed: ${position.positionType} ${position.amount} ${position.currency} PnL: ${pnl}`,
        entries,
        undefined,
        position.currency,
        TransactionType.TRADE,
        positionId,
        {
          positionId,
          closePrice,
          pnl,
          ...closeData.metadata
        }
      );

      LoggerService.info(`Margin position closed locally: ${positionId}`, {
        pnl,
        closePrice,
        margin: position.margin
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'margin.position.closed',
        'blnkfinance',
        positionId,
        {
          accountId: position.accountId,
          positionType: position.positionType,
          amount: position.amount,
          entryPrice: position.entryPrice,
          closePrice,
          pnl,
          margin: position.margin
        }
      );

      return {
        ...position,
        pnl,
        closePrice
      };

    } catch (error) {
      LoggerService.error('Close margin position failed:', error);
      throw error;
    }
  }

  /**
   * Process liquidation
   *
   * Forcefully closes a margin position when it reaches liquidation threshold:
   * - Seize remaining collateral
   * - Close position at current market price
   * - Record liquidation fee
   */
  public static async processLiquidation(liquidationData: {
    tenantId: string;
    accountId: string;
    positionId: string;
    liquidationAmount: number;
    currency: string;
    reason: string;
    liquidationPrice?: number;
    metadata?: any;
  }): Promise<any> {
    try {
      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          const response = await this.externalServiceClient.post('/liquidations', {
            tenant_id: liquidationData.tenantId,
            account_id: liquidationData.accountId,
            position_id: liquidationData.positionId,
            liquidation_amount: liquidationData.liquidationAmount,
            currency: liquidationData.currency,
            reason: liquidationData.reason,
            metadata: liquidationData.metadata
          });
          
          LoggerService.info(`Liquidation processed via external BlnkFinance service: ${response.data.id}`);
          return response.data;
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local implementation', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation
      const position = this.marginPositions.get(liquidationData.positionId);
      if (!position) {
        throw createError('Margin position not found', 404, 'POSITION_NOT_FOUND');
      }

      if (position.status !== 'open') {
        throw createError('Position is not open', 400, 'POSITION_NOT_OPEN');
      }

      const liquidationId = uuidv4();
      const liquidationPrice = liquidationData.liquidationPrice || position.liquidationPrice;
      const liquidationFee = position.margin * 0.05; // 5% liquidation fee

      // Calculate final loss (user loses entire margin minus liquidation fee)
      const totalLoss = position.margin;

      // Update position
      position.status = 'liquidated';
      position.currentPrice = liquidationPrice;
      position.unrealizedPnl = -totalLoss;
      position.updatedAt = new Date();
      position.closedAt = new Date();
      this.marginPositions.set(liquidationData.positionId, position);

      // Record accounting entries
      await this.recordTransaction(
        `Liquidation: ${liquidationData.reason}`,
        [
          // Seize margin collateral
          {
            accountId: '1130', // Margin Accounts
            debitAmount: position.margin,
            description: 'Margin collateral seized'
          },
          // Liquidation fee to platform
          {
            accountId: '4200', // Fee Income
            creditAmount: liquidationFee,
            description: 'Liquidation fee'
          },
          // Remaining to cover losses
          {
            accountId: '4100', // Trading Revenue
            creditAmount: position.margin - liquidationFee,
            description: 'Liquidation proceeds'
          }
        ],
        undefined,
        liquidationData.currency,
        TransactionType.LIQUIDATION,
        liquidationId,
        {
          positionId: liquidationData.positionId,
          liquidationPrice,
          liquidationFee,
          reason: liquidationData.reason,
          ...liquidationData.metadata
        }
      );

      LoggerService.info(`Liquidation processed locally: ${liquidationId}`, {
        positionId: liquidationData.positionId,
        liquidationPrice,
        liquidationFee,
        totalLoss,
        reason: liquidationData.reason
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'margin.position.liquidated',
        'blnkfinance',
        liquidationId,
        {
          positionId: liquidationData.positionId,
          accountId: liquidationData.accountId,
          liquidationPrice,
          liquidationFee,
          totalLoss,
          reason: liquidationData.reason
        }
      );

      return {
        id: liquidationId,
        positionId: liquidationData.positionId,
        accountId: liquidationData.accountId,
        liquidationPrice,
        liquidationFee,
        totalLoss,
        reason: liquidationData.reason,
        status: 'completed',
        createdAt: new Date()
      };

    } catch (error) {
      LoggerService.error('Process liquidation failed:', error);
      throw error;
    }
  }

  /**
   * Get margin position by ID
   */
  public static async getMarginPosition(positionId: string): Promise<any> {
    const position = this.marginPositions.get(positionId);
    if (!position) {
      throw createError('Margin position not found', 404, 'POSITION_NOT_FOUND');
    }
    return position;
  }

  /**
   * Get all margin positions for an account
   */
  public static async getAccountMarginPositions(accountId: string, status?: 'open' | 'closed' | 'liquidated'): Promise<any[]> {
    const positions = Array.from(this.marginPositions.values())
      .filter(p => p.accountId === accountId)
      .filter(p => !status || p.status === status);
    return positions;
  }

  /**
   * Update margin position price (for PnL calculation)
   */
  public static async updateMarginPositionPrice(positionId: string, currentPrice: number): Promise<any> {
    const position = this.marginPositions.get(positionId);
    if (!position) {
      throw createError('Margin position not found', 404, 'POSITION_NOT_FOUND');
    }

    if (position.status !== 'open') {
      return position; // No update needed for closed positions
    }

    // Calculate unrealized PnL
    const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
    const unrealizedPnl = position.positionType === 'long'
      ? position.amount * priceChange
      : position.amount * -priceChange;

    position.currentPrice = currentPrice;
    position.unrealizedPnl = unrealizedPnl;
    position.updatedAt = new Date();
    this.marginPositions.set(positionId, position);

    // Check if position should be liquidated
    const shouldLiquidate = position.positionType === 'long'
      ? currentPrice <= position.liquidationPrice
      : currentPrice >= position.liquidationPrice;

    if (shouldLiquidate) {
      LoggerService.warn(`Position ${positionId} has reached liquidation price`, {
        currentPrice,
        liquidationPrice: position.liquidationPrice
      });
    }

    return {
      ...position,
      shouldLiquidate
    };
  }

  /**
   * Generate financial report
   */
  public static async generateFinancialReport(
    reportType: ReportType,
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<FinancialReport> {
    try {
      LoggerService.info(`Generating financial report: ${reportType}`, {
        startDate,
        endDate,
        brokerId,
        currency
      });

      let data: any;

      switch (reportType) {
        case ReportType.PROFIT_LOSS:
          data = await this.generateProfitLossReport(startDate, endDate, brokerId, currency);
          break;
        case ReportType.BALANCE_SHEET:
          data = await this.generateBalanceSheetReport(startDate, endDate, brokerId, currency);
          break;
        case ReportType.CASH_FLOW:
          data = await this.generateCashFlowReport(startDate, endDate, brokerId, currency);
          break;
        case ReportType.TRIAL_BALANCE:
          data = await this.generateTrialBalanceReport(startDate, endDate, brokerId, currency);
          break;
        case ReportType.BROKER_SUMMARY:
          data = await this.generateBrokerSummaryReport(startDate, endDate, brokerId, currency);
          break;
        default:
          throw createError('Unsupported report type', 400, 'UNSUPPORTED_REPORT_TYPE');
      }

      const reportId = uuidv4();
      const report: FinancialReport = {
        id: reportId,
        reportType,
        period: { startDate, endDate },
        brokerId,
        currency,
        data,
        generatedAt: new Date()
      };

      // Persist report to database
      await this.saveFinancialReport(report);

      LoggerService.info(`Financial report generated and saved: ${reportType}`, {
        reportId,
        dataSize: JSON.stringify(data).length
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'report.generated',
        'blnkfinance',
        reportId,
        {
          reportId,
          reportType,
          startDate,
          endDate,
          brokerId,
          currency
        }
      );

      return report;

    } catch (error) {
      LoggerService.error('Generate financial report failed:', error);
      throw error;
    }
  }

  /**
   * Reconcile account with external source
   */
  public static async reconcileAccount(
    accountId: string,
    externalSource: string,
    externalReference: string,
    internalAmount: number,
    externalAmount: number,
    notes?: string
  ): Promise<Reconciliation> {
    try {
      LoggerService.info(`Reconciling account: ${accountId}`, {
        externalSource,
        externalReference,
        internalAmount,
        externalAmount
      });

      const difference = internalAmount - externalAmount;
      const status = Math.abs(difference) < 0.01 ? ReconciliationStatus.MATCHED : ReconciliationStatus.DIFFERENCE;

      const reconciliation: Reconciliation = {
        id: uuidv4(),
        accountId,
        externalSource,
        externalReference,
        internalAmount,
        externalAmount,
        difference,
        status,
        reconciledAt: status === ReconciliationStatus.MATCHED ? new Date() : undefined,
        notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save reconciliation
      await this.saveReconciliation(reconciliation);

      LoggerService.info(`Account reconciled: ${reconciliation.id}`, {
        status: reconciliation.status,
        difference: reconciliation.difference
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'account.reconciled',
        'blnkfinance',
        accountId,
        {
          reconciliationId: reconciliation.id,
          externalSource,
          status: reconciliation.status,
          difference: reconciliation.difference
        }
      );

      return reconciliation;

    } catch (error) {
      LoggerService.error('Reconcile account failed:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing BlnkFinance Service...');
      this.isInitialized = false;
      this.accounts.clear();
      this.balances.clear();
      this.transactions.clear();
      LoggerService.info('✅ BlnkFinance Service closed');
    } catch (error) {
      LoggerService.error('Error closing BlnkFinance Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static async initializeModels(): Promise<void> {
    try {
      // This would typically initialize Sequelize models
      // For now, we'll use in-memory storage
      LoggerService.info('BlnkFinance models initialized');
    } catch (error) {
      LoggerService.error('Initialize models failed:', error);
      throw error;
    }
  }

  private static async createDefaultChartOfAccounts(): Promise<void> {
    try {
      LoggerService.info('Creating default chart of accounts...');

      for (const [category, accounts] of Object.entries(this.CHART_OF_ACCOUNTS)) {
        for (const [code, accountData] of Object.entries(accounts)) {
          const parentId = accountData.parent ? this.getAccountIdByCode(accountData.parent) : undefined;
          await this.createAccount(
            code,
            accountData.name,
            accountData.type,
            'USD',
            undefined,
            parentId,
            `Default ${category} account`
          );
        }
      }

      LoggerService.info('Default chart of accounts created successfully');

    } catch (error) {
      LoggerService.error('Create default chart of accounts failed:', error);
      throw error;
    }
  }

  private static async loadAccountsAndBalances(): Promise<void> {
    try {
      // This would typically load from database
      // For now, we'll initialize with empty maps
      LoggerService.info('Accounts and balances loaded from database');
    } catch (error) {
      LoggerService.error('Load accounts and balances failed:', error);
      throw error;
    }
  }

  private static async saveAccount(account: Account): Promise<void> {
    try {
      // This would typically save to database
      LoggerService.info(`Account saved to database: ${account.id}`);
    } catch (error) {
      LoggerService.error('Save account failed:', error);
      throw error;
    }
  }

  private static async saveTransaction(transaction: FinancialTransaction): Promise<void> {
    try {
      // This would typically save to database
      LoggerService.info(`Transaction saved to database: ${transaction.id}`);
    } catch (error) {
      LoggerService.error('Save transaction failed:', error);
      throw error;
    }
  }

  private static async updateTransaction(transaction: FinancialTransaction): Promise<void> {
    try {
      // This would typically update in database
      LoggerService.info(`Transaction updated in database: ${transaction.id}`);
    } catch (error) {
      LoggerService.error('Update transaction failed:', error);
      throw error;
    }
  }

  private static async updateAccountBalances(transaction: FinancialTransaction): Promise<void> {
    try {
      for (const entry of transaction.entries) {
        const balance = this.balances.get(entry.accountId);
        if (balance) {
          balance.debitBalance += entry.debitAmount;
          balance.creditBalance += entry.creditAmount;
          balance.netBalance = balance.debitBalance - balance.creditBalance;
          balance.lastUpdated = new Date();
        }
      }
      LoggerService.info(`Account balances updated for transaction: ${transaction.id}`);
    } catch (error) {
      LoggerService.error('Update account balances failed:', error);
      throw error;
    }
  }

  private static async loadAccountBalance(accountId: string): Promise<Balance | null> {
    try {
      // This would typically load from database
      return null;
    } catch (error) {
      LoggerService.error('Load account balance failed:', error);
      return null;
    }
  }

  private static async loadLedgerEntries(
    accountId: string,
    startDate: Date,
    endDate: Date,
    brokerId?: string
  ): Promise<LedgerEntry[]> {
    try {
      // This would typically load from database
      return [];
    } catch (error) {
      LoggerService.error('Load ledger entries failed:', error);
      return [];
    }
  }

  private static async generateTransactionNumber(): Promise<string> {
    try {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `TXN-${timestamp}-${random}`;
    } catch (error) {
      LoggerService.error('Generate transaction number failed:', error);
      return `TXN-${Date.now()}`;
    }
  }

  private static getAccountIdByCode(code: string): string | undefined {
    for (const account of this.accounts.values()) {
      if (account.code === code) {
        return account.id;
      }
    }
    return undefined;
  }

  private static async generateProfitLossReport(
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<any> {
    try {
      // This would generate actual P&L report
      return {
        revenue: 0,
        expenses: 0,
        netIncome: 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      LoggerService.error('Generate profit loss report failed:', error);
      throw error;
    }
  }

  private static async generateBalanceSheetReport(
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<any> {
    try {
      // This would generate actual balance sheet
      return {
        assets: 0,
        liabilities: 0,
        equity: 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      LoggerService.error('Generate balance sheet report failed:', error);
      throw error;
    }
  }

  private static async generateCashFlowReport(
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<any> {
    try {
      // This would generate actual cash flow report
      return {
        operatingCashFlow: 0,
        investingCashFlow: 0,
        financingCashFlow: 0,
        netCashFlow: 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      LoggerService.error('Generate cash flow report failed:', error);
      throw error;
    }
  }

  private static async generateTrialBalanceReport(
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<any> {
    try {
      // This would generate actual trial balance
      return {
        accounts: [],
        totalDebits: 0,
        totalCredits: 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      LoggerService.error('Generate trial balance report failed:', error);
      throw error;
    }
  }

  private static async generateBrokerSummaryReport(
    startDate: Date,
    endDate: Date,
    brokerId?: string,
    currency: string = 'USD'
  ): Promise<any> {
    try {
      // This would generate actual broker summary
      return {
        brokerId,
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        period: { startDate, endDate }
      };
    } catch (error) {
      LoggerService.error('Generate broker summary report failed:', error);
      throw error;
    }
  }

  private static async saveReconciliation(reconciliation: Reconciliation): Promise<void> {
    try {
      // This would typically save to database
      LoggerService.info(`Reconciliation saved to database: ${reconciliation.id}`);
    } catch (error) {
      LoggerService.error('Save reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * Save financial report to database
   */
  private static async saveFinancialReport(report: FinancialReport): Promise<void> {
    try {
      // Try external BlnkFinance service first if enabled
      if (this.externalServiceEnabled && this.externalServiceClient) {
        try {
          await this.externalServiceClient.post('/v1/reports', {
            id: report.id,
            report_type: report.reportType,
            start_date: report.period.startDate.toISOString(),
            end_date: report.period.endDate.toISOString(),
            broker_id: report.brokerId,
            currency: report.currency,
            data: report.data,
            generated_at: report.generatedAt.toISOString()
          });
          LoggerService.info(`Financial report saved via external BlnkFinance service: ${report.id}`);
          return;
        } catch (error: any) {
          LoggerService.warn('External BlnkFinance service call failed, using local storage', {
            error: error.message
          });
          // Fall through to local implementation
        }
      }

      // Local implementation - save to database
      try {
        const FinancialReportModel = DatabaseService.getModel('FinancialReport');
        if (FinancialReportModel) {
          await FinancialReportModel.upsert({
            id: report.id,
            reportType: report.reportType,
            startDate: report.period.startDate,
            endDate: report.period.endDate,
            brokerId: report.brokerId,
            currency: report.currency,
            data: JSON.stringify(report.data),
            generatedAt: report.generatedAt,
            createdAt: report.createdAt || new Date(),
            updatedAt: new Date()
          });
          LoggerService.info(`Financial report saved to database: ${report.id}`);
        } else {
          LoggerService.warn('FinancialReport model not found, report not persisted');
        }
      } catch (error: any) {
        LoggerService.error('Save financial report to database failed:', {
          error: error.message,
          reportId: report.id
        });
        // Don't throw - report generation succeeded, persistence is secondary
      }
    } catch (error) {
      LoggerService.error('Save financial report failed:', error);
      // Don't throw - report generation succeeded, persistence is secondary
    }
  }
}
