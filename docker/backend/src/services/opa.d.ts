/**
 * Open Policy Agent (OPA) Service
 *
 * Single source of truth for all compliance and security policies
 * Replaces hardcoded rules with policy-as-code
 *
 * NOTE: For simple, high-frequency checks, consider using OPASDkService (WASM)
 * This service should be used for: AML, security, compliance policies
 */
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
export declare class OPAService {
    private client;
    private baseURL;
    private enabled;
    constructor();
    /**
     * Evaluate AML/KYC policies
     */
    evaluateAMLPolicy(input: OPAInput): Promise<OPADecision[]>;
    /**
     * Evaluate security policies
     */
    evaluateSecurityPolicy(input: OPAInput): Promise<OPADecision[]>;
    /**
     * Evaluate risk assessment
     */
    evaluateRiskAssessment(input: OPAInput): Promise<any>;
    /**
     * Evaluate compliance report
     */
    evaluateComplianceReport(input: OPAInput): Promise<any>;
    /**
     * Check if action is allowed
     */
    isAllowed(input: OPAInput, policyType?: 'aml' | 'security'): Promise<boolean>;
    /**
     * Get all decisions for an action
     */
    getDecisions(input: OPAInput, policyType?: 'aml' | 'security'): Promise<OPADecision[]>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
}
export declare const opaService: OPAService;
//# sourceMappingURL=opa.d.ts.map