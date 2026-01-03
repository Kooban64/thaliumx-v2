/**
 * Compliance Service
 * 
 * NOTE: This service is a placeholder/stub using NestJS patterns.
 * The actual compliance functionality is handled by the separate compliance microservices:
 * - compliance-cex
 * - compliance-dex
 * - compliance-nft
 * - compliance-token
 * - compliance-coordinator
 * 
 * This file is kept for reference but is not actively used.
 * All compliance operations should go through the compliance microservices.
 */

import { LoggerService } from '../logger';
import { DatabaseService } from '../database';
import { EventStreamingService } from '../event-streaming';
import { User, Transaction } from '../../types';

export interface ComplianceReport {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  data: any;
  status: 'generating' | 'completed' | 'failed';
}

export interface SuspiciousActivityReport {
  userId: string;
  activities: Array<{
    type: string;
    timestamp: Date;
    details: any;
    riskScore: number;
  }>;
  totalRiskScore: number;
  recommendedActions: string[];
}

export class ComplianceService {
  /**
   * Generate comprehensive compliance report
   * NOTE: This is a stub - actual compliance is handled by microservices
   */
  static async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceReport> {
    LoggerService.warn('ComplianceService.generateComplianceReport is a stub - use compliance microservices');
    
    return {
      reportId: `report-${Date.now()}`,
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      data: {},
      status: 'completed'
    };
  }

  /**
   * Generate suspicious activity report
   * NOTE: This is a stub - actual compliance is handled by microservices
   */
  static async generateSuspiciousActivityReport(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SuspiciousActivityReport> {
    LoggerService.warn('ComplianceService.generateSuspiciousActivityReport is a stub - use compliance microservices');
    
    return {
      userId,
      activities: [],
      totalRiskScore: 0,
      recommendedActions: []
    };
  }

  /**
   * Send compliance notification
   * NOTE: This is a stub - actual compliance is handled by microservices
   */
  static async sendComplianceNotification(
    userId: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): Promise<void> {
    LoggerService.warn('ComplianceService.sendComplianceNotification is a stub - use compliance microservices');
    
    // Emit event for compliance microservices to handle
    await EventStreamingService.emitComplianceEvent(
      'NOTIFICATION',
      'ALERT',
      { userId, message, priority },
      'compliant'
    );
  }

  /**
   * Get presale-to-trading conversion metrics
   * Tracks users who purchase tokens on presale and then trade on main platform
   */
  static async getPresaleToTradingMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalPresaleInvestors: number;
    totalTradingUsers: number;
    conversionRate: number;
    averageTimeToFirstTrade: number; // in hours
    kycLevelDistribution: Record<string, number>;
  }> {
    try {
      // Query audit logs for presale investments and trading activity
      const AuditLogModel = DatabaseService.getModel('AuditLog');
      
      // Get presale investments in period
      const presaleInvestments = await (AuditLogModel as any).findAll({
        where: {
          tenantId,
          action: 'presale_investment_completed',
          createdAt: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        },
        attributes: ['userId', 'details', 'createdAt']
      });

      // Get trading activity in period
      const tradingActivity = await (AuditLogModel as any).findAll({
        where: {
          tenantId,
          action: {
            [require('sequelize').Op.in]: ['trade_executed', 'order_placed', 'transaction_completed']
          },
          createdAt: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        },
        attributes: ['userId', 'createdAt']
      });

      // Calculate metrics
      const uniquePresaleInvestors = new Set(presaleInvestments.map((inv: any) => inv.userId));
      const uniqueTradingUsers = new Set(tradingActivity.map((tx: any) => tx.userId));
      
      // Find users who did both
      const convertedUsers = Array.from(uniquePresaleInvestors).filter((userId: any) => 
        uniqueTradingUsers.has(userId)
      );

      // Calculate average time to first trade
      let totalHours = 0;
      let count = 0;
      for (const userId of convertedUsers) {
        const investment = presaleInvestments.find((inv: any) => inv.userId === userId);
        const firstTrade = tradingActivity.find((tx: any) => tx.userId === userId);
        if (investment && firstTrade) {
          const hours = (new Date(firstTrade.createdAt).getTime() - new Date(investment.createdAt).getTime()) / (1000 * 60 * 60);
          totalHours += hours;
          count++;
        }
      }

      // Get KYC level distribution from investments
      const kycDistribution: Record<string, number> = {};
      for (const inv of presaleInvestments) {
        const kycLevel = (inv.details as any)?.kycLevel || 'L0';
        kycDistribution[kycLevel] = (kycDistribution[kycLevel] || 0) + 1;
      }

      return {
        totalPresaleInvestors: uniquePresaleInvestors.size,
        totalTradingUsers: uniqueTradingUsers.size,
        conversionRate: uniquePresaleInvestors.size > 0 
          ? (convertedUsers.length / uniquePresaleInvestors.size) * 100 
          : 0,
        averageTimeToFirstTrade: count > 0 ? totalHours / count : 0,
        kycLevelDistribution: kycDistribution
      };
    } catch (error) {
      LoggerService.error('Failed to get presale-to-trading metrics:', error);
      return {
        totalPresaleInvestors: 0,
        totalTradingUsers: 0,
        conversionRate: 0,
        averageTimeToFirstTrade: 0,
        kycLevelDistribution: {}
      };
    }
  }
}
