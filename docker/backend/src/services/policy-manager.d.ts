/**
 * Policy Manager - Unified interface for OPA policies
 *
 * Routes simple policies to WASM SDK (fast, in-process)
 * Routes complex/compliance policies to HTTP OPA (centralized, auditable)
 */
export interface PolicyInput {
    action: string;
    [key: string]: any;
}
export interface PolicyDecision {
    allowed: boolean;
    rule_id?: string;
    reason?: string;
    source?: 'wasm' | 'http';
    [key: string]: any;
}
export declare class PolicyManager {
    private opaService;
    private opaSdkService;
    private httpPolicyTypes;
    private wasmPolicyTypes;
    constructor();
    /**
     * Evaluate a policy using the appropriate method
     * - Simple policies → WASM (zero latency)
     * - Complex/compliance policies → HTTP (centralized audit)
     */
    evaluate(input: PolicyInput, policyType?: 'aml' | 'security' | 'rbac' | 'validation'): Promise<PolicyDecision>;
    /**
     * Determine if policy should use WASM or HTTP
     */
    private shouldUseWasm;
    /**
     * Evaluate using WASM SDK (fast, in-process)
     */
    private evaluateWasm;
    /**
     * Evaluate using HTTP OPA (centralized, auditable)
     */
    private evaluateHttp;
    /**
     * Quick RBAC check (uses WASM if available, HTTP fallback)
     */
    checkRBAC(userRole: string, requiredRole: string): Promise<boolean>;
    /**
     * AML transaction check (always uses HTTP for audit trail)
     */
    checkAMLTransaction(transaction: any): Promise<PolicyDecision>;
}
//# sourceMappingURL=policy-manager.d.ts.map