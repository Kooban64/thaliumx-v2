/**
 * Email Service
 *
 * Handles email sending using SMTP (Nodemailer).
 *
 * Features:
 * - SMTP configuration from environment/secrets
 * - Password reset emails
 * - Email verification
 * - Transactional emails
 * - HTML and plain text email support
 *
 * Configuration:
 * - SMTP host, port, and security settings
 * - Authentication credentials
 * - From address configuration
 *
 * Error Handling:
 * - Verifies SMTP connection on initialization
 * - Fails fast in production if SMTP unavailable
 * - Continues with warnings in development
 */
interface PasswordResetEmail {
    email: string;
    token: string;
    userId: string;
}
export declare class EmailService {
    private static transporter;
    static initialize(): Promise<void>;
    static sendPasswordReset(params: PasswordResetEmail): Promise<void>;
}
export {};
//# sourceMappingURL=email.d.ts.map