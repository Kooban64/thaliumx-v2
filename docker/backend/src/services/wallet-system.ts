/**
 * Comprehensive Wallet System Service
 * 
 * ARCHITECTURE OVERVIEW:
 * - Multi-tier wallet system (Platform → Broker → User)
 * - FIAT wallets with unique reference system
 * - Crypto hot wallets (non-custodial with MFA recovery)
 * - Integration with native CEX (Dingir + Liquibook)
 * - THAL token promotion and business model
 * - Nedbank pool account system
 * 
 * Features:
 * - Unique reference generation (THAL-JD-8F2K format)
 * - FIAT → USDT conversion with bulk liquidity management
 * - Hot wallet portability with secure MFA recovery
 * - Native CEX integration with liquidity incentives
 * - THAL token rewards and fee discounts
 * - Complete audit trails and compliance
 */

import { Sequelize } from 'sequelize';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { BlnkFinanceService } from './blnkfinance';
import { QuantLibService } from './quantlib';

// ==================== CORE INTERFACES ====================

export interface Wallet {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  walletType: 'fiat' | 'crypto_hot' | 'crypto_cold' | 'thal_token' | 'trading';
  currency: string;
  address?: string; // For crypto wallets
  accountId?: string; // For FIAT wallets (BlnkFinance)
  status: 'active' | 'suspended' | 'pending' | 'closed' | 'recovery';
  balance: string;
  metadata: {
    provider?: string; // For external wallets
    network?: string; // For EVM wallets
    derivationPath?: string; // For HD wallets
    publicKey?: string;
    encryptedPrivateKey?: string; // Encrypted for hot wallets
    recoveryPhrase?: string; // Encrypted recovery phrase
    mfaEnabled: boolean;
    lastBackup?: Date;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    lots?: Array<{
      amount: number;        // For crypto (e.g., USDT)
      costZAR: number;       // Cost basis in ZAR
      acquiredAt: Date;
    }>;
  };
  security: {
    accessCount: number;
    lastAccessed?: Date;
    accessLog: Array<{
      accessedAt: Date;
      ipAddress: string;
      userAgent: string;
      action: string;
    }>;
    fraudIndicators: string[];
  };
}

