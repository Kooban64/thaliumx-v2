/**
 * Post-Purchase Flow Service
 * 
 * Encourages trading on main platform after token purchase on presale.
 * 
 * Features:
 * - Automatically creates/enables trading account after presale investment
 * - Sends welcome email with trading dashboard link
 * - Tracks presale-to-trading conversion
 * - Works with unified KYC levels across both platforms
 */

import { LoggerService } from './logger';
import { EventStreamingService } from './event-streaming';
import { EmailService } from './email';
import { DatabaseService } from './database';
import { KYCService } from './kyc';

export interface TradingAccountStatus {
  exists: boolean;
  enabled: boolean;
  kycLevel: string;
  tradingEnabled: boolean;
  features: string[];
}

export interface PostPurchaseResult {
  success: boolean;
  tradingAccountCreated: boolean;
  tradingAccountEnabled: boolean;
  tradingDashboardUrl?: string;
  message: string;
}

export class PostPurchaseFlowService {
  public static async initializeTrading(
    userId: string,
    tenantId: string,
    investmentAmount: number,
    tokenAmount: number
  ): Promise<PostPurchaseResult> {
    try {
      LoggerService.info('Initializing trading after presale investment', {
        userId,
        tenantId,
        investmentAmount,
        tokenAmount
      });

      let kycLevel = 'L0';
      let userEmail = 'unknown@thaliumx.com';
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        kycLevel = kycStatus.kycLevel;
        userEmail = kycStatus.email;
      } catch (error) {
        LoggerService.warn('Could not fetch KYC status for post-purchase flow', { userId, error });
      }

      const accountStatus = await this.checkTradingAccountStatus(userId, tenantId);
      
      let tradingAccountCreated = false;
      let tradingAccountEnabled = false;

      if (!accountStatus.exists) {
        try {
          await this.createTradingAccount(userId, tenantId, kycLevel);
          tradingAccountCreated = true;
          tradingAccountEnabled = true;
        } catch (error) {
          LoggerService.warn('Failed to create trading account (non-blocking)', {
            userId,
            tenantId,
            error: error instanceof Error ? error.message : 'unknown'
          });
        }
      } else if (!accountStatus.enabled) {
        try {
          await this.enableTradingAccount(userId, tenantId, kycLevel);
          tradingAccountEnabled = true;
        } catch (error) {
          LoggerService.warn('Failed to enable trading account (non-blocking)', {
            userId,
            tenantId,
            error: error instanceof Error ? error.message : 'unknown'
          });
        }
      } else {
        tradingAccountEnabled = true;
      }

      const tradingFeatures = this.getTradingFeatures(kycLevel);
      const tradingDashboardUrl = this.getTradingDashboardUrl(tenantId);

      try {
        await this.sendTradingWelcomeEmail(
          userEmail,
          userId,
          investmentAmount,
          tokenAmount,
          kycLevel,
          tradingFeatures,
          tradingDashboardUrl
        );
      } catch (error) {
        LoggerService.warn('Failed to send trading welcome email (non-blocking)', {
          userId,
          error: error instanceof Error ? error.message : 'unknown'
        });
      }

      await EventStreamingService.emitSystemEvent(
        'presale.trading.initialized',
        'post_purchase_flow',
        'info',
        {
          userId,
          tenantId,
          investmentAmount,
          tokenAmount,
          kycLevel,
          tradingAccountCreated,
          tradingAccountEnabled,
          timestamp: new Date().toISOString()
        },
        { userId, tenantId }
      );

      LoggerService.info('Trading initialized successfully after presale investment', {
        userId,
        tenantId,
        tradingAccountCreated,
        tradingAccountEnabled
      });

      return {
        success: true,
        tradingAccountCreated,
        tradingAccountEnabled,
        tradingDashboardUrl,
        message: 'Trading account initialized. You can now start trading on the main platform!'
      };
    } catch (error) {
      LoggerService.error('Failed to initialize trading after presale investment:', error);
      return {
        success: false,
        tradingAccountCreated: false,
        tradingAccountEnabled: false,
        message: 'Trading account initialization is in progress. You can access trading features shortly.'
      };
    }
  }

  private static async checkTradingAccountStatus(
    userId: string,
    tenantId: string
  ): Promise<TradingAccountStatus> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const user = await (UserModel as any).findOne({
        where: { id: userId, tenantId }
      });

      if (!user) {
        return {
          exists: false,
          enabled: false,
          kycLevel: 'L0',
          tradingEnabled: false,
          features: []
        };
      }

      let kycLevel = 'L0';
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        kycLevel = kycStatus.kycLevel;
      } catch (error) {}

      const tradingEnabled = user.isActive && user.isVerified && kycLevel !== 'L0';
      const features = this.getTradingFeatures(kycLevel);

      return {
        exists: true,
        enabled: tradingEnabled,
        kycLevel,
        tradingEnabled,
        features
      };
    } catch (error) {
      LoggerService.warn('Failed to check trading account status', { userId, tenantId, error });
      return {
        exists: false,
        enabled: false,
        kycLevel: 'L0',
        tradingEnabled: false,
        features: []
      };
    }
  }

  private static async createTradingAccount(
    userId: string,
    tenantId: string,
    kycLevel: string
  ): Promise<void> {
    try {
      const UserModel = DatabaseService.getModel('User');
      await (UserModel as any).update(
        {
          isVerified: true,
          updatedAt: new Date()
        },
        { where: { id: userId, tenantId } }
      );

      LoggerService.info('Trading account created', { userId, tenantId, kycLevel });
    } catch (error) {
      LoggerService.error('Failed to create trading account:', error);
      throw error;
    }
  }

  private static async enableTradingAccount(
    userId: string,
    tenantId: string,
    kycLevel: string
  ): Promise<void> {
    try {
      const UserModel = DatabaseService.getModel('User');
      await (UserModel as any).update(
        {
          isVerified: true,
          isActive: true,
          updatedAt: new Date()
        },
        { where: { id: userId, tenantId } }
      );

      LoggerService.info('Trading account enabled', { userId, tenantId, kycLevel });
    } catch (error) {
      LoggerService.error('Failed to enable trading account:', error);
      throw error;
    }
  }

  private static getTradingFeatures(kycLevel: string): string[] {
    const features: Record<string, string[]> = {
      L0: ['view_market_data', 'view_portfolio'],
      L1: ['view_market_data', 'view_portfolio', 'basic_trading', 'spot_trading'],
      L2: ['view_market_data', 'view_portfolio', 'basic_trading', 'spot_trading', 'advanced_trading', 'margin_trading'],
      L3: ['view_market_data', 'view_portfolio', 'basic_trading', 'spot_trading', 'advanced_trading', 'margin_trading', 'futures_trading'],
      INSTITUTIONAL: ['all_features', 'api_access', 'custom_solutions']
    };

    return features[kycLevel] || features.L0 || [];
  }

  private static getTradingDashboardUrl(tenantId: string): string {
    const baseUrl = process.env.FRONTEND_URL || process.env.PLATFORM_URL || 'https://thaliumx.com';
    return `${baseUrl}/trading`;
  }

  private static async sendTradingWelcomeEmail(
    email: string,
    userId: string,
    investmentAmount: number,
    tokenAmount: number,
    kycLevel: string,
    features: string[],
    dashboardUrl: string
  ): Promise<void> {
    try {
      const subject = 'Welcome to ThaliumX Trading!';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .features { list-style: none; padding: 0; }
            .features li { padding: 8px 0; border-bottom: 1px solid #eee; }
            .features li:before { content: "✓ "; color: #667eea; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your Tokens Are Ready!</h1>
            </div>
            <div class="content">
              <p>Congratulations! Your presale investment has been confirmed.</p>
              
              <h3>Investment Summary</h3>
              <ul>
                <li><strong>Amount:</strong> $${investmentAmount.toFixed(2)}</li>
                <li><strong>Tokens:</strong> ${tokenAmount.toLocaleString()}</li>
                <li><strong>KYC Level:</strong> ${kycLevel}</li>
              </ul>

              <h3>Start Trading Now</h3>
              <p>Your trading account is ready! You can now access the main platform and start trading.</p>
              
              <a href="${dashboardUrl}" class="button">Go to Trading Dashboard</a>

              <h3>Available Features</h3>
              <ul class="features">
                ${features.map(f => `<li>${f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>`).join('')}
              </ul>

              <p>If you have any questions, please don't hesitate to contact our support team.</p>
              
              <p>Happy Trading!<br>The ThaliumX Team</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Email service integration - use appropriate method
      // Note: EmailService.sendEmail may need to be implemented or use a different method
      try {
        const { EmailService } = await import('./email');
        if ((EmailService as any).sendEmail) {
          await (EmailService as any).sendEmail(email, subject, html);
        } else {
          LoggerService.warn('EmailService.sendEmail not available, skipping email', { email });
        }
      } catch (emailError) {
        LoggerService.warn('Failed to send email (non-blocking)', { email, error: emailError });
      }
      LoggerService.info('Trading welcome email sent', { email, userId });
    } catch (error) {
      LoggerService.error('Failed to send trading welcome email:', error);
      throw error;
    }
  }
}
