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
import { Sequelize, Model, ModelCtor } from 'sequelize';
export declare class DatabaseService {
    private static sequelize;
    private static models;
    private static isInitialized;
    /**
     * Initialize database connection and schema
     *
     * In production: Runs migrations automatically to create/update schema
     * In development: Uses Sequelize sync for rapid schema updates
     *
     * @throws {Error} If database connection fails or initialization fails
     */
    static initialize(): Promise<void>;
    /**
     * Check if database connection is active
     * @returns {boolean} True if database is initialized and connected
     */
    static isConnected(): boolean;
    /**
     * Close database connection and cleanup
     * Should be called during graceful shutdown
     */
    static close(): Promise<void>;
    private static initializeModels;
    private static defineAssociations;
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
    private static syncDatabase;
    static getSequelize(): Sequelize;
    static getModel(name: string): ModelCtor<Model>;
    static healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=database.d.ts.map