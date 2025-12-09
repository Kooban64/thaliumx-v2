#!/usr/bin/env ts-node

/**
 * Database Initialization Script
 * 
 * Ensures database is properly initialized, migrated, and seeded for production.
 * This script should be run on container startup to ensure database persistence.
 * 
 * Features:
 * - Runs all database migrations
 * - Seeds initial data (tenants, platform admin, etc.)
 * - Validates database schema
 * - Ensures data persistence
 * 
 * Usage:
 * - Automatically called by DatabaseService in production
 * - Can be run manually: ts-node scripts/init-database.ts
 */

import { DatabaseService } from '../src/services/database';
import { LoggerService } from '../src/services/logger';
import { DatabaseSeeder } from './database-seeder';

class DatabaseInitializer {
  /**
   * Initialize database with migrations and seeding
   */
  static async initialize(): Promise<void> {
    LoggerService.info('🚀 Starting database initialization...');

    try {
      // Step 1: Initialize database connection
      LoggerService.info('Step 1: Connecting to database...');
      await DatabaseService.initialize();
      LoggerService.info('✅ Database connection established');

      // Step 2: Run migrations (handled by DatabaseService.initialize)
      // Migrations are automatically run in production mode
      LoggerService.info('✅ Database migrations completed (if any)');

      // Step 3: Validate critical tables exist
      LoggerService.info('Step 2: Validating database schema...');
      await this.validateSchema();
      LoggerService.info('✅ Database schema validated');

      // Step 4: Seed initial data if needed
      LoggerService.info('Step 3: Checking if seeding is needed...');
      const needsSeeding = await this.checkIfSeedingNeeded();
      
      if (needsSeeding) {
        LoggerService.info('Step 4: Seeding initial data...');
        await DatabaseSeeder.seed();
        LoggerService.info('✅ Database seeding completed');
      } else {
        LoggerService.info('✅ Database already seeded, skipping');
      }

      // Step 5: Verify data persistence
      LoggerService.info('Step 5: Verifying data persistence...');
      await this.verifyPersistence();
      LoggerService.info('✅ Data persistence verified');

      LoggerService.info('🎉 Database initialization completed successfully');

    } catch (error: any) {
      LoggerService.error('❌ Database initialization failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Validate that critical tables exist
   */
  private static async validateSchema(): Promise<void> {
    const sequelize = DatabaseService.getSequelize();
    const queryInterface = sequelize.getQueryInterface();
    
    const requiredTables = [
      'tenants',
      'users',
      'sequelize_meta'
    ];

    const existingTables = await queryInterface.showAllTables();
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(
        `Critical tables missing: ${missingTables.join(', ')}. ` +
        'Please ensure migrations have run successfully.'
      );
    }

    LoggerService.info(`✅ All required tables exist: ${requiredTables.join(', ')}`);
  }

  /**
   * Check if database needs seeding
   * Returns true if no tenants exist (indicating fresh database)
   */
  private static async checkIfSeedingNeeded(): Promise<boolean> {
    try {
      const TenantModel = DatabaseService.getModel('Tenant');
      const tenantCount = await TenantModel.count();
      
      // If no tenants exist, we need to seed
      if (tenantCount === 0) {
        LoggerService.info('No tenants found, seeding required');
        return true;
      }

      LoggerService.info(`Found ${tenantCount} existing tenant(s), seeding not required`);
      return false;
    } catch (error: any) {
      // If there's an error checking, assume we need to seed
      LoggerService.warn('Error checking if seeding needed, will attempt seeding:', error.message);
      return true;
    }
  }

  /**
   * Verify data persistence by reading back seeded data
   */
  private static async verifyPersistence(): Promise<void> {
    try {
      const TenantModel = DatabaseService.getModel('Tenant');
      const tenants = await TenantModel.findAll({ limit: 1 });
      
      if (tenants.length === 0) {
        throw new Error('No tenants found after seeding - persistence verification failed');
      }

      LoggerService.info('✅ Data persistence verified - tenants can be read from database');
    } catch (error: any) {
      LoggerService.error('Data persistence verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Health check for database initialization status
   */
  static async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const isConnected = DatabaseService.isConnected();
      if (!isConnected) {
        return { healthy: false, message: 'Database not connected' };
      }

      const TenantModel = DatabaseService.getModel('Tenant');
      const tenantCount = await TenantModel.count();
      
      if (tenantCount === 0) {
        return { 
          healthy: false, 
          message: 'Database not initialized - no tenants found' 
        };
      }

      return { 
        healthy: true, 
        message: `Database healthy - ${tenantCount} tenant(s) found` 
      };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: `Database health check failed: ${error.message}` 
      };
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'init';

  try {
    if (command === 'init' || command === 'initialize') {
      await DatabaseInitializer.initialize();
    } else if (command === 'health') {
      const health = await DatabaseInitializer.healthCheck();
      console.log(JSON.stringify(health, null, 2));
      process.exit(health.healthy ? 0 : 1);
    } else if (command === 'validate') {
      await DatabaseService.initialize();
      await DatabaseInitializer.validateSchema();
      console.log('✅ Schema validation passed');
    } else {
      console.log('Usage: ts-node init-database.ts [init|health|validate]');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseInitializer };

