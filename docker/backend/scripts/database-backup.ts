#!/usr/bin/env ts-node

/**
 * Database Backup Script
 * Creates automated backups of the database with verification
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/services/database';
import { LoggerService } from '../src/services/logger';

const execAsync = promisify(exec);

class DatabaseBackup {
  private static readonly BACKUP_DIR = process.env.BACKUP_DIR || './backups';
  private static readonly RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');

  static async createBackup(): Promise<string> {
    LoggerService.info('📦 Starting database backup...');

    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `thaliumx-backup-${timestamp}.sql`;
      const backupPath = path.join(this.BACKUP_DIR, backupFileName);

      // Get database connection details
      const dbConfig = this.getDatabaseConfig();

      // Create backup using pg_dump
      const pgDumpCommand = this.buildPgDumpCommand(dbConfig, backupPath);
      LoggerService.info(`Executing: ${pgDumpCommand.replace(dbConfig.password, '***')}`);

      const { stdout, stderr } = await execAsync(pgDumpCommand);

      if (stderr && !stderr.includes('NOTICE')) {
        LoggerService.warn('pg_dump stderr:', stderr);
      }

      // Verify backup integrity
      await this.verifyBackup(backupPath);

      // Compress backup
      const compressedPath = await this.compressBackup(backupPath);
      if (compressedPath) {
        // Remove uncompressed file
        fs.unlinkSync(backupPath);
      }

      // Clean old backups
      await this.cleanOldBackups();

      LoggerService.info(`✅ Database backup completed: ${compressedPath || backupPath}`);

      return compressedPath || backupPath;

    } catch (error) {
      LoggerService.error('❌ Database backup failed:', error);
      throw error;
    }
  }

  static async restoreBackup(backupPath: string): Promise<void> {
    LoggerService.info(`🔄 Starting database restore from: ${backupPath}`);

    try {
      // Verify backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Decompress if needed
      let restorePath = backupPath;
      if (backupPath.endsWith('.gz')) {
        restorePath = await this.decompressBackup(backupPath);
      }

      // Get database connection details
      const dbConfig = this.getDatabaseConfig();

      // Create restore command
      const psqlCommand = this.buildPsqlCommand(dbConfig, restorePath);
      LoggerService.info(`Executing: ${psqlCommand.replace(dbConfig.password, '***')}`);

      const { stdout, stderr } = await execAsync(psqlCommand);

      if (stderr && !stderr.includes('NOTICE')) {
        LoggerService.warn('psql stderr:', stderr);
      }

      // Clean up decompressed file if created
      if (restorePath !== backupPath) {
        fs.unlinkSync(restorePath);
      }

      // Verify restore
      await this.verifyRestore();

      LoggerService.info('✅ Database restore completed successfully');

    } catch (error) {
      LoggerService.error('❌ Database restore failed:', error);
      throw error;
    }
  }

  static async verifyBackup(backupPath: string): Promise<void> {
    LoggerService.info('🔍 Verifying backup integrity...');

    try {
      // Check file exists and has content
      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Check if file contains valid SQL
      const content = fs.readFileSync(backupPath, 'utf8').substring(0, 1000);
      if (!content.includes('-- PostgreSQL database dump') &&
          !content.includes('CREATE TABLE') &&
          !content.includes('INSERT INTO')) {
        throw new Error('Backup file does not contain valid SQL');
      }

      LoggerService.info('✅ Backup verification passed');

    } catch (error) {
      LoggerService.error('❌ Backup verification failed:', error);
      throw error;
    }
  }

  private static async verifyRestore(): Promise<void> {
    LoggerService.info('🔍 Verifying database restore...');

    try {
      // Simple query to verify database is accessible
      const sequelize = DatabaseService.getSequelize();
      await sequelize.authenticate();

      // Check if critical tables exist
      const [tables] = await sequelize.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN ('users', 'brokers', 'tenants')
      `);

      if ((tables as any[]).length === 0) {
        throw new Error('Critical tables not found after restore');
      }

      LoggerService.info('✅ Database restore verification passed');

    } catch (error) {
      LoggerService.error('❌ Database restore verification failed:', error);
      throw error;
    }
  }

  private static async ensureBackupDirectory(): Promise<void> {
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
      LoggerService.info(`Created backup directory: ${this.BACKUP_DIR}`);
    }
  }

  private static getDatabaseConfig() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Parse PostgreSQL connection string
    const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlMatch) {
      throw new Error('Invalid DATABASE_URL format');
    }

    return {
      user: urlMatch[1],
      password: urlMatch[2],
      host: urlMatch[3],
      port: urlMatch[4],
      database: urlMatch[5]
    };
  }

  private static buildPgDumpCommand(dbConfig: any, outputPath: string): string {
    return `pg_dump --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --no-password --format=custom --compress=9 --file=${outputPath}`;
  }

  private static buildPsqlCommand(dbConfig: any, inputPath: string): string {
    return `PGPASSWORD=${dbConfig.password} psql --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --file=${inputPath}`;
  }

  private static async compressBackup(backupPath: string): Promise<string | null> {
    try {
      const compressedPath = `${backupPath}.gz`;
      await execAsync(`gzip -9 "${backupPath}"`);

      LoggerService.info(`✅ Backup compressed: ${compressedPath}`);
      return compressedPath;

    } catch (error) {
      LoggerService.warn('Backup compression failed, keeping uncompressed file:', error);
      return null;
    }
  }

  private static async decompressBackup(compressedPath: string): Promise<string> {
    const decompressedPath = compressedPath.replace('.gz', '');
    await execAsync(`gunzip -c "${compressedPath}" > "${decompressedPath}"`);

    LoggerService.info(`✅ Backup decompressed: ${decompressedPath}`);
    return decompressedPath;
  }

  private static async cleanOldBackups(): Promise<void> {
    try {
      const files = fs.readdirSync(this.BACKUP_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.BACKUP_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        LoggerService.info(`🧹 Cleaned up ${deletedCount} old backup files`);
      }

    } catch (error) {
      LoggerService.warn('Backup cleanup failed:', error);
    }
  }

  static async listBackups(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.BACKUP_DIR);
      return files
        .filter(file => file.startsWith('thaliumx-backup-'))
        .sort()
        .reverse(); // Most recent first

    } catch (error) {
      LoggerService.error('Failed to list backups:', error);
      return [];
    }
  }

  static async getBackupInfo(backupName: string): Promise<any> {
    const backupPath = path.join(this.BACKUP_DIR, backupName);

    try {
      const stats = fs.statSync(backupPath);
      return {
        name: backupName,
        path: backupPath,
        size: stats.size,
        created: stats.mtime,
        compressed: backupName.endsWith('.gz')
      };

    } catch (error) {
      throw new Error(`Backup not found: ${backupName}`);
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const argument = process.argv[3];

  try {
    if (command === 'create') {
      const backupPath = await DatabaseBackup.createBackup();
      console.log(`Backup created: ${backupPath}`);

    } else if (command === 'restore') {
      if (!argument) {
        console.log('Usage: ts-node database-backup.ts restore <backup-file>');
        process.exit(1);
      }
      await DatabaseBackup.restoreBackup(argument);
      console.log('Backup restored successfully');

    } else if (command === 'list') {
      const backups = await DatabaseBackup.listBackups();
      console.log('Available backups:');
      backups.forEach(backup => console.log(`  - ${backup}`));

    } else if (command === 'info') {
      if (!argument) {
        console.log('Usage: ts-node database-backup.ts info <backup-file>');
        process.exit(1);
      }
      const info = await DatabaseBackup.getBackupInfo(argument);
      console.log('Backup Info:');
      console.log(JSON.stringify(info, null, 2));

    } else {
      console.log('Usage: ts-node database-backup.ts [create|restore|list|info] [backup-file]');
      console.log('Commands:');
      console.log('  create              Create a new database backup');
      console.log('  restore <file>      Restore database from backup file');
      console.log('  list                List all available backups');
      console.log('  info <file>         Show information about a backup file');
      process.exit(1);
    }

  } catch (error) {
    console.error('Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseBackup };