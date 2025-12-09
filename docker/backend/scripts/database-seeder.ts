#!/usr/bin/env ts-node

/**
 * Database Seeder Script
 * Seeds the database with test data for development and testing
 */

import { DatabaseService } from '../src/services/database';
import { LoggerService } from '../src/services/logger';
import { UserService } from '../src/services/user';
import { BrokerManagementService } from '../src/services/broker-management';
import { AdvancedMarginTradingService } from '../src/services/advanced-margin';
import { TokenService } from '../src/services/token';

class DatabaseSeeder {
  static async seed(): Promise<void> {
    LoggerService.info('🌱 Starting database seeding...');

    try {
      // Initialize database connection
      await DatabaseService.initialize();
      LoggerService.info('✅ Database connection established');

      // Seed tenants
      await this.seedTenants();

      // Seed brokers
      await this.seedBrokers();

      // Seed users
      await this.seedUsers();

      // Seed margin accounts
      await this.seedMarginAccounts();

      // Seed tokens
      await this.seedTokens();

      LoggerService.info('✅ Database seeding completed successfully');

    } catch (error) {
      LoggerService.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  private static async seedTenants(): Promise<void> {
    LoggerService.info('Seeding tenants...');

    const tenants = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Platform Default',
        slug: 'platform',
        domain: 'platform.thaliumx.com',
        tenantType: 'platform',
        isActive: true,
        settings: {
          allowRegistration: true,
          requireKYC: true,
          requireMFA: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Test Tenant',
        slug: 'test-tenant',
        domain: 'test.thaliumx.com',
        tenantType: 'regular',
        isActive: true,
        settings: {
          allowRegistration: true,
          requireKYC: false,
          requireMFA: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Demo Broker',
        slug: 'demo-broker',
        domain: 'demo.thaliumx.com',
        tenantType: 'broker',
        isActive: true,
        settings: {
          allowRegistration: true,
          requireKYC: true,
          requireMFA: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const TenantModel = DatabaseService.getModel('Tenant');
    for (const tenant of tenants) {
      try {
        await TenantModel.upsert(tenant, {
          conflictFields: ['id']
        });
        LoggerService.info(`✅ Seeded/updated tenant: ${tenant.slug}`);
      } catch (error: any) {
        LoggerService.warn(`Failed to seed tenant ${tenant.slug}:`, error.message);
      }
    }

    LoggerService.info(`✅ Seeded ${tenants.length} tenants`);
  }

  private static async seedBrokers(): Promise<void> {
    LoggerService.info('Seeding brokers...');

    const brokers = [
      {
        id: 'test-broker',
        name: 'Test Broker',
        slug: 'test-broker',
        domain: 'test.thaliumx.com',
        status: 'active',
        tier: 'enterprise',
        apiKey: 'test_api_key_' + Math.random().toString(36).substr(2, 9),
        webhookSecret: 'test_webhook_secret_' + Math.random().toString(36).substr(2, 9),
        features: {
          marginTrading: true,
          spotTrading: true,
          futuresTrading: true,
          staking: true,
          lending: true
        },
        limits: {
          maxUsers: 1000,
          maxDailyVolume: 1000000,
          maxOpenOrders: 100
        },
        compliance: {
          kycRequired: true,
          amlRequired: true,
          sanctionsScreening: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const broker of brokers) {
      await BrokerManagementService.onboardBroker({
        name: broker.name,
        domain: broker.domain,
        tier: broker.tier as any,
        features: broker.features,
        limits: broker.limits as any,
        compliance: broker.compliance
      });
    }

    LoggerService.info(`✅ Seeded ${brokers.length} brokers`);
  }

  private static async seedUsers(): Promise<void> {
    LoggerService.info('Seeding users...');

    const users = [
      {
        email: 'admin@thaliumx.com',
        password: 'AdminPass123!',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        kycLevel: 'L3',
        kycStatus: 'approved',
        tenantId: 'test-tenant',
        brokerId: 'test-broker'
      },
      {
        email: 'trader@thaliumx.com',
        password: 'TraderPass123!',
        firstName: 'Test',
        lastName: 'Trader',
        role: 'trader',
        kycLevel: 'L2',
        kycStatus: 'approved',
        tenantId: 'test-tenant',
        brokerId: 'test-broker'
      },
      {
        email: 'user@thaliumx.com',
        password: 'UserPass123!',
        firstName: 'Regular',
        lastName: 'User',
        role: 'user',
        kycLevel: 'L1',
        kycStatus: 'approved',
        tenantId: 'test-tenant',
        brokerId: 'test-broker'
      }
    ];

    for (const userData of users) {
      try {
        await UserService.createUser({
          ...userData,
          isActive: true,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        LoggerService.warn(`User ${userData.email} may already exist:`, errorMessage);
      }
    }

    LoggerService.info(`✅ Seeded ${users.length} users`);
  }

  private static async seedMarginAccounts(): Promise<void> {
    LoggerService.info('Seeding margin accounts...');

    // Get test user
    const testUser = await UserService.getUserByEmail('trader@thaliumx.com');
    if (!testUser) {
      LoggerService.warn('Test trader not found, skipping margin account seeding');
      return;
    }

    const marginAccounts = [
      {
        userId: testUser.id,
        tenantId: 'test-tenant',
        brokerId: 'test-broker',
        accountType: 'cross' as const,
        initialDeposit: { asset: 'USDT', amount: 10000 }
      },
      {
        userId: testUser.id,
        tenantId: 'test-tenant',
        brokerId: 'test-broker',
        accountType: 'isolated' as const,
        symbol: 'BTCUSDT',
        initialDeposit: { asset: 'USDT', amount: 5000 }
      }
    ];

    for (const accountData of marginAccounts) {
      try {
        await AdvancedMarginTradingService.createMarginAccount(
          accountData.userId,
          accountData.tenantId,
          accountData.brokerId,
          accountData.accountType,
          accountData.symbol,
          accountData.initialDeposit
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        LoggerService.warn('Margin account creation failed:', errorMessage);
      }
    }

    LoggerService.info(`✅ Seeded ${marginAccounts.length} margin accounts`);
  }

  private static async seedTokens(): Promise<void> {
    LoggerService.info('Seeding tokens...');

    const tokens = [
      {
        symbol: 'THAL',
        name: 'ThaliumX Token',
        address: '0x1234567890123456789012345678901234567890',
        decimals: 18,
        totalSupply: '1000000000000000000000000', // 1M tokens
        isActive: true
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        totalSupply: '1000000000000000', // 1T USDT
        isActive: true
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        decimals: 8,
        totalSupply: '2100000000000000', // 21M BTC
        isActive: true
      }
    ];

    for (const token of tokens) {
      try {
        await TokenService.createWallet('admin-user', 'test-tenant', token.symbol, token.address);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        LoggerService.warn(`Token wallet creation failed for ${token.symbol}:`, errorMessage);
      }
    }

    LoggerService.info(`✅ Seeded ${tokens.length} tokens`);
  }

  static async clean(): Promise<void> {
    LoggerService.info('🧹 Cleaning database...');

    try {
      const sequelize = DatabaseService.getSequelize();

      // Disable foreign key checks
      await sequelize.query('SET CONSTRAINTS ALL DEFERRED');

      // List of tables to clean (in reverse dependency order)
      const tables = [
        'MarginLiquidationEvents',
        'MarginTransfers',
        'MarginOrders',
        'MarginPositions',
        'MarginAccounts',
        'TokenTransactions',
        'TokenWallets',
        'UserRoles',
        'Users',
        'Brokers',
        'Tenants'
      ];

      for (const table of tables) {
        try {
          await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`);
          LoggerService.info(`Truncated table: ${table}`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          LoggerService.warn(`Failed to truncate ${table}:`, errorMessage);
        }
      }

      // Re-enable foreign key checks
      await sequelize.query('SET CONSTRAINTS ALL IMMEDIATE');

      LoggerService.info('✅ Database cleaning completed');

    } catch (error) {
      LoggerService.error('❌ Database cleaning failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];

  try {
    if (command === 'clean') {
      await DatabaseSeeder.clean();
    } else if (command === 'seed') {
      await DatabaseSeeder.seed();
    } else if (command === 'reset') {
      await DatabaseSeeder.clean();
      await DatabaseSeeder.seed();
    } else {
      console.log('Usage: ts-node database-seeder.ts [seed|clean|reset]');
      process.exit(1);
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseSeeder };