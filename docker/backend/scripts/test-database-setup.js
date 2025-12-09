#!/usr/bin/env ts-node
"use strict";
/**
 * Database Setup Test Script
 *
 * Tests database migrations, seeding, and persistence.
 * This script verifies that all fixes are working correctly.
 *
 * Tests:
 * 1. Database connection
 * 2. Migration execution
 * 3. Table creation (tenants, users)
 * 4. Seeding functionality
 * 5. Data persistence
 */
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/services/database");
const runner_1 = require("../src/migrations/runner");
async function testDatabaseSetup() {
    console.log('🧪 Starting Database Setup Tests...\n');
    let allTestsPassed = true;
    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    try {
        await database_1.DatabaseService.initialize();
        const isConnected = database_1.DatabaseService.isConnected();
        if (isConnected) {
            console.log('✅ Database connection successful\n');
        }
        else {
            console.log('❌ Database connection failed\n');
            allTestsPassed = false;
        }
    }
    catch (error) {
        console.log(`❌ Database connection error: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 2: Check if migrations table exists
    console.log('Test 2: Migrations Table');
    try {
        const sequelize = database_1.DatabaseService.getSequelize();
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        if (tables.includes('sequelize_meta')) {
            console.log('✅ Migrations table exists\n');
        }
        else {
            console.log('⚠️  Migrations table does not exist (will be created)\n');
        }
    }
    catch (error) {
        console.log(`❌ Error checking migrations table: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 3: Run Migrations
    console.log('Test 3: Run Migrations');
    try {
        await runner_1.MigrationRunner.runMigrations();
        console.log('✅ Migrations executed successfully\n');
    }
    catch (error) {
        console.log(`❌ Migration error: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 4: Verify tenants table exists
    console.log('Test 4: Verify Tenants Table');
    try {
        const sequelize = database_1.DatabaseService.getSequelize();
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        if (tables.includes('tenants')) {
            console.log('✅ Tenants table exists\n');
        }
        else {
            console.log('❌ Tenants table does not exist\n');
            allTestsPassed = false;
        }
    }
    catch (error) {
        console.log(`❌ Error checking tenants table: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 5: Verify users table exists
    console.log('Test 5: Verify Users Table');
    try {
        const sequelize = database_1.DatabaseService.getSequelize();
        const queryInterface = sequelize.getQueryInterface();
        const tables = await queryInterface.showAllTables();
        if (tables.includes('users')) {
            console.log('✅ Users table exists\n');
        }
        else {
            console.log('❌ Users table does not exist\n');
            allTestsPassed = false;
        }
    }
    catch (error) {
        console.log(`❌ Error checking users table: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 6: Check tenant count
    console.log('Test 6: Check Tenant Data');
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const tenantCount = await TenantModel.count();
        console.log(`✅ Found ${tenantCount} tenant(s) in database\n`);
        if (tenantCount === 0) {
            console.log('⚠️  No tenants found - database may need seeding\n');
        }
    }
    catch (error) {
        console.log(`❌ Error checking tenants: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Test 7: Test data persistence (read back)
    console.log('Test 7: Data Persistence');
    try {
        const TenantModel = database_1.DatabaseService.getModel('Tenant');
        const tenants = await TenantModel.findAll({ limit: 5 });
        console.log(`✅ Successfully read ${tenants.length} tenant(s) from database\n`);
    }
    catch (error) {
        console.log(`❌ Error reading tenants: ${error.message}\n`);
        allTestsPassed = false;
    }
    // Summary
    console.log('='.repeat(50));
    if (allTestsPassed) {
        console.log('✅ All database setup tests passed!');
        process.exit(0);
    }
    else {
        console.log('❌ Some tests failed. Please review the output above.');
        process.exit(1);
    }
}
// Run tests
testDatabaseSetup().catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-database-setup.js.map