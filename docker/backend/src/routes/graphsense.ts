/**
 * GraphSense Routes
 * 
 * API endpoints for GraphSense Integration Service:
 * - Blockchain Data Analysis
 * - Transaction Graph Analysis
 * - Address Clustering & Entity Resolution
 * - Risk Scoring & AML Detection
 * - Flow Analysis & Pattern Detection
 * - Compliance Monitoring
 * - Real-time Alerts & Notifications
 */

import { Router } from 'express';
import { GraphSenseService } from '../services/graphsense';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { validateRequest } from '../middleware/error-handler';
import Joi from 'joi';
import { LoggerService } from '../services/logger';

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const analyzeTransactionSchema = Joi.object({
  transactionHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required()
});

const analyzeEntitySchema = Joi.object({
  address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

const createAlertSchema = Joi.object({
  type: Joi.string().valid(
    'suspicious_transaction', 'aml_flag', 'sanctions_match', 'pep_match',
    'mixer_usage', 'high_value_transfer', 'unusual_pattern', 'cluster_anomaly',
    'flow_anomaly', 'compliance_violation'
  ).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  entityId: Joi.string().required(),
  entityType: Joi.string().valid('address', 'transaction', 'block', 'contract', 'token', 'exchange', 'mixer', 'miner', 'unknown').required(),
  transactionHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).optional(),
  metadata: Joi.object({
    ruleId: Joi.string().optional(),
    ruleName: Joi.string().optional(),
    confidence: Joi.number().min(0).max(1).required(),
    evidence: Joi.object().optional(),
    additionalData: Joi.object().optional()
  }).required(),
  status: Joi.string().valid('active', 'acknowledged', 'resolved', 'false_positive').required()
});

// =============================================================================
// ANALYSIS ROUTES
// =============================================================================

/**
 * POST /api/graphsense/analyze/transaction
 * Analyze a transaction
 */
router.post('/analyze/transaction', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), validateRequest(analyzeTransactionSchema), async (req, res) => {
  try {
    const { transactionHash } = req.body;
    const analysis = await GraphSenseService.analyzeTransaction(transactionHash);
    
    res.status(200).json({
      success: true,
      data: analysis,
      message: 'Transaction analysis completed successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to analyze transaction:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'TRANSACTION_ANALYSIS_FAILED',
        message: 'Failed to analyze transaction'
      }
    });
  }
});

/**
 * POST /api/graphsense/analyze/entity
 * Analyze an entity (address)
 */
router.post('/analyze/entity', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), validateRequest(analyzeEntitySchema), async (req, res) => {
  try {
    const { address } = req.body;
    const analysis = await GraphSenseService.analyzeEntity(address);
    
    res.status(200).json({
      success: true,
      data: analysis,
      message: 'Entity analysis completed successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to analyze entity:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'ENTITY_ANALYSIS_FAILED',
        message: 'Failed to analyze entity'
      }
    });
  }
});

// =============================================================================
// ENTITY ROUTES
// =============================================================================

/**
 * GET /api/graphsense/entities
 * Get analyzed entities
 */
router.get('/entities', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const filters = {
      type: req.query.type as any,
      riskLevel: req.query.riskLevel as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const entities = await GraphSenseService.getEntities(filters);
    
    res.json({
      success: true,
      data: entities,
      count: entities.length
    });
  } catch (error) {
    LoggerService.error('Failed to get entities:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get entities'
      }
    });
  }
});

/**
 * GET /api/graphsense/entities/:id
 * Get specific entity
 */
router.get('/entities/:id', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const entities = await GraphSenseService.getEntities({ limit: 1 });
    const entity = entities.find(e => e.id === id);
    
    if (!entity) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: 'Entity not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: entity
    });
  } catch (error) {
    LoggerService.error('Failed to get entity:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get entity'
      }
    });
  }
});

// =============================================================================
// TRANSACTION ROUTES
// =============================================================================

/**
 * GET /api/graphsense/transactions
 * Get analyzed transactions
 */
