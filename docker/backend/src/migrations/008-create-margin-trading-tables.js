"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
exports.default = {
    up: async (queryInterface) => {
        // Create margin_accounts table
        await queryInterface.createTable('margin_accounts', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            accountType: {
                type: sequelize_1.DataTypes.ENUM('isolated', 'cross'),
                allowNull: false,
                defaultValue: 'cross'
            },
            symbol: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('active', 'margin_call', 'liquidation', 'suspended', 'closed'),
                allowNull: false,
                defaultValue: 'active'
            },
            // Balance Management
            totalEquity: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            totalMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            availableBalance: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            usedMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            freeMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            marginLevel: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            marginRatio: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            // Risk Management
            maxLeverage: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 10
            },
            maintenanceMarginRatio: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.1'
            },
            liquidationThreshold: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.05'
            },
            marginCallThreshold: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.15'
            },
            // Fund Segregation (JSON fields for complex structures)
            userSegregation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            brokerSegregation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            platformSegregation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            segregatedBalances: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            borrowedAssets: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            collateralAssets: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            // Metadata
            lastRiskCheck: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            riskScore: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            complianceFlags: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: []
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            }
        });
        // Create margin_positions table
        await queryInterface.createTable('margin_positions', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            accountId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            symbol: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            side: {
                type: sequelize_1.DataTypes.ENUM('long', 'short'),
                allowNull: false
            },
            size: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            entryPrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            currentPrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            leverage: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false
            },
            // Margin Management
            initialMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            maintenanceMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            marginUsed: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            liquidationPrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            // P&L Tracking
            unrealizedPnl: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            realizedPnl: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            fundingFee: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            interestFee: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            // Status
            status: {
                type: sequelize_1.DataTypes.ENUM('open', 'closing', 'closed', 'liquidated'),
                allowNull: false,
                defaultValue: 'open'
            },
            openedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            closedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            // Risk Metrics
            marginRatio: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '100'
            },
            riskScore: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            volatility: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0.2'
            },
            maxDrawdown: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            // Fund Segregation
            userFundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            brokerFundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            platformFundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            fundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            }
        });
        // Create margin_orders table
        await queryInterface.createTable('margin_orders', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            accountId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            symbol: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            side: {
                type: sequelize_1.DataTypes.ENUM('buy', 'sell'),
                allowNull: false
            },
            type: {
                type: sequelize_1.DataTypes.ENUM('market', 'limit', 'stop', 'stop_limit'),
                allowNull: false
            },
            quantity: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            price: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: true
            },
            stopPrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: true
            },
            leverage: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false
            },
            // Order Management
            status: {
                type: sequelize_1.DataTypes.ENUM('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected'),
                allowNull: false,
                defaultValue: 'pending'
            },
            filledQuantity: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            averagePrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '0'
            },
            remainingQuantity: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            // Margin Requirements
            marginRequired: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            marginUsed: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            // Risk & Compliance
            riskScore: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            complianceFlags: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: []
            },
            // Fund Segregation
            fundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            filledAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            }
        });
        // Create liquidation_events table
        await queryInterface.createTable('liquidation_events', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            accountId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            positionId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            symbol: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            // Liquidation Details
            liquidationPrice: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            liquidationAmount: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            liquidationValue: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            remainingMargin: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            penaltyFee: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            // Risk Metrics
            marginRatio: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false
            },
            riskScore: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false
            },
            // Reason & Status
            reason: {
                type: sequelize_1.DataTypes.ENUM('margin_call', 'forced_liquidation', 'risk_limit_exceeded'),
                allowNull: false
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('pending', 'executed', 'failed'),
                allowNull: false,
                defaultValue: 'pending'
            },
            // Timestamps
            triggeredAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            executedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            // Fund Segregation
            fundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            }
        });
        // Create margin_transfers table
        await queryInterface.createTable('margin_transfers', {
            id: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            fromAccount: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            toAccount: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            asset: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            amount: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false
            },
            type: {
                type: sequelize_1.DataTypes.ENUM('deposit', 'withdrawal', 'transfer', 'collateral_add', 'collateral_remove'),
                allowNull: false
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
                allowNull: false,
                defaultValue: 'pending'
            },
            // Risk Checks
            riskScore: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '0'
            },
            complianceFlags: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: []
            },
            // Fund Segregation
            fundAllocation: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            completedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            }
        });
        // Create risk_limits table
        await queryInterface.createTable('risk_limits', {
            id: {
                type: sequelize_1.DataTypes.UUID,
                defaultValue: sequelize_1.DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            userId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            tenantId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            brokerId: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            // Leverage Limits
            maxLeverage: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 10
            },
            maxPositionSize: {
                type: sequelize_1.DataTypes.DECIMAL(36, 18),
                allowNull: false,
                defaultValue: '100000'
            },
            maxOpenPositions: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5
            },
            // Risk Limits
            maxAccountRisk: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '80'
            },
            maxDrawdown: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '50'
            },
            maxVolatility: {
                type: sequelize_1.DataTypes.DECIMAL(10, 4),
                allowNull: false,
                defaultValue: '100'
            },
            // Margin Limits
            marginCallThreshold: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.15'
            },
            liquidationThreshold: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.05'
            },
            maintenanceMarginRatio: {
                type: sequelize_1.DataTypes.DECIMAL(5, 4),
                allowNull: false,
                defaultValue: '0.1'
            },
            // Compliance
            kycRequired: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            amlRequired: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            riskTier: {
                type: sequelize_1.DataTypes.ENUM('low', 'medium', 'high', 'professional'),
                allowNull: false,
                defaultValue: 'medium'
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            }
        });
        // Create funding_rates table
        await queryInterface.createTable('funding_rates', {
            symbol: {
                type: sequelize_1.DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            rate: {
                type: sequelize_1.DataTypes.DECIMAL(10, 8),
                allowNull: false
            },
            nextFundingTime: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
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
    down: async (queryInterface) => {
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
