/**
 * Reporting Service
 * Generates cross-platform compliance reports
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getAggregationService } from '../aggregation';
import { createComponentLogger, logReportEvent } from '../../utils/logger';
import type {
  ComplianceServiceType,
  PlatformComplianceReport,
  UserComplianceReport,
} from '../../types/coordinator';
import type {
  PlatformComplianceReportRow,
  UserComplianceReportRow,
} from '../../types/database';

const logger = createComponentLogger('reporting-service');

/**
 * Report generation options
 */
export interface ReportOptions {
  tenantId: string;
  brokerId?: string | undefined;
  periodStart: Date;
  periodEnd: Date;
  format?: 'json' | 'pdf' | 'csv' | undefined;
  generatedBy?: string | undefined;
}

/**
 * User report options
 */
export interface UserReportOptions extends ReportOptions {
  userId: string;
}

/**
 * Reporting Service
 */
export class ReportingService {
  /**
   * Generate platform compliance report
   */
  async generatePlatformReport(
    reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom',
    options: ReportOptions
  ): Promise<PlatformComplianceReport> {
    logger.info('Generating platform compliance report', {
      reportType,
      tenantId: options.tenantId,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
    });

    const db = getDatabaseService();
    const aggregationService = getAggregationService();

    // Get platform statistics
    const stats = await aggregationService.getPlatformStatistics(
      options.tenantId,
      options.periodStart,
      options.periodEnd
    );

    // Get risk distribution
    const riskDistribution = await this.getRiskDistribution(
      options.tenantId,
      options.periodStart,
      options.periodEnd
    );

    // Get top risk flags
    const topRiskFlags = await this.getTopRiskFlags(
      options.tenantId,
      options.periodStart,
      options.periodEnd
    );

    // Calculate total volume (would need to aggregate from services)
    const totalVolumeUSD = '0'; // Placeholder - would aggregate from services

    // Build service breakdown
    const serviceBreakdown = Object.entries(stats.byService).map(([service, data]) => ({
      service: service as ComplianceServiceType,
      transactions: data.assessments,
      volumeUSD: '0', // Would need to get from services
      averageRiskScore: 0, // Would need to calculate
      highRiskCount: data.highRisk,
      travelRuleCount: data.travelRule,
    }));

    // Create report
    const reportId = `PLT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const report: PlatformComplianceReport = {
      id: uuidv4(),
      reportId,
      reportType,
      tenantId: options.tenantId,
      brokerId: options.brokerId,
      reportingPeriod: {
        startDate: options.periodStart,
        endDate: options.periodEnd,
      },
      summary: {
        totalTransactions: stats.totalAssessments,
        totalVolumeUSD,
        averageRiskScore: 0, // Would calculate
        highRiskTransactions: stats.highRiskCount,
        criticalRiskTransactions: stats.criticalRiskCount,
        travelRuleMessages: stats.travelRuleMessages,
        travelRuleCompliance: stats.travelRuleCompliance,
        sanctionsMatches: 0, // Would get from alerts
        pendingReviews: stats.pendingReviews,
      },
      serviceBreakdown,
      riskDistribution,
      topRiskFlags,
      generatedAt: new Date(),
      generatedBy: options.generatedBy ?? 'system',
      format: options.format ?? 'json',
    };

    // Save to database
    await db.query(`
      INSERT INTO platform_compliance_reports (
        id, report_id, report_type, tenant_id, broker_id,
        reporting_period_start_date, reporting_period_end_date,
        summary, service_breakdown, risk_distribution, top_risk_flags,
        generated_at, generated_by, format, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP
      )
    `, [
      report.id,
      report.reportId,
      report.reportType,
      report.tenantId,
      report.brokerId,
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      JSON.stringify(report.summary),
      JSON.stringify(report.serviceBreakdown),
      JSON.stringify(report.riskDistribution),
      JSON.stringify(report.topRiskFlags),
      report.generatedAt,
      report.generatedBy,
      report.format,
    ]);

    logReportEvent('generated', 'platform', report.reportId, report.format);

    return report;
  }

  /**
   * Generate user compliance report
   */
  async generateUserReport(options: UserReportOptions): Promise<UserComplianceReport> {
    logger.info('Generating user compliance report', {
      userId: options.userId,
      tenantId: options.tenantId,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
    });

    const db = getDatabaseService();

    // Get user's risk assessments
    const userStats = await db.queryOne<{
      total: string;
      avgRisk: string;
      maxRiskLevel: string;
    }>(`
      SELECT
        COUNT(*) as total,
        AVG(risk_score) as "avgRisk",
        MAX(CASE
          WHEN risk_level = 'critical' THEN 4
          WHEN risk_level = 'high' THEN 3
          WHEN risk_level = 'medium' THEN 2
          ELSE 1
        END) as "maxRiskLevel"
      FROM aggregated_risk_assessments
      WHERE user_id = $1
        AND tenant_id = $2
        AND assessment_date >= $3
        AND assessment_date <= $4
    `, [options.userId, options.tenantId, options.periodStart, options.periodEnd]);

    // Get travel rule count
    const travelRuleCount = await db.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM aggregated_travel_rules
      WHERE user_id = $1
        AND tenant_id = $2
        AND created_at >= $3
        AND created_at <= $4
    `, [options.userId, options.tenantId, options.periodStart, options.periodEnd]);

    // Get activity by service
    const activityByService = await db.queryAll<{
      sourceService: string;
      count: string;
      lastActivity: Date;
    }>(`
      SELECT
        source_service as "sourceService",
        COUNT(*) as count,
        MAX(assessment_date) as "lastActivity"
      FROM aggregated_risk_assessments
      WHERE user_id = $1
        AND tenant_id = $2
        AND assessment_date >= $3
        AND assessment_date <= $4
      GROUP BY source_service
    `, [options.userId, options.tenantId, options.periodStart, options.periodEnd]);

    // Get risk history
    const riskHistory = await db.queryAll<{
      date: Date;
      riskScore: number;
      riskLevel: string;
    }>(`
      SELECT
        DATE(assessment_date) as date,
        AVG(risk_score)::integer as "riskScore",
        MAX(risk_level) as "riskLevel"
      FROM aggregated_risk_assessments
      WHERE user_id = $1
        AND tenant_id = $2
        AND assessment_date >= $3
        AND assessment_date <= $4
      GROUP BY DATE(assessment_date)
      ORDER BY date
    `, [options.userId, options.tenantId, options.periodStart, options.periodEnd]);

    // Get flags
    const flagsResult = await db.queryAll<{ flag: string }>(`
      SELECT DISTINCT unnest(flags) as flag
      FROM aggregated_risk_assessments
      WHERE user_id = $1
        AND tenant_id = $2
        AND assessment_date >= $3
        AND assessment_date <= $4
    `, [options.userId, options.tenantId, options.periodStart, options.periodEnd]);

    // Determine risk level
    const maxRiskLevel = parseInt(userStats?.maxRiskLevel ?? '1', 10);
    const riskLevel = maxRiskLevel >= 4 ? 'critical' :
                      maxRiskLevel >= 3 ? 'high' :
                      maxRiskLevel >= 2 ? 'medium' : 'low';

