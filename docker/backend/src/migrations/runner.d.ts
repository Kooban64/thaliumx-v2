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
interface Migration {
    name: string;
    up: (queryInterface: any, Sequelize: any) => Promise<void>;
    down: (queryInterface: any) => Promise<void>;
}
export declare class MigrationRunner {
    private static sequelize;
    private static migrationsTable;
    /**
     * Initialize migration runner with database connection
     * Ensures DatabaseService is initialized before running migrations
     */
    static initialize(): Promise<void>;
    static ensureMigrationsTable(): Promise<void>;
    static getExecutedMigrations(): Promise<string[]>;
    static loadMigrations(): Promise<Migration[]>;
    static runMigrations(): Promise<void>;
    static rollbackLast(): Promise<void>;
}
export {};
//# sourceMappingURL=runner.d.ts.map