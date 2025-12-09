#!/usr/bin/env ts-node
"use strict";
/**
 * Database Backup Script
 * Creates automated backups of the database with verification
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
exports.DatabaseBackup = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const database_1 = require("../src/services/database");
const logger_1 = require("../src/services/logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DatabaseBackup {
    static BACKUP_DIR = process.env.BACKUP_DIR || './backups';
    static RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
    static async createBackup() {
        logger_1.LoggerService.info('📦 Starting database backup...');
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
            logger_1.LoggerService.info(`Executing: ${pgDumpCommand.replace(dbConfig.password, '***')}`);
            const { stdout, stderr } = await execAsync(pgDumpCommand);
            if (stderr && !stderr.includes('NOTICE')) {
                logger_1.LoggerService.warn('pg_dump stderr:', stderr);
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
            logger_1.LoggerService.info(`✅ Database backup completed: ${compressedPath || backupPath}`);
            return compressedPath || backupPath;
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Database backup failed:', error);
            throw error;
        }
    }
    static async restoreBackup(backupPath) {
        logger_1.LoggerService.info(`🔄 Starting database restore from: ${backupPath}`);
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
            logger_1.LoggerService.info(`Executing: ${psqlCommand.replace(dbConfig.password, '***')}`);
            const { stdout, stderr } = await execAsync(psqlCommand);
            if (stderr && !stderr.includes('NOTICE')) {
                logger_1.LoggerService.warn('psql stderr:', stderr);
            }
            // Clean up decompressed file if created
            if (restorePath !== backupPath) {
                fs.unlinkSync(restorePath);
            }
            // Verify restore
            await this.verifyRestore();
            logger_1.LoggerService.info('✅ Database restore completed successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Database restore failed:', error);
            throw error;
        }
    }
    static async verifyBackup(backupPath) {
        logger_1.LoggerService.info('🔍 Verifying backup integrity...');
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
            logger_1.LoggerService.info('✅ Backup verification passed');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Backup verification failed:', error);
            throw error;
        }
    }
    static async verifyRestore() {
        logger_1.LoggerService.info('🔍 Verifying database restore...');
        try {
            // Simple query to verify database is accessible
            const sequelize = database_1.DatabaseService.getSequelize();
            await sequelize.authenticate();
            // Check if critical tables exist
            const [tables] = await sequelize.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN ('users', 'brokers', 'tenants')
      `);
            if (tables.length === 0) {
                throw new Error('Critical tables not found after restore');
            }
            logger_1.LoggerService.info('✅ Database restore verification passed');
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Database restore verification failed:', error);
            throw error;
        }
    }
    static async ensureBackupDirectory() {
        if (!fs.existsSync(this.BACKUP_DIR)) {
            fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
            logger_1.LoggerService.info(`Created backup directory: ${this.BACKUP_DIR}`);
        }
    }
    static getDatabaseConfig() {
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
    static buildPgDumpCommand(dbConfig, outputPath) {
        return `pg_dump --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --no-password --format=custom --compress=9 --file=${outputPath}`;
    }
    static buildPsqlCommand(dbConfig, inputPath) {
        return `PGPASSWORD=${dbConfig.password} psql --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --file=${inputPath}`;
    }
    static async compressBackup(backupPath) {
        try {
            const compressedPath = `${backupPath}.gz`;
            await execAsync(`gzip -9 "${backupPath}"`);
            logger_1.LoggerService.info(`✅ Backup compressed: ${compressedPath}`);
            return compressedPath;
        }
        catch (error) {
            logger_1.LoggerService.warn('Backup compression failed, keeping uncompressed file:', error);
            return null;
        }
    }
    static async decompressBackup(compressedPath) {
        const decompressedPath = compressedPath.replace('.gz', '');
        await execAsync(`gunzip -c "${compressedPath}" > "${decompressedPath}"`);
        logger_1.LoggerService.info(`✅ Backup decompressed: ${decompressedPath}`);
        return decompressedPath;
    }
    static async cleanOldBackups() {
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
                logger_1.LoggerService.info(`🧹 Cleaned up ${deletedCount} old backup files`);
            }
        }
        catch (error) {
            logger_1.LoggerService.warn('Backup cleanup failed:', error);
        }
    }
    static async listBackups() {
        try {
            const files = fs.readdirSync(this.BACKUP_DIR);
            return files
                .filter(file => file.startsWith('thaliumx-backup-'))
                .sort()
                .reverse(); // Most recent first
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to list backups:', error);
            return [];
        }
    }
    static async getBackupInfo(backupName) {
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
        }
        catch (error) {
            throw new Error(`Backup not found: ${backupName}`);
        }
    }
}
exports.DatabaseBackup = DatabaseBackup;
// CLI interface
async function main() {
    const command = process.argv[2];
    const argument = process.argv[3];
    try {
        if (command === 'create') {
            const backupPath = await DatabaseBackup.createBackup();
            console.log(`Backup created: ${backupPath}`);
        }
        else if (command === 'restore') {
            if (!argument) {
                console.log('Usage: ts-node database-backup.ts restore <backup-file>');
                process.exit(1);
            }
            await DatabaseBackup.restoreBackup(argument);
            console.log('Backup restored successfully');
        }
        else if (command === 'list') {
            const backups = await DatabaseBackup.listBackups();
            console.log('Available backups:');
            backups.forEach(backup => console.log(`  - ${backup}`));
        }
        else if (command === 'info') {
            if (!argument) {
                console.log('Usage: ts-node database-backup.ts info <backup-file>');
                process.exit(1);
            }
            const info = await DatabaseBackup.getBackupInfo(argument);
            console.log('Backup Info:');
            console.log(JSON.stringify(info, null, 2));
        }
        else {
            console.log('Usage: ts-node database-backup.ts [create|restore|list|info] [backup-file]');
            console.log('Commands:');
            console.log('  create              Create a new database backup');
            console.log('  restore <file>      Restore database from backup file');
            console.log('  list                List all available backups');
            console.log('  info <file>         Show information about a backup file');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Command failed:', error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=database-backup.js.map