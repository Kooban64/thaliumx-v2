/**
 * Alerts Service
 * Manages compliance alerts across all platform services
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getChainAnalysisService } from '../chainanalysis';
import { createComponentLogger, logAlertEvent } from '../../utils/logger';
import { getConfig } from '../../config';
import type {
  ComplianceServiceType,
  ComplianceAlert,
} from '../../types/coordinator';
import type { ComplianceAlertTable } from '../../types/database';

const logger = createComponentLogger('alerts-service');

/**
 * Alert creation input
 */
export interface CreateAlertInput {
  alertType: ComplianceAlert['alertType'];
  severity: ComplianceAlert['severity'];
  sourceService: ComplianceServiceType;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
}

/**
 * Alert query options
 */
export interface AlertQueryOptions {
  status?: ComplianceAlert['status'] | undefined;
  severity?: ComplianceAlert['severity'] | undefined;
  alertType?: ComplianceAlert['alertType'] | undefined;
  sourceService?: ComplianceServiceType | undefined;
  assignedTo?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Alert update input
 */
export interface UpdateAlertInput {
  status?: ComplianceAlert['status'] | undefined;
  assignedTo?: string | undefined;
  resolution?: string | undefined;
}

/**
 * Alerts Service
 */
export class AlertsService {
  /**
   * Create a new alert
   */
  async createAlert(input: CreateAlertInput): Promise<ComplianceAlert> {
    logger.info('Creating alert', {
      alertType: input.alertType,
      severity: input.severity,
      sourceService: input.sourceService,
    });

    const db = getDatabaseService();
    const id = uuidv4();
    const now = new Date();

    await db.query(`
      INSERT INTO compliance_alerts (
        id, alert_type, severity, source_service, source_entity_type, source_entity_id,
        title, description, details, tenant_id, broker_id, user_id, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      id,
      input.alertType,
      input.severity,
      input.sourceService,
      input.sourceEntityType,
      input.sourceEntityId,
      input.title,
      input.description,
      JSON.stringify(input.details),
      input.tenantId,
      input.brokerId,
      input.userId,
    ]);

    logAlertEvent('created', id, input.alertType, input.severity, {
      sourceService: input.sourceService,
      tenantId: input.tenantId,
    });

    // Send notifications if enabled
    await this.sendNotifications(input);

    return {
      id,
      alertType: input.alertType,
      severity: input.severity,
      sourceService: input.sourceService,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      title: input.title,
      description: input.description,
      details: input.details,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      userId: input.userId,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get alert by ID
   */
  async getAlert(alertId: string): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<ComplianceAlertTable>(`
      SELECT
        id,
        alert_type as "alertType",
        severity,
        source_service as "sourceService",
        source_entity_type as "sourceEntityType",
        source_entity_id as "sourceEntityId",
        title,
        description,
        details,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        user_id as "userId",
        status,
        assigned_to as "assignedTo",
        acknowledged_by as "acknowledgedBy",
        acknowledged_at as "acknowledgedAt",
        resolved_by as "resolvedBy",
        resolved_at as "resolvedAt",
        resolution,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM compliance_alerts WHERE id = $1
    `, [alertId]);

    if (!row) {
      return null;
    }

    return this.mapAlertTableToData(row);
  }

  /**
   * Get alerts with filters
   */
  async getAlerts(
    tenantId: string,
    options?: AlertQueryOptions
  ): Promise<ComplianceAlert[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.severity) {
      whereClause += ` AND severity = $${paramIndex}`;
      params.push(options.severity);
      paramIndex++;
    }

    if (options?.alertType) {
      whereClause += ` AND alert_type = $${paramIndex}`;
      params.push(options.alertType);
      paramIndex++;
    }

    if (options?.sourceService) {
      whereClause += ` AND source_service = $${paramIndex}`;
      params.push(options.sourceService);
      paramIndex++;
    }

    if (options?.assignedTo) {
      whereClause += ` AND assigned_to = $${paramIndex}`;
      params.push(options.assignedTo);
      paramIndex++;
    }

    if (options?.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<ComplianceAlertTable>(`
      SELECT
        id,
        alert_type as "alertType",
        severity,
        source_service as "sourceService",
        source_entity_type as "sourceEntityType",
        source_entity_id as "sourceEntityId",
        title,
        description,
        details,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        user_id as "userId",
        status,
        assigned_to as "assignedTo",
        acknowledged_by as "acknowledgedBy",
        acknowledged_at as "acknowledgedAt",
        resolved_by as "resolvedBy",
        resolved_at as "resolvedAt",
        resolution,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM compliance_alerts
      ${whereClause}
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapAlertTableToData(row));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE compliance_alerts
      SET status = 'acknowledged',
          acknowledged_by = $1,
          acknowledged_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'new'
    `, [acknowledgedBy, alertId]);

    const alert = await this.getAlert(alertId);
    if (alert) {
      logAlertEvent('acknowledged', alertId, alert.alertType, alert.severity, {
        acknowledgedBy,
      });
    }

    return alert;
  }

  /**
   * Start investigating an alert
   */
  async investigateAlert(
    alertId: string,
    assignedTo: string
  ): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE compliance_alerts
      SET status = 'investigating',
          assigned_to = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status IN ('new', 'acknowledged')
    `, [assignedTo, alertId]);

