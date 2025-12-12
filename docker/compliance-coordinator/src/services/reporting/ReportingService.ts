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
  PlatformComplianceReportTable,
  UserComplianceReportTable,
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
      avg_risk: string;
      max_risk_level: string;
    }>(`
      SELECT
        COUNT(*) as total,
        AVG(risk_score) as avg_risk,
        MAX(CASE
          WHEN risk_level = 'critical' THEN 4
          WHEN risk_level = 'high' THEN 3
          WHEN risk_level = 'medium' THEN 2
          ELSE 1
        END) as max_risk_level
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
      source_service: string;
      count: string;
      last_activity: Date;
    }>(`
      SELECT
        source_service,
        COUNT(*) as count,
        MAX(assessment_date) as last_activity
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
      risk_score: number;
      risk_level: string;
    }>(`
      SELECT
        DATE(assessment_date) as date,
        AVG(risk_score)::integer as risk_score,
        MAX(risk_level) as risk_level
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
    const maxRiskLevel = parseInt(userStats?.max_risk_level ?? '1', 10);
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
        averageRiskScore: parseFloat(userStats?.avg_risk ?? '0'),
        riskLevel,
        travelRuleMessages: parseInt(travelRuleCount?.count ?? '0', 10),
        carfReports: 0, // Would need to count
      },
      activityByService: activityByService.map((a) => ({
        service: a.source_service as ComplianceServiceType,
        transactions: parseInt(a.count, 10),
        volumeUSD: '0',
        lastActivity: a.last_activity,
      })),
      riskHistory: riskHistory.map((r) => ({
        date: r.date,
        riskScore: r.risk_score,
        riskLevel: r.risk_level as 'low' | 'medium' | 'high' | 'critical',
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
    const row = await db.queryOne<PlatformComplianceReportTable>(`
      SELECT * FROM platform_compliance_reports WHERE id = $1 OR report_id = $1
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
    const row = await db.queryOne<UserComplianceReportTable>(`
      SELECT * FROM user_compliance_reports WHERE id = $1 OR report_id = $1
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
  private mapPlatformReportTableToData(row: PlatformComplianceReportTable): PlatformComplianceReport {
    return {
      id: row.id,
      reportId: row.report_id,
      reportType: row.report_type as PlatformComplianceReport['reportType'],
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      reportingPeriod: {
        startDate: row.reporting_period_start_date,
        endDate: row.reporting_period_end_date,
      },
      summary: row.summary as PlatformComplianceReport['summary'],
      serviceBreakdown: row.service_breakdown as PlatformComplianceReport['serviceBreakdown'],
      riskDistribution: row.risk_distribution as PlatformComplianceReport['riskDistribution'],
      topRiskFlags: row.top_risk_flags as PlatformComplianceReport['topRiskFlags'],
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
      format: row.format as PlatformComplianceReport['format'],
      fileUrl: row.file_url ?? undefined,
    };
  }

  /**
   * Map user report table to data
   */
  private mapUserReportTableToData(row: UserComplianceReportTable): UserComplianceReport {
    return {
      id: row.id,
      reportId: row.report_id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      reportingPeriod: {
        startDate: row.reporting_period_start_date,
        endDate: row.reporting_period_end_date,
      },
      summary: row.summary as UserComplianceReport['summary'],
      activityByService: row.activity_by_service as UserComplianceReport['activityByService'],
      riskHistory: row.risk_history as UserComplianceReport['riskHistory'],
      flags: row.flags,
      recommendations: row.recommendations,
      generatedAt: row.generated_at,
      format: row.format as UserComplianceReport['format'],
      fileUrl: row.file_url ?? undefined,
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
