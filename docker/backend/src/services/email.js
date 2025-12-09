"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("./config");
const logger_1 = require("./logger");
class EmailService {
    static transporter;
    static async initialize() {
        const config = await config_1.ConfigService.getConfig();
        this.transporter = nodemailer_1.default.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: {
                user: config.smtp.auth.user,
                pass: config.smtp.auth.pass
            }
        });
        // Verify connection
        try {
            await this.transporter.verify();
            logger_1.LoggerService.info('SMTP transporter verified successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('SMTP transporter verification failed', error);
            if (config.env === 'production') {
                throw error;
            }
            logger_1.LoggerService.warn('Continuing without email service in non-production mode');
        }
    }
    static async sendPasswordReset(params) {
        if (!this.transporter) {
            throw new Error('Email service not initialized');
        }
        const config = await config_1.ConfigService.getConfig();
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${params.token}`;
        const mailOptions = {
            from: config.smtp.from,
            to: params.email,
            subject: 'ThaliumX Password Reset',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your ThaliumX account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          <p>If you didn't request this, please ignore this email or contact support.</p>
          <p>This link will expire in 1 hour.</p>
          <p>Best regards,<br>ThaliumX Team</p>
        </div>
      `,
            text: `You requested a password reset for your ThaliumX account. Visit this link to reset: ${resetUrl}. If you didn't request this, ignore this email. Link expires in 1 hour.`
        };
        try {
            await this.transporter.sendMail(mailOptions);
            logger_1.LoggerService.info('Password reset email sent', { userId: params.userId, email: params.email });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to send password reset email', { error, userId: params.userId });
            throw error;
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.js.map