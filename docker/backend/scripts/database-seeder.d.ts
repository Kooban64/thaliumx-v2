#!/usr/bin/env ts-node
/**
 * Database Seeder Script
 * Seeds the database with test data for development and testing
 */
declare class DatabaseSeeder {
    static seed(): Promise<void>;
    private static seedTenants;
    private static seedBrokers;
    private static seedUsers;
    private static seedMarginAccounts;
    private static seedTokens;
    static clean(): Promise<void>;
}
export { DatabaseSeeder };
//# sourceMappingURL=database-seeder.d.ts.map