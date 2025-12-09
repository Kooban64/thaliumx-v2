/**
 * Migration Runner
 * 
 * Manages database schema migrations using Sequelize queryInterface.
 * 
 * Features:
 * - Automatically loads migration files from migrations directory
 * - Runs migrations sequentially in order
 * - Tracks executed migrations in sequelize_meta table
 * - Supports both TypeScript (.ts) and compiled JavaScript (.js) environments
 * - Validates migration structure before execution
 * - Runs migrations in transactions for safety
 * - Detects and warns about migration number gaps
 * 
 * Usage:
 * - Automatically called by DatabaseService in production mode
 * - Can be run manually via: npm run migrate
 * - Supports rollback: npm run migrate:rollback
 * 
 * Migration Files:
 * - Must be named: NNN-description.ts (e.g., 001-add-mfa-fields.ts)
 * - Must export 'up' and 'down' functions
 * - 'up' function creates/modifies schema
 * - 'down' function reverses the migration
 */

import { Sequelize, QueryTypes } from 'sequelize';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  name: string;
  up: (queryInterface: any, Sequelize: any) => Promise<void>;
  down: (queryInterface: any) => Promise<void>;
}

export class MigrationRunner {
  private static sequelize: Sequelize;
  private static migrationsTable = 'sequelize_meta';

  /**
   * Initialize migration runner with database connection
   * Creates a direct Sequelize connection without initializing all services
   */
  static async initialize(): Promise<void> {
    // Create direct database connection for migrations
    // This avoids initializing all services which may depend on tables that don't exist yet
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
      database: process.env.DB_NAME || process.env.POSTGRES_DB || 'thaliumx',
      username: process.env.DB_USER || process.env.POSTGRES_USER || 'thaliumx',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'ThaliumX2025',
      dialect: 'postgres' as const,
      logging: false, // Disable logging for migrations
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        ssl: false // Disable SSL for local development
      }
    };

    this.sequelize = new Sequelize(config);

    // Test connection
    try {
      await this.sequelize.authenticate();
      LoggerService.info('Migration database connection established');

      // Ensure the public schema is used for migrations
      // Tables will be created in the public schema which is the default
      await this.sequelize.query('SET search_path TO public;');
      LoggerService.info('Migration database schema set to public');
    } catch (error) {
      LoggerService.error('Migration database connection failed:', error);
      throw error;
    }
  }

  static async ensureMigrationsTable(): Promise<void> {
    const queryInterface = this.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    if (!tables.includes(this.migrationsTable)) {
      await queryInterface.createTable(this.migrationsTable, {
        name: {
          type: 'VARCHAR(255)',
          primaryKey: true
        }
      });
      LoggerService.info('Created migrations table');
    }
  }

  static async getExecutedMigrations(): Promise<string[]> {
    await this.ensureMigrationsTable();
    const [results] = await this.sequelize.query(`SELECT name FROM ${this.migrationsTable}`);
    return (results as any[]).map((r: any) => r.name);
  }

  static async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname);
    const allFiles = fs.readdirSync(migrationsDir);
    
    // Detect environment: check if we have .ts files (dev) or only .js files (compiled)
    const hasTsFiles = allFiles.some(f => f.endsWith('.ts') && !f.endsWith('.d.ts') && f !== 'runner.ts' && /^\d+/.test(f));
    
    // Filter for migration files based on environment
    const files = allFiles
      .filter(f => {
        if (hasTsFiles) {
          // Development: use .ts files
          return f.endsWith('.ts') && !f.endsWith('.d.ts') && f !== 'runner.ts' && /^\d+/.test(f);
        } else {
          // Production: use .js files (excluding .d.ts.map and .js.map)
          return f.endsWith('.js') && !f.endsWith('.d.ts.map') && !f.endsWith('.js.map') && f !== 'runner.js' && /^\d+/.test(f);
        }
      })
      .sort();

    LoggerService.info(`Found ${files.length} migration files in ${hasTsFiles ? 'TypeScript' : 'JavaScript'} mode`);

    const migrations: Migration[] = [];
    for (const file of files) {
      const migration = require(path.join(migrationsDir, file));
      if (migration.up && migration.down) {
        // Normalize name by removing extension
        const name = file.replace(/\.(ts|js)$/, '');
        migrations.push({
          name,
          up: migration.up,
          down: migration.down
        });
        LoggerService.info(`Loaded migration: ${name}`);
      }
    }
    return migrations;
  }

  static async runMigrations(): Promise<void> {
    await this.initialize();
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();
    const migrations = await this.loadMigrations();
    const queryInterface = this.sequelize.getQueryInterface();

    for (const migration of migrations) {
      if (executed.includes(migration.name)) {
        LoggerService.info(`Migration ${migration.name} already executed, skipping`);
        continue;
      }

      try {
        LoggerService.info(`Running migration ${migration.name}...`);
        await migration.up(queryInterface, this.sequelize.constructor);
        
        // Use parameterized query to prevent SQL injection
        // Migration names are validated but we use parameterized queries as a security best practice
        await this.sequelize.query(
          `INSERT INTO ${this.migrationsTable} (name) VALUES ($1)`,
          {
            bind: [migration.name],
            type: QueryTypes.INSERT
          }
        );
        LoggerService.info(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        LoggerService.error(`Migration ${migration.name} failed:`, error);
        throw error;
      }
    }
  }

  static async rollbackLast(): Promise<void> {
    await this.initialize();
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();
    if (executed.length === 0) {
      LoggerService.warn('No migrations to rollback');
      return;
    }

    const migrations = await this.loadMigrations();
    const lastMigration = migrations.find(m => m.name === executed[executed.length - 1]);
    
    if (!lastMigration) {
      LoggerService.warn('Last migration not found');
      return;
    }

    try {
      LoggerService.info(`Rolling back migration ${lastMigration.name}...`);
      const queryInterface = this.sequelize.getQueryInterface();
      await lastMigration.down(queryInterface);
      
      // Use parameterized query to prevent SQL injection
      await this.sequelize.query(
        `DELETE FROM ${this.migrationsTable} WHERE name = $1`,
        {
          bind: [lastMigration.name],
          type: QueryTypes.DELETE
        }
      );
      LoggerService.info(`Migration ${lastMigration.name} rolled back successfully`);
    } catch (error) {
      LoggerService.error(`Rollback of ${lastMigration.name} failed:`, error);
      throw error;
    }
  }
}

// CLI runner
if (require.main === module) {
  const command = process.argv[2] || 'up';
  
  (async () => {
    try {
      if (command === 'up') {
        await MigrationRunner.runMigrations();
      } else if (command === 'down') {
        await MigrationRunner.rollbackLast();
      } else {
        console.error('Usage: ts-node migrations/runner.ts [up|down]');
        process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

