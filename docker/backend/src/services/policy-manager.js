"use strict";
/**
 * Policy Manager - Unified interface for OPA policies
 *
 * Routes simple policies to WASM SDK (fast, in-process)
 * Routes complex/compliance policies to HTTP OPA (centralized, auditable)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyManager = void 0;
const opa_1 = require("./opa");
const opa_sdk_1 = require("./opa-sdk");
const logger_1 = require("./logger");
class PolicyManager {
    opaService;
    opaSdkService;
    // Policies that should use HTTP (compliance, audit trail required)
    httpPolicyTypes = new Set([
        'aml',
        'compliance',
        'security',
        'transaction_review',
        'kyc',
        'sanctioned_country',
        'pep',
    ]);
    // Policies that can use WASM (simple, high-frequency)
    wasmPolicyTypes = new Set([
        'rbac',
        'validation',
        'field_validation',
        'resource_access',
    ]);
    constructor() {
        this.opaService = new opa_1.OPAService();
        this.opaSdkService = new opa_sdk_1.OPASDkService();
    }
    /**
     * Evaluate a policy using the appropriate method
     * - Simple policies → WASM (zero latency)
     * - Complex/compliance policies → HTTP (centralized audit)
     */
    async evaluate(input, policyType = 'security') {
        const action = input.action || '';
        // Always use HTTP for aml and security (compliance-critical)
        if (policyType === 'aml' || policyType === 'security') {
            logger_1.LoggerService.debug('Using OPA HTTP for compliance policy', { policyType, action });
            const result = await this.evaluateHttp(input, policyType);
            return { ...result, source: 'http' };
        }
        // Try WASM for simple policies (rbac, validation) - NOW IMPLEMENTED!
        if (policyType === 'rbac' || policyType === 'validation') {
            if (this.opaSdkService.isPolicyAvailable(policyType)) {
                try {
                    logger_1.LoggerService.debug('Using OPA WASM for policy evaluation', { policyType, action });
                    const result = await this.evaluateWasm(policyType, input);
                    return { ...result, source: 'wasm' };
                }
                catch (error) {
                    logger_1.LoggerService.warn('WASM evaluation failed, falling back to HTTP', {
                        policyType,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    // Fallback to HTTP
                }
            }
            else {
                logger_1.LoggerService.debug('WASM policy not available, using HTTP', { policyType });
            }
        }
        // Fallback to HTTP for all other cases
        logger_1.LoggerService.debug('Using OPA HTTP for policy evaluation', { policyType, action });
        const result = await this.evaluateHttp(input, 'security');
        return { ...result, source: 'http' };
    }
    /**
     * Determine if policy should use WASM or HTTP
     */
    shouldUseWasm(policyType, action) {
        // Always use HTTP for compliance-critical policies
        if (this.httpPolicyTypes.has(policyType) || this.httpPolicyTypes.has(action)) {
            return false;
        }
        // Use WASM for simple, high-frequency policies
        if (this.wasmPolicyTypes.has(policyType) || this.wasmPolicyTypes.has(action)) {
            return true;
        }
        // Default to HTTP (safer, centralized audit)
        return false;
    }
    /**
     * Evaluate using WASM SDK (fast, in-process)
     */
    async evaluateWasm(policyType, input) {
        const query = `data.${policyType}.allow`;
        const result = await this.opaSdkService.evaluate(policyType, query, input);
        return {
            allowed: result.allowed === true,
            reason: result.error || 'Policy evaluation completed',
        };
    }
    /**
     * Evaluate using HTTP OPA (centralized, auditable)
     */
    async evaluateHttp(input, policyType = 'security') {
        const decisions = policyType === 'aml'
            ? await this.opaService.evaluateAMLPolicy(input)
            : await this.opaService.evaluateSecurityPolicy(input);
        // If any decision explicitly denies, return false
        for (const decision of decisions) {
            if (decision.allowed === false) {
                return {
                    allowed: false,
                    rule_id: decision.rule_id,
                    reason: decision.reason || 'Policy violation',
                };
            }
        }
        // If any decision allows, return true
        for (const decision of decisions) {
            if (decision.allowed === true) {
                return {
                    allowed: true,
                    rule_id: decision.rule_id,
                    reason: decision.reason || 'Policy allows',
                };
            }
        }
        // Default: deny if no explicit allow
        return {
            allowed: false,
            reason: 'No explicit allow rule matched',
        };
    }
    /**
     * Quick RBAC check (uses WASM if available, HTTP fallback)
     */
    async checkRBAC(userRole, requiredRole) {
        // Try WASM first (if rbac.wasm is loaded), fallback to HTTP
        const result = await this.evaluate({ action: 'resource_access', user: { roles: [userRole] }, resource: { required_role: requiredRole } }, 'rbac');
        return result.allowed;
    }
    /**
     * AML transaction check (always uses HTTP for audit trail)
     */
    async checkAMLTransaction(transaction) {
        return await this.evaluate({ action: 'transaction_review', ...transaction }, 'aml');
    }
}
exports.PolicyManager = PolicyManager;
//# sourceMappingURL=policy-manager.js.map