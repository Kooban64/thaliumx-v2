"use strict";
/**
 * Open Policy Agent (OPA) Service
 *
 * Single source of truth for all compliance and security policies
 * Replaces hardcoded rules with policy-as-code
 *
 * NOTE: For simple, high-frequency checks, consider using OPASDkService (WASM)
 * This service should be used for: AML, security, compliance policies
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opaService = exports.OPAService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
class OPAService {
    client;
    baseURL;
    enabled;
    constructor() {
        this.baseURL = process.env.OPA_URL || 'http://opa:8181';
        this.enabled = process.env.OPA_ENABLED !== 'false'; // Enabled by default
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            timeout: 5000, // 5 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Request interceptor
        this.client.interceptors.request.use((config) => {
            logger_1.LoggerService.debug('OPA Request', {
                method: config.method,
                url: config.url,
                data: config.data
            });
            return config;
        }, (error) => {
            logger_1.LoggerService.error('OPA Request Error', { error: error.message });
            return Promise.reject(error);
        });
        // Response interceptor
        this.client.interceptors.response.use((response) => {
            logger_1.LoggerService.debug('OPA Response', {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.LoggerService.error('OPA Response Error', {
                status: error.response?.status,
                message: error.message,
                data: error.response?.data
            });
            return Promise.reject(error);
        });
    }
    /**
     * Evaluate AML/KYC policies
     */
    async evaluateAMLPolicy(input) {
        try {
            if (!this.enabled) {
                logger_1.LoggerService.warn('OPA is disabled, returning empty decisions');
                return [];
            }
            const response = await this.client.post('/v1/data/thaliumx/aml/allow', { input });
            const decisions = Array.isArray(response.data.result)
                ? response.data.result
                : [response.data.result];
            logger_1.LoggerService.info('OPA AML Policy Evaluation', {
                action: input.action,
                decisionCount: decisions.length,
                decisions: decisions.map(d => ({
                    rule_id: d.rule_id,
                    allowed: d.allowed,
                    severity: d.severity
                }))
            });
            return decisions;
        }
        catch (error) {
            logger_1.LoggerService.error('OPA AML Policy Evaluation Failed', {
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
    async evaluateSecurityPolicy(input) {
        try {
            if (!this.enabled) {
                logger_1.LoggerService.warn('OPA is disabled, returning empty decisions');
                return [];
            }
            const response = await this.client.post('/v1/data/thaliumx/security/allow', { input });
            const decisions = Array.isArray(response.data.result)
                ? response.data.result
                : [response.data.result];
            logger_1.LoggerService.info('OPA Security Policy Evaluation', {
                action: input.action,
                decisionCount: decisions.length
            });
            return decisions;
        }
        catch (error) {
            logger_1.LoggerService.error('OPA Security Policy Evaluation Failed', {
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
    async evaluateRiskAssessment(input) {
        try {
            if (!this.enabled) {
                logger_1.LoggerService.warn('OPA is disabled, returning default risk assessment');
                return {
                    risk_score: 50,
                    risk_level: 'medium',
                    recommendations: ['Standard monitoring']
                };
            }
            const response = await this.client.post('/v1/data/thaliumx/aml/assess_risk', { input: { ...input, action: 'risk_assessment' } });
            const assessment = Array.isArray(response.data.result)
                ? response.data.result[0]
                : response.data.result;
            logger_1.LoggerService.info('OPA Risk Assessment', {
                action: input.action,
                risk_score: assessment?.risk_score,
                risk_level: assessment?.risk_level
            });
            return assessment || {};
        }
        catch (error) {
            logger_1.LoggerService.error('OPA Risk Assessment Failed', {
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
    async evaluateComplianceReport(input) {
        try {
            if (!this.enabled) {
                logger_1.LoggerService.warn('OPA is disabled, returning empty compliance report');
                return {};
            }
            const response = await this.client.post('/v1/data/thaliumx/aml/compliance_report', { input: { ...input, action: 'compliance_report' } });
            const report = Array.isArray(response.data.result)
                ? response.data.result[0]
                : response.data.result;
            logger_1.LoggerService.info('OPA Compliance Report', {
                total_transactions: report?.total_transactions,
                compliance_score: report?.compliance_score
            });
            return report || {};
        }
        catch (error) {
            logger_1.LoggerService.error('OPA Compliance Report Failed', {
                error: error.message
            });
            return {};
        }
    }
    /**
     * Check if action is allowed
     */
    async isAllowed(input, policyType = 'aml') {
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
        }
        catch (error) {
            logger_1.LoggerService.error('OPA isAllowed Check Failed', {
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
    async getDecisions(input, policyType = 'aml') {
        return policyType === 'aml'
            ? await this.evaluateAMLPolicy(input)
            : await this.evaluateSecurityPolicy(input);
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return response.status === 200;
        }
        catch (error) {
            logger_1.LoggerService.error('OPA Health Check Failed', { error: error.message });
            return false;
        }
    }
}
exports.OPAService = OPAService;
// Export singleton instance
exports.opaService = new OPAService();
//# sourceMappingURL=opa.js.map