    // Create report
    const reportId = `USR-${uuidv4().substring(0, 8).toUpperCase()}`;
    const report: UserComplianceReport = {
      id: uuidv4(),
      reportId,
      userId: options.userId,
      tenantId: options.tenantId,
      brokerId: options.brokerId,
      reportingPeriod: {
        startDate: options.periodStart,
        endDate: options.periodEnd,
      },
      summary: {
        totalTransactions: parseInt(userStats?.total ?? '0', 10),
        totalVolumeUSD: '0', // Would need to aggregate
        averageRiskScore: parseFloat(userStats?.avgRisk ?? '0'),
        riskLevel,
        travelRuleMessages: parseInt(travelRuleCount?.count ?? '0', 10),
        carfReports: 0, // Would need to count
      },
      activityByService: activityByService.map((a) => ({
        service: a.sourceService as ComplianceServiceType,
        transactions: parseInt(a.count, 10),
        volumeUSD: '0',
        lastActivity: a.lastActivity,
      })),
      riskHistory: riskHistory.map((riskEntry) => ({
        date: riskEntry.date,
        riskScore: riskEntry.riskScore,
        riskLevel: riskEntry.riskLevel as 'low' | 'medium' | 'high' | 'critical',
      })),
      flags: flagsResult.map((f) => f.flag),
      recommendations: this.generateUserRecommendations(riskLevel, flagsResult.map((f) => f.flag)),
      generatedAt: new Date(),
      format: (options.format === 'csv' ? 'json' : options.format) ?? 'json',
    };

    // Save to database
    await db.query(`
      INSERT INTO user_compliance_reports (
        id, report_id, user_id, tenant_id, broker_id,
        reporting_period_start_date, reporting_period_end_date,
        summary, activity_by_service, risk_history, flags, recommendations,
        generated_at, format, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP
      )
    `, [
      report.id,
      report.reportId,
      report.userId,
      report.tenantId,
      report.brokerId,
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      JSON.stringify(report.summary),
      JSON.stringify(report.activityByService),
      JSON.stringify(report.riskHistory),
      report.flags,
      report.recommendations,
      report.generatedAt,
      report.format,
    ]);

    logReportEvent('generated', 'user', report.reportId, report.format, { userId: options.userId });

