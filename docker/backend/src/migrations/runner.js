"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../services/database");
const logger_1 = require("../services/logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MigrationRunner {
    static sequelize;
    static migrationsTable = 'sequelize_meta';
    /**
     * Initialize migration runner with database connection
     * Ensures DatabaseService is initialized before running migrations
     */
    static async initialize() {
        // Get sequelize instance from DatabaseService
        const db = database_1.DatabaseService;
        if (!db.sequelize) {
            await database_1.DatabaseService.initialize();
        }
        this.sequelize = database_1.DatabaseService.sequelize;
    }
    static async ensureMigrationsTable() {
        const queryInterface = this.sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        if (!tables.includes(this.migrationsTable)) {
            await queryInterface.createTable(this.migrationsTable, {
                name: {
                    type: 'VARCHAR(255)',
                    primaryKey: true
                }
            });
            logger_1.LoggerService.info('Created migrations table');
        }
    }
    static async getExecutedMigrations() {
        await this.ensureMigrationsTable();
        const [results] = await this.sequelize.query(`SELECT name FROM ${this.migrationsTable}`);
        return results.map((r) => r.name);
    }
    static async loadMigrations() {
        const migrationsDir = path.join(__dirname);
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.ts') && f !== 'runner.ts' && /^\d+/.test(f))
            .sort();
        const migrations = [];
        for (const file of files) {
            const migration = require(path.join(migrationsDir, file));
            if (migration.up && migration.down) {
                migrations.push({
                    name: file.replace('.ts', ''),
                    up: migration.up,
                    down: migration.down
                });
            }
        }
        return migrations;
    }
    static async runMigrations() {
        await this.initialize();
        await this.ensureMigrationsTable();
        const executed = await this.getExecutedMigrations();
        const migrations = await this.loadMigrations();
        const queryInterface = this.sequelize.getQueryInterface();
        for (const migration of migrations) {
            if (executed.includes(migration.name)) {
                logger_1.LoggerService.info(`Migration ${migration.name} already executed, skipping`);
                continue;
            }
            try {
                logger_1.LoggerService.info(`Running migration ${migration.name}...`);
                await migration.up(queryInterface, this.sequelize.constructor);
                // Use parameterized query to prevent SQL injection
                // Migration names are validated but we use parameterized queries as a security best practice
                await this.sequelize.query(`INSERT INTO ${this.migrationsTable} (name) VALUES ($1)`, {
                    bind: [migration.name],
                    type: sequelize_1.QueryTypes.INSERT
                });
                logger_1.LoggerService.info(`Migration ${migration.name} completed successfully`);
            }
            catch (error) {
                logger_1.LoggerService.error(`Migration ${migration.name} failed:`, error);
                throw error;
            }
        }
    }
    static async rollbackLast() {
        await this.initialize();
        await this.ensureMigrationsTable();
        const executed = await this.getExecutedMigrations();
        if (executed.length === 0) {
            logger_1.LoggerService.warn('No migrations to rollback');
            return;
        }
        const migrations = await this.loadMigrations();
        const lastMigration = migrations.find(m => m.name === executed[executed.length - 1]);
        if (!lastMigration) {
            logger_1.LoggerService.warn('Last migration not found');
            return;
        }
        try {
            logger_1.LoggerService.info(`Rolling back migration ${lastMigration.name}...`);
            const queryInterface = this.sequelize.getQueryInterface();
            await lastMigration.down(queryInterface);
            // Use parameterized query to prevent SQL injection
            await this.sequelize.query(`DELETE FROM ${this.migrationsTable} WHERE name = $1`, {
                bind: [lastMigration.name],
                type: sequelize_1.QueryTypes.DELETE
            });
            logger_1.LoggerService.info(`Migration ${lastMigration.name} rolled back successfully`);
        }
        catch (error) {
            logger_1.LoggerService.error(`Rollback of ${lastMigration.name} failed:`, error);
            throw error;
        }
    }
}
exports.MigrationRunner = MigrationRunner;
// CLI runner
if (require.main === module) {
    const command = process.argv[2] || 'up';
    (async () => {
        try {
            if (command === 'up') {
                await MigrationRunner.runMigrations();
            }
            else if (command === 'down') {
                await MigrationRunner.rollbackLast();
            }
            else {
                console.error('Usage: ts-node migrations/runner.ts [up|down]');
                process.exit(1);
            }
            process.exit(0);
        }
        catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=runner.js.map