export interface UniqueReference {
  id: string;
  reference: string; // Format: THAL-JD-8F2K (broker-user-random)
  referenceType: 'fiat_deposit' | 'crypto_deposit' | 'withdrawal' | 'transfer';
  brokerCode: string; // 4-char broker code (THAL, BROK, etc.)
  userInitials: string; // 2-char user initials (JD)
  randomSuffix: string; // 4-char random (8F2K)
  userId: string;
  tenantId: string;
  brokerId: string;
  currency: string;
  expectedAmount?: string;
  actualAmount?: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  isPersistent?: boolean;
  expiresAt: Date;
  usedAt?: Date;
  metadata: {
    createdVia: 'auto_generated' | 'manual' | 'api';
    ipAddress?: string;
    userAgent?: string;
    riskScore: number;
    complianceFlags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolAccount {
  id: string;
  brokerId: string;
  accountType: 'platform' | 'broker';
  bankAccountNumber: string;
  bankReference: string;
  currency: string;
  balance: string;
  availableBalance: string;
  pendingDeposits: string;
  metadata: {
    bankName: string;
    accountHolder: string;
    swiftCode?: string;
    iban?: string;
    lastReconciliation?: Date;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface CEXOrder {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  tradingPair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: string;
  price?: string;
  stopPrice?: string;
  status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: string;
  averagePrice: string;
  fees: string;
  thalRewards: string; // THAL tokens earned
  engine: 'dingir' | 'liquibook' | 'hybrid';
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
  };
}

export interface THALReward {
  id: string;
  userId: string;
  brokerId: string;
  rewardType: 'trading_fee_discount' | 'volume_bonus' | 'liquidity_provider' | 'referral';
  amount: string;
  currency: string; // Always THAL
  status: 'pending' | 'credited' | 'expired';
  expiresAt?: Date;
  metadata: {
    sourceOrderId?: string;
    sourceTransactionId?: string;
    multiplier: number;
    createdAt: Date;
  };
}

export class WalletSystemService {
  private db: Sequelize;
  private eventStreamingService: EventStreamingService;
  private blnkfinanceService: BlnkFinanceService;
  private quantlibService: QuantLibService;
  
  // Wallet management
  private wallets: Map<string, Wallet> = new Map();
  private references: Map<string, UniqueReference> = new Map();
  private poolAccounts: Map<string, PoolAccount> = new Map();
  
  // CEX integration
  private cexOrders: Map<string, CEXOrder> = new Map();
  private thalRewards: Map<string, THALReward> = new Map();
  private transactionsLog: Array<{
    date: Date;
    userId: string;
    walletId: string;
    type: 'deposit' | 'conversion' | 'withdrawal';
    reference?: string;
    description?: string;
    amount: number;
    currency: string;
    balanceAfter: number;
    fees?: number;
    taxes?: number;
    fxSpread?: number;
    proceedsZAR?: number;
    costZAR?: number;
    taxableGainZAR?: number;
  }> = [];

  // ==================== FIAT ADMIN (UNALLOCATED & MULTI-SIG) ====================
  private unallocatedDeposits: Map<string, {
    id: string;
    brokerId?: string;
    poolAccountNumber?: string;
    amount: string;
    currency: string;
    bankReference?: string;
    customerReference?: string;
    valueDate: string;
    status: 'unallocated' | 'proposed' | 'allocated' | 'rejected';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }> = new Map();

  private allocationProposals: Map<string, {
    id: string;
    depositId: string;
    proposedBy: string; // admin user id
    target: { tenantId: string; brokerId: string; userId: string; currency: string };
    amount: string;
    approvalsRequired: number;
    approvers: string[]; // assigned approvers
    approvals: string[]; // userIds who approved
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    createdAt: Date;
    updatedAt: Date;
  }> = new Map();

  public recordUnallocatedDeposit(dep: { id: string; brokerId?: string; poolAccountNumber?: string; amount: string; currency: string; bankReference?: string; customerReference?: string; valueDate: string; notes?: string }): void {
    this.unallocatedDeposits.set(dep.id, {
      id: dep.id,
      brokerId: dep.brokerId,
      poolAccountNumber: dep.poolAccountNumber,
      amount: dep.amount,
      currency: dep.currency,
      bankReference: dep.bankReference,
      customerReference: dep.customerReference,
      valueDate: dep.valueDate,
      status: 'unallocated',
      notes: dep.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  public listUnallocatedDeposits(filter?: { brokerId?: string; currency?: string; status?: string }) {
    const items = Array.from(this.unallocatedDeposits.values());
    return items.filter(i => (!filter?.brokerId || i.brokerId === filter.brokerId)
      && (!filter?.currency || i.currency === filter.currency)
      && (!filter?.status || i.status === filter.status));
  }

  public createAllocationProposal(params: {
    depositId: string;
    proposedBy: string;
    target: { tenantId: string; brokerId: string; userId: string; currency: string };
    amount: string;
    approvalsRequired: number;
    approvers: string[];
  }) {
    const dep = this.unallocatedDeposits.get(params.depositId);
    if (!dep || dep.status !== 'unallocated') throw new Error('Deposit not available');
    const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
    const prop = {
      id,
      depositId: params.depositId,
      proposedBy: params.proposedBy,
      target: params.target,
      amount: params.amount,
      approvalsRequired: params.approvalsRequired,
      approvers: params.approvers,
      approvals: [],
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.allocationProposals.set(id, prop);
    dep.status = 'proposed';
    dep.updatedAt = new Date();
    return prop;
  }

  public approveAllocationProposal(proposalId: string, approverId: string) {
    const prop = this.allocationProposals.get(proposalId);
    if (!prop) throw new Error('Proposal not found');
    if (!prop.approvers.includes(approverId)) throw new Error('Not an authorized approver');
    if (prop.approvals.includes(approverId)) return prop; // idempotent
    prop.approvals.push(approverId);
    prop.updatedAt = new Date();
    if (prop.approvals.length >= prop.approvalsRequired) {
      prop.status = 'approved';
    }
    return prop;
  }

  public rejectAllocationProposal(proposalId: string, approverId: string, reason?: string) {
    const prop = this.allocationProposals.get(proposalId);
    if (!prop) throw new Error('Proposal not found');
    if (!prop.approvers.includes(approverId)) throw new Error('Not an authorized approver');
    prop.status = 'rejected';
    prop.updatedAt = new Date();
    const dep = this.unallocatedDeposits.get(prop.depositId);
    if (dep) {
      dep.status = 'unallocated';
      dep.updatedAt = new Date();
      dep.notes = reason || dep.notes;
    }
    return prop;
  }

  public async executeAllocation(proposalId: string): Promise<{ success: boolean; depositId: string; walletId?: string }>{
    const prop = this.allocationProposals.get(proposalId);
    if (!prop) throw new Error('Proposal not found');
    if (prop.status !== 'approved') throw new Error('Proposal not approved');
    const dep = this.unallocatedDeposits.get(prop.depositId);
    if (!dep) throw new Error('Deposit not found');

    // Credit target user's FIAT wallet
    const fiatWallet = Array.from(this.wallets.values()).find(w => w.userId === prop.target.userId && w.walletType === 'fiat' && w.currency === prop.target.currency);
    if (!fiatWallet) throw new Error('Target FIAT wallet not found');
    fiatWallet.balance = (parseFloat(fiatWallet.balance) + parseFloat(prop.amount)).toString();
    fiatWallet.metadata.updatedAt = new Date();

    // Update records
    dep.status = 'allocated';
    dep.updatedAt = new Date();
    prop.status = 'executed';
    prop.updatedAt = new Date();

    // Log
    LoggerService.logTransaction(proposalId, 'fiat_admin_allocation', {
      depositId: dep.id,
      amount: prop.amount,
      currency: dep.currency,
      userId: prop.target.userId,
      brokerId: prop.target.brokerId
    });

    return { success: true, depositId: dep.id, walletId: fiatWallet.id };
  }
  
  // Configuration
  private readonly ZAR_TO_USDT_RATE = 18.5; // Example rate
  private readonly THAL_REWARD_RATE = 0.001; // 0.1% of trading volume
  private readonly MIN_THAL_REWARD = '1'; // Minimum 1 THAL
  private readonly MAX_THAL_REWARD = '1000'; // Maximum 1000 THAL per transaction
  // Fee layering (can be moved to ConfigService and broker overrides later)
  private readonly PLATFORM_FEE_RATE = 0.001; // 0.1%
  private readonly BROKER_FEE_RATE = 0.001;   // 0.1%

  constructor(db: Sequelize) {
    this.db = db;
    this.eventStreamingService = new EventStreamingService();
    this.blnkfinanceService = new BlnkFinanceService();
    this.quantlibService = new QuantLibService();
  }

  async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Wallet System Service...');
      await this.loadExistingWallets();
      await this.loadPoolAccounts();
      await this.initializeCEXIntegration();
      LoggerService.info('Wallet System Service initialized successfully');
    } catch (error) {
      LoggerService.error('Failed to initialize Wallet System Service', { error });
      throw error;
    }
  }

  // ==================== WALLET MANAGEMENT ====================

  /**
   * Create comprehensive wallet infrastructure for new user
   */
  async createUserWalletInfrastructure(
    userId: string,
    tenantId: string,
    brokerId: string,
    userInfo: {
      firstName: string;
      lastName: string;
      email: string;
    }
  ): Promise<Wallet[]> {
    try {
      LoggerService.info('Creating wallet infrastructure for user', { userId, tenantId, brokerId });

      const wallets: Wallet[] = [];

      // 1. Create FIAT wallet (linked to BlnkFinance account)
      const fiatWallet = await this.createFiatWallet(userId, tenantId, brokerId, userInfo);
      wallets.push(fiatWallet);

      // 2. Create Crypto Hot wallet (non-custodial with MFA recovery)
      const cryptoHotWallet = await this.createCryptoHotWallet(userId, tenantId, brokerId);
      wallets.push(cryptoHotWallet);

      // 3. Create THAL Token wallet
      const thalWallet = await this.createTHALWallet(userId, tenantId, brokerId);
      wallets.push(thalWallet);

      // 4. Create Trading wallet (for CEX integration)
      const tradingWallet = await this.createTradingWallet(userId, tenantId, brokerId);
      wallets.push(tradingWallet);

      // Store wallets
      wallets.forEach(wallet => {
        this.wallets.set(wallet.id, wallet);
      });

      // Log wallet infrastructure creation
      LoggerService.info('Wallet infrastructure created', {
        userId,
        tenantId,
        brokerId,
        wallets: wallets.map(w => ({ id: w.id, type: w.walletType, currency: w.currency })),
        timestamp: new Date().toISOString()
      });

      LoggerService.info('Wallet infrastructure created successfully', { 
        userId, 
        walletCount: wallets.length,
        walletTypes: wallets.map(w => w.walletType)
      });

      return wallets;

    } catch (error) {
      LoggerService.error('Failed to create wallet infrastructure', { error, userId });
      throw error;
    }
  }

  /**
   * Create FIAT wallet with BlnkFinance integration
   */
  private async createFiatWallet(
    userId: string,
    tenantId: string,
    brokerId: string,
    userInfo: { firstName: string; lastName: string; email: string }
  ): Promise<Wallet> {
    try {
      // Create mock ledger account for FIAT (simplified)
      const ledgerAccount = {
        id: `ledger_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        accountType: 'fiat',
        currency: 'ZAR',
        accountName: `${userInfo.firstName} ${userInfo.lastName} - FIAT Wallet`
      };

      const wallet: Wallet = {
        id: `fiat_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        walletType: 'fiat',
        currency: 'ZAR',
        accountId: ledgerAccount.id,
        status: 'active',
        balance: '0',
        metadata: {
          mfaEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        },
        security: {
          accessCount: 0,
          accessLog: [],
          fraudIndicators: []
        }
      };

      LoggerService.info('FIAT wallet created', { 
        walletId: wallet.id, 
        userId, 
        accountId: ledgerAccount.id 
      });

      return wallet;

    } catch (error) {
      LoggerService.error('Failed to create FIAT wallet', { error, userId });
      throw error;
    }
  }

  /**
   * Create Crypto Hot wallet (non-custodial with MFA recovery)
   */
  private async createCryptoHotWallet(
    userId: string,
    tenantId: string,
    brokerId: string
  ): Promise<Wallet> {
    try {
      // Generate HD wallet
      const wallet = ethers.Wallet.createRandom();
      const mnemonic = wallet.mnemonic;
      
      if (!mnemonic) {
        throw new Error('Failed to generate wallet mnemonic');
      }
      
      // Encrypt private key and recovery phrase
      const encryptedPrivateKey = this.encryptData(wallet.privateKey);
      const encryptedRecoveryPhrase = this.encryptData(mnemonic.phrase);

      const cryptoWallet: Wallet = {
        id: `crypto_hot_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        walletType: 'crypto_hot',
        currency: 'USDT',
        address: wallet.address,
        status: 'active',
        balance: '0',
        metadata: {
          network: 'ethereum',
          derivationPath: 'm/44\'/60\'/0\'/0/0',
          publicKey: wallet.publicKey,
          encryptedPrivateKey,
          recoveryPhrase: encryptedRecoveryPhrase,
          mfaEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        },
        security: {
          accessCount: 0,
          accessLog: [],
          fraudIndicators: []
        }
      };

      LoggerService.info('Crypto hot wallet created', { 
        walletId: cryptoWallet.id, 
        userId, 
        address: wallet.address 
      });

      return cryptoWallet;

    } catch (error) {
      LoggerService.error('Failed to create crypto hot wallet', { error, userId });
      throw error;
    }
  }

  /**
   * Create THAL Token wallet
   */
  private async createTHALWallet(
    userId: string,
    tenantId: string,
    brokerId: string
  ): Promise<Wallet> {
    try {
      const thalWallet: Wallet = {
        id: `thal_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        walletType: 'thal_token',
        currency: 'THAL',
        status: 'active',
        balance: '0',
        metadata: {
          mfaEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        },
        security: {
          accessCount: 0,
          accessLog: [],
          fraudIndicators: []
        }
      };

      LoggerService.info('THAL wallet created', { 
        walletId: thalWallet.id, 
        userId 
      });

      return thalWallet;

    } catch (error) {
      LoggerService.error('Failed to create THAL wallet', { error, userId });
      throw error;
    }
  }

  /**
   * Create Trading wallet for CEX integration
   */
  private async createTradingWallet(
    userId: string,
    tenantId: string,
    brokerId: string
  ): Promise<Wallet> {
    try {
      const tradingWallet: Wallet = {
        id: `trading_${userId}_${Date.now()}`,
        userId,
        tenantId,
        brokerId,
        walletType: 'trading',
        currency: 'MULTI', // Multi-currency trading wallet
        status: 'active',
        balance: '0',
        metadata: {
          mfaEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        },
        security: {
          accessCount: 0,
          accessLog: [],
          fraudIndicators: []
        }
      };

      LoggerService.info('Trading wallet created', { 
        walletId: tradingWallet.id, 
        userId 
      });

      return tradingWallet;

    } catch (error) {
      LoggerService.error('Failed to create trading wallet', { error, userId });
      throw error;
    }
  }

  // ==================== UNIQUE REFERENCE SYSTEM ====================

  /**
   * Generate unique reference for FIAT deposits
   */
  async generateUniqueReference(
    userId: string,
    tenantId: string,
    brokerId: string,
    referenceType: UniqueReference['referenceType'],
    currency: string,
    expectedAmount?: string
  ): Promise<UniqueReference> {
    try {
      // Get broker code
      const brokerCode = await this.getBrokerCode(brokerId);
      
      // Get user initials
      const userInitials = await this.getUserInitials(userId);
      
      // Generate random suffix
      const randomSuffix = this.generateRandomSuffix();
      
      // Create reference string (alphanumeric only, no separators)
      const reference = `${brokerCode}${userInitials}${randomSuffix}`.toUpperCase();
      
      // Ensure uniqueness
      await this.ensureReferenceUniqueness(reference);

      const uniqueRef: UniqueReference = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        reference,
        referenceType,
        brokerCode,
        userInitials,
        randomSuffix,
        userId,
        tenantId,
        brokerId,
        currency,
        expectedAmount,
        status: 'active',
        isPersistent: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {
          createdVia: 'auto_generated',
          riskScore: 0,
          complianceFlags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.references.set(uniqueRef.id, uniqueRef);

      LoggerService.info('Unique reference generated', {
        reference,
        userId,
        brokerId,
        referenceType,
        currency
      });

      return uniqueRef;

    } catch (error) {
      LoggerService.error('Failed to generate unique reference', { error, userId });
      throw error;
    }
  }

  /**
   * Get or create a persistent alphanumeric reference per (userId, brokerId, currency)
   */
  async getOrCreatePersistentReference(
    userId: string,
    tenantId: string,
    brokerId: string,
    currency: string
  ): Promise<UniqueReference> {
    const existing = Array.from(this.references.values()).find(r =>
      r.userId === userId && r.tenantId === tenantId && r.brokerId === brokerId &&
      r.currency === currency && r.isPersistent === true && r.status === 'active'
    );
    if (existing) return existing;

    const brokerCode = await this.getBrokerCode(brokerId);
    const userInitials = await this.getUserInitials(userId);
    const randomSuffix = this.generateRandomSuffix();
    const reference = `${brokerCode}${userInitials}${randomSuffix}`.toUpperCase();
    await this.ensureReferenceUniqueness(reference);

    const ref: UniqueReference = {
      id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reference,
      referenceType: 'fiat_deposit',
      brokerCode,
      userInitials,
      randomSuffix,
      userId,
      tenantId,
      brokerId,
      currency,
      status: 'active',
      isPersistent: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      metadata: {
        createdVia: 'auto_generated',
        riskScore: 0,
        complianceFlags: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.references.set(ref.id, ref);
    LoggerService.info('Persistent FIAT reference created', { userId, brokerId, currency, reference });
    return ref;
  }

  /**
   * Process FIAT deposit with unique reference
   */
  async processFiatDeposit(
    reference: string,
    actualAmount: string,
    bankTransaction: any
  ): Promise<{
    success: boolean;
    walletId?: string;
  }> {
    try {
      // Find reference
      const uniqueRef = Array.from(this.references.values())
        .find(r => r.reference === reference && r.status === 'active');
      
      if (!uniqueRef) {
        throw new Error('Invalid or expired reference');
      }

      // Check if reference is expired
      if (new Date() > uniqueRef.expiresAt) {
        uniqueRef.status = 'expired';
        throw new Error('Reference has expired');
      }

      // Get user's FIAT wallet
      const fiatWallet = Array.from(this.wallets.values())
        .find(w => w.userId === uniqueRef.userId && w.walletType === 'fiat');
      
      if (!fiatWallet) {
        throw new Error('FIAT wallet not found');
      }

      // Update FIAT wallet balance
      const newBalance = (parseFloat(fiatWallet.balance) + parseFloat(actualAmount)).toString();
      fiatWallet.balance = newBalance;
      fiatWallet.metadata.updatedAt = new Date();

      // No auto-conversion or THAL rewards on deposit. User will convert explicitly.

      // Mark reference as used
      uniqueRef.status = 'used';
      uniqueRef.actualAmount = actualAmount;
      uniqueRef.usedAt = new Date();
      uniqueRef.updatedAt = new Date();

      // Log FIAT deposit processing
      LoggerService.info('FIAT deposit processed (FIAT credited only)', {
        reference,
        userId: uniqueRef.userId,
        brokerId: uniqueRef.brokerId,
        amount: actualAmount,
        timestamp: new Date().toISOString()
      });

      LoggerService.logTransaction(uniqueRef.id, 'fiat_deposit_processed', {
        reference,
        userId: uniqueRef.userId,
        brokerId: uniqueRef.brokerId,
        amount: actualAmount
      });

      return {
        success: true,
        walletId: fiatWallet.id
      };

    } catch (error) {
      LoggerService.error('Failed to process FIAT deposit', { error, reference });
      throw error;
    }
  }

  /**
   * Create a conversion quote (FIAT ↔ USDT) with fee/tax breakdown (estimates)
   */
  async getConversionQuote(params: {
    userId: string;
    tenantId: string;
    brokerId: string;
    fromCurrency: string; // e.g., ZAR or USDT
    toCurrency: string;   // e.g., USDT or ZAR
    amount: string;       // amount in fromCurrency
  }): Promise<{
    quoteId: string;
    fromCurrency: string;
    toCurrency: string;
    grossAmount: string;
    rate: string;
    fxSpread: string;
    platformFee: string;
    taxes: string;
    netToReceive: string;
    expiresAt: Date;
    feePolicyVersion: string;
  }> {
    const gross = parseFloat(params.amount);
    const rate = (params.fromCurrency === 'ZAR' && params.toCurrency === 'USDT')
      ? this.ZAR_TO_USDT_RATE
      : (params.fromCurrency === 'USDT' && params.toCurrency === 'ZAR')
        ? (1 / this.ZAR_TO_USDT_RATE)
        : 1;

    const fxSpread = gross * 0.002; // 0.2%
    const platformLayerFee = gross * this.PLATFORM_FEE_RATE;
    const brokerLayerFee = gross * this.BROKER_FEE_RATE;
    const platformFee = platformLayerFee + brokerLayerFee;
    const taxes = 0; // placeholder
    const net = (gross - fxSpread - platformFee - taxes) * rate;

    return {
      quoteId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      grossAmount: gross.toFixed(6),
      rate: rate.toString(),
      fxSpread: fxSpread.toFixed(6),
      platformFee: platformFee.toFixed(6),
      taxes: taxes.toFixed(2),
      netToReceive: net.toFixed(6),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      feePolicyVersion: '1.0.0'
    };
  }

  /**
   * Confirm conversion (FIAT ↔ USDT) applying quoted fees, updating wallets
   */
  async confirmConversion(params: {
    userId: string;
    tenantId: string;
    brokerId: string;
    fromCurrency: string;
    toCurrency: string;
    amount: string;
    quoteId: string;
    acceptFees: boolean;
  }): Promise<{
    success: boolean;
    fromWalletId: string;
    toWalletId: string;
  }> {
    if (!params.acceptFees) {
      throw new Error('Fees must be accepted to proceed');
    }

    const fromWallet = Array.from(this.wallets.values()).find(w => w.userId === params.userId && ((w.walletType === 'fiat' && w.currency === params.fromCurrency) || (w.walletType === 'crypto_hot' && w.currency === params.fromCurrency)));
    const toWallet = Array.from(this.wallets.values()).find(w => w.userId === params.userId && ((w.walletType === 'fiat' && w.currency === params.toCurrency) || (w.walletType === 'crypto_hot' && w.currency === params.toCurrency)));
    if (!fromWallet || !toWallet) throw new Error('Wallets not found for conversion');

    const quote = await this.getConversionQuote({ userId: params.userId, tenantId: params.tenantId, brokerId: params.brokerId, fromCurrency: params.fromCurrency, toCurrency: params.toCurrency, amount: params.amount });

    const fromBal = parseFloat(fromWallet.balance);
    const amount = parseFloat(params.amount);
    if (fromBal < amount) throw new Error('Insufficient balance');

    fromWallet.balance = (fromBal - amount).toString();
    toWallet.balance = (parseFloat(toWallet.balance) + parseFloat(quote.netToReceive)).toString();
    fromWallet.metadata.updatedAt = new Date();
    toWallet.metadata.updatedAt = new Date();

    // Track lots and tax basis if converting ZAR<->USDT
    const now = new Date();
    if (params.fromCurrency === 'ZAR' && params.toCurrency === 'USDT') {
      // Acquire USDT lot with ZAR cost basis
      toWallet.metadata.lots = toWallet.metadata.lots || [];
      toWallet.metadata.lots.push({ amount: parseFloat(quote.netToReceive), costZAR: amount - parseFloat(quote.fxSpread) - parseFloat(quote.platformFee) - parseFloat(quote.taxes), acquiredAt: now });
    } else if (params.fromCurrency === 'USDT' && params.toCurrency === 'ZAR') {
      // Dispose USDT: compute simple FIFO gain (mock from current lots)
      const qtyToDispose = amount; // amount in USDT here when USDT->ZAR path uses amount in fromCurrency
      let remaining = qtyToDispose;
      let cost = 0;
      const lots = fromWallet.metadata.lots || [];
      while (remaining > 0 && lots.length) {
        const lot = lots[0];
        if (!lot) break;
        const use = Math.min(remaining, lot.amount);
        cost += (lot.costZAR * (use / lot.amount));
        lot.amount -= use;
        if (lot.amount <= 0.0000001) {
          lots.shift();
        }
        remaining -= use;
      }
      fromWallet.metadata.lots = lots;
      const proceeds = parseFloat(quote.netToReceive); // ZAR
      const taxableGain = proceeds - cost;
      this.transactionsLog.push({
        date: now,
        userId: params.userId,
        walletId: fromWallet.id,
        type: 'conversion',
        amount: amount,
        currency: params.fromCurrency,
        balanceAfter: parseFloat(fromWallet.balance),
        fees: parseFloat(quote.platformFee),
        taxes: parseFloat(quote.taxes),
        fxSpread: parseFloat(quote.fxSpread),
        proceedsZAR: proceeds,
        costZAR: cost,
        taxableGainZAR: taxableGain
      });
    }

    LoggerService.logTransaction(params.quoteId, 'conversion_confirmed', {
      userId: params.userId,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      grossAmount: params.amount,
      netToReceive: quote.netToReceive,
      fxSpread: quote.fxSpread,
      platformFee: quote.platformFee,
      taxes: quote.taxes,
      feePolicyVersion: quote.feePolicyVersion
    });

    return { success: true, fromWalletId: fromWallet.id, toWalletId: toWallet.id };
  }
  // ==================== POOL ACCOUNT MANAGEMENT ====================

  /**
   * Create pool account for broker
   */
  async createPoolAccount(
    brokerId: string,
    accountType: 'platform' | 'broker',
    bankDetails: {
      bankAccountNumber: string;
      bankName: string;
      accountHolder: string;
      swiftCode?: string;
      iban?: string;
    }
  ): Promise<PoolAccount> {
    try {
      const poolAccount: PoolAccount = {
        id: `pool_${brokerId}_${accountType}_${Date.now()}`,
        brokerId,
        accountType,
        bankAccountNumber: bankDetails.bankAccountNumber,
        bankReference: this.generateBankReference(brokerId, accountType),
        currency: 'ZAR',
        balance: '0',
        availableBalance: '0',
        pendingDeposits: '0',
        metadata: {
          bankName: bankDetails.bankName,
          accountHolder: bankDetails.accountHolder,
          swiftCode: bankDetails.swiftCode,
          iban: bankDetails.iban,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      this.poolAccounts.set(poolAccount.id, poolAccount);

      LoggerService.info('Pool account created', {
        poolAccountId: poolAccount.id,
        brokerId,
        accountType,
        bankAccountNumber: bankDetails.bankAccountNumber
      });

      return poolAccount;

    } catch (error) {
      LoggerService.error('Failed to create pool account', { error, brokerId });
      throw error;
    }
  }

  // ==================== CEX INTEGRATION ====================

  /**
   * Place order on native CEX
   */
  async placeCEXOrder(
    userId: string,
    tenantId: string,
    brokerId: string,
    params: {
      tradingPair: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop' | 'stop_limit';
      quantity: string;
      price?: string;
      stopPrice?: string;
    }
  ): Promise<CEXOrder> {
    try {
      // Check user has sufficient balance
      const tradingWallet = Array.from(this.wallets.values())
        .find(w => w.userId === userId && w.walletType === 'trading');
      
      if (!tradingWallet) {
        throw new Error('Trading wallet not found');
      }

      // Calculate required balance
      const requiredBalance = params.type === 'market' 
        ? (parseFloat(params.quantity) * await this.getMarketPrice(params.tradingPair))
        : (parseFloat(params.quantity) * parseFloat(params.price || '0'));

      if (parseFloat(tradingWallet.balance) < requiredBalance) {
        throw new Error('Insufficient balance');
      }

      // Create CEX order
      const cexOrder: CEXOrder = {
        id: `cex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        brokerId,
        tradingPair: params.tradingPair,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice,
        status: 'pending',
        filledQuantity: '0',
        averagePrice: '0',
        fees: '0',
        thalRewards: '0',
        engine: 'hybrid', // Will determine best engine
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };

      // Process order through trading engines
      await this.processCEXOrder(cexOrder);

      this.cexOrders.set(cexOrder.id, cexOrder);

      LoggerService.logTransaction(cexOrder.id, 'cex_order_placed', {
        userId,
        brokerId,
        tradingPair: params.tradingPair,
        side: params.side,
        quantity: params.quantity,
        price: params.price
      });

      return cexOrder;

    } catch (error) {
      LoggerService.error('Failed to place CEX order', { error, userId });
      throw error;
    }
  }

  /**
   * Process CEX order through trading engines
   */
  private async processCEXOrder(order: CEXOrder): Promise<void> {
    try {
      // Try Dingir first, fallback to Liquibook
      let engineUsed: 'dingir' | 'liquibook' = 'dingir';
      
      try {
        await this.processDingirOrder(order);
      } catch (error) {
        LoggerService.warn('Dingir order failed, trying Liquibook', { error, orderId: order.id });
        await this.processLiquibookOrder(order);
        engineUsed = 'liquibook';
      }

      order.engine = engineUsed;
      order.status = 'open';
      order.metadata.updatedAt = new Date();

      // Calculate THAL rewards
      const thalReward = this.calculateTHALReward(order.quantity);
      order.thalRewards = thalReward;

      // Credit THAL rewards to user's THAL wallet
      if (thalReward) {
        await this.creditTHALReward(order.userId, thalReward, 'trading_fee_discount', order.id);
      }

      LoggerService.info('CEX order processed', {
        orderId: order.id,
        engine: engineUsed,
        thalReward
      });

    } catch (error) {
      LoggerService.error('Failed to process CEX order', { error, orderId: order.id });
      order.status = 'rejected';
      order.metadata.updatedAt = new Date();
      throw error;
    }
  }

  // ==================== THAL TOKEN BUSINESS MODEL ====================

  /**
   * Calculate THAL reward based on transaction
   */
  private calculateTHALReward(amount: string): string {
    const reward = parseFloat(amount) * this.THAL_REWARD_RATE;
    const clampedReward = Math.max(
      parseFloat(this.MIN_THAL_REWARD),
      Math.min(reward, parseFloat(this.MAX_THAL_REWARD))
    );
    return clampedReward.toString();
  }

  /**
   * Credit THAL reward to user
   */
  private async creditTHALReward(
    userId: string,
    amount: string,
    rewardType: THALReward['rewardType'],
    sourceId?: string
  ): Promise<void> {
    try {
      const thalReward: THALReward = {
        id: `thal_reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        brokerId: 'platform', // Platform-level reward
        rewardType,
        amount,
        currency: 'THAL',
        status: 'credited',
        metadata: {
          sourceOrderId: sourceId,
          multiplier: 1.0,
          createdAt: new Date()
        }
      };

      this.thalRewards.set(thalReward.id, thalReward);

      // Update user's THAL wallet
      const thalWallet = Array.from(this.wallets.values())
        .find(w => w.userId === userId && w.walletType === 'thal_token');
      
      if (thalWallet) {
        const newBalance = (parseFloat(thalWallet.balance) + parseFloat(amount)).toString();
        thalWallet.balance = newBalance;
        thalWallet.metadata.updatedAt = new Date();
      }

      LoggerService.info('THAL reward credited', {
        userId,
        amount,
        rewardType,
        sourceId
      });

    } catch (error) {
      LoggerService.error('Failed to credit THAL reward', { error, userId });
    }
  }

  // ==================== WALLET RECOVERY ====================

  /**
   * Recover hot wallet with MFA verification
   */
  async recoverHotWallet(
    userId: string,
    mfaCode: string,
    recoveryMethod: 'phrase' | 'private_key'
  ): Promise<{
    success: boolean;
    wallet?: Wallet;
    recoveryData?: string;
  }> {
    try {
      // Verify MFA code (simplified - in production, use proper MFA service)
      if (!this.verifyMFACode(userId, mfaCode)) {
        throw new Error('Invalid MFA code');
      }

      const cryptoWallet = Array.from(this.wallets.values())
        .find(w => w.userId === userId && w.walletType === 'crypto_hot');
      
      if (!cryptoWallet) {
        throw new Error('Crypto wallet not found');
      }

      // Decrypt recovery data
      let recoveryData: string;
      if (recoveryMethod === 'phrase') {
        recoveryData = this.decryptData(cryptoWallet.metadata.recoveryPhrase!);
      } else {
        recoveryData = this.decryptData(cryptoWallet.metadata.encryptedPrivateKey!);
      }

      // Update wallet status
      cryptoWallet.status = 'active';
      cryptoWallet.metadata.updatedAt = new Date();

      LoggerService.logSecurity('hot_wallet_recovered', {
        userId,
        recoveryMethod,
        walletId: cryptoWallet.id
      });

      return {
        success: true,
        wallet: cryptoWallet,
        recoveryData
      };

    } catch (error) {
      LoggerService.error('Failed to recover hot wallet', { error, userId });
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  private async loadExistingWallets(): Promise<void> {
    // In production, load from database
    LoggerService.info('Loading existing wallets from database...');
  }

  private async loadPoolAccounts(): Promise<void> {
    // In production, load from database
    LoggerService.info('Loading pool accounts from database...');
  }

  private async initializeCEXIntegration(): Promise<void> {
    LoggerService.info('Initializing CEX integration...');
  }

  private async getBrokerCode(brokerId: string): Promise<string> {
    // In production, get from broker configuration
    return 'THAL'; // Default broker code
  }

  private async getUserInitials(userId: string): Promise<string> {
    // In production, get from user profile
    return 'JD'; // Default initials
  }

  private generateRandomSuffix(): string {
    return Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  private async ensureReferenceUniqueness(reference: string): Promise<void> {
    const existing = Array.from(this.references.values())
      .find(r => r.reference === reference && r.status === 'active');
    
    if (existing) {
      throw new Error('Reference already exists');
    }
  }

  /**
   * Attempt to auto-match a bank deposit to a persistent reference
   */
  public autoMatchDepositToReference(record: { reference: string; amount: string; currency: string }): {
    matched: boolean;
    userId?: string;
    brokerId?: string;
    tenantId?: string;
    referenceId?: string;
  } {
    const ref = Array.from(this.references.values()).find(r =>
      r.reference.toUpperCase() === record.reference.toUpperCase() &&
      r.currency === record.currency &&
      r.status === 'active'
    );
    if (!ref) return { matched: false };
    return {
      matched: true,
      userId: ref.userId,
      brokerId: ref.brokerId,
      tenantId: ref.tenantId,
      referenceId: ref.id
    };
  }

  private generateBankReference(brokerId: string, accountType: string): string {
    return `BANK_${brokerId}_${accountType}_${Date.now()}`;
  }

  private encryptData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptData(encryptedData: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const parts = encryptedData.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid encrypted data format');
    }
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    const updateResult = decipher.update(encrypted, 'hex', 'utf8');
    const finalResult = decipher.final('utf8');
    const decrypted = (updateResult ?? '') + (finalResult ?? '');
    
    return decrypted;
  }

  private verifyMFACode(userId: string, code: string): boolean {
    // Simplified MFA verification - in production, use proper MFA service
    return code === '123456'; // Mock verification
  }

  private async getMarketPrice(tradingPair: string): Promise<number> {
    // In production, get from market data service
    return 50000; // Mock BTC price
  }

  private async processDingirOrder(order: CEXOrder): Promise<void> {
    // Mock Dingir order processing
    LoggerService.info('Processing Dingir order', { orderId: order.id });
  }

  private async processLiquibookOrder(order: CEXOrder): Promise<void> {
    // Mock Liquibook order processing
    LoggerService.info('Processing Liquibook order', { orderId: order.id });
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get user's wallets
   */
  getUserWallets(userId: string): Wallet[] {
    return Array.from(this.wallets.values())
      .filter(w => w.userId === userId);
  }

  /**
   * Get wallet by ID
   */
  getWallet(walletId: string): Wallet | null {
    return this.wallets.get(walletId) || null;
  }

  /**
   * Get unique reference by reference string
   */
  getReference(reference: string): UniqueReference | null {
    return Array.from(this.references.values())
      .find(r => r.reference === reference) || null;
  }

  /**
   * Get pool accounts for broker
   */
  getBrokerPoolAccounts(brokerId: string): PoolAccount[] {
    return Array.from(this.poolAccounts.values())
      .filter(p => p.brokerId === brokerId);
  }

  /**
   * Get CEX orders for user
   */
  getUserCEXOrders(userId: string): CEXOrder[] {
    return Array.from(this.cexOrders.values())
      .filter(o => o.userId === userId);
  }

  /**
   * Get THAL rewards for user
   */
  getUserTHALRewards(userId: string): THALReward[] {
    return Array.from(this.thalRewards.values())
      .filter(r => r.userId === userId);
  }

  /**
   * Generate wallet statement (CSV) for date range (mocked from in-memory state)
   */
  async generateWalletStatementCSV(params: {
    walletId: string;
    from?: string; // ISO date
    to?: string;   // ISO date
  }): Promise<string> {
    const wallet = this.getWallet(params.walletId);
    if (!wallet) throw new Error('Wallet not found');
    const from = params.from ? new Date(params.from) : new Date('1970-01-01');
    const to = params.to ? new Date(params.to) : new Date();
    const rows: string[] = [];
    rows.push('date,type,reference,amount,currency,balanceAfter,fees,taxes,fxSpread');
    for (const t of this.transactionsLog) {
      if (t.walletId !== wallet.id) continue;
      if (t.date < from || t.date > to) continue;
      rows.push(`${t.date.toISOString()},${t.type},${t.reference || ''},${t.amount},${t.currency},${t.balanceAfter},${t.fees || 0},${t.taxes || 0},${t.fxSpread || 0}`);
    }
    return rows.join('\n');
  }

  /**
   * Generate tax report (CSV) for a range with method (FIFO/LIFO) - placeholder
   */
  async generateTaxReportCSV(params: {
    userId: string;
    from?: string;
    to?: string;
    method?: 'fifo' | 'lifo';
    baseCurrency?: string; // e.g., ZAR
  }): Promise<string> {
    const from = params.from ? new Date(params.from) : new Date('1970-01-01');
    const to = params.to ? new Date(params.to) : new Date();
    const rows: string[] = [];
    rows.push('date,event,asset,quantity,proceedsZAR,feesZAR,taxableGainZAR');
    for (const t of this.transactionsLog) {
      if (t.userId !== params.userId) continue;
      if (t.date < from || t.date > to) continue;
      if (typeof t.taxableGainZAR === 'number') {
        rows.push(`${t.date.toISOString()},conversion,USDT,${t.amount},${t.proceedsZAR || 0},${t.fees || 0},${t.taxableGainZAR || 0}`);
      }
    }
    return rows.join('\n');
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    LoggerService.info('Shutting down Wallet System Service...');
  }
}
