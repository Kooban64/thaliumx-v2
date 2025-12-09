#!/usr/bin/env ts-node
"use strict";
/**
 * Database Seeder Script
 * Seeds the database with test data for development and testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSeeder = void 0;
const database_1 = require("../src/services/database");
const logger_1 = require("../src/services/logger");
const user_1 = require("../src/services/user");
const broker_management_1 = require("../src/services/broker-management");
const advanced_margin_1 = require("../src/services/advanced-margin");
const token_1 = require("../src/services/token");
class DatabaseSeeder {
    static async seed() {
        logger_1.LoggerService.info('🌱 Starting database seeding...');
        try {
            // Initialize database connection
            await database_1.DatabaseService.initialize();
            logger_1.LoggerService.info('✅ Database connection established');
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
            logger_1.LoggerService.info('✅ Database seeding completed successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Database seeding failed:', error);
            throw error;
        }
    }
    static async seedTenants() {
        logger_1.LoggerService.info('Seeding tenants...');
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
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        for (const tenant of tenants) {
            try {
                await TenantModel.upsert(tenant, {
                    conflictFields: ['id']
                });
                logger_1.LoggerService.info(`✅ Seeded/updated tenant: ${tenant.slug}`);
            }
            catch (error) {
                logger_1.LoggerService.warn(`Failed to seed tenant ${tenant.slug}:`, error.message);
            }
        }
        logger_1.LoggerService.info(`✅ Seeded ${tenants.length} tenants`);
    }
    static async seedBrokers() {
        logger_1.LoggerService.info('Seeding brokers...');
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
            await broker_management_1.BrokerManagementService.onboardBroker({
                name: broker.name,
                domain: broker.domain,
                tier: broker.tier,
                features: broker.features,
                limits: broker.limits,
                compliance: broker.compliance
            });
        }
        logger_1.LoggerService.info(`✅ Seeded ${brokers.length} brokers`);
    }
    static async seedUsers() {
        logger_1.LoggerService.info('Seeding users...');
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
                await user_1.UserService.createUser({
                    ...userData,
                    isActive: true,
                    isVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger_1.LoggerService.warn(`User ${userData.email} may already exist:`, errorMessage);
            }
        }
        logger_1.LoggerService.info(`✅ Seeded ${users.length} users`);
    }
    static async seedMarginAccounts() {
        logger_1.LoggerService.info('Seeding margin accounts...');
        // Get test user
        const testUser = await user_1.UserService.getUserByEmail('trader@thaliumx.com');
        if (!testUser) {
            logger_1.LoggerService.warn('Test trader not found, skipping margin account seeding');
            return;
        }
        const marginAccounts = [
            {
                userId: testUser.id,
                tenantId: 'test-tenant',
                brokerId: 'test-broker',
                accountType: 'cross',
                initialDeposit: { asset: 'USDT', amount: 10000 }
            },
            {
                userId: testUser.id,
                tenantId: 'test-tenant',
                brokerId: 'test-broker',
                accountType: 'isolated',
                symbol: 'BTCUSDT',
                initialDeposit: { asset: 'USDT', amount: 5000 }
            }
        ];
        for (const accountData of marginAccounts) {
            try {
                await advanced_margin_1.AdvancedMarginTradingService.createMarginAccount(accountData.userId, accountData.tenantId, accountData.brokerId, accountData.accountType, accountData.symbol, accountData.initialDeposit);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger_1.LoggerService.warn('Margin account creation failed:', errorMessage);
            }
        }
        logger_1.LoggerService.info(`✅ Seeded ${marginAccounts.length} margin accounts`);
    }
    static async seedTokens() {
        logger_1.LoggerService.info('Seeding tokens...');
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
                await token_1.TokenService.createWallet('admin-user', 'test-tenant', token.symbol, token.address);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger_1.LoggerService.warn(`Token wallet creation failed for ${token.symbol}:`, errorMessage);
            }
        }
        logger_1.LoggerService.info(`✅ Seeded ${tokens.length} tokens`);
    }
    static async clean() {
        logger_1.LoggerService.info('🧹 Cleaning database...');
        try {
            const sequelize = database_1.DatabaseService.getSequelize();
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
                    logger_1.LoggerService.info(`Truncated table: ${table}`);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger_1.LoggerService.warn(`Failed to truncate ${table}:`, errorMessage);
                }
            }
            // Re-enable foreign key checks
            await sequelize.query('SET CONSTRAINTS ALL IMMEDIATE');
            logger_1.LoggerService.info('✅ Database cleaning completed');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Database cleaning failed:', error);
            throw error;
        }
    }
}
exports.DatabaseSeeder = DatabaseSeeder;
// CLI interface
async function main() {
    const command = process.argv[2];
    try {
        if (command === 'clean') {
            await DatabaseSeeder.clean();
        }
        else if (command === 'seed') {
            await DatabaseSeeder.seed();
        }
        else if (command === 'reset') {
            await DatabaseSeeder.clean();
            await DatabaseSeeder.seed();
        }
        else {
            console.log('Usage: ts-node database-seeder.ts [seed|clean|reset]');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Command failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=database-seeder.js.map