router.get('/transactions', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const filters = {
      riskLevel: req.query.riskLevel as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const transactions = await GraphSenseService.getTransactions(filters);
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    LoggerService.error('Failed to get transactions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get transactions'
      }
    });
  }
});

/**
 * GET /api/graphsense/transactions/:id
 * Get specific transaction
 */
router.get('/transactions/:id', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const transactions = await GraphSenseService.getTransactions({ limit: 1 });
    const transaction = transactions.find(t => t.id === id);
    
    if (!transaction) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    LoggerService.error('Failed to get transaction:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get transaction'
      }
    });
  }
});

// =============================================================================
// ALERT ROUTES
// =============================================================================

/**
 * POST /api/graphsense/alerts
 * Create alert
 */
router.post('/alerts', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), validateRequest(createAlertSchema), async (req, res) => {
  try {
    const alert = await GraphSenseService.createAlert(req.body);
    
    res.status(201).json({
      success: true,
      data: alert,
      message: 'Alert created successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to create alert:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'ALERT_CREATION_FAILED',
        message: 'Failed to create alert'
      }
    });
  }
});

/**
 * GET /api/graphsense/alerts
 * Get alerts
 */
router.get('/alerts', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const filters = {
      type: req.query.type as any,
      severity: req.query.severity as any,
      status: req.query.status as string,
      entityId: req.query.entityId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const alerts = await GraphSenseService.getAlerts(filters);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    LoggerService.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get alerts'
      }
    });
  }
});

/**
 * GET /api/graphsense/alerts/:id
 * Get specific alert
 */
router.get('/alerts/:id', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const alerts = await GraphSenseService.getAlerts({ limit: 1 });
    const alert = alerts.find(a => a.id === id);
    
    if (!alert) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    LoggerService.error('Failed to get alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get alert'
      }
    });
  }
});

// =============================================================================
// CLUSTER ROUTES
// =============================================================================

/**
 * GET /api/graphsense/clusters
 * Get clusters
 */
router.get('/clusters', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const filters = {
      riskLevel: req.query.riskLevel as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const clusters = await GraphSenseService.getClusters(filters);
    
    res.json({
      success: true,
      data: clusters,
      count: clusters.length
    });
  } catch (error) {
    LoggerService.error('Failed to get clusters:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get clusters'
      }
    });
  }
});

/**
 * GET /api/graphsense/clusters/:id
 * Get specific cluster
 */
router.get('/clusters/:id', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const clusters = await GraphSenseService.getClusters({ limit: 1 });
    const cluster = clusters.find(c => c.id === id);
    
    if (!cluster) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CLUSTER_NOT_FOUND',
          message: 'Cluster not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: cluster
    });
  } catch (error) {
    LoggerService.error('Failed to get cluster:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get cluster'
      }
    });
  }
});

// =============================================================================
// FLOW ROUTES
// =============================================================================

/**
 * GET /api/graphsense/flows
 * Get flows
 */
router.get('/flows', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const filters = {
      riskLevel: req.query.riskLevel as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    
    const flows = await GraphSenseService.getFlows(filters);
    
    res.json({
      success: true,
      data: flows,
      count: flows.length
    });
  } catch (error) {
    LoggerService.error('Failed to get flows:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get flows'
      }
    });
  }
});

/**
 * GET /api/graphsense/flows/:id
 * Get specific flow
 */
router.get('/flows/:id', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const flows = await GraphSenseService.getFlows({ limit: 1 });
    const flow = flows.find(f => f.id === id);
    
    if (!flow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'FLOW_NOT_FOUND',
          message: 'Flow not found'
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: flow
    });
  } catch (error) {
    LoggerService.error('Failed to get flow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get flow'
      }
    });
  }
});

// =============================================================================
// DASHBOARD & ANALYTICS ROUTES
// =============================================================================

/**
 * GET /api/graphsense/dashboard
 * Get GraphSense dashboard data
 */
