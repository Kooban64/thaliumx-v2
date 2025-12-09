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
declare class DatabaseInitializer {
    /**
     * Initialize database with migrations and seeding
     */
    static initialize(): Promise<void>;
    /**
     * Validate that critical tables exist
     */
    private static validateSchema;
    /**
     * Check if database needs seeding
     * Returns true if no tenants exist (indicating fresh database)
     */
    private static checkIfSeedingNeeded;
    /**
     * Verify data persistence by reading back seeded data
     */
    private static verifyPersistence;
    /**
     * Health check for database initialization status
     */
    static healthCheck(): Promise<{
        healthy: boolean;
        message: string;
    }>;
}
export { DatabaseInitializer };
//# sourceMappingURL=init-database.d.ts.map