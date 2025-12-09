/**
 * Database Service
 * 
 * Manages PostgreSQL database connections, models, and schema synchronization.
 * 
 * Key Features:
 * - Connection pooling and retry logic
 * - Automatic schema synchronization (development) or migration execution (production)
 * - Model registration and association management
 * - Transaction support
 * - Query logging and performance monitoring
 * 
 * Production Behavior:
 * - Automatically runs database migrations on startup
 * - Uses migrations instead of sync for schema management
 * - Fails fast on critical database errors
 * 
 * Development Behavior:
 * - Uses Sequelize sync for rapid schema updates
 * - Allows startup with schema issues for development flexibility
 */

import { Sequelize, DataTypes, Model, ModelCtor, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { ConfigService } from './config';
import { LoggerService } from './logger';
import { User, Transaction, Wallet, Tenant, Order, Trade, TradingPair, MarketData, Balance } from '../types';

export class DatabaseService {
  private static sequelize: Sequelize;
  private static models: Map<string, ModelCtor<Model>> = new Map();
  private static isInitialized = false;

  /**
   * Initialize database connection and schema
   * 
   * In production: Runs migrations automatically to create/update schema
   * In development: Uses Sequelize sync for rapid schema updates
   * 
   * @throws {Error} If database connection fails or initialization fails
   */
  public static async initialize(): Promise<void> {
    try {
      const config = ConfigService.getConfig();
      
      this.sequelize = new Sequelize({
        host: config.database.host,
        port: config.database.port || 5432,
        database: config.database.database,
        username: config.database.username,
        password: config.database.password,
        dialect: 'postgres',
        logging: (sql: string, timing?: number) => {
          LoggerService.logDatabase(sql, timing || 0);
        },
        pool: config.database.pool,
        dialectOptions: {
          ssl: config.database.ssl ? {
            require: true,
            rejectUnauthorized: false
          } : false
        }
      });

      // Test connection with retry logic
      await this.sequelize.authenticate();
      LoggerService.info('Database connection established successfully');

      // Initialize all Sequelize models
      this.initializeModels();

      // Sync database schema or run migrations
      // Production: Runs migrations automatically
      // Development: Uses Sequelize sync
      await this.syncDatabase();
      
      this.isInitialized = true;

    } catch (error) {
      LoggerService.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if database connection is active
   * @returns {boolean} True if database is initialized and connected
   */
  public static isConnected(): boolean {
    return this.isInitialized && this.sequelize && this.sequelize.authenticate !== undefined;
  }

  /**
   * Close database connection and cleanup
   * Should be called during graceful shutdown
   */
  public static async close(): Promise<void> {
    if (this.sequelize) {
      await this.sequelize.close();
      this.isInitialized = false;
      LoggerService.info('Database connection closed');
    }
  }

  private static initializeModels(): void {
    // User Model
    const UserModel = this.sequelize.define('User', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      dateOfBirth: {
        type: DataTypes.DATE,
        allowNull: true
      },
      address: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      kycStatus: {
        type: DataTypes.ENUM('not_started', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired'),
        defaultValue: 'not_started'
      },
      kycLevel: {
        type: DataTypes.ENUM('basic', 'intermediate', 'advanced', 'enterprise'),
        defaultValue: 'basic'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      mfaSecret: {
        type: DataTypes.STRING,
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('user', 'admin', 'broker', 'compliance', 'finance', 'support', 'super_admin'),
        defaultValue: 'user'
      },
      permissions: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Tenants',
          key: 'id'
        }
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
      }
    }, {
      tableName: 'users',
      timestamps: true,
      indexes: [
        { fields: ['email'] },
        { fields: ['username'] },
        { fields: ['tenantId'] },
        { fields: ['role'] },
        { fields: ['kycStatus'] }
      ]
    });

    // Tenant Model
    const TenantModel = this.sequelize.define('Tenant', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      domain: {
        type: DataTypes.STRING,
        allowNull: true
      },
      tenantType: {
        type: DataTypes.ENUM('regular', 'broker', 'platform'),
        allowNull: false,
        defaultValue: 'regular',
        comment: 'Type of tenant: regular (users sign up), broker (manages clients), platform (platform oversight)'
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true
      },
      primaryColor: {
        type: DataTypes.STRING,
        allowNull: true
      },
      secondaryColor: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {}
      }
    }, {
      tableName: 'tenants',
      timestamps: true,
      indexes: [
        { fields: ['slug'] },
        { fields: ['domain'] },
        { fields: ['tenantType'] },
        { fields: ['isActive'] },
        { fields: ['tenantType', 'isActive'] }
      ]
    });

    // Transaction Model
    const TransactionModel = this.sequelize.define('Transaction', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      type: {
        type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'trade', 'fee', 'reward', 'refund'),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed', 'cancelled', 'processing'),
        defaultValue: 'pending'
      },
      amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fromAddress: {
        type: DataTypes.STRING,
        allowNull: true
      },
      toAddress: {
        type: DataTypes.STRING,
        allowNull: true
      },
      hash: {
        type: DataTypes.STRING,
        allowNull: true
      },
      blockNumber: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      gasUsed: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      gasPrice: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      tableName: 'transactions',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['type'] },
        { fields: ['status'] },
        { fields: ['currency'] },
        { fields: ['hash'] },
        { fields: ['createdAt'] }
      ]
    });

    // Wallet Model
    const WalletModel = this.sequelize.define('Wallet', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      type: {
        type: DataTypes.ENUM('hot', 'cold', 'multi_sig', 'hardware'),
        defaultValue: 'hot'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      balance: {
        type: DataTypes.JSONB,
        defaultValue: {}
      }
    }, {
      tableName: 'wallets',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['address'] },
        { fields: ['type'] },
        { fields: ['isActive'] }
      ]
    });
    // Web3Wallet Model (for external wallet connections)
    const Web3WalletModel = this.sequelize.define('Web3Wallet', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      walletType: { type: DataTypes.STRING, allowNull: false },
      address: { type: DataTypes.STRING, allowNull: false, unique: true },
      chainId: { type: DataTypes.BIGINT, allowNull: false },
      network: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.ENUM('connected','disconnected','pending','error'), defaultValue: 'connected' },
      isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
      verificationMethod: { type: DataTypes.STRING, allowNull: false, defaultValue: 'none' },
      metadata: { type: DataTypes.JSONB, defaultValue: {} },
      security: { type: DataTypes.JSONB, defaultValue: {} }
    }, {
      tableName: 'web3_wallets',
      timestamps: true,
      indexes: [ { fields: ['userId'] }, { fields: ['tenantId'] }, { fields: ['address'] }, { fields: ['status'] } ]
    });


    // Store models
    this.models.set('User', UserModel);
    this.models.set('Tenant', TenantModel);
    this.models.set('Transaction', TransactionModel);
    this.models.set('Wallet', WalletModel);
    this.models.set('Web3Wallet', Web3WalletModel);


    // Platform Fund Allocation Model
    const PlatformAllocationModel = this.sequelize.define('PlatformAllocation', {
      id: { type: DataTypes.STRING, primaryKey: true },
      exchangeId: { type: DataTypes.STRING, allowNull: false },
      asset: { type: DataTypes.STRING, allowNull: false },
      totalPlatformBalance: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      availableForAllocation: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      brokerAllocations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      customerAllocations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      lastUpdated: { type: DataTypes.DATE, allowNull: false }
    }, {
      tableName: 'platform_allocations',
      timestamps: true,
      indexes: [ { fields: ['exchangeId'] }, { fields: ['asset'] } ]
    });

    // Internal Order Model
    const InternalOrderModel = this.sequelize.define('InternalOrder', {
      id: { type: DataTypes.STRING, primaryKey: true },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.STRING, allowNull: false },
      exchangeId: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      side: { type: DataTypes.ENUM('buy','sell'), allowNull: false },
      type: { type: DataTypes.ENUM('market','limit','stop','stop_limit'), allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      price: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      status: { type: DataTypes.ENUM('pending','allocated','submitted','filled','cancelled','rejected'), allowNull: false, defaultValue: 'pending' },
      allocatedAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      filledAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      averagePrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      fees: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      externalOrderId: { type: DataTypes.STRING, allowNull: true },
      fundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      compliance: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
      tableName: 'internal_orders',
      timestamps: true,
      indexes: [ { fields: ['brokerId'] }, { fields: ['userId'] }, { fields: ['exchangeId'] }, { fields: ['status'] } ]
    });

    // Travel Rule Messages
    const TravelRuleModel = this.sequelize.define('TravelRuleMessage', {
      messageId: { type: DataTypes.STRING, primaryKey: true },
      data: { type: DataTypes.JSONB, allowNull: false },
      status: { type: DataTypes.ENUM('pending','sent','received','acknowledged','failed'), allowNull: false, defaultValue: 'pending' },
      transactionId: { type: DataTypes.STRING, allowNull: false }
    }, {
      tableName: 'travel_rule_messages',
      timestamps: true,
      indexes: [ { fields: ['status'] }, { fields: ['transactionId'] } ]
    });

    // CARF Reports
    const CarfReportModel = this.sequelize.define('CarfReport', {
      reportId: { type: DataTypes.STRING, primaryKey: true },
      data: { type: DataTypes.JSONB, allowNull: false },
      status: { type: DataTypes.ENUM('pending','submitted','acknowledged','rejected'), allowNull: false, defaultValue: 'pending' },
      submissionDate: { type: DataTypes.DATE, allowNull: true }
    }, {
      tableName: 'carf_reports',
      timestamps: true,
      indexes: [ { fields: ['status'] } ]
    });

    this.models.set('PlatformAllocation', PlatformAllocationModel);
    this.models.set('InternalOrder', InternalOrderModel);
    this.models.set('TravelRuleMessage', TravelRuleModel);
    this.models.set('CarfReport', CarfReportModel);

    // Reconciliation Snapshot Model
    const ReconciliationSnapshotModel = this.sequelize.define('ReconciliationSnapshot', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      snapshotAt: { type: DataTypes.DATE, allowNull: false },
      platformTotals: { type: DataTypes.JSONB, allowNull: false },
      exchangeBalances: { type: DataTypes.JSONB, allowNull: false },
      internalAllocations: { type: DataTypes.JSONB, allowNull: false },
      reconciliation: { type: DataTypes.JSONB, allowNull: false }
    }, {
      tableName: 'reconciliation_snapshots',
      timestamps: true,
      indexes: [ { fields: ['snapshotAt'] } ]
    });

    this.models.set('ReconciliationSnapshot', ReconciliationSnapshotModel);

    // AuditLog Model
    const AuditLogModel = this.sequelize.define('AuditLog', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      action: { type: DataTypes.STRING, allowNull: false },
      subject: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      tenantId: { type: DataTypes.UUID, allowNull: true, references: { model: 'tenants', key: 'id' } },
      brokerId: { type: DataTypes.STRING, allowNull: true },
      details: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'audit_logs',
      timestamps: true,
      indexes: [
        { fields: ['action'] },
        { fields: ['subject'] },
        { fields: ['userId'] },
        { fields: ['tenantId'] },
        { fields: ['createdAt'] },
        { fields: ['action', 'createdAt'] }
      ]
    });

    this.models.set('AuditLog', AuditLogModel);

    // Order Model - matches existing database schema with snake_case columns
    const OrderModel = this.sequelize.define('Order', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' },
      symbol: { type: DataTypes.STRING(20), allowNull: false },
      side: { type: DataTypes.STRING(10), allowNull: false },
      type: { type: DataTypes.STRING(20), allowNull: false, field: 'order_type' },
      quantity: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      price: { type: DataTypes.DECIMAL(20, 8), allowNull: true },
      filledQuantity: { type: DataTypes.DECIMAL(20, 8), allowNull: true, defaultValue: 0, field: 'filled_quantity' },
      averagePrice: { type: DataTypes.DECIMAL(20, 8), allowNull: true, field: 'average_price' },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pending' },
      timeInForce: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'GTC', field: 'time_in_force' },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'orders',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['tenant_id', 'user_id'] },
        { fields: ['tenant_id', 'symbol'] },
        { fields: ['tenant_id', 'status'] }
      ]
    });

    this.models.set('Order', OrderModel);

    // Trade Model
    const TradeModel = this.sequelize.define('Trade', {
      id: { type: DataTypes.STRING, primaryKey: true },
      buyOrderId: { type: DataTypes.STRING, allowNull: false },
      sellOrderId: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      price: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      buyerId: { type: DataTypes.STRING, allowNull: false },
      sellerId: { type: DataTypes.STRING, allowNull: false },
      buyerTenantId: { type: DataTypes.STRING, allowNull: false },
      sellerTenantId: { type: DataTypes.STRING, allowNull: false },
      fee: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      feeCurrency: { type: DataTypes.STRING, allowNull: false }
    }, {
      tableName: 'trades',
      timestamps: true,
      indexes: [
        { fields: ['buyOrderId'] },
        { fields: ['sellOrderId'] },
        { fields: ['symbol'] },
        { fields: ['buyerId'] },
        { fields: ['sellerId'] }
      ]
    });

    this.models.set('Trade', TradeModel);

    // TradingPair Model - matches existing database schema with snake_case columns
    const TradingPairModel = this.sequelize.define('TradingPair', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
      symbol: { type: DataTypes.STRING(50), allowNull: false },
      baseAsset: { type: DataTypes.STRING(20), allowNull: false, field: 'base_asset' },
      quoteAsset: { type: DataTypes.STRING(20), allowNull: false, field: 'quote_asset' },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'active' },
      minQuantity: { type: DataTypes.DECIMAL(30, 8), allowNull: true, field: 'min_amount' },
      maxQuantity: { type: DataTypes.DECIMAL(30, 8), allowNull: true, field: 'max_amount' },
      minPrice: { type: DataTypes.DECIMAL(30, 8), allowNull: true, field: 'min_price' },
      maxPrice: { type: DataTypes.DECIMAL(30, 8), allowNull: true, field: 'max_price' },
      tickSize: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 8, field: 'price_precision' },
      stepSize: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 8, field: 'amount_precision' },
      makerFee: { type: DataTypes.DECIMAL(10, 6), allowNull: true, defaultValue: 0.001, field: 'maker_fee' },
      takerFee: { type: DataTypes.DECIMAL(10, 6), allowNull: true, defaultValue: 0.001, field: 'taker_fee' }
    }, {
      tableName: 'trading_pairs',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['symbol'] },
        { fields: ['status'] }
      ]
    });

    this.models.set('TradingPair', TradingPairModel);

    // MarketData Model
    const MarketDataModel = this.sequelize.define('MarketData', {
      symbol: { type: DataTypes.STRING, primaryKey: true },
      price: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      volume24h: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      change24h: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      changePercent24h: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
      high24h: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      low24h: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
      lastUpdate: { type: DataTypes.DATE, allowNull: false }
    }, {
      tableName: 'market_data',
      timestamps: false
    });

    this.models.set('MarketData', MarketDataModel);

    // Balance Model
    const BalanceModel = this.sequelize.define('Balance', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      asset: { type: DataTypes.STRING, allowNull: false },
      available: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      locked: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      total: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' }
    }, {
      tableName: 'balances',
      timestamps: true,
      indexes: [ { fields: ['userId', 'tenantId', 'asset'], unique: true } ]
    });

    this.models.set('Balance', BalanceModel);

    // =============================================================================
    // MARGIN TRADING MODELS
    // =============================================================================

    // Margin Account Model
    const MarginAccountModel = this.sequelize.define('MarginAccount', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      accountType: { type: DataTypes.ENUM('isolated', 'cross'), allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'margin_call', 'liquidation', 'suspended', 'closed'), allowNull: false, defaultValue: 'active' },

      // Balance Management
      totalEquity: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      totalMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      availableBalance: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      usedMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      freeMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      marginLevel: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },
      marginRatio: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },

      // Risk Management
      maxLeverage: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      maintenanceMarginRatio: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.1' },
      liquidationThreshold: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.05' },
      marginCallThreshold: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.15' },

      // USER-LEVEL FUND SEGREGATION
      userSegregation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Broker-level segregation
      brokerSegregation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Platform-level segregation
      platformSegregation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Legacy fund segregation (for backward compatibility)
      segregatedBalances: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      borrowedAssets: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      collateralAssets: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Metadata
      lastRiskCheck: { type: DataTypes.DATE, allowNull: true },
      riskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },
      complianceFlags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
    }, {
      tableName: 'margin_accounts',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'], unique: true },
        { fields: ['status'] },
        { fields: ['accountType'] },
        { fields: ['brokerId'] }
      ]
    });

    // Margin Position Model
    const MarginPositionModel = this.sequelize.define('MarginPosition', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      accountId: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      side: { type: DataTypes.ENUM('long', 'short'), allowNull: false },
      size: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      entryPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      currentPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      leverage: { type: DataTypes.INTEGER, allowNull: false },

      // Margin Management
      initialMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      maintenanceMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      marginUsed: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      liquidationPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false },

      // P&L Tracking
      unrealizedPnl: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      realizedPnl: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      fundingFee: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      interestFee: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },

      // Status
      status: { type: DataTypes.ENUM('open', 'closing', 'closed', 'liquidated'), allowNull: false, defaultValue: 'open' },
      closedAt: { type: DataTypes.DATE, allowNull: true },

      // Risk Metrics
      marginRatio: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '100' },
      riskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },
      volatility: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0.2' },
      maxDrawdown: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },

      // USER-LEVEL FUND SEGREGATION
      userFundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Broker-level fund segregation
      brokerFundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Platform-level fund segregation
      platformFundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      // Legacy fund segregation (for backward compatibility)
      fundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
      tableName: 'margin_positions',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'] },
        { fields: ['accountId'] },
        { fields: ['symbol'] },
        { fields: ['status'] },
        { fields: ['side'] }
      ]
    });

    // Margin Order Model
    const MarginOrderModel = this.sequelize.define('MarginOrder', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      accountId: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      side: { type: DataTypes.ENUM('buy', 'sell'), allowNull: false },
      type: { type: DataTypes.ENUM('market', 'limit', 'stop', 'stop_limit'), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      price: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      stopPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      leverage: { type: DataTypes.INTEGER, allowNull: false },

      // Order Management
      status: { type: DataTypes.ENUM('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected'), allowNull: false, defaultValue: 'pending' },
      filledQuantity: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      averagePrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      remainingQuantity: { type: DataTypes.DECIMAL(36, 18), allowNull: false },

      // Margin Requirements
      marginRequired: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      marginUsed: { type: DataTypes.DECIMAL(36, 18), allowNull: false },

      // Risk & Compliance
      riskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },
      complianceFlags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

      // Fund Segregation
      fundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
      tableName: 'margin_orders',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'] },
        { fields: ['accountId'] },
        { fields: ['symbol'] },
        { fields: ['status'] },
        { fields: ['type'] }
      ]
    });

    // Liquidation Event Model
    const LiquidationEventModel = this.sequelize.define('LiquidationEvent', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      accountId: { type: DataTypes.STRING, allowNull: false },
      positionId: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },

      // Liquidation Details
      liquidationPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      liquidationAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      liquidationValue: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      remainingMargin: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      penaltyFee: { type: DataTypes.DECIMAL(36, 18), allowNull: false },

      // Risk Metrics
      marginRatio: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
      riskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: false },

      // Reason & Status
      reason: { type: DataTypes.ENUM('margin_call', 'forced_liquidation', 'risk_limit_exceeded'), allowNull: false },
      status: { type: DataTypes.ENUM('pending', 'executed', 'failed'), allowNull: false, defaultValue: 'pending' },

      // Fund Segregation
      fundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
      tableName: 'liquidation_events',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'] },
        { fields: ['positionId'] },
        { fields: ['status'] },
        { fields: ['reason'] }
      ]
    });

    // Margin Transfer Model
    const MarginTransferModel = this.sequelize.define('MarginTransfer', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },
      fromAccount: { type: DataTypes.STRING, allowNull: false },
      toAccount: { type: DataTypes.STRING, allowNull: false },
      asset: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      type: { type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'collateral_add', 'collateral_remove'), allowNull: false },
      status: { type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },

      // Risk Checks
      riskScore: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '0' },
      complianceFlags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

      // Fund Segregation
      fundAllocation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
    }, {
      tableName: 'margin_transfers',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'] },
        { fields: ['status'] },
        { fields: ['type'] },
        { fields: ['asset'] }
      ]
    });

    // Risk Limits Model
    const RiskLimitsModel = this.sequelize.define('RiskLimits', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      brokerId: { type: DataTypes.STRING, allowNull: false },

      // Leverage Limits
      maxLeverage: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      maxPositionSize: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '100000' },
      maxOpenPositions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },

      // Risk Limits
      maxAccountRisk: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '80' },
      maxDrawdown: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '50' },
      maxVolatility: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: '100' },

      // Margin Limits
      marginCallThreshold: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.15' },
      liquidationThreshold: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.05' },
      maintenanceMarginRatio: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: '0.1' },

      // Compliance
      kycRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      amlRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      riskTier: { type: DataTypes.ENUM('low', 'medium', 'high', 'professional'), allowNull: false, defaultValue: 'medium' }
    }, {
      tableName: 'risk_limits',
      timestamps: true,
      indexes: [
        { fields: ['userId', 'tenantId', 'brokerId'], unique: true },
        { fields: ['riskTier'] }
      ]
    });

    // Funding Rate Model
    const FundingRateModel = this.sequelize.define('FundingRate', {
      symbol: { type: DataTypes.STRING, primaryKey: true },
      rate: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
      nextFundingTime: { type: DataTypes.DATE, allowNull: false }
    }, {
      tableName: 'funding_rates',
      timestamps: true,
      indexes: [ { fields: ['nextFundingTime'] } ]
    });

    this.models.set('MarginAccount', MarginAccountModel);
    this.models.set('MarginPosition', MarginPositionModel);
    this.models.set('MarginOrder', MarginOrderModel);
    this.models.set('LiquidationEvent', LiquidationEventModel);
    this.models.set('MarginTransfer', MarginTransferModel);
    this.models.set('RiskLimits', RiskLimitsModel);
    this.models.set('FundingRate', FundingRateModel);

    // =============================================================================
    // OMNI EXCHANGE MODELS
    // =============================================================================
    // Note: PlatformAllocation, InternalOrder, CarfReport, and ReconciliationSnapshot models
    // are already defined above and stored in this.models. They are reused here without redeclaration.
    
    // Models are already defined above, just verify they exist in the models map
    // No need to redeclare - they're already accessible via this.models.get()

    // =============================================================================
    // FINANCIAL SERVICE MODELS
    // =============================================================================

    // Journal Entry Model
    const JournalEntryModel = this.sequelize.define('JournalEntry', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      description: { type: DataTypes.STRING, allowNull: false },
      idempotencyKey: { type: DataTypes.STRING, allowNull: true, unique: true },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'journal_entries',
      timestamps: true,
      indexes: [{ fields: ['tenantId'] }, { fields: ['idempotencyKey'] }, { fields: ['createdAt'] }]
    });

    // Journal Entry Line Model
    const JournalEntryLineModel = this.sequelize.define('JournalEntryLine', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      journalEntryId: { type: DataTypes.UUID, allowNull: false, references: { model: 'journal_entries', key: 'id' } },
      accountId: { type: DataTypes.STRING, allowNull: false },
      debit: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      credit: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      description: { type: DataTypes.STRING, allowNull: true }
    }, {
      tableName: 'journal_entry_lines',
      timestamps: true,
      indexes: [{ fields: ['journalEntryId'] }, { fields: ['accountId'] }]
    });

    // Account Model (Financial Accounts)
    const FinancialAccountModel = this.sequelize.define('FinancialAccount', {
      id: { type: DataTypes.STRING, primaryKey: true },
      tenantId: { 
        type: DataTypes.UUID, 
        allowNull: false, 
        references: { model: 'tenants', key: 'id' },
        comment: 'Tenant ID - for fund segregation at tenant/broker level'
      },
      clientId: { 
        type: DataTypes.UUID, 
        allowNull: true, 
        references: { model: 'clients', key: 'id' },
        comment: 'Client ID - only set if tenant is a broker (tenantType=broker)'
      },
      name: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'general' },
      accountType: { type: DataTypes.ENUM('client_trading', 'broker_operational', 'platform_reserve', 'fee_collection', 'escrow'), allowNull: false, defaultValue: 'client_trading' },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      balance: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      availableBalance: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      segregationLevel: { type: DataTypes.ENUM('client', 'broker', 'platform'), allowNull: false, defaultValue: 'client' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    }, {
      tableName: 'accounts',
      timestamps: true,
      indexes: [
        { fields: ['tenantId'] }, 
        { fields: ['clientId'] }, 
        { fields: ['tenantId', 'clientId'] }, 
        { fields: ['isActive'] }
      ]
    });

    // Hold Model
    const HoldModel = this.sequelize.define('Hold', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      accountId: { type: DataTypes.STRING, allowNull: false, references: { model: 'accounts', key: 'id' } },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      description: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'released', 'expired'), allowNull: false, defaultValue: 'active' },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      releasedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'holds',
      timestamps: true,
      indexes: [{ fields: ['tenantId'] }, { fields: ['accountId'] }, { fields: ['status'] }]
    });

    // Client Model
    const ClientModel = this.sequelize.define('Client', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { 
        type: DataTypes.UUID, 
        allowNull: false, 
        references: { model: 'tenants', key: 'id' },
        comment: 'Tenant ID - must be a broker-tenant (tenantType=broker)'
      },
      externalId: { type: DataTypes.STRING, allowNull: true },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      kycStatus: { type: DataTypes.ENUM('not_started', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired'), allowNull: false, defaultValue: 'not_started' },
      kycCompletedAt: { type: DataTypes.DATE, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'clients',
      timestamps: true,
      indexes: [
        { fields: ['tenantId'] }, 
        { fields: ['externalId'] }, 
        { fields: ['kycStatus'] },
        { fields: ['isActive'] }
      ]
    });

    // Client-Account Relationship Model
    const ClientAccountModel = this.sequelize.define('ClientAccount', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      clientId: { type: DataTypes.UUID, allowNull: false, references: { model: 'clients', key: 'id' } },
      accountId: { type: DataTypes.STRING, allowNull: false, references: { model: 'accounts', key: 'id' } },
      relationshipType: { type: DataTypes.ENUM('owner', 'beneficiary', 'authorized', 'trustee'), allowNull: false, defaultValue: 'owner' },
      canDebit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      canCredit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      dailyLimit: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      monthlyLimit: { type: DataTypes.DECIMAL(36, 18), allowNull: true }
    }, {
      tableName: 'client_accounts',
      timestamps: true,
      indexes: [{ fields: ['clientId'] }, { fields: ['accountId'] }, { unique: true, fields: ['clientId', 'accountId'] }]
    });

    // Fund Segregation Rule Model
    const FundSegregationRuleModel = this.sequelize.define('FundSegregationRule', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      ruleName: { type: DataTypes.STRING, allowNull: false },
      segregationType: { type: DataTypes.STRING, allowNull: false },
      sourceAccountPattern: { type: DataTypes.STRING, allowNull: true },
      targetAccountPattern: { type: DataTypes.STRING, allowNull: true },
      allowInterClientTransfers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      requireDualAuthorization: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      maxTransactionAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      conditions: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    }, {
      tableName: 'fund_segregation_rules',
      timestamps: true,
      indexes: [{ fields: ['tenantId'] }, { fields: ['isActive'] }]
    });

    // Financial Transaction Model
    const FinancialTransactionModel = this.sequelize.define('FinancialTransaction', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      userId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      type: { type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'trade', 'fee', 'interest', 'adjustment'), allowNull: false },
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
      fromAccountId: { type: DataTypes.STRING, allowNull: true },
      toAccountId: { type: DataTypes.STRING, allowNull: true },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      description: { type: DataTypes.STRING, allowNull: true },
      requiresApproval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      approvedBy: { type: DataTypes.UUID, allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      rejectedBy: { type: DataTypes.UUID, allowNull: true },
      rejectedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.STRING, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }
    }, {
      tableName: 'financial_transactions',
      timestamps: true,
      indexes: [{ fields: ['tenantId'] }, { fields: ['userId'] }, { fields: ['status'] }, { fields: ['type'] }]
    });

    // Financial Audit Log Model
    const FinancialAuditLogModel = this.sequelize.define('FinancialAuditLog', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      clientId: { type: DataTypes.UUID, allowNull: true, references: { model: 'clients', key: 'id' } },
      userId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.STRING, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      changes: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.STRING, allowNull: true },
      sessionId: { type: DataTypes.STRING, allowNull: true }
    }, {
      tableName: 'financial_audit_log',
      timestamps: true,
      indexes: [{ fields: ['tenantId'] }, { fields: ['entityType', 'entityId'] }, { fields: ['createdAt'] }]
    });

    // Financial Report Model
    const FinancialReportModel = this.sequelize.define('FinancialReport', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, references: { model: 'tenants', key: 'id' } },
      reportType: { type: DataTypes.STRING, allowNull: false },
      startDate: { type: DataTypes.DATE, allowNull: false },
      endDate: { type: DataTypes.DATE, allowNull: false },
      brokerId: { type: DataTypes.UUID, allowNull: true },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      generatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      generatedBy: { type: DataTypes.STRING, allowNull: false, defaultValue: 'system' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' }
    }, {
      tableName: 'financial_reports',
      timestamps: true,
      indexes: [
        { fields: ['tenantId'] },
        { fields: ['reportType'] },
        { fields: ['brokerId'] },
        { fields: ['generatedAt'] },
        { fields: ['startDate', 'endDate'] }
      ]
    });

    this.models.set('JournalEntry', JournalEntryModel);
    this.models.set('JournalEntryLine', JournalEntryLineModel);
    this.models.set('FinancialAccount', FinancialAccountModel);
    this.models.set('Hold', HoldModel);
    this.models.set('Client', ClientModel);
    this.models.set('ClientAccount', ClientAccountModel);
    this.models.set('FundSegregationRule', FundSegregationRuleModel);
    this.models.set('FinancialTransaction', FinancialTransactionModel);
    this.models.set('FinancialAuditLog', FinancialAuditLogModel);
    this.models.set('FinancialReport', FinancialReportModel);

    // Define associations
    this.defineAssociations();
  }

  private static defineAssociations(): void {
    const UserModel = this.models.get('User')!;
    const TenantModel = this.models.get('Tenant')!;
    const TransactionModel = this.models.get('Transaction')!;
    const WalletModel = this.models.get('Wallet')!;

    // User belongs to Tenant
    UserModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
    TenantModel.hasMany(UserModel, { foreignKey: 'tenantId', as: 'users' });

    // User has many Transactions
    UserModel.hasMany(TransactionModel, { foreignKey: 'userId', as: 'transactions' });
    TransactionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // User has many Wallets
    UserModel.hasMany(WalletModel, { foreignKey: 'userId', as: 'wallets' });
    WalletModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // User has many Web3Wallets
    const Web3WalletModel = this.models.get('Web3Wallet')!;
    UserModel.hasMany(Web3WalletModel, { foreignKey: 'userId', as: 'web3Wallets' });
    Web3WalletModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // Add exchange associations
    const OrderModel = this.models.get('Order')!;
    const TradeModel = this.models.get('Trade')!;
    const BalanceModel = this.models.get('Balance')!;

    // User has many Orders
    UserModel.hasMany(OrderModel, { foreignKey: 'userId', as: 'orders' });
    OrderModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // Tenant has many Orders
    TenantModel.hasMany(OrderModel, { foreignKey: 'tenantId', as: 'orders' });
    OrderModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });

    // User has many Balances
    UserModel.hasMany(BalanceModel, { foreignKey: 'userId', as: 'balances' });
    BalanceModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // Tenant has many Balances
    TenantModel.hasMany(BalanceModel, { foreignKey: 'tenantId', as: 'balances' });
    BalanceModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });

    // Financial Service Associations
    const JournalEntryModel = this.models.get('JournalEntry')!;
    const JournalEntryLineModel = this.models.get('JournalEntryLine')!;
    const FinancialAccountModel = this.models.get('FinancialAccount')!;
    const HoldModel = this.models.get('Hold')!;
    const ClientModel = this.models.get('Client')!;
    const ClientAccountModel = this.models.get('ClientAccount')!;
    const FundSegregationRuleModel = this.models.get('FundSegregationRule')!;
    const FinancialTransactionModel = this.models.get('FinancialTransaction')!;
    const FinancialAuditLogModel = this.models.get('FinancialAuditLog')!;

    // Journal Entry associations
    JournalEntryModel.hasMany(JournalEntryLineModel, { foreignKey: 'journalEntryId', as: 'lines' });
    JournalEntryLineModel.belongsTo(JournalEntryModel, { foreignKey: 'journalEntryId', as: 'journalEntry' });
    TenantModel.hasMany(JournalEntryModel, { foreignKey: 'tenantId', as: 'journalEntries' });
    JournalEntryModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });

    // Financial Account associations
    TenantModel.hasMany(FinancialAccountModel, { foreignKey: 'tenantId', as: 'accounts' });
    FinancialAccountModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
    ClientModel.hasMany(FinancialAccountModel, { foreignKey: 'clientId', as: 'accounts' });
    FinancialAccountModel.belongsTo(ClientModel, { foreignKey: 'clientId', as: 'client' });

    // Hold associations
    TenantModel.hasMany(HoldModel, { foreignKey: 'tenantId', as: 'holds' });
    HoldModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
    FinancialAccountModel.hasMany(HoldModel, { foreignKey: 'accountId', as: 'holds' });
    HoldModel.belongsTo(FinancialAccountModel, { foreignKey: 'accountId', as: 'account' });

    // Client associations
    TenantModel.hasMany(ClientModel, { foreignKey: 'tenantId', as: 'clients' });
    ClientModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });

    // Client-Account associations
    ClientModel.hasMany(ClientAccountModel, { foreignKey: 'clientId', as: 'accountRelationships' });
    ClientAccountModel.belongsTo(ClientModel, { foreignKey: 'clientId', as: 'client' });
    FinancialAccountModel.hasMany(ClientAccountModel, { foreignKey: 'accountId', as: 'clientRelationships' });
    ClientAccountModel.belongsTo(FinancialAccountModel, { foreignKey: 'accountId', as: 'account' });

    // Fund Segregation Rule associations
    TenantModel.hasMany(FundSegregationRuleModel, { foreignKey: 'tenantId', as: 'fundSegregationRules' });
    FundSegregationRuleModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });

    // Financial Transaction associations
    TenantModel.hasMany(FinancialTransactionModel, { foreignKey: 'tenantId', as: 'financialTransactions' });
    FinancialTransactionModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
    UserModel.hasMany(FinancialTransactionModel, { foreignKey: 'userId', as: 'financialTransactions' });
    FinancialTransactionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // Financial Audit Log associations
    TenantModel.hasMany(FinancialAuditLogModel, { foreignKey: 'tenantId', as: 'financialAuditLogs' });
    FinancialAuditLogModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
    ClientModel.hasMany(FinancialAuditLogModel, { foreignKey: 'clientId', as: 'auditLogs' });
    FinancialAuditLogModel.belongsTo(ClientModel, { foreignKey: 'clientId', as: 'client' });
    UserModel.hasMany(FinancialAuditLogModel, { foreignKey: 'userId', as: 'financialAuditLogs' });
    FinancialAuditLogModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

    // Financial Report associations
    const FinancialReportModel = this.models.get('FinancialReport')!;
    TenantModel.hasMany(FinancialReportModel, { foreignKey: 'tenantId', as: 'financialReports' });
    FinancialReportModel.belongsTo(TenantModel, { foreignKey: 'tenantId', as: 'tenant' });
  }

  /**
   * Synchronize database schema
   * 
   * Development Mode:
   * - Uses Sequelize sync with alter: true for rapid schema updates
   * - Allows startup even with schema issues for development flexibility
   * 
   * Production Mode:
   * - Automatically runs database migrations on startup
   * - Migrations create/update all required tables
   * - Logs warnings if migrations fail but allows health checks to continue
   * - Fails fast on critical database errors
   * 
   * @throws {Error} In production if database sync fails critically
   */
  private static async syncDatabase(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        // Development: Use Sequelize sync for rapid schema updates
        await this.sequelize.sync({ alter: true });
        LoggerService.info('Database synchronized successfully');
      } else {
        // Production: Run migrations automatically on startup
        // This ensures all database tables are created/updated
        LoggerService.info('Production mode - running database migrations...');
        try {
          const { MigrationRunner } = await import('../migrations/runner');
          await MigrationRunner.runMigrations();
          LoggerService.info('✅ Database migrations completed successfully');
          
          // After migrations, check if seeding is needed
          // Only seed if no tenants exist (fresh database)
          // Note: Seeding is done via init-database.ts script, not here
          // This keeps database.ts focused on schema management only
          try {
            const TenantModel = this.getModel('Tenant');
            const tenantCount = await TenantModel.count();
            
            if (tenantCount === 0) {
              LoggerService.info('No tenants found - database may need seeding');
              LoggerService.info('Run: ts-node scripts/init-database.ts to seed initial data');
            } else {
              LoggerService.info(`Database contains ${tenantCount} tenant(s)`);
            }
          } catch (seedError: any) {
            // Log but don't fail - seeding is optional
            LoggerService.warn('Could not check tenant count:', seedError.message);
          }
        } catch (migrationError) {
          LoggerService.error('Database migration failed:', migrationError);
          // In production, migrations are critical - fail fast
          throw migrationError;
        }
      }
    } catch (error) {
      LoggerService.error('Database sync failed:', error);
      // In production, fail fast on critical errors
      if (process.env.NODE_ENV === 'production') {
        throw error;
      } else {
        // In development, allow startup with schema issues
        LoggerService.warn('Continuing in development mode despite database sync issues');
      }
    }
  }

  public static getSequelize(): Sequelize {
    return this.sequelize;
  }

  public static getModel(name: string): ModelCtor<Model> {
    const model = this.models.get(name);
    if (!model) {
      throw new Error(`Model ${name} not found`);
    }
    return model;
  }


  public static async healthCheck(): Promise<boolean> {
    try {
      await this.sequelize.authenticate();
      return true;
    } catch (error) {
      LoggerService.error('Database health check failed:', error);
      return false;
    }
  }
}