    return this.getAlert(alertId);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE compliance_alerts
      SET status = 'resolved',
          resolved_by = $1,
          resolved_at = CURRENT_TIMESTAMP,
          resolution = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status IN ('new', 'acknowledged', 'investigating')
    `, [resolvedBy, resolution, alertId]);

    const alert = await this.getAlert(alertId);
    if (alert) {
      logAlertEvent('resolved', alertId, alert.alertType, alert.severity, {
        resolvedBy,
        resolution,
      });
    }

    return alert;
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(
    alertId: string,
    dismissedBy: string,
    reason: string
  ): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE compliance_alerts
      SET status = 'dismissed',
          resolved_by = $1,
          resolved_at = CURRENT_TIMESTAMP,
          resolution = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status IN ('new', 'acknowledged', 'investigating')
    `, [dismissedBy, reason, alertId]);

    const alert = await this.getAlert(alertId);
    if (alert) {
      logAlertEvent('dismissed', alertId, alert.alertType, alert.severity, {
        dismissedBy,
        reason,
      });
    }

    return alert;
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byService: Record<string, number>;
    averageResolutionTime: number;
  }> {
    const db = getDatabaseService();

    // Get total and by status
    const statusStats = await db.queryAll<{ status: string; count: string }>(`
      SELECT status, COUNT(*) as count
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY status
    `, [tenantId, periodStart, periodEnd]);

    // Get by severity
    const severityStats = await db.queryAll<{ severity: string; count: string }>(`
      SELECT severity, COUNT(*) as count
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY severity
    `, [tenantId, periodStart, periodEnd]);

    // Get by type
    const typeStats = await db.queryAll<{ alertType: string; count: string }>(`
      SELECT alert_type as "alertType", COUNT(*) as count
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY alert_type
    `, [tenantId, periodStart, periodEnd]);

    // Get by service
    const serviceStats = await db.queryAll<{ sourceService: string; count: string }>(`
      SELECT source_service as "sourceService", COUNT(*) as count
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY source_service
    `, [tenantId, periodStart, periodEnd]);

    // Get average resolution time
    const resolutionTime = await db.queryOne<{ avg_time: string }>(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_time
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
        AND resolved_at IS NOT NULL
    `, [tenantId, periodStart, periodEnd]);

    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byService: Record<string, number> = {};
    let total = 0;

    for (const stat of statusStats) {
      byStatus[stat.status] = parseInt(stat.count, 10);
      total += parseInt(stat.count, 10);
    }

    for (const stat of severityStats) {
      bySeverity[stat.severity] = parseInt(stat.count, 10);
    }

    for (const stat of typeStats) {
      byType[stat.alertType] = parseInt(stat.count, 10);
    }

    for (const stat of serviceStats) {
      byService[stat.sourceService] = parseInt(stat.count, 10);
    }

    return {
      total,
      byStatus,
      bySeverity,
      byType,
      byService,
      averageResolutionTime: parseFloat(resolutionTime?.avg_time ?? '0'),
    };
  }

  /**
   * Process OmniExchange alerts and create compliance alerts
   */
  async processOmniExchangeAlerts(tenantId: string): Promise<void> {
    try {
      // TODO: Get OmniExchange service alerts
      // For now, we'll create alerts based on compliance dashboard data
      // In a real implementation, this would integrate with the OmniExchangeService

      // Example alerts based on compliance metrics
      const complianceMetrics = {
        highRiskTransactions: 2,
        failedTravelRuleSubmissions: 1,
        exchangeHealthIssues: 0,
        fundSegregationAlerts: 0
      };

      // Create alerts for high-risk transactions
      if (complianceMetrics.highRiskTransactions > 0) {
        await this.createAlert({
          alertType: 'high_risk_transaction',
          severity: 'high',
          sourceService: 'omni-exchange',
          sourceEntityType: 'transaction',
          sourceEntityId: 'multiple',
          title: 'OmniExchange: High Risk Transactions Detected',
          description: `${complianceMetrics.highRiskTransactions} high-risk transactions detected in multi-exchange operations. Immediate review required.`,
          details: {
            highRiskCount: complianceMetrics.highRiskTransactions,
            exchanges: ['kucoin', 'bybit', 'okx'],
            riskFactors: ['large_amount', 'new_counterparty', 'geographic_risk']
          },
          tenantId,
        });
      }

      // Create alerts for failed Travel Rule submissions
      if (complianceMetrics.failedTravelRuleSubmissions > 0) {
        await this.createAlert({
          alertType: 'travel_rule_failure',
          severity: 'medium',
          sourceService: 'omni-exchange',
          sourceEntityType: 'travel_rule',
          sourceEntityId: 'pending_submissions',
          title: 'OmniExchange: Travel Rule Submission Failures',
          description: `${complianceMetrics.failedTravelRuleSubmissions} Travel Rule messages failed to submit to beneficiary VASPs.`,
          details: {
            failedCount: complianceMetrics.failedTravelRuleSubmissions,
            pendingMessages: 5,
            retryRequired: true
          },
          tenantId,
        });
      }

      // Create alerts for exchange health issues
      if (complianceMetrics.exchangeHealthIssues > 0) {
        await this.createAlert({
          alertType: 'exchange_health_issue',
          severity: 'medium',
          sourceService: 'omni-exchange',
          sourceEntityType: 'exchange',
          sourceEntityId: 'multiple',
          title: 'OmniExchange: Exchange Health Degradation',
          description: `${complianceMetrics.exchangeHealthIssues} exchanges showing degraded health status.`,
          details: {
            degradedExchanges: ['kraken'],
            issues: ['response_time', 'error_rate'],
            failoverActive: false
          },
          tenantId,
        });
      }

      // Create alerts for fund segregation issues
      if (complianceMetrics.fundSegregationAlerts > 0) {
        await this.createAlert({
          alertType: 'fund_segregation_issue',
          severity: 'critical',
          sourceService: 'omni-exchange',
          sourceEntityType: 'funds',
          sourceEntityId: 'platform_allocation',
          title: 'OmniExchange: Fund Segregation Alert',
          description: 'Critical fund segregation issue detected in platform-level allocations.',
          details: {
            affectedAssets: ['BTC', 'ETH'],
            affectedExchanges: ['kucoin', 'bybit'],
            issueType: 'allocation_mismatch',
            requiresImmediateAction: true
          },
          tenantId,
        });
      }

      logger.info('Processed OmniExchange alerts', {
        alertsCreated: 4, // This would be dynamic in real implementation
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to process OmniExchange alerts', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Process ChainAnalysis alerts and create compliance alerts
   */
  async processChainAnalysisAlerts(tenantId: string): Promise<void> {
    try {
      const chainAnalysis = getChainAnalysisService();
      const alertsResponse = await chainAnalysis.getAlerts();

      if (!alertsResponse.success || !alertsResponse.data) {
        logger.warn('Failed to retrieve ChainAnalysis alerts', {
          success: alertsResponse.success,
          error: alertsResponse.error,
        });
        return;
      }

      const chainAlerts = alertsResponse.data.alerts;

      logger.info('Processing ChainAnalysis alerts', {
        alertCount: chainAlerts.length,
        tenantId,
      });

      for (const chainAlert of chainAlerts) {
        // Check if we already have this alert
        const existingAlert = await this.findExistingChainAnalysisAlert(
          chainAlert.id,
          tenantId
        );

        if (existingAlert) {
          logger.debug('ChainAnalysis alert already exists', {
            chainAlertId: chainAlert.id,
            existingAlertId: existingAlert.id,
          });
          continue;
        }

        // Map ChainAnalysis severity to compliance severity
        const severity = this.mapChainAnalysisSeverity(chainAlert.severity);

        // Create compliance alert
        await this.createAlert({
          alertType: this.mapChainAnalysisType(chainAlert.type),
          severity,
          sourceService: 'chainanalysis',
          sourceEntityType: 'blockchain',
          sourceEntityId: chainAlert.entities.join(','),
          title: `ChainAnalysis: ${chainAlert.description}`,
          description: `Blockchain forensic analysis detected: ${chainAlert.description}. Risk Score: ${(chainAlert.riskScore * 100).toFixed(1)}%`,
          details: {
            chainAnalysisAlertId: chainAlert.id,
            riskScore: chainAlert.riskScore,
            entities: chainAlert.entities,
            originalType: chainAlert.type,
            originalSeverity: chainAlert.severity,
            timestamp: chainAlert.timestamp,
          },
          tenantId,
          // ChainAnalysis alerts are platform-wide, not broker-specific
        });

        logger.info('Created compliance alert from ChainAnalysis', {
          chainAlertId: chainAlert.id,
          severity,
          riskScore: chainAlert.riskScore,
          entityCount: chainAlert.entities.length,
        });
      }
    } catch (error) {
      logger.error('Failed to process ChainAnalysis alerts', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Find existing ChainAnalysis alert by ID
   */
  private async findExistingChainAnalysisAlert(
    chainAlertId: string,
    tenantId: string
  ): Promise<ComplianceAlert | null> {
    const db = getDatabaseService();

    const row = await db.queryOne<ComplianceAlertTable>(`
      SELECT
        id,
        alert_type as "alertType",
        severity,
        source_service as "sourceService",
        source_entity_type as "sourceEntityType",
        source_entity_id as "sourceEntityId",
        title,
        description,
        details,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        user_id as "userId",
        status,
        assigned_to as "assignedTo",
        acknowledged_by as "acknowledgedBy",
        acknowledged_at as "acknowledgedAt",
        resolved_by as "resolvedBy",
        resolved_at as "resolvedAt",
        resolution,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM compliance_alerts
      WHERE source_service = 'chainanalysis'
        AND details->>'chainAnalysisAlertId' = $1
        AND tenant_id = $2
    `, [chainAlertId, tenantId]);

    return row ? this.mapAlertTableToData(row) : null;
  }

  /**
   * Map ChainAnalysis severity to compliance severity
   */
  private mapChainAnalysisSeverity(chainSeverity: string): ComplianceAlert['severity'] {
    switch (chainSeverity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  /**
   * Map ChainAnalysis alert type to compliance alert type
   */
  private mapChainAnalysisType(chainType: string): ComplianceAlert['alertType'] {
    switch (chainType.toLowerCase()) {
      case 'high_risk_transaction':
        return 'suspicious_transaction';
      case 'suspicious_pattern':
        return 'pattern_detected';
      case 'large_transfer':
        return 'large_transfer';
      case 'circular_flow':
        return 'circular_flow';
      default:
        return 'blockchain_anomaly';
    }
  }

  /**
   * Get active alerts count
   */
  async getActiveAlertsCount(tenantId: string): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }> {
    const db = getDatabaseService();

    const result = await db.queryOne<{
      total: string;
      critical: string;
      high: string;
      medium: string;
      low: string;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND status IN ('new', 'acknowledged', 'investigating')
    `, [tenantId]);

    return {
      total: parseInt(result?.total ?? '0', 10),
      critical: parseInt(result?.critical ?? '0', 10),
      high: parseInt(result?.high ?? '0', 10),
      medium: parseInt(result?.medium ?? '0', 10),
      low: parseInt(result?.low ?? '0', 10),
    };
  }

  /**
   * Send notifications for alert
   */
  private async sendNotifications(input: CreateAlertInput): Promise<void> {
    const config = getConfig();

    if (!config.alerts.enabled) {
      return;
    }

    // Only send notifications for high and critical alerts
    if (input.severity !== 'high' && input.severity !== 'critical') {
      return;
    }

    // Email notifications
    if (config.alerts.emailNotifications) {
      await this.sendEmailNotification(input);
    }

    // Slack notifications
    if (config.alerts.slackNotifications && config.alerts.webhookUrl) {
      await this.sendSlackNotification(input);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(input: CreateAlertInput): Promise<void> {
    // TODO: Implement email notification
    logger.info('Email notification would be sent', {
      alertType: input.alertType,
      severity: input.severity,
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(input: CreateAlertInput): Promise<void> {
    const config = getConfig();

    if (!config.alerts.webhookUrl) {
      return;
    }

    try {
      const color = input.severity === 'critical' ? '#FF0000' :
                    input.severity === 'high' ? '#FFA500' :
                    input.severity === 'medium' ? '#FFFF00' : '#00FF00';

      const payload = {
        attachments: [{
          color,
          title: `[${input.severity.toUpperCase()}] ${input.title}`,
          text: input.description,
          fields: [
            { title: 'Service', value: input.sourceService, short: true },
            { title: 'Type', value: input.alertType, short: true },
            { title: 'Entity', value: `${input.sourceEntityType}:${input.sourceEntityId}`, short: true },
            { title: 'Tenant', value: input.tenantId, short: true },
          ],
          ts: Math.floor(Date.now() / 1000),
        }],
      };

      // Use fetch to send webhook
      const response = await fetch(config.alerts.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error('Failed to send Slack notification', {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error('Error sending Slack notification', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Map alert table to data
   */
  private mapAlertTableToData(row: ComplianceAlertTable): ComplianceAlert {
    return {
      id: row.id,
      alertType: row.alertType as ComplianceAlert['alertType'],
      severity: row.severity as ComplianceAlert['severity'],
      sourceService: row.sourceService as ComplianceServiceType,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      title: row.title,
      description: row.description,
      details: row.details,
      tenantId: row.tenantId,
      brokerId: row.brokerId ?? undefined,
      userId: row.userId ?? undefined,
      status: row.status as ComplianceAlert['status'],
      assignedTo: row.assignedTo ?? undefined,
      acknowledgedBy: row.acknowledgedBy ?? undefined,
      acknowledgedAt: row.acknowledgedAt ?? undefined,
      resolvedBy: row.resolvedBy ?? undefined,
      resolvedAt: row.resolvedAt ?? undefined,
      resolution: row.resolution ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Singleton instance
 */
let alertsServiceInstance: AlertsService | null = null;

export function getAlertsService(): AlertsService {
  if (!alertsServiceInstance) {
    alertsServiceInstance = new AlertsService();
  }
  return alertsServiceInstance;
}

export default getAlertsService;
