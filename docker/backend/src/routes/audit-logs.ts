/**
 * Audit Logs API Routes
 * 
 * Provides API endpoints for querying and exporting audit logs for compliance.
 * 
 * Features:
 * - Query by user, tenant, time range, event type
 * - Export for compliance reports
 * - Support pagination and filtering
 * - Access control (admin only)
 */

import { Router, type Request, type Response } from 'express';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import { ComplianceReportingService } from '../services/compliance-reporting';
import { LogReplayService } from '../services/log-replay';

const router: ReturnType<typeof Router> = Router();

/**
 * Query audit logs
 * GET /api/audit-logs
 * Query params: userId, tenantId, startDate, endDate, action, limit, offset
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      startDate,
      endDate,
      action,
      limit = '100',
      offset = '0',
    } = req.query;

    const Model: any = DatabaseService.getModel && DatabaseService.getModel('AuditLog');
      if (!Model) {
        res.status(503).json({
          success: false,
          error: 'Audit log service unavailable',
        });
        return;
      }

    const where: any = {};
    if (userId) where.userId = userId;
    if (tenantId) where.tenantId = tenantId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.$gte = new Date(startDate as string);
      if (endDate) where.createdAt.$lte = new Date(endDate as string);
    }

    const logs = await Model.findAll({
      where,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      order: [['createdAt', 'DESC']],
    });

    const total = await Model.count({ where });

    res.json({
      success: true,
      data: logs.map((log: any) => log.toJSON()),
      pagination: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    LoggerService.error('Failed to query audit logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
    });
  }
});

/**
 * Generate compliance report
 * POST /api/audit-logs/compliance-report
 * Body: { reportType, startDate, endDate, format, anonymize, tenantId }
 */
router.post('/compliance-report', async (req: Request, res: Response) => {
  try {
    const {
      reportType,
      startDate,
      endDate,
      format = 'json',
      anonymize = false,
      tenantId,
    } = req.body;

    if (!reportType || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: reportType, startDate, endDate',
      });
      return;
    }

    const report = await ComplianceReportingService.generateReport({
      reportType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format,
      anonymize,
      tenantId,
    });

    const exported = ComplianceReportingService.exportReport(report, format);

    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 
                              format === 'csv' ? 'text/csv' : 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${reportType}-${Date.now()}.${format}"`);
    res.send(exported);
  } catch (error) {
    LoggerService.error('Failed to generate compliance report', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate compliance report',
    });
  }
});

/**
 * Replay logs by correlation ID
 * GET /api/audit-logs/replay/:correlationId
 */
router.get('/replay/:correlationId', async (req: Request, res: Response) => {
  try {
    const { correlationId } = req.params;
    const { startTime, endTime, services, levels, format = 'json' } = req.query;

    if (!correlationId) {
      res.status(400).json({
        success: false,
        error: 'Missing correlationId parameter',
      });
      return;
    }

    LogReplayService.initialize();
    
    const logs = await LogReplayService.replayByCorrelationId({
      correlationId,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      services: services ? (services as string).split(',') : undefined,
      levels: levels ? (levels as string).split(',') : undefined,
      format: format as 'json' | 'csv',
    });

    if (format === 'json') {
      res.json({
        success: true,
        correlationId,
        logs,
        count: logs.length,
      });
    } else {
      const exported = LogReplayService.exportLogs(logs, 'csv');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="log-replay-${correlationId}.csv"`);
      res.send(exported);
    }
  } catch (error) {
    LoggerService.error('Failed to replay logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to replay logs',
    });
  }
});

/**
 * Get compliance status dashboard
 * GET /api/audit-logs/compliance-status
 */
router.get('/compliance-status', async (_req: Request, res: Response) => {
  try {
    const status = await ComplianceReportingService.getComplianceStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    LoggerService.error('Failed to get compliance status', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get compliance status',
    });
  }
});

export default router;