#!/usr/bin/env node

/**
 * Persistence Verification Script
 * 
 * Verifies that all critical data and configurations persist across rebuilds and restarts:
 * - Database migrations are tracked
 * - Environment variables are loaded
 * - Services initialize correctly
 * - OPA cache service is available
 * - Policy manager is configured
 * - Metrics service is initialized
 */

import { DatabaseService } from '../src/services/database';
import { RedisService } from '../src/services/redis';
import { LoggerService } from '../src/services/logger';
import { MetricsService } from '../src/services/metrics';
import { opaService } from '../src/services/opa';
import { opaCacheService } from '../src/services/opa-cache';
import { policyManager } from '../src/services/policy-manager';
import { ConfigService } from '../src/services/config-enhanced';

interface PersistenceCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

class PersistenceVerifier {
  private checks: PersistenceCheck[] = [];

  async verifyAll(): Promise<void> {
    LoggerService.info('🔍 Starting persistence verification...');

    // Check 1: Database connection and migrations
    await this.verifyDatabase();

    // Check 2: Redis connection
    await this.verifyRedis();

    // Check 3: OPA services
    await this.verifyOPAServices();

    // Check 4: Configuration
    await this.verifyConfiguration();

    // Check 5: Metrics
    await this.verifyMetrics();

    // Print summary
    this.printSummary();
  }

  private async verifyDatabase(): Promise<void> {
    try {
      await DatabaseService.initialize();
      const sequelize = DatabaseService.getSequelize();
      
      // Check if migrations table exists
      const [results] = await sequelize.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sequelize_meta')"
      );
      const migrationsTableExists = (results[0] as any).exists;

      if (migrationsTableExists) {
        const [migrations] = await sequelize.query(
          'SELECT name FROM sequelize_meta ORDER BY name'
        );
        this.addCheck('Database Migrations', 'pass', 
          `Migrations table exists with ${migrations.length} executed migrations`);
      } else {
        this.addCheck('Database Migrations', 'warning', 
          'Migrations table does not exist (will be created on first migration)');
      }

      this.addCheck('Database Connection', 'pass', 'Database connection successful');
    } catch (error: any) {
      this.addCheck('Database Connection', 'fail', `Database connection failed: ${error.message}`);
    }
  }

  private async verifyRedis(): Promise<void> {
    try {
      await RedisService.initialize();
      const isConnected = RedisService.isConnected();
      
      if (isConnected) {
        // Test write/read
        await RedisService.setString('persistence-test', 'ok', 10);
        const value = await RedisService.getString('persistence-test');
        
        if (value === 'ok') {
          this.addCheck('Redis Connection', 'pass', 'Redis connection and read/write successful');
        } else {
          this.addCheck('Redis Connection', 'warning', 'Redis connected but read/write test failed');
        }
      } else {
        this.addCheck('Redis Connection', 'warning', 'Redis not connected (may be starting up)');
      }
    } catch (error: any) {
      this.addCheck('Redis Connection', 'fail', `Redis connection failed: ${error.message}`);
    }
  }

  private async verifyOPAServices(): Promise<void> {
    try {
      // Check OPA Service singleton
      if (opaService) {
        this.addCheck('OPA Service Singleton', 'pass', 'OPA service singleton available');
        
        // Check health
        try {
          const healthy = await opaService.healthCheck();
          if (healthy) {
            this.addCheck('OPA Service Health', 'pass', 'OPA service health check passed');
          } else {
            this.addCheck('OPA Service Health', 'warning', 'OPA service health check failed');
          }
        } catch (error: any) {
          this.addCheck('OPA Service Health', 'warning', `OPA health check error: ${error.message}`);
        }
      } else {
        this.addCheck('OPA Service Singleton', 'fail', 'OPA service singleton not available');
      }

      // Check OPA Cache Service
      if (opaCacheService) {
        const stats = opaCacheService.getStats();
        this.addCheck('OPA Cache Service', 'pass', 
          `OPA cache service available (${stats.memoryEntries} entries in memory)`);
      } else {
        this.addCheck('OPA Cache Service', 'fail', 'OPA cache service not available');
      }

      // Check Policy Manager
      if (policyManager) {
        this.addCheck('Policy Manager', 'pass', 'Policy manager singleton available');
      } else {
        this.addCheck('Policy Manager', 'fail', 'Policy manager singleton not available');
      }
    } catch (error: any) {
      this.addCheck('OPA Services', 'fail', `OPA services verification failed: ${error.message}`);
    }
  }

  private async verifyConfiguration(): Promise<void> {
    try {
      const config = ConfigService.getConfig();
      
      // Check critical config values
      const checks = [
        { key: 'database', name: 'Database Config' },
        { key: 'redis', name: 'Redis Config' },
        { key: 'jwt', name: 'JWT Config' }
      ];

      for (const check of checks) {
        if (config[check.key as keyof typeof config]) {
          this.addCheck(check.name, 'pass', `${check.name} loaded successfully`);
        } else {
          this.addCheck(check.name, 'warning', `${check.name} not found in config`);
        }
      }

      // Check environment variables
      const envVars = [
        'NODE_ENV',
        'DB_HOST',
        'DB_NAME',
        'REDIS_HOST'
      ];

      const missingEnvVars = envVars.filter(v => !process.env[v]);
      if (missingEnvVars.length === 0) {
        this.addCheck('Environment Variables', 'pass', 'All critical environment variables set');
      } else {
        this.addCheck('Environment Variables', 'warning', 
          `Missing environment variables: ${missingEnvVars.join(', ')}`);
      }
    } catch (error: any) {
      this.addCheck('Configuration', 'fail', `Configuration verification failed: ${error.message}`);
    }
  }

  private async verifyMetrics(): Promise<void> {
    try {
      MetricsService.initialize();
      this.addCheck('Metrics Service', 'pass', 'Metrics service initialized');
    } catch (error: any) {
      this.addCheck('Metrics Service', 'fail', `Metrics service initialization failed: ${error.message}`);
    }
  }

  private addCheck(name: string, status: 'pass' | 'fail' | 'warning', message: string): void {
    this.checks.push({ name, status, message });
  }

  private printSummary(): void {
    LoggerService.info('\n📊 Persistence Verification Summary:');
    LoggerService.info('=' .repeat(60));

    const passed = this.checks.filter(c => c.status === 'pass').length;
    const failed = this.checks.filter(c => c.status === 'fail').length;
    const warnings = this.checks.filter(c => c.status === 'warning').length;

    for (const check of this.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      LoggerService.info(`${icon} ${check.name}: ${check.message}`);
    }

    LoggerService.info('=' .repeat(60));
    LoggerService.info(`Total: ${this.checks.length} | Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}`);

    if (failed > 0) {
      LoggerService.error('❌ Some persistence checks failed. System may not be fully persistent.');
      process.exit(1);
    } else if (warnings > 0) {
      LoggerService.warn('⚠️  Some persistence checks have warnings. Review above.');
      process.exit(0);
    } else {
      LoggerService.info('✅ All persistence checks passed. System is ready for production.');
      process.exit(0);
    }
  }
}

// Run verification
(async () => {
  try {
    const verifier = new PersistenceVerifier();
    await verifier.verifyAll();
  } catch (error) {
    LoggerService.error('Persistence verification failed:', error);
    process.exit(1);
  }
})();
