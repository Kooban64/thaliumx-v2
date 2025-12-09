"use strict";
/**
 * Open Policy Agent (OPA) WASM SDK Service
 *
 * Embedded OPA policy evaluation using WASM for high-frequency, simple policy checks.
 * Use this for: RBAC, field validation, simple business rules.
 *
 * For complex/compliance policies, use OPAService (HTTP) instead.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPASDkService = void 0;
// OPA WASM SDK - For high-frequency simple policy checks
// Embedded OPA policy evaluation using WASM for zero-latency policy checks
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const opa_wasm_1 = require("@open-policy-agent/opa-wasm");
const logger_1 = require("./logger");
class OPASDkService {
    policies = new Map();
    policyDir;
    enabled;
    constructor() {
        this.policyDir = process.env.OPA_WASM_POLICY_DIR || path_1.default.join(__dirname, '../../policies/wasm');
        this.enabled = process.env.OPA_WASM_ENABLED !== 'false'; // Enabled by default
        if (this.enabled) {
            this.loadPolicies();
        }
    }
    /**
     * Load WASM policies from directory
     */
    async loadPolicies() {
        try {
            if (!fs_1.default.existsSync(this.policyDir)) {
                logger_1.LoggerService.warn('OPA WASM policy directory not found', { dir: this.policyDir });
                return;
            }
            const files = fs_1.default.readdirSync(this.policyDir);
            const wasmFiles = files.filter(f => f.endsWith('.wasm'));
            for (const file of wasmFiles) {
                try {
                    const policyName = path_1.default.basename(file, '.wasm');
                    const wasmPath = path_1.default.join(this.policyDir, file);
                    // Load WASM policy file
                    const wasmBytes = fs_1.default.readFileSync(wasmPath);
                    // Load policy using OPA WASM SDK
                    const policy = await (0, opa_wasm_1.loadPolicy)(wasmBytes);
                    if (policy) {
                        this.policies.set(policyName, policy);
                        logger_1.LoggerService.info('OPA WASM policy loaded successfully', {
                            policy: policyName,
                            path: wasmPath
                        });
                    }
                    else {
                        logger_1.LoggerService.error('OPA WASM policy load returned null', { policy: policyName });
                    }
                }
                catch (error) {
                    logger_1.LoggerService.error('Failed to load OPA WASM policy', {
                        file,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    });
                }
            }
            if (this.policies.size === 0) {
                logger_1.LoggerService.warn('No OPA WASM policies loaded', { dir: this.policyDir });
            }
            else {
                logger_1.LoggerService.info('OPA WASM policies loaded', { count: this.policies.size });
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize OPA WASM service', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.enabled = false;
        }
    }
    /**
     * Evaluate a simple policy (e.g., RBAC check)
     *
     * @param policyName - Name of the policy (e.g., 'rbac')
     * @param query - Query to evaluate (e.g., 'data.rbac.allow')
     * @param input - Input data for policy evaluation
     * @returns Policy result
     */
    async evaluate(policyName, query, input) {
        if (!this.enabled) {
            logger_1.LoggerService.warn('OPA WASM service is disabled');
            return { allowed: false, error: 'OPA WASM service is disabled' };
        }
        const policy = this.policies.get(policyName);
        if (!policy) {
            logger_1.LoggerService.warn('OPA WASM policy not found - use HTTP OPA instead', { policy: policyName });
            return { allowed: false, error: `Policy ${policyName} not found - use OPAService for HTTP evaluation` };
        }
        try {
            // Set input data (if provided)
            if (input && Object.keys(input).length > 0) {
                policy.setData(input);
            }
            // Evaluate the policy
            // Note: OPA WASM evaluate takes the input directly, not a query string
            // The query is pre-compiled into the WASM module
            const resultSet = policy.evaluate(input);
            if (resultSet == null) {
                logger_1.LoggerService.warn('OPA WASM evaluation returned null', { policy: policyName, query });
                return {
                    allowed: false,
                    error: 'Policy evaluation returned null',
                };
            }
            if (resultSet.length === 0) {
                // No results means policy didn't match (undefined/deny)
                return {
                    allowed: false,
                    result: null,
                };
            }
            // Check first result (OPA WASM returns array of results)
            const firstResult = resultSet[0];
            const resultValue = firstResult?.result !== undefined ? firstResult.result : firstResult;
            // Handle boolean results
            const allowed = resultValue === true || resultValue === 'true';
            logger_1.LoggerService.debug('OPA WASM evaluation completed', {
                policy: policyName,
                allowed,
                resultValue,
            });
            return {
                allowed,
                result: resultValue,
            };
        }
        catch (error) {
            logger_1.LoggerService.error('OPA WASM evaluation failed', {
                policy: policyName,
                query,
                input,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            return {
                allowed: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Quick RBAC check (high-frequency, low latency)
     *
     * @param userRole - User's role
     * @param requiredRole - Required role for action
     * @returns true if user has required role
     */
    async checkRBAC(userRole, requiredRole) {
        const result = await this.evaluate('rbac', 'data.rbac.allow', {
            user: { role: userRole },
            resource: { required_role: requiredRole },
        });
        return result.allowed === true;
    }
    /**
     * Quick field validation check
     *
     * @param fieldName - Field name
     * @param fieldValue - Field value
     * @param validationRules - Validation rules
     * @returns true if field is valid
     */
    async validateField(fieldName, fieldValue, validationRules) {
        const result = await this.evaluate('validation', 'data.validation.allow', {
            field: { name: fieldName, value: fieldValue },
            rules: validationRules,
        });
        return result.allowed === true;
    }
    /**
     * Check if policy is loaded and available
     */
    isPolicyAvailable(policyName) {
        return this.policies.has(policyName);
    }
    /**
     * Get list of loaded policies
     */
    getLoadedPolicies() {
        return Array.from(this.policies.keys());
    }
    /**
     * Reload policies (useful for hot-reloading in development)
     */
    async reloadPolicies() {
        this.policies.clear();
        await this.loadPolicies();
    }
}
exports.OPASDkService = OPASDkService;
//# sourceMappingURL=opa-sdk.js.map