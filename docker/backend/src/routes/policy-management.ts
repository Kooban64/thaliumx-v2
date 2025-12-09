/**
 * Policy Management API Routes
 * 
 * Admin endpoints for managing OPA policies and parameters
 * Provides CRUD operations for policy parameters and policy testing
 */

import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from '../services/logger';

const router: Router = Router();

// OPA client configuration
const OPA_URL = process.env.OPA_URL || 'http://thaliumx-opa:8181';

const opaClient: AxiosInstance = axios.create({
  baseURL: OPA_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Middleware to check admin role
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  if (!user || !['admin', 'super_admin', 'compliance_officer'].includes(user.role)) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
};

// ============================================
// POLICY PARAMETERS ENDPOINTS
// ============================================

/**
 * GET /api/admin/policies/parameters
 * Get all policy parameters
 */
router.get('/parameters', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await opaClient.get('/v1/data/parameters');
    
    LoggerService.info('Policy parameters retrieved', {
      user: (req as any).user?.id
    });
    
    res.json({
      success: true,
      data: response.data.result || {},
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to retrieve policy parameters', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy parameters',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/policies/parameters/:category
 * Get parameters for a specific category (aml, security, trading, rbac)
 */
router.get('/parameters/:category', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.params.category as string;
    const validCategories = ['aml', 'security', 'trading', 'rbac'];
    
    if (!category || !validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
      return;
    }
    
    const response = await opaClient.get(`/v1/data/parameters/${category}`);
    
    LoggerService.info('Policy parameters retrieved', {
      category,
      user: (req as any).user?.id
    });
    
    res.json({
      success: true,
      category,
      data: response.data.result || {},
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to retrieve policy parameters', {
      category: req.params.category,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy parameters',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/policies/parameters/:category
 * Update parameters for a specific category
 */
router.put('/parameters/:category', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.params.category as string;
    const validCategories = ['aml', 'security', 'trading', 'rbac'];
    
    if (!category || !validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
      return;
    }
    
    const newParameters = req.body;
    
    // Add metadata
    newParameters.version = newParameters.version || '1.0.0';
    newParameters.last_updated = new Date().toISOString();
    newParameters.updated_by = (req as any).user?.id || 'system';
    
    // Update in OPA
    await opaClient.put(`/v1/data/parameters/${category}`, newParameters);
    
    LoggerService.info('Policy parameters updated', {
      category,
      user: (req as any).user?.id,
      changes: Object.keys(newParameters)
    });
    
    // Audit log
    await logPolicyChange(category, 'update', (req as any).user?.id || 'unknown', newParameters);
    
    res.json({
      success: true,
      message: `${category} parameters updated successfully`,
      category,
      data: newParameters,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to update policy parameters', {
      category: req.params.category,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update policy parameters',
      details: error.message
    });
  }
});

/**
 * PATCH /api/admin/policies/parameters/:category
 * Partially update parameters for a specific category
 */
router.patch('/parameters/:category', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.params.category as string;
    const validCategories = ['aml', 'security', 'trading', 'rbac'];
    
    if (!category || !validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
      return;
    }
    
    // Get current parameters
    const currentResponse = await opaClient.get(`/v1/data/parameters/${category}`);
    const currentParams = currentResponse.data.result || {};
    
    // Merge with new parameters
    const updatedParams = deepMerge(currentParams, req.body);
    updatedParams.last_updated = new Date().toISOString();
    updatedParams.updated_by = (req as any).user?.id || 'system';
    
    // Update in OPA
    await opaClient.put(`/v1/data/parameters/${category}`, updatedParams);
    
    LoggerService.info('Policy parameters patched', {
      category,
      user: (req as any).user?.id,
      changes: Object.keys(req.body)
    });
    
    // Audit log
    await logPolicyChange(category, 'patch', (req as any).user?.id || 'unknown', req.body);
    
    res.json({
      success: true,
      message: `${category} parameters patched successfully`,
      category,
      data: updatedParams,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to patch policy parameters', {
      category: req.params.category,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to patch policy parameters',
      details: error.message
    });
  }
});

// ============================================
// POLICY EVALUATION ENDPOINTS
// ============================================

/**
 * POST /api/admin/policies/evaluate
 * Evaluate a policy with test input
 */
router.post('/evaluate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { policy, input } = req.body;
    
    if (!policy || !input) {
      res.status(400).json({
        success: false,
        error: 'Both policy and input are required'
      });
      return;
    }
    
    const validPolicies = ['thaliumx/aml', 'thaliumx/security', 'thaliumx/trading', 'thaliumx/authz'];
    
    if (!validPolicies.some(p => policy.startsWith(p))) {
      res.status(400).json({
        success: false,
        error: `Invalid policy. Must start with one of: ${validPolicies.join(', ')}`
      });
      return;
    }
    
    const response = await opaClient.post(`/v1/data/${policy}`, { input });
    
    LoggerService.info('Policy evaluated', {
      policy,
      user: (req as any).user?.id,
      result: response.data.result
    });
    
    res.json({
      success: true,
      policy,
      input,
      result: response.data.result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Policy evaluation failed', {
      policy: req.body.policy,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Policy evaluation failed',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/policies/test
 * Test a policy with multiple scenarios
 */
router.post('/test', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { policy, scenarios } = req.body;
    
    if (!policy || !scenarios || !Array.isArray(scenarios)) {
      res.status(400).json({
        success: false,
        error: 'Policy and scenarios array are required'
      });
      return;
    }
    
    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const response = await opaClient.post(`/v1/data/${policy}`, { input: scenario.input });
        results.push({
          name: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          actual: response.data.result,
          passed: JSON.stringify(response.data.result) === JSON.stringify(scenario.expected)
        });
      } catch (error: any) {
        results.push({
          name: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          actual: null,
          passed: false,
          error: error.message
        });
      }
    }
    
    const passedCount = results.filter(r => r.passed).length;
    
    LoggerService.info('Policy test completed', {
      policy,
      user: (req as any).user?.id,
      total: scenarios.length,
      passed: passedCount
    });
    
    res.json({
      success: true,
      policy,
      summary: {
        total: scenarios.length,
        passed: passedCount,
        failed: scenarios.length - passedCount
      },
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Policy test failed', {
      policy: req.body.policy,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Policy test failed',
      details: error.message
    });
  }
});

// ============================================
// POLICY STATUS ENDPOINTS
// ============================================

/**
 * GET /api/admin/policies/status
 * Get OPA service status and loaded policies
 */
router.get('/status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Health check
    const healthResponse = await opaClient.get('/health');
    
    // Get loaded policies
    const policiesResponse = await opaClient.get('/v1/policies');
    
    // Get decision logs status
    let decisionLogsEnabled = false;
    try {
      const statusResponse = await opaClient.get('/v1/status');
      decisionLogsEnabled = statusResponse.data?.decision_logs?.enabled || false;
    } catch {
      // Status endpoint may not be available
    }
    
    const policies = policiesResponse.data.result || [];
    
    res.json({
      success: true,
      status: {
        healthy: healthResponse.status === 200,
        version: healthResponse.headers['x-opa-version'] || 'unknown',
        decisionLogsEnabled
      },
      policies: policies.map((p: any) => ({
        id: p.id,
        raw: p.raw?.substring(0, 100) + '...',
        ast: p.ast ? 'loaded' : 'not loaded'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to get OPA status', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get OPA status',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/policies/health
 * Simple health check for OPA
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await opaClient.get('/health');
    res.json({
      success: true,
      healthy: response.status === 200,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// POLICY AUDIT ENDPOINTS
// ============================================

/**
 * GET /api/admin/policies/audit
 * Get policy change audit log
 */
router.get('/audit', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 100, offset = 0, category } = req.query;
    
    // In production, this would query from a database
    // For now, return from in-memory store
    let logs = policyAuditLog;
    
    if (category) {
      logs = logs.filter(l => l.category === category);
    }
    
    const paginatedLogs = logs.slice(Number(offset), Number(offset) + Number(limit));
    
    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        total: logs.length,
        limit: Number(limit),
        offset: Number(offset)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to get policy audit log', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get policy audit log',
      details: error.message
    });
  }
});

// ============================================
// POLICY PRESETS ENDPOINTS
// ============================================

/**
 * GET /api/admin/policies/presets
 * Get available policy presets
 */
router.get('/presets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    presets: policyPresets,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/admin/policies/presets/:presetName/apply
 * Apply a policy preset
 */
router.post('/presets/:presetName/apply', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { presetName } = req.params;
    const preset = policyPresets.find(p => p.name === presetName);
    
    if (!preset) {
      res.status(404).json({
        success: false,
        error: `Preset '${presetName}' not found`
      });
      return;
    }
    
    // Apply preset parameters
    for (const [category, params] of Object.entries(preset.parameters)) {
      await opaClient.put(`/v1/data/parameters/${category}`, params);
    }
    
    LoggerService.info('Policy preset applied', {
      preset: presetName,
      user: (req as any).user?.id
    });
    
    // Audit log
    await logPolicyChange('all', 'preset_applied', (req as any).user?.id, { preset: presetName });
    
    res.json({
      success: true,
      message: `Preset '${presetName}' applied successfully`,
      preset: presetName,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    LoggerService.error('Failed to apply policy preset', {
      preset: req.params.presetName,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to apply policy preset',
      details: error.message
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// In-memory audit log (in production, use database)
const policyAuditLog: Array<{
  id: string;
  timestamp: string;
  category: string;
  action: string;
  userId: string;
  changes: any;
}> = [];

async function logPolicyChange(category: string, action: string, userId: string, changes: any): Promise<void> {
  policyAuditLog.unshift({
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    category,
    action,
    userId,
    changes
  });
  
  // Keep only last 1000 entries
  if (policyAuditLog.length > 1000) {
    policyAuditLog.pop();
  }
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Policy presets for common configurations
const policyPresets = [
  {
    name: 'strict',
    description: 'Strict compliance mode - maximum security and AML controls',
    parameters: {
      aml: {
        large_transaction_threshold: 5000,
        structuring_lower_bound: 4000,
        structuring_count_threshold: 2,
        pep_threshold: 2500,
        new_account_days: 60,
        new_account_threshold: 2500
      },
      security: {
        max_failed_login_attempts: 3,
        lockout_duration_seconds: 3600,
        session_timeout_seconds: 1800,
        max_concurrent_sessions: 2,
        withdrawal_2fa_threshold: 500
      },
      trading: {
        max_price_deviation_percent: 5,
        max_notional_value: 500000,
        spoofing_order_threshold: 10,
        spoofing_cancel_threshold: 8
      }
    }
  },
  {
    name: 'standard',
    description: 'Standard compliance mode - balanced security and usability',
    parameters: {
      aml: {
        large_transaction_threshold: 10000,
        structuring_lower_bound: 8000,
        structuring_count_threshold: 3,
        pep_threshold: 5000,
        new_account_days: 30,
        new_account_threshold: 5000
      },
      security: {
        max_failed_login_attempts: 5,
        lockout_duration_seconds: 1800,
        session_timeout_seconds: 3600,
        max_concurrent_sessions: 5,
        withdrawal_2fa_threshold: 1000
      },
      trading: {
        max_price_deviation_percent: 10,
        max_notional_value: 1000000,
        spoofing_order_threshold: 20,
        spoofing_cancel_threshold: 15
      }
    }
  },
  {
    name: 'relaxed',
    description: 'Relaxed mode - for trusted/institutional users',
    parameters: {
      aml: {
        large_transaction_threshold: 50000,
        structuring_lower_bound: 40000,
        structuring_count_threshold: 5,
        pep_threshold: 25000,
        new_account_days: 14,
        new_account_threshold: 25000
      },
      security: {
        max_failed_login_attempts: 10,
        lockout_duration_seconds: 900,
        session_timeout_seconds: 7200,
        max_concurrent_sessions: 10,
        withdrawal_2fa_threshold: 5000
      },
      trading: {
        max_price_deviation_percent: 20,
        max_notional_value: 5000000,
        spoofing_order_threshold: 50,
        spoofing_cancel_threshold: 40
      }
    }
  }
];

export default router;