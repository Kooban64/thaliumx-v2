/**
 * Open Policy Agent (OPA) Service
 * 
 * Single source of truth for all compliance and security policies
 * Replaces hardcoded rules with policy-as-code
 * 
 * NOTE: For simple, high-frequency checks, consider using OPASDkService (WASM)
 * This service should be used for: AML, security, compliance policies
 */

import axios, { AxiosInstance } from 'axios';
import { LoggerService } from './logger';

export interface OPAInput {
  action: string;
  [key: string]: any;
}

export interface OPADecision {
  allowed?: boolean;
  flagged?: boolean;
  rule_id?: string;
  severity?: string;
  framework?: string;
  reason?: string;
  actions?: OPAAction[];
  [key: string]: any;
}

export interface OPAAction {
  type: string;
  target: string;
  parameters?: Record<string, any>;
  description?: string;
}

export interface OPAResponse {
  result: OPADecision[] | OPADecision;
}

export class OPAService {
  private client: AxiosInstance;
  private baseURL: string;
  private enabled: boolean;

  constructor() {
    this.baseURL = process.env.OPA_URL || 'http://opa:8181';
    this.enabled = process.env.OPA_ENABLED !== 'false'; // Enabled by default

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        LoggerService.debug('OPA Request', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        LoggerService.error('OPA Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        LoggerService.debug('OPA Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        LoggerService.error('OPA Response Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Evaluate AML/KYC policies
   */
  async evaluateAMLPolicy(input: OPAInput): Promise<OPADecision[]> {
    try {
      if (!this.enabled) {
        LoggerService.warn('OPA is disabled, returning empty decisions');
        return [];
      }

      const response = await this.client.post<OPAResponse>(
        '/v1/data/thaliumx/aml/allow',
        { input }
      );

      const decisions = Array.isArray(response.data.result)
        ? response.data.result
        : [response.data.result];

      LoggerService.info('OPA AML Policy Evaluation', {
        action: input.action,
        decisionCount: decisions.length,
        decisions: decisions.map(d => ({
          rule_id: d.rule_id,
          allowed: d.allowed,
          severity: d.severity
        }))
      });

      return decisions;
    } catch (error: any) {
      LoggerService.error('OPA AML Policy Evaluation Failed', {
        action: input.action,
        error: error.message
      });
      // Fallback: deny by default if OPA is unavailable
      return [{
        allowed: false,
        rule_id: 'opa-unavailable',
        severity: 'high',
        reason: 'OPA service unavailable, denying by default for security',
        actions: [{
          type: 'alert',
          target: 'security_team',
          parameters: { reason: 'OPA service unavailable' }
        }]
      }];
    }
  }

  /**
   * Evaluate security policies
   */
  async evaluateSecurityPolicy(input: OPAInput): Promise<OPADecision[]> {
    try {
      if (!this.enabled) {
        LoggerService.warn('OPA is disabled, returning empty decisions');
        return [];
      }

      const response = await this.client.post<OPAResponse>(
        '/v1/data/thaliumx/security/allow',
        { input }
      );

      const decisions = Array.isArray(response.data.result)
        ? response.data.result
        : [response.data.result];

      LoggerService.info('OPA Security Policy Evaluation', {
        action: input.action,
        decisionCount: decisions.length
      });

      return decisions;
    } catch (error: any) {
      LoggerService.error('OPA Security Policy Evaluation Failed', {
        action: input.action,
        error: error.message
      });
      // Fallback: deny by default
      return [{
        allowed: false,
        rule_id: 'opa-unavailable',
        severity: 'high',
        reason: 'OPA service unavailable, denying by default for security'
      }];
    }
  }

  /**
   * Evaluate risk assessment
   */
  async evaluateRiskAssessment(input: OPAInput): Promise<any> {
    try {
      if (!this.enabled) {
        LoggerService.warn('OPA is disabled, returning default risk assessment');
        return {
          risk_score: 50,
          risk_level: 'medium',
          recommendations: ['Standard monitoring']
        };
      }

      const response = await this.client.post<OPAResponse>(
        '/v1/data/thaliumx/aml/assess_risk',
        { input: { ...input, action: 'risk_assessment' } }
      );

      const assessment = Array.isArray(response.data.result)
        ? response.data.result[0]
        : response.data.result;

      LoggerService.info('OPA Risk Assessment', {
        action: input.action,
        risk_score: assessment?.risk_score,
        risk_level: assessment?.risk_level
      });

      return assessment || {};
    } catch (error: any) {
      LoggerService.error('OPA Risk Assessment Failed', {
        action: input.action,
        error: error.message
      });
      return {
        risk_score: 100,
        risk_level: 'high',
        recommendations: ['Manual review required - OPA unavailable']
      };
    }
  }

  /**
   * Evaluate compliance report
   */
  async evaluateComplianceReport(input: OPAInput): Promise<any> {
    try {
      if (!this.enabled) {
        LoggerService.warn('OPA is disabled, returning empty compliance report');
        return {};
      }

      const response = await this.client.post<OPAResponse>(
        '/v1/data/thaliumx/aml/compliance_report',
        { input: { ...input, action: 'compliance_report' } }
      );

      const report = Array.isArray(response.data.result)
        ? response.data.result[0]
        : response.data.result;

      LoggerService.info('OPA Compliance Report', {
        total_transactions: report?.total_transactions,
        compliance_score: report?.compliance_score
      });

      return report || {};
    } catch (error: any) {
      LoggerService.error('OPA Compliance Report Failed', {
        error: error.message
      });
      return {};
    }
  }

  /**
   * Check if action is allowed
   */
  async isAllowed(input: OPAInput, policyType: 'aml' | 'security' = 'aml'): Promise<boolean> {
    try {
      const decisions = policyType === 'aml'
        ? await this.evaluateAMLPolicy(input)
        : await this.evaluateSecurityPolicy(input);

      // If any decision explicitly denies, return false
      for (const decision of decisions) {
        if (decision.allowed === false) {
          return false;
        }
      }

      // If any decision allows, return true
      for (const decision of decisions) {
        if (decision.allowed === true) {
          return true;
        }
      }

      // Default: deny if no explicit allow
      return false;
    } catch (error: any) {
      LoggerService.error('OPA isAllowed Check Failed', {
        action: input.action,
        error: error.message
      });
      // Fail secure: deny by default
      return false;
    }
  }

  /**
   * Get all decisions for an action
   */
  async getDecisions(input: OPAInput, policyType: 'aml' | 'security' = 'aml'): Promise<OPADecision[]> {
    return policyType === 'aml'
      ? await this.evaluateAMLPolicy(input)
      : await this.evaluateSecurityPolicy(input);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error: any) {
      LoggerService.error('OPA Health Check Failed', { error: error.message });
      return false;
    }
  }
}

// Export singleton instance
export const opaService = new OPAService();

