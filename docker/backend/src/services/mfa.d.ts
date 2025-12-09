/**
 * Multi-Factor Authentication (MFA) Service
 *
 * Handles MFA setup, validation, and management using TOTP (Time-based One-Time Password).
 *
 * Features:
 * - TOTP secret generation using authenticator library
 * - QR code generation for authenticator app setup
 * - MFA code validation
 * - Backup codes generation and validation
 * - MFA enable/disable functionality
 *
 * Security:
 * - Secrets stored securely in database
 * - QR codes generated with service name and user email
 * - Backup codes hashed before storage
 * - Rate limiting on validation attempts
 *
 * Integration:
 * - Works with AuthService for login flow
 * - Uses otplib for TOTP implementation
 * - QR codes compatible with Google Authenticator, Authy, etc.
 */
export declare class MFAService {
    static enableMFA(userId: string): Promise<{
        secret: string;
        qrCodeDataUrl: string;
    }>;
    static verifyMFASetup(userId: string, code: string): Promise<{
        success: boolean;
    }>;
    static verifyMFALogin(userId: string, code: string): Promise<{
        success: boolean;
    }>;
    static disableMFA(userId: string, password: string): Promise<void>;
}
//# sourceMappingURL=mfa.d.ts.map