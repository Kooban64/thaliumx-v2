/**
 * Migration: Add MFA fields to users table
 * Adds mfaEmailCode, mfaEmailCodeExpiresAt, mfaSmsCode, mfaSmsCodeExpiresAt, mfaBackupCodes
 */
export declare function up(queryInterface: any, Sequelize: any): Promise<void>;
export declare function down(queryInterface: any): Promise<void>;
//# sourceMappingURL=001-add-mfa-fields.d.ts.map