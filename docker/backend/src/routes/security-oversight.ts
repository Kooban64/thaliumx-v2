/**
 * Security & Oversight Routes
 * 
 * API endpoints for Security & Oversight Service:
 * - Security Event Management
 * - Incident Response
 * - Risk Assessment
 * - Compliance Monitoring
 * - Security Reporting
 * - Threat Detection
 * - Audit Trail Management
 */

import { Router } from 'express';
import { SecurityOversightService } from '../services/security-oversight';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { validateRequest } from '../middleware/error-handler';
import Joi from 'joi';
import { LoggerService } from '../services/logger';

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createSecurityEventSchema = Joi.object({
  type: Joi.string().valid(
    'login_attempt', 'login_success', 'login_failure', 'suspicious_activity',
    'unauthorized_access', 'data_breach', 'malware_detected', 'phishing_attempt',
    'insider_threat', 'system_compromise', 'compliance_violation', 'regulatory_breach',
    'financial_anomaly', 'trading_anomaly', 'aml_flag', 'sanctions_match',
    'pep_match', 'high_risk_transaction', 'account_takeover', 'identity_theft'
  ).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  source: Joi.string().required(),
  userId: Joi.string().optional(),
  brokerId: Joi.string().optional(),
  ipAddress: Joi.string().ip().optional(),
  userAgent: Joi.string().optional(),
  location: Joi.string().optional(),
  metadata: Joi.object({
    requestId: Joi.string().optional(),
    sessionId: Joi.string().optional(),
    transactionId: Joi.string().optional(),
    amount: Joi.number().optional(),
    currency: Joi.string().optional(),
    accountId: Joi.string().optional(),
    walletAddress: Joi.string().optional(),
    deviceFingerprint: Joi.string().optional(),
    riskScore: Joi.number().min(0).max(100).optional(),
    complianceFlags: Joi.array().items(Joi.string()).optional(),
    additionalData: Joi.object().optional()
  }).optional()
});

const createIncidentSchema = Joi.object({
  eventId: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  priority: Joi.number().min(1).max(10).required(),
  category: Joi.string().required(),
  affectedUsers: Joi.array().items(Joi.string()).required(),
  affectedSystems: Joi.array().items(Joi.string()).required(),
  assignedTo: Joi.string().optional()
});

const createRiskAssessmentSchema = Joi.object({
  entityId: Joi.string().required(),
  entityType: Joi.string().valid('user', 'broker', 'transaction', 'system').required(),
  riskLevel: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  riskScore: Joi.number().min(0).max(100).required(),
  factors: Joi.array().items(Joi.object({
    category: Joi.string().required(),
    factor: Joi.string().required(),
    weight: Joi.number().min(0).max(1).required(),
    score: Joi.number().min(0).max(100).required(),
    description: Joi.string().required(),
    evidence: Joi.string().optional()
  })).required(),
  mitigation: Joi.array().items(Joi.object({
    type: Joi.string().valid('control', 'monitoring', 'training', 'process', 'technology').required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    effectiveness: Joi.number().min(0).max(1).required(),
    cost: Joi.number().min(0).required(),
    implementation: Joi.string().required(),
    status: Joi.string().valid('planned', 'implemented', 'testing', 'operational').required()
  })).required(),
  status: Joi.string().valid('active', 'mitigated', 'accepted', 'transferred').required()
});

const generateReportSchema = Joi.object({
  type: Joi.string().valid('security', 'compliance', 'risk', 'incident', 'audit').required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  period: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().required()
  }).required(),
  recipients: Joi.array().items(Joi.string().email()).required()
});

// =============================================================================
// SECURITY EVENT ROUTES
// =============================================================================

/**
 * POST /api/security/events
 * Create a security event
 */
router.post('/events', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), validateRequest(createSecurityEventSchema), async (req, res) => {
  try {
    const event = await SecurityOversightService.createSecurityEvent(req.body);
    
    res.status(201).json({
      success: true,
      data: event,
      message: 'Security event created successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to create security event:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SECURITY_EVENT_CREATION_FAILED',
        message: 'Failed to create security event'
      }
    });
  }
});

/**
 * GET /api/security/events
 * Get security events
 */
router.get('/events', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      type: req.query.type as any,
      severity: req.query.severity as any,
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const events = await SecurityOversightService.getSecurityEvents(filters);
    
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    LoggerService.error('Failed to get security events:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security events'
      }
    });
  }
});

/**
 * GET /api/security/events/:id
 * Get specific security event
 */
router.get('/events/:id', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const events = await SecurityOversightService.getSecurityEvents({ limit: 1 });
    const event = events.find(e => e.id === id);
    
    if (!event) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SECURITY_EVENT_NOT_FOUND',
          message: 'Security event not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: event
    });
    return;
  } catch (error) {
    LoggerService.error('Failed to get security event:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security event'
      }
    });
    return;
  }
});

// =============================================================================
// INCIDENT RESPONSE ROUTES
// =============================================================================

/**
 * POST /api/security/incidents
 * Create a security incident
 */
router.post('/incidents', authenticateToken, requireRole(['admin', 'security_officer']), validateRequest(createIncidentSchema), async (req, res) => {
  try {
    const incident = await SecurityOversightService.createSecurityIncident(req.body);
    
    res.status(201).json({
      success: true,
      data: incident,
      message: 'Security incident created successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to create security incident:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'INCIDENT_CREATION_FAILED',
        message: 'Failed to create security incident'
      }
    });
  }
});

/**
 * GET /api/security/incidents
 * Get security incidents
 */
router.get('/incidents', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      status: req.query.status as any,
      severity: req.query.severity as any,
      assignedTo: req.query.assignedTo as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const incidents = await SecurityOversightService.getSecurityIncidents(filters);
    
    res.json({
      success: true,
      data: incidents,
      count: incidents.length
    });
  } catch (error) {
    LoggerService.error('Failed to get security incidents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security incidents'
      }
    });
  }
});

/**
 * GET /api/security/incidents/:id
 * Get specific security incident
 */
router.get('/incidents/:id', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const incidents = await SecurityOversightService.getSecurityIncidents({ limit: 1 });
    const incident = incidents.find(i => i.id === id);
    
    if (!incident) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: 'Security incident not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: incident
    });
    return;
  } catch (error) {
    LoggerService.error('Failed to get security incident:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security incident'
      }
    });
  }
});

// =============================================================================
// RISK ASSESSMENT ROUTES
// =============================================================================

/**
 * POST /api/security/risks
 * Create a risk assessment
 */
router.post('/risks', authenticateToken, requireRole(['admin', 'risk_manager', 'compliance_officer']), validateRequest(createRiskAssessmentSchema), async (req, res) => {
  try {
    const risk = await SecurityOversightService.createRiskAssessment(req.body);
    
    res.status(201).json({
      success: true,
      data: risk,
      message: 'Risk assessment created successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to create risk assessment:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'RISK_ASSESSMENT_CREATION_FAILED',
        message: 'Failed to create risk assessment'
      }
    });
  }
});

/**
 * GET /api/security/risks
 * Get risk assessments
 */
router.get('/risks', authenticateToken, requireRole(['admin', 'risk_manager', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      entityType: req.query.entityType as string,
      riskLevel: req.query.riskLevel as any,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const risks = await SecurityOversightService.getRiskAssessments(filters);
    
    res.json({
      success: true,
      data: risks,
      count: risks.length
    });
  } catch (error) {
    LoggerService.error('Failed to get risk assessments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get risk assessments'
      }
    });
  }
});

/**
 * GET /api/security/risks/:id
 * Get specific risk assessment
 */
router.get('/risks/:id', authenticateToken, requireRole(['admin', 'risk_manager', 'compliance_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const risks = await SecurityOversightService.getRiskAssessments({ limit: 1 });
    const risk = risks.find(r => r.id === id);
    
    if (!risk) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RISK_ASSESSMENT_NOT_FOUND',
          message: 'Risk assessment not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: risk
    });
    return;
  } catch (error) {
    LoggerService.error('Failed to get risk assessment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get risk assessment'
      }
    });
  }
});

// =============================================================================
// SECURITY REPORTING ROUTES
// =============================================================================

/**
 * POST /api/security/reports
 * Generate security report
 */
