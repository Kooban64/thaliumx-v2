"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const security_oversight_1 = require("../services/security-oversight");
const error_handler_1 = require("../middleware/error-handler");
const error_handler_2 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../services/logger");
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const createSecurityEventSchema = joi_1.default.object({
    type: joi_1.default.string().valid('login_attempt', 'login_success', 'login_failure', 'suspicious_activity', 'unauthorized_access', 'data_breach', 'malware_detected', 'phishing_attempt', 'insider_threat', 'system_compromise', 'compliance_violation', 'regulatory_breach', 'financial_anomaly', 'trading_anomaly', 'aml_flag', 'sanctions_match', 'pep_match', 'high_risk_transaction', 'account_takeover', 'identity_theft').required(),
    severity: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
    title: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    source: joi_1.default.string().required(),
    userId: joi_1.default.string().optional(),
    brokerId: joi_1.default.string().optional(),
    ipAddress: joi_1.default.string().ip().optional(),
    userAgent: joi_1.default.string().optional(),
    location: joi_1.default.string().optional(),
    metadata: joi_1.default.object({
        requestId: joi_1.default.string().optional(),
        sessionId: joi_1.default.string().optional(),
        transactionId: joi_1.default.string().optional(),
        amount: joi_1.default.number().optional(),
        currency: joi_1.default.string().optional(),
        accountId: joi_1.default.string().optional(),
        walletAddress: joi_1.default.string().optional(),
        deviceFingerprint: joi_1.default.string().optional(),
        riskScore: joi_1.default.number().min(0).max(100).optional(),
        complianceFlags: joi_1.default.array().items(joi_1.default.string()).optional(),
        additionalData: joi_1.default.object().optional()
    }).optional()
});
const createIncidentSchema = joi_1.default.object({
    eventId: joi_1.default.string().required(),
    title: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    severity: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
    priority: joi_1.default.number().min(1).max(10).required(),
    category: joi_1.default.string().required(),
    affectedUsers: joi_1.default.array().items(joi_1.default.string()).required(),
    affectedSystems: joi_1.default.array().items(joi_1.default.string()).required(),
    assignedTo: joi_1.default.string().optional()
});
const createRiskAssessmentSchema = joi_1.default.object({
    entityId: joi_1.default.string().required(),
    entityType: joi_1.default.string().valid('user', 'broker', 'transaction', 'system').required(),
    riskLevel: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
    riskScore: joi_1.default.number().min(0).max(100).required(),
    factors: joi_1.default.array().items(joi_1.default.object({
        category: joi_1.default.string().required(),
        factor: joi_1.default.string().required(),
        weight: joi_1.default.number().min(0).max(1).required(),
        score: joi_1.default.number().min(0).max(100).required(),
        description: joi_1.default.string().required(),
        evidence: joi_1.default.string().optional()
    })).required(),
    mitigation: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('control', 'monitoring', 'training', 'process', 'technology').required(),
        name: joi_1.default.string().required(),
        description: joi_1.default.string().required(),
        effectiveness: joi_1.default.number().min(0).max(1).required(),
        cost: joi_1.default.number().min(0).required(),
        implementation: joi_1.default.string().required(),
        status: joi_1.default.string().valid('planned', 'implemented', 'testing', 'operational').required()
    })).required(),
    status: joi_1.default.string().valid('active', 'mitigated', 'accepted', 'transferred').required()
});
const generateReportSchema = joi_1.default.object({
    type: joi_1.default.string().valid('security', 'compliance', 'risk', 'incident', 'audit').required(),
    title: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    period: joi_1.default.object({
        start: joi_1.default.date().required(),
        end: joi_1.default.date().required()
    }).required(),
    recipients: joi_1.default.array().items(joi_1.default.string().email()).required()
});
// =============================================================================
// SECURITY EVENT ROUTES
// =============================================================================
/**
 * POST /api/security/events
 * Create a security event
 */
