#!/usr/bin/env ts-node

/**
 * Database Optimization Script
 * Adds missing indexes and optimizes queries for production performance
 */

import { DatabaseService } from '../src/services/database';
import { LoggerService } from '../src/services/logger';

class DatabaseOptimizer {
  static async optimize(): Promise<void> {
    LoggerService.info('🚀 Starting database optimization...');

    try {
      // Initialize database connection
      await DatabaseService.initialize();
      const sequelize = DatabaseService.getSequelize();

      // Add critical indexes for performance
      await this.addPerformanceIndexes(sequelize);

      // Analyze and optimize existing indexes
      await this.analyzeIndexes(sequelize);

      // Add composite indexes for common query patterns
      await this.addCompositeIndexes(sequelize);

      // Optimize table statistics
      await this.updateTableStatistics(sequelize);

      LoggerService.info('✅ Database optimization completed successfully');

    } catch (error) {
      LoggerService.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  private static async addPerformanceIndexes(sequelize: any): Promise<void> {
    LoggerService.info('Adding performance indexes...');

    const indexQueries = [
      // User table indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_tenant ON users(email, "tenantId") WHERE "isActive" = true;`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_tenant ON users(role, "tenantId") WHERE "isActive" = true;`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_kyc_status ON users("kycStatus", "kycLevel") WHERE "isActive" = true;`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users("lastLoginAt") WHERE "lastLoginAt" IS NOT NULL;`,

      // Transaction table indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_status ON transactions("userId", status) WHERE status IN ('pending', 'confirmed');`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type_status ON transactions(type, status, "createdAt");`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_hash ON transactions(hash) WHERE hash IS NOT NULL;`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_currency_amount ON transactions(currency, amount) WHERE status = 'confirmed';`,

      // Wallet table indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_active ON wallets("userId", "isActive") WHERE "isActive" = true;`,

      // Margin trading indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_margin_accounts_user_broker ON margin_accounts("userId", "tenantId", "brokerId", status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_margin_positions_account_symbol ON margin_positions("accountId", symbol, status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_margin_orders_user_status ON margin_orders("userId", "tenantId", "brokerId", status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_liquidation_events_user_status ON liquidation_events("userId", "tenantId", "brokerId", status);`,

      // Omni exchange indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_orders_broker_user ON internal_orders("tenantId", "brokerId", "userId", status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_orders_exchange_symbol ON internal_orders("exchangeId", symbol, status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_allocations_exchange_asset ON platform_allocations("exchangeId", asset);`,

      // Financial service indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_tenant_client ON accounts("tenantId", "clientId", "isActive");`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_tenant_created ON journal_entries("tenantId", "createdAt");`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_transactions_tenant_status ON financial_transactions("tenantId", status, "createdAt");`,

      // Audit and compliance indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, "createdAt");`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_rule_messages_status ON travel_rule_messages(status, "createdAt");`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carf_reports_status ON carf_reports(status, "createdAt");`
    ];

    for (const query of indexQueries) {
      try {
        await sequelize.query(query);
        LoggerService.info(`✅ Created index: ${query.split('idx_')[1].split(' ')[0]}`);
      } catch (error) {
        LoggerService.warn(`⚠️  Failed to create index: ${error.message}`);
      }
    }
  }

  private static async analyzeIndexes(sequelize: any): Promise<void> {
    LoggerService.info('Analyzing existing indexes...');

    try {
      // Analyze table statistics
      const tables = [
        'users', 'transactions', 'wallets', 'margin_accounts', 'margin_positions',
        'internal_orders', 'accounts', 'journal_entries', 'financial_transactions'
      ];

      for (const table of tables) {
        try {
          await sequelize.query(`ANALYZE ${table}`);
          LoggerService.info(`✅ Analyzed table: ${table}`);
        } catch (error) {
          LoggerService.warn(`⚠️  Failed to analyze ${table}: ${error.message}`);
        }
      }
    } catch (error) {
      LoggerService.warn('Index analysis failed:', error);
    }
  }

  private static async addCompositeIndexes(sequelize: any): Promise<void> {
    LoggerService.info('Adding composite indexes for query optimization...');

    const compositeIndexes = [
      // Complex query patterns
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_tenant_status_created ON transactions("userId", "tenantId", status, "createdAt" DESC);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_margin_positions_user_broker_symbol ON margin_positions("userId", "tenantId", "brokerId", symbol, status);`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_tenant_symbol_status ON orders("userId", "tenantId", symbol, status, "createdAt" DESC);`,

      // Reporting and analytics
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_amount ON transactions("createdAt", amount) WHERE status = 'confirmed';`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_margin_positions_created_pnl ON margin_positions("createdAt", "unrealizedPnl") WHERE status = 'open';`
    ];

    for (const query of compositeIndexes) {
      try {
        await sequelize.query(query);
        LoggerService.info(`✅ Created composite index: ${query.split('idx_')[1].split(' ')[0]}`);
      } catch (error) {
        LoggerService.warn(`⚠️  Failed to create composite index: ${error.message}`);
      }
    }
  }

  private static async updateTableStatistics(sequelize: any): Promise<void> {
    LoggerService.info('Updating table statistics...');

    try {
      // Update statistics for better query planning
      await sequelize.query('VACUUM ANALYZE');
      LoggerService.info('✅ Updated table statistics');
    } catch (error) {
      LoggerService.warn('Failed to update table statistics:', error);
    }
  }

  static async validate(): Promise<void> {
    LoggerService.info('🔍 Validating database optimization...');

    try {
      const sequelize = DatabaseService.getSequelize();

      // Check if critical indexes exist
      const criticalIndexes = [
        'idx_users_email_tenant',
        'idx_transactions_user_status',
        'idx_margin_accounts_user_broker',
        'idx_internal_orders_broker_user'
      ];

      for (const indexName of criticalIndexes) {
        const [results] = await sequelize.query(`
          SELECT 1 FROM pg_indexes
          WHERE indexname = '${indexName}'
          LIMIT 1
        `);

        if (results.length === 0) {
          throw new Error(`Critical index missing: ${indexName}`);
        }
      }

      LoggerService.info('✅ Database optimization validation passed');

    } catch (error) {
      LoggerService.error('❌ Database optimization validation failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];

  try {
    if (command === 'optimize') {
      await DatabaseOptimizer.optimize();
    } else if (command === 'validate') {
      await DatabaseOptimizer.validate();
    } else if (command === 'all') {
      await DatabaseOptimizer.optimize();
      await DatabaseOptimizer.validate();
    } else {
      console.log('Usage: ts-node database-optimization.ts [optimize|validate|all]');
      console.log('Commands:');
      console.log('  optimize    Add performance indexes and optimize database');
      console.log('  validate    Validate database optimization');
      console.log('  all         Optimize and validate database');
      process.exit(1);
    }

  } catch (error) {
    console.error('Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseOptimizer };
     