    return report;
  }

  /**
   * Get platform report by ID
   */
  async getPlatformReport(reportId: string): Promise<PlatformComplianceReport | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<PlatformComplianceReportRow>(`
      SELECT
        id,
        report_id as "reportId",
        report_type as "reportType",
        tenant_id as "tenantId",
        broker_id as "brokerId",
        reporting_period_start_date as "reportingPeriodStartDate",
        reporting_period_end_date as "reportingPeriodEndDate",
        summary,
        service_breakdown as "serviceBreakdown",
        risk_distribution as "riskDistribution",
        top_risk_flags as "topRiskFlags",
        generated_at as "generatedAt",
        generated_by as "generatedBy",
        format,
        file_url as "fileUrl",
        created_at as "createdAt"
      FROM platform_compliance_reports WHERE id = $1 OR report_id = $1
    `, [reportId]);

    if (!row) {
      return null;
    }

    return this.mapPlatformReportTableToData(row);
  }

  /**
   * Get user report by ID
   */
  async getUserReport(reportId: string): Promise<UserComplianceReport | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<UserComplianceReportRow>(`
      SELECT
        id,
        report_id as "reportId",
        user_id as "userId",
        tenant_id as "tenantId",
        broker_id as "brokerId",
        reporting_period_start_date as "reportingPeriodStartDate",
        reporting_period_end_date as "reportingPeriodEndDate",
        summary,
        activity_by_service as "activityByService",
        risk_history as "riskHistory",
        flags,
        recommendations,
        generated_at as "generatedAt",
        format,
        file_url as "fileUrl",
        created_at as "createdAt"
      FROM user_compliance_reports WHERE id = $1 OR report_id = $1
    `, [reportId]);

    if (!row) {
      return null;
    }

    return this.mapUserReportTableToData(row);
  }

  /**
   * Get risk distribution
   */
  private async getRiskDistribution(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ low: number; medium: number; high: number; critical: number }> {
    const db = getDatabaseService();
    const result = await db.queryOne<{
      low: string;
      medium: string;
      high: string;
      critical: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE risk_level = 'low') as low,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical
      FROM aggregated_risk_assessments
      WHERE tenant_id = $1
        AND assessment_date >= $2
        AND assessment_date <= $3
    `, [tenantId, periodStart, periodEnd]);

    return {
      low: parseInt(result?.low ?? '0', 10),
      medium: parseInt(result?.medium ?? '0', 10),
      high: parseInt(result?.high ?? '0', 10),
      critical: parseInt(result?.critical ?? '0', 10),
    };
  }

  /**
   * Get top risk flags
   */
  private async getTopRiskFlags(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    limit = 10
  ): Promise<{ flag: string; count: number; percentage: number }[]> {
    const db = getDatabaseService();

    const totalResult = await db.queryOne<{ total: string }>(`
      SELECT COUNT(*) as total
      FROM aggregated_risk_assessments
      WHERE tenant_id = $1
        AND assessment_date >= $2
        AND assessment_date <= $3
    `, [tenantId, periodStart, periodEnd]);

    const total = parseInt(totalResult?.total ?? '0', 10);

    const flags = await db.queryAll<{ flag: string; count: string }>(`
      SELECT flag, COUNT(*) as count
      FROM (
        SELECT unnest(flags) as flag
        FROM aggregated_risk_assessments
        WHERE tenant_id = $1
          AND assessment_date >= $2
          AND assessment_date <= $3
      ) f
      GROUP BY flag
      ORDER BY count DESC
      LIMIT $4
    `, [tenantId, periodStart, periodEnd, limit]);

    return flags.map((f) => ({
      flag: f.flag,
      count: parseInt(f.count, 10),
      percentage: total > 0 ? (parseInt(f.count, 10) / total) * 100 : 0,
    }));
  }

  /**
   * Generate user recommendations
   */
  private generateUserRecommendations(riskLevel: string, flags: string[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Enhanced due diligence required');
      recommendations.push('Review recent transactions');
    }

    if (flags.includes('sanctions_match')) {
      recommendations.push('Immediate compliance review required');
    }

    if (flags.includes('mixer_usage') || flags.includes('tornado_cash')) {
      recommendations.push('Verify source of funds');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue standard monitoring');
    }

    return recommendations;
  }

  /**
   * Map platform report table to data
   */
  private mapPlatformReportTableToData(row: PlatformComplianceReportRow): PlatformComplianceReport {
    return {
      id: row.id,
      reportId: row.reportId,
      reportType: row.reportType as PlatformComplianceReport['reportType'],
      tenantId: row.tenantId,
      brokerId: row.brokerId ?? undefined,
      reportingPeriod: {
        startDate: row.reportingPeriodStartDate,
        endDate: row.reportingPeriodEndDate,
      },
      summary: row.summary as PlatformComplianceReport['summary'],
      serviceBreakdown: row.serviceBreakdown as PlatformComplianceReport['serviceBreakdown'],
      riskDistribution: row.riskDistribution as PlatformComplianceReport['riskDistribution'],
      topRiskFlags: row.topRiskFlags as PlatformComplianceReport['topRiskFlags'],
      generatedAt: row.generatedAt,
      generatedBy: row.generatedBy,
      format: row.format as PlatformComplianceReport['format'],
      fileUrl: row.fileUrl ?? undefined,
    };
  }

  /**
   * Map user report table to data
   */
  private mapUserReportTableToData(row: UserComplianceReportRow): UserComplianceReport {
    return {
      id: row.id,
      reportId: row.reportId,
      userId: row.userId,
      tenantId: row.tenantId,
      brokerId: row.brokerId ?? undefined,
      reportingPeriod: {
        startDate: row.reportingPeriodStartDate,
        endDate: row.reportingPeriodEndDate,
      },
      summary: row.summary as UserComplianceReport['summary'],
      activityByService: row.activityByService as UserComplianceReport['activityByService'],
      riskHistory: row.riskHistory as UserComplianceReport['riskHistory'],
      flags: row.flags,
      recommendations: row.recommendations,
      generatedAt: row.generatedAt,
      format: row.format as UserComplianceReport['format'],
      fileUrl: row.fileUrl ?? undefined,
    };
  }
}

/**
 * Singleton instance
 */
let reportingServiceInstance: ReportingService | null = null;

export function getReportingService(): ReportingService {
  if (!reportingServiceInstance) {
    reportingServiceInstance = new ReportingService();
  }
  return reportingServiceInstance;
}

export default getReportingService;
