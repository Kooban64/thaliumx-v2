/**
 * Migration: Create Margin Trading Tables
 *
 * Creates all tables required for advanced margin trading functionality:
 * - margin_accounts: User margin accounts with fund segregation
 * - margin_positions: Open margin positions
 * - margin_orders: Margin trading orders
 * - liquidation_events: Position liquidation records
 * - margin_transfers: Margin account transfers
 * - risk_limits: User risk management limits
 * - funding_rates: Perpetual contract funding rates
 */

import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    // Create margin_accounts table
    await queryInterface.createTable('margin_accounts', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accountType: {
        type: DataTypes.ENUM('isolated', 'cross'),
        allowNull: false,
        defaultValue: 'cross'
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('active', 'margin_call', 'liquidation', 'suspended', 'closed'),
        allowNull: false,
        defaultValue: 'active'
      },
      // Balance Management
      totalEquity: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      totalMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      availableBalance: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      usedMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      freeMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      marginLevel: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      marginRatio: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      // Risk Management
      maxLeverage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10
      },
      maintenanceMarginRatio: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.1'
      },
      liquidationThreshold: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.05'
      },
      marginCallThreshold: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.15'
      },
      // Fund Segregation (JSON fields for complex structures)
      userSegregation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      brokerSegregation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      platformSegregation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      segregatedBalances: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      borrowedAssets: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      collateralAssets: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      // Metadata
      lastRiskCheck: {
        type: DataTypes.DATE,
        allowNull: true
      },
      riskScore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      complianceFlags: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create margin_positions table
    await queryInterface.createTable('margin_positions', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false
      },
      side: {
        type: DataTypes.ENUM('long', 'short'),
        allowNull: false
      },
      size: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      entryPrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      currentPrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      leverage: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      // Margin Management
      initialMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      maintenanceMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      marginUsed: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      liquidationPrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      // P&L Tracking
      unrealizedPnl: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      realizedPnl: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      fundingFee: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      interestFee: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      // Status
      status: {
        type: DataTypes.ENUM('open', 'closing', 'closed', 'liquidated'),
        allowNull: false,
        defaultValue: 'open'
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      // Risk Metrics
      marginRatio: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '100'
      },
      riskScore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      volatility: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0.2'
      },
      maxDrawdown: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      // Fund Segregation
      userFundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      brokerFundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      platformFundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      fundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      }
    });

    // Create margin_orders table
    await queryInterface.createTable('margin_orders', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false
      },
      side: {
        type: DataTypes.ENUM('buy', 'sell'),
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('market', 'limit', 'stop', 'stop_limit'),
        allowNull: false
      },
      quantity: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      price: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: true
      },
      stopPrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: true
      },
      leverage: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      // Order Management
      status: {
        type: DataTypes.ENUM('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      filledQuantity: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      averagePrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '0'
      },
      remainingQuantity: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      // Margin Requirements
      marginRequired: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      marginUsed: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      // Risk & Compliance
      riskScore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      complianceFlags: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      // Fund Segregation
      fundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      filledAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // Create liquidation_events table
    await queryInterface.createTable('liquidation_events', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      positionId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Liquidation Details
      liquidationPrice: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      liquidationAmount: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      liquidationValue: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      remainingMargin: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      penaltyFee: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      // Risk Metrics
      marginRatio: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false
      },
      riskScore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false
      },
      // Reason & Status
      reason: {
        type: DataTypes.ENUM('margin_call', 'forced_liquidation', 'risk_limit_exceeded'),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'executed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      // Timestamps
      triggeredAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      executedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // Fund Segregation
      fundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create margin_transfers table
    await queryInterface.createTable('margin_transfers', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fromAccount: {
        type: DataTypes.STRING,
        allowNull: false
      },
      toAccount: {
        type: DataTypes.STRING,
        allowNull: false
      },
      asset: {
        type: DataTypes.STRING,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false
      },
      type: {
        type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'collateral_add', 'collateral_remove'),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      // Risk Checks
      riskScore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '0'
      },
      complianceFlags: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      // Fund Segregation
      fundAllocation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // Create risk_limits table
    await queryInterface.createTable('risk_limits', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      brokerId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Leverage Limits
      maxLeverage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10
      },
      maxPositionSize: {
        type: DataTypes.DECIMAL(36, 18),
        allowNull: false,
        defaultValue: '100000'
      },
      maxOpenPositions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
      },
      // Risk Limits
      maxAccountRisk: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '80'
      },
      maxDrawdown: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '50'
      },
      maxVolatility: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        defaultValue: '100'
      },
      // Margin Limits
      marginCallThreshold: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.15'
      },
      liquidationThreshold: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.05'
      },
      maintenanceMarginRatio: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: '0.1'
      },
      // Compliance
      kycRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      amlRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      riskTier: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'professional'),
        allowNull: false,
        defaultValue: 'medium'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create funding_rates table
    await queryInterface.createTable('funding_rates', {
      symbol: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      rate: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false
      },
      nextFundingTime: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Create indexes for performance
    await queryInterface.addIndex('margin_accounts', ['userId', 'tenantId', 'brokerId'], {
      unique: true,
      name: 'margin_accounts_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('margin_accounts', ['status'], {
      name: 'margin_accounts_status_idx'
    });

    await queryInterface.addIndex('margin_positions', ['userId', 'tenantId', 'brokerId'], {
      name: 'margin_positions_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('margin_positions', ['accountId'], {
      name: 'margin_positions_account_idx'
    });
    await queryInterface.addIndex('margin_positions', ['symbol'], {
      name: 'margin_positions_symbol_idx'
    });
    await queryInterface.addIndex('margin_positions', ['status'], {
      name: 'margin_positions_status_idx'
    });

    await queryInterface.addIndex('margin_orders', ['userId', 'tenantId', 'brokerId'], {
      name: 'margin_orders_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('margin_orders', ['accountId'], {
      name: 'margin_orders_account_idx'
    });
    await queryInterface.addIndex('margin_orders', ['status'], {
      name: 'margin_orders_status_idx'
    });

    await queryInterface.addIndex('liquidation_events', ['userId', 'tenantId', 'brokerId'], {
      name: 'liquidation_events_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('liquidation_events', ['positionId'], {
      name: 'liquidation_events_position_idx'
    });
    await queryInterface.addIndex('liquidation_events', ['status'], {
      name: 'liquidation_events_status_idx'
    });

    await queryInterface.addIndex('margin_transfers', ['userId', 'tenantId', 'brokerId'], {
      name: 'margin_transfers_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('margin_transfers', ['status'], {
      name: 'margin_transfers_status_idx'
    });

    await queryInterface.addIndex('risk_limits', ['userId', 'tenantId', 'brokerId'], {
      unique: true,
      name: 'risk_limits_user_tenant_broker_idx'
    });
    await queryInterface.addIndex('risk_limits', ['riskTier'], {
      name: 'risk_limits_tier_idx'
    });

    await queryInterface.addIndex('funding_rates', ['nextFundingTime'], {
      name: 'funding_rates_next_time_idx'
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    // Drop tables in reverse order to handle foreign key constraints
    await queryInterface.dropTable('funding_rates');
    await queryInterface.dropTable('risk_limits');
    await queryInterface.dropTable('margin_transfers');
    await queryInterface.dropTable('liquidation_events');
    await queryInterface.dropTable('margin_orders');
    await queryInterface.dropTable('margin_positions');
    await queryInterface.dropTable('margin_accounts');
  }
};