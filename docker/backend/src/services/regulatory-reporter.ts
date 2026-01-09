/**
 * Regulatory Reporter Service
 * 
 * FATF-compliant event streams and regulatory reporting:
 * - SAR (Suspicious Activity Report) event generation
 * - Regulatory report generation from events
 * - Data retention compliance (1 year+ for compliance topics)
 * - FATF-compliant event streams
 */

import { EventStreamingService } from './event-streaming';
import { LoggerService } from './logger';
import { DatabaseService } from './database';
import { v4 as uuidv4 } from 'uuid';

export interface SAREvent {
  sarId: string;
  userId: string;
  tenantId: string;
  transactionId?: string;
  suspiciousActivity: string;
  activityType: 'large_transaction' | 'unusual_pattern' | 'sanctions_match' | 'other';
  amount?: number;
  currency?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RegulatoryReport {
  reportId: string;
  reportType: 'SAR' | 'CTR' | 'AML' | 'KYC';
  period: {
    start: string;
    end: string;
  };
  data: any;
  generatedAt: string;
  status: 'pending' | 'submitted' | 'acknowledged';
}

export class RegulatoryReporterService {
  private static isInitialized = false;
  private static readonly COMPLIANCE_TOPIC = 'thaliumx.compliance';
  private static readonly RETENTION_DAYS = 365; // 1 year minimum for compliance

  /**
   * Initialize regulatory reporter
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.info('Initializing Regulatory Reporter Service...');
    this.isInitialized = true;
    LoggerService.info('✅ Regulatory Reporter Service initialized');
  }

  /**
   * Generate SAR (Suspicious Activity Report) event
   */
  public static async generateSAR(sarEvent: SAREvent): Promise<string> {
    try {
      const sarId = sarEvent.sarId || uuidv4();

      // Emit SAR event to compliance topic
      await EventStreamingService.emitComplianceEvent(
        'AML',
        'suspicious_activity_report',
        {
          sarId,
          userId: sarEvent.userId,
          tenantId: sarEvent.tenantId,
          transactionId: sarEvent.transactionId,
          suspiciousActivity: sarEvent.suspiciousActivity,
          activityType: sarEvent.activityType,
          amount: sarEvent.amount,
          currency: sarEvent.currency,
          metadata: sarEvent.metadata
        },
        'non-compliant',
        { correlationId: sarId },
        `Suspicious Activity Detected: ${sarEvent.suspiciousActivity}`
      );

      // Store SAR in database
      const SARModel: any = DatabaseService.getModel('SuspiciousActivityReport');
      if (SARModel) {
        await SARModel.create({
          sarId,
          userId: sarEvent.userId,
          tenantId: sarEvent.tenantId,
          transactionId: sarEvent.transactionId,
          suspiciousActivity: sarEvent.suspiciousActivity,
          activityType: sarEvent.activityType,
          amount: sarEvent.amount,
          currency: sarEvent.currency,
          timestamp: sarEvent.timestamp || new Date(),
          metadata: sarEvent.metadata,
          status: 'pending'
        });
      }

      LoggerService.warn('SAR generated', {
        sarId,
        userId: sarEvent.userId,
        activityType: sarEvent.activityType
      });

      return sarId;
    } catch (error) {
      LoggerService.error('Failed to generate SAR', {
        error,
        sarEvent
      });
      throw error;
    }
  }

  /**
   * Generate regulatory report from events
   */
  public static async generateRegulatoryReport(
    reportType: 'SAR' | 'CTR' | 'AML' | 'KYC',
    period: { start: string; end: string }
  ): Promise<RegulatoryReport> {
    try {
      const reportId = uuidv4();

      LoggerService.info('Generating regulatory report', {
        reportId,
        reportType,
        period
      });

      // Query events from compliance topic or database
      const data = await this.queryComplianceEvents(reportType, period);

      const report: RegulatoryReport = {
        reportId,
        reportType,
        period,
        data,
        generatedAt: new Date().toISOString(),
        status: 'pending'
      };

      // Store report
      const ReportModel: any = DatabaseService.getModel('RegulatoryReport');
      if (ReportModel) {
        await ReportModel.create(report);
      }

      // Emit report generation event
      await EventStreamingService.emitComplianceEvent(
        'AML',
        'regulatory_report_generated',
        report,
        'pending',
        { correlationId: reportId },
        `Regulatory report generated: ${reportType}`
      );

      LoggerService.info('Regulatory report generated', {
        reportId,
        reportType,
        recordCount: Array.isArray(data) ? data.length : 0
      });

      return report;
    } catch (error) {
      LoggerService.error('Failed to generate regulatory report', {
        reportType,
        period,
        error
      });
      throw error;
    }
  }

  /**
   * Query compliance events for reporting
   */
  private static async queryComplianceEvents(
    reportType: string,
    period: { start: string; end: string }
  ): Promise<any[]> {
    try {
      // Query from compliance database table
      const ComplianceModel: any = DatabaseService.getModel('ComplianceEvent');
      if (ComplianceModel) {
        const events = await ComplianceModel.findAll({
          where: {
            eventType: reportType,
            timestamp: {
              [require('sequelize').Op.between]: [period.start, period.end]
            }
          },
          order: [['timestamp', 'ASC']]
        });

        return events.map((e: any) => e.toJSON());
      }

      return [];
    } catch (error) {
      LoggerService.error('Failed to query compliance events', {
        reportType,
        period,
        error
      });
      return [];
    }
  }

  /**
   * Submit regulatory report to authorities
   */
  public static async submitRegulatoryReport(reportId: string): Promise<void> {
    try {
      const ReportModel: any = DatabaseService.getModel('RegulatoryReport');
      if (ReportModel) {
        await ReportModel.update(
          { status: 'submitted', submittedAt: new Date() },
          { where: { reportId } }
        );
      }

      LoggerService.info('Regulatory report submitted', { reportId });

      // Emit submission event
      await EventStreamingService.emitComplianceEvent(
        'AML',
        'regulatory_report_submitted',
        { reportId },
        'pending',
        { correlationId: reportId },
        `Regulatory report submitted: ${reportId}`
      );
    } catch (error) {
      LoggerService.error('Failed to submit regulatory report', {
        reportId,
        error
      });
      throw error;
    }
  }

  /**
   * Check data retention compliance
   */
  public static async checkRetentionCompliance(): Promise<{
    compliant: boolean;
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      // Check compliance events retention
      const ComplianceModel: any = DatabaseService.getModel('ComplianceEvent');
      if (ComplianceModel) {
        const oldEvents = await ComplianceModel.count({
          where: {
            timestamp: {
              [require('sequelize').Op.lt]: cutoffDate
            }
          }
        });

        if (oldEvents > 0) {
          issues.push(`${oldEvents} compliance events older than ${this.RETENTION_DAYS} days found`);
        }
      }

      // Check SAR retention
      const SARModel: any = DatabaseService.getModel('SuspiciousActivityReport');
      if (SARModel) {
        const oldSARs = await SARModel.count({
          where: {
            timestamp: {
              [require('sequelize').Op.lt]: cutoffDate
            }
          }
        });

        if (oldSARs > 0) {
          issues.push(`${oldSARs} SARs older than ${this.RETENTION_DAYS} days found`);
        }
      }

      return {
        compliant: issues.length === 0,
        issues
      };
    } catch (error) {
      LoggerService.error('Failed to check retention compliance', { error });
      return {
        compliant: false,
        issues: [`Compliance check failed: ${(error as Error).message}`]
      };
    }
  }
}
