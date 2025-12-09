#!/usr/bin/env ts-node
/**
 * Database Backup Script
 * Creates automated backups of the database with verification
 */
declare class DatabaseBackup {
    private static readonly BACKUP_DIR;
    private static readonly RETENTION_DAYS;
    static createBackup(): Promise<string>;
    static restoreBackup(backupPath: string): Promise<void>;
    static verifyBackup(backupPath: string): Promise<void>;
    private static verifyRestore;
    private static ensureBackupDirectory;
    private static getDatabaseConfig;
    private static buildPgDumpCommand;
    private static buildPsqlCommand;
    private static compressBackup;
    private static decompressBackup;
    private static cleanOldBackups;
    static listBackups(): Promise<string[]>;
    static getBackupInfo(backupName: string): Promise<any>;
}
export { DatabaseBackup };
//# sourceMappingURL=database-backup.d.ts.map