router.post('/reports', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), validateRequest(generateReportSchema), async (req, res) => {
  try {
    const reportData = {
      ...req.body,
      generatedBy: (req as any).user?.id || 'system'
    };
    
    const report = await SecurityOversightService.generateSecurityReport(reportData);
    
    res.status(201).json({
      success: true,
      data: report,
      message: 'Security report generated successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to generate security report:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate security report'
      }
    });
  }
});

/**
 * GET /api/security/reports
 * Get security reports
 */
router.get('/reports', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
  try {
    const filters = {
      type: req.query.type as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const reports = await SecurityOversightService.getSecurityReports(filters);
    
    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    LoggerService.error('Failed to get security reports:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security reports'
      }
    });
  }
});

/**
 * GET /api/security/reports/:id
 * Get specific security report
 */
router.get('/reports/:id', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const reports = await SecurityOversightService.getSecurityReports({ limit: 1 });
    const report = reports.find(r => r.id === id);
    
    if (!report) {
      res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Security report not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: report
    });
    return;
  } catch (error) {
    LoggerService.error('Failed to get security report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security report'
      }
    });
  }
});

// =============================================================================
// DASHBOARD & ANALYTICS ROUTES
// =============================================================================

/**
 * GET /api/security/dashboard
 * Get security dashboard data
 */
router.get('/dashboard', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
  try {
    const events = await SecurityOversightService.getSecurityEvents({ limit: 100 });
    const incidents = await SecurityOversightService.getSecurityIncidents({ limit: 50 });
    const risks = await SecurityOversightService.getRiskAssessments({ limit: 50 });
    
    const dashboard = {
      summary: {
        totalEvents: events.length,
        criticalEvents: events.filter(e => e.severity === 'critical').length,
        highSeverityEvents: events.filter(e => e.severity === 'high').length,
        openIncidents: incidents.filter(i => i.status === 'open').length,
        highRiskAssessments: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
        complianceScore: 85,
        riskScore: 72
      },
      recentEvents: events.slice(0, 10),
      recentIncidents: incidents.slice(0, 5),
      highRisks: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').slice(0, 5),
      trends: {
        eventsBySeverity: {
          low: events.filter(e => e.severity === 'low').length,
          medium: events.filter(e => e.severity === 'medium').length,
          high: events.filter(e => e.severity === 'high').length,
          critical: events.filter(e => e.severity === 'critical').length
        },
        incidentsByStatus: {
          open: incidents.filter(i => i.status === 'open').length,
          investigating: incidents.filter(i => i.status === 'investigating').length,
          contained: incidents.filter(i => i.status === 'contained').length,
          resolved: incidents.filter(i => i.status === 'resolved').length,
          closed: incidents.filter(i => i.status === 'closed').length
        }
      }
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    LoggerService.error('Failed to get security dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security dashboard'
      }
    });
  }
});

/**
 * GET /api/security/analytics
 * Get security analytics
 */
router.get('/analytics', authenticateToken, requireRole(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    
    const events = await SecurityOversightService.getSecurityEvents({
      startDate,
      endDate
    });
    
    const analytics = {
      period: { startDate, endDate },
      metrics: {
        totalEvents: events.length,
        eventsByType: events.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsBySeverity: events.reduce((acc, event) => {
          acc[event.severity] = (acc[event.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsBySource: events.reduce((acc, event) => {
          acc[event.source] = (acc[event.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByDay: events.reduce((acc, event) => {
          const day = event.timestamp.toISOString().split('T')[0];
          if (day) {
            acc[day] = (acc[day] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      },
      trends: {
        eventTrend: 'increasing', // Would be calculated from historical data
        riskTrend: 'stable',
        complianceTrend: 'improving'
      }
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    LoggerService.error('Failed to get security analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security analytics'
      }
    });
  }
});

// =============================================================================
// HEALTH ROUTES
// =============================================================================

/**
 * GET /api/security/health
 * Get security service health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const isHealthy = SecurityOversightService.isHealthy();
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        monitoring: {
          compliance: 'active',
          threatDetection: 'active',
          riskAssessment: 'active',
          incidentResponse: 'active'
        }
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get security health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get security health'
      }
    });
  }
});

export default router;
