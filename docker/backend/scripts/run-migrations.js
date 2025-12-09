#!/usr/bin/env node

/**
 * Run Database Migrations Script
 * 
 * This script runs database migrations directly from compiled JavaScript.
 * Used when migrations need to be run manually or during container startup.
 */

const { DatabaseService } = require('../dist/services/database');
const { MigrationRunner } = require('../dist/migrations/runner');

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Initialize database connection
    await DatabaseService.initialize();
    console.log('✅ Database connected');
    
    // Run migrations
    await MigrationRunner.runMigrations();
    console.log('✅ All migrations completed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigrations();

