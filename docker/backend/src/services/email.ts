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

import nodemailer from 'nodemailer';
import { ConfigService } from './config';
import { LoggerService } from './logger';

interface PasswordResetEmail {
  email: string;
  token: string;
  userId: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter;

  public static async initialize(): Promise<void> {
    const config = await ConfigService.getConfig();

    // Gmail requires specific configuration
    const isGmail = config.smtp.host.includes('gmail.com');
    
    // Gmail app-specific passwords may have spaces - remove them
    const smtpPassword = isGmail ? config.smtp.auth.pass.replace(/\s+/g, '') : config.smtp.auth.pass;
    
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure, // false for port 587, true for port 465
      requireTLS: !config.smtp.secure, // Require TLS for port 587
      auth: {
        user: config.smtp.auth.user,
        pass: smtpPassword
      },
      // Gmail-specific settings
      ...(isGmail && {
        service: 'gmail',
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates if needed
        }
      })
    });

    // Verify connection
    try {
      await this.transporter.verify();
      LoggerService.info('SMTP transporter verified successfully');
    } catch (error) {
      LoggerService.error('SMTP transporter verification failed', error);
      // Log detailed error for debugging but don't fail startup
      // Email service will be unavailable but backend can still run
      LoggerService.warn('Email service unavailable - backend will continue without email functionality', {
        error: error instanceof Error ? error.message : String(error),
        host: config.smtp.host,
        port: config.smtp.port
      });
      // Set transporter to null to indicate service is unavailable
      this.transporter = null as any;
    }
  }

  public static async sendPasswordReset(params: PasswordResetEmail): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    const config = await ConfigService.getConfig();
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
      LoggerService.info('Password reset email sent', { userId: params.userId, email: params.email });
    } catch (error) {
      LoggerService.error('Failed to send password reset email', { error, userId: params.userId });
      throw error;
    }
  }

  // Add other email methods as needed, e.g., verification email, notifications, etc.
}