/**
 * Open Policy Agent (OPA) WASM SDK Service
 *
 * Embedded OPA policy evaluation using WASM for high-frequency, simple policy checks.
 * Use this for: RBAC, field validation, simple business rules.
 *
 * For complex/compliance policies, use OPAService (HTTP) instead.
 */
export interface OPASDKInput {
    [key: string]: any;
}
export interface OPASDKResult {
    allowed?: boolean;
    result?: any;
    error?: string;
}
export declare class OPASDkService {
    private policies;
    private policyDir;
    private enabled;
    constructor();
    /**
     * Load WASM policies from directory
     */
    private loadPolicies;
    /**
     * Evaluate a simple policy (e.g., RBAC check)
     *
     * @param policyName - Name of the policy (e.g., 'rbac')
     * @param query - Query to evaluate (e.g., 'data.rbac.allow')
     * @param input - Input data for policy evaluation
     * @returns Policy result
     */
    evaluate(policyName: string, query: string, input: OPASDKInput): Promise<OPASDKResult>;
    /**
     * Quick RBAC check (high-frequency, low latency)
     *
     * @param userRole - User's role
     * @param requiredRole - Required role for action
     * @returns true if user has required role
     */
    checkRBAC(userRole: string, requiredRole: string): Promise<boolean>;
    /**
     * Quick field validation check
     *
     * @param fieldName - Field name
     * @param fieldValue - Field value
     * @param validationRules - Validation rules
     * @returns true if field is valid
     */
    validateField(fieldName: string, fieldValue: any, validationRules: any): Promise<boolean>;
    /**
     * Check if policy is loaded and available
     */
    isPolicyAvailable(policyName: string): boolean;
    /**
     * Get list of loaded policies
     */
    getLoadedPolicies(): string[];
    /**
     * Reload policies (useful for hot-reloading in development)
     */
    reloadPolicies(): Promise<void>;
}
//# sourceMappingURL=opa-sdk.d.ts.map