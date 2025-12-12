/**
 * Alerts Service
 * Manages compliance alerts across all platform services
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
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
      SELECT * FROM compliance_alerts WHERE id = $1
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
      SELECT * FROM compliance_alerts
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
    const typeStats = await db.queryAll<{ alert_type: string; count: string }>(`
      SELECT alert_type, COUNT(*) as count
      FROM compliance_alerts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY alert_type
    `, [tenantId, periodStart, periodEnd]);

    // Get by service
    const serviceStats = await db.queryAll<{ source_service: string; count: string }>(`
      SELECT source_service, COUNT(*) as count
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
      byType[stat.alert_type] = parseInt(stat.count, 10);
    }

    for (const stat of serviceStats) {
      byService[stat.source_service] = parseInt(stat.count, 10);
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
      alertType: row.alert_type as ComplianceAlert['alertType'],
      severity: row.severity as ComplianceAlert['severity'],
      sourceService: row.source_service as ComplianceServiceType,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      title: row.title,
      description: row.description,
      details: row.details,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      userId: row.user_id ?? undefined,
      status: row.status as ComplianceAlert['status'],
      assignedTo: row.assigned_to ?? undefined,
      acknowledgedBy: row.acknowledged_by ?? undefined,
      acknowledgedAt: row.acknowledged_at ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      resolution: row.resolution ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