router.post('/events', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), (0, error_handler_2.validateRequest)(createSecurityEventSchema), async (req, res) => {
    try {
        const event = await security_oversight_1.SecurityOversightService.createSecurityEvent(req.body);
        res.status(201).json({
            success: true,
            data: event,
            message: 'Security event created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create security event:', error);
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
router.get('/events', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const filters = {
            type: req.query.type,
            severity: req.query.severity,
            status: req.query.status,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const events = await security_oversight_1.SecurityOversightService.getSecurityEvents(filters);
        res.json({
            success: true,
            data: events,
            count: events.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security events:', error);
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
router.get('/events/:id', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const events = await security_oversight_1.SecurityOversightService.getSecurityEvents({ limit: 1 });
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security event:', error);
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
router.post('/incidents', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer']), (0, error_handler_2.validateRequest)(createIncidentSchema), async (req, res) => {
    try {
        const incident = await security_oversight_1.SecurityOversightService.createSecurityIncident(req.body);
        res.status(201).json({
            success: true,
            data: incident,
            message: 'Security incident created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create security incident:', error);
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
router.get('/incidents', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            assignedTo: req.query.assignedTo,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const incidents = await security_oversight_1.SecurityOversightService.getSecurityIncidents(filters);
        res.json({
            success: true,
            data: incidents,
            count: incidents.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security incidents:', error);
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
router.get('/incidents/:id', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const incidents = await security_oversight_1.SecurityOversightService.getSecurityIncidents({ limit: 1 });
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security incident:', error);
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
router.post('/risks', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'risk_manager', 'compliance_officer']), (0, error_handler_2.validateRequest)(createRiskAssessmentSchema), async (req, res) => {
    try {
        const risk = await security_oversight_1.SecurityOversightService.createRiskAssessment(req.body);
        res.status(201).json({
            success: true,
            data: risk,
            message: 'Risk assessment created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create risk assessment:', error);
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
router.get('/risks', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'risk_manager', 'compliance_officer']), async (req, res) => {
    try {
        const filters = {
            entityType: req.query.entityType,
            riskLevel: req.query.riskLevel,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const risks = await security_oversight_1.SecurityOversightService.getRiskAssessments(filters);
        res.json({
            success: true,
            data: risks,
            count: risks.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get risk assessments:', error);
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
router.get('/risks/:id', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'risk_manager', 'compliance_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const risks = await security_oversight_1.SecurityOversightService.getRiskAssessments({ limit: 1 });
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get risk assessment:', error);
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
router.post('/reports', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), (0, error_handler_2.validateRequest)(generateReportSchema), async (req, res) => {
    try {
        const reportData = {
            ...req.body,
            generatedBy: req.user?.id || 'system'
        };
        const report = await security_oversight_1.SecurityOversightService.generateSecurityReport(reportData);
        res.status(201).json({
            success: true,
            data: report,
            message: 'Security report generated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to generate security report:', error);
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
router.get('/reports', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const filters = {
            type: req.query.type,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const reports = await security_oversight_1.SecurityOversightService.getSecurityReports(filters);
        res.json({
            success: true,
            data: reports,
            count: reports.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security reports:', error);
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
router.get('/reports/:id', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const reports = await security_oversight_1.SecurityOversightService.getSecurityReports({ limit: 1 });
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security report:', error);
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
router.get('/dashboard', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const events = await security_oversight_1.SecurityOversightService.getSecurityEvents({ limit: 100 });
        const incidents = await security_oversight_1.SecurityOversightService.getSecurityIncidents({ limit: 50 });
        const risks = await security_oversight_1.SecurityOversightService.getRiskAssessments({ limit: 50 });
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security dashboard:', error);
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
router.get('/analytics', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'security_officer', 'compliance_officer']), async (req, res) => {
    try {
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const events = await security_oversight_1.SecurityOversightService.getSecurityEvents({
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
                }, {}),
                eventsBySeverity: events.reduce((acc, event) => {
                    acc[event.severity] = (acc[event.severity] || 0) + 1;
                    return acc;
                }, {}),
                eventsBySource: events.reduce((acc, event) => {
                    acc[event.source] = (acc[event.source] || 0) + 1;
                    return acc;
                }, {}),
                eventsByDay: events.reduce((acc, event) => {
                    const day = event.timestamp.toISOString().split('T')[0];
                    if (day) {
                        acc[day] = (acc[day] || 0) + 1;
                    }
                    return acc;
                }, {})
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security analytics:', error);
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
router.get('/health', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const isHealthy = security_oversight_1.SecurityOversightService.isHealthy();
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get security health:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to get security health'
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=security-oversight.js.map