router.get('/dashboard', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const entities = await GraphSenseService.getEntities({ limit: 100 });
    const transactions = await GraphSenseService.getTransactions({ limit: 100 });
    const clusters = await GraphSenseService.getClusters({ limit: 50 });
    const flows = await GraphSenseService.getFlows({ limit: 50 });
    const alerts = await GraphSenseService.getAlerts({ limit: 50 });
    
    const dashboard = {
      summary: {
        totalEntities: entities.length,
        highRiskEntities: entities.filter(e => e.riskLevel === 'high' || e.riskLevel === 'critical').length,
        totalTransactions: transactions.length,
        highRiskTransactions: transactions.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical').length,
        totalClusters: clusters.length,
        highRiskClusters: clusters.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length,
        totalFlows: flows.length,
        highRiskFlows: flows.filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical').length,
        activeAlerts: alerts.filter(a => a.status === 'active').length,
        resolvedAlerts: alerts.filter(a => a.status === 'resolved').length
      },
      recentEntities: entities.slice(0, 10),
      recentTransactions: transactions.slice(0, 10),
      recentAlerts: alerts.slice(0, 10),
      riskDistribution: {
        low: entities.filter(e => e.riskLevel === 'low').length,
        medium: entities.filter(e => e.riskLevel === 'medium').length,
        high: entities.filter(e => e.riskLevel === 'high').length,
        critical: entities.filter(e => e.riskLevel === 'critical').length
      },
      alertTypes: {
        suspicious_transaction: alerts.filter(a => a.type === 'suspicious_transaction').length,
        aml_flag: alerts.filter(a => a.type === 'aml_flag').length,
        sanctions_match: alerts.filter(a => a.type === 'sanctions_match').length,
        pep_match: alerts.filter(a => a.type === 'pep_match').length,
        mixer_usage: alerts.filter(a => a.type === 'mixer_usage').length,
        high_value_transfer: alerts.filter(a => a.type === 'high_value_transfer').length,
        unusual_pattern: alerts.filter(a => a.type === 'unusual_pattern').length,
        cluster_anomaly: alerts.filter(a => a.type === 'cluster_anomaly').length,
        flow_anomaly: alerts.filter(a => a.type === 'flow_anomaly').length,
        compliance_violation: alerts.filter(a => a.type === 'compliance_violation').length
      }
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    LoggerService.error('Failed to get GraphSense dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get GraphSense dashboard'
      }
    });
  }
});

/**
 * GET /api/graphsense/analytics
 * Get GraphSense analytics
 */
router.get('/analytics', authenticateToken, requireRole(['admin', 'compliance_officer', 'security_officer']), async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    
    const entities = await GraphSenseService.getEntities();
    const transactions = await GraphSenseService.getTransactions();
    const alerts = await GraphSenseService.getAlerts();
    
    const analytics = {
      period: { startDate, endDate },
      metrics: {
        totalEntities: entities.length,
        entitiesByType: entities.reduce((acc, entity) => {
          acc[entity.type] = (acc[entity.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        entitiesByRiskLevel: entities.reduce((acc, entity) => {
          acc[entity.riskLevel] = (acc[entity.riskLevel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalTransactions: transactions.length,
        transactionsByRiskLevel: transactions.reduce((acc, transaction) => {
          acc[transaction.riskLevel] = (acc[transaction.riskLevel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalAlerts: alerts.length,
        alertsByType: alerts.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        alertsBySeverity: alerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        alertsByDay: alerts.reduce((acc, alert) => {
          const day = alert.createdAt.toISOString().split('T')[0];
          if (day) {
            acc[day] = (acc[day] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      },
      trends: {
        entityGrowth: 'increasing',
        transactionVolume: 'stable',
        alertFrequency: 'decreasing',
        riskLevel: 'stable'
      }
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    LoggerService.error('Failed to get GraphSense analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get GraphSense analytics'
      }
    });
  }
});

// =============================================================================
// HEALTH ROUTES
// =============================================================================

/**
 * GET /api/graphsense/health
 * Get GraphSense service health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const isHealthy = GraphSenseService.isHealthy();
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        monitoring: {
          realTimeAnalysis: 'active',
          clusterAnalysis: 'active',
          flowAnalysis: 'active',
          alertMonitoring: 'active'
        }
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get GraphSense health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get GraphSense health'
      }
    });
  }
});

export default router;
