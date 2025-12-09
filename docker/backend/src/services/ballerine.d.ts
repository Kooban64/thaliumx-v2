/**
 * Ballerine Service
 *
 * Production-ready integration with Ballerine workflow engine:
 * - Start workflow for KYC/KYB cases
 * - Get workflow status and decisions
 * - Handle workflow callbacks and webhooks
 * - Document management
 * - Risk assessment integration
 * - Compliance reporting
 *
 * Connects to external Ballerine workflow service (ballerine-workflow:4000)
 */
export interface BallerineWorkflowRequest {
    workflowDefinitionId: string;
    context: {
        entity: any;
        tenantId: string;
        caseId: string;
        documents?: any[];
        metadata?: any;
    };
}
export interface BallerineWorkflowResponse {
    id: string;
    status: string;
    currentState: string;
    context: any;
    createdAt: string;
    updatedAt: string;
}
export interface BallerineWebhookPayload {
    workflowId: string;
    caseId: string;
    state: string;
    status: string;
    decision?: any;
    documents?: any[];
    metadata?: any;
}
export interface WorkflowDefinition {
    id: string;
    name: string;
    version: number;
    definition: any;
    extensions?: any;
    uiDefinitions?: any[];
    createdAt?: string;
    updatedAt?: string;
}
export interface CollectionFlowRequest {
    workflowId: string;
    endUserId?: string;
    config?: {
        theme?: any;
        redirectUrl?: string;
    };
}
export interface CollectionFlowResponse {
    id: string;
    url: string;
    token?: string;
    expiresAt?: string;
}
export interface WorkflowEvent {
    name: string;
    payload?: any;
}
export declare class BallerineService {
    private client;
    private baseURL;
    private apiKey;
    private webhookSecret;
    constructor();
    /**
     * Start a new Ballerine workflow
     */
    startWorkflow(caseData: any): Promise<BallerineWorkflowResponse>;
    /**
     * Get workflow status
     */
    getWorkflowStatus(workflowId: string): Promise<BallerineWorkflowResponse>;
    /**
     * Get workflow decisions
     */
    getWorkflowDecisions(workflowId: string): Promise<any[]>;
    /**
     * Get workflow documents
     */
    getWorkflowDocuments(workflowId: string): Promise<any[]>;
    /**
     * Update workflow state
     */
    updateWorkflowState(workflowId: string, state: string, data: any): Promise<void>;
    /**
     * Get workflow risk assessment
     */
    getWorkflowRiskAssessment(workflowId: string): Promise<any>;
    /**
     * Submit additional documents to workflow
     */
    submitAdditionalDocuments(workflowId: string, documents: any[]): Promise<void>;
    /**
     * Get workflow compliance report
     */
    getWorkflowComplianceReport(workflowId: string): Promise<any>;
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string | object, signature: string): Promise<boolean>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get all workflow definitions
     */
    getWorkflowDefinitions(): Promise<WorkflowDefinition[]>;
    /**
     * Get a specific workflow definition
     */
    getWorkflowDefinition(id: string): Promise<WorkflowDefinition>;
    /**
     * Get workflow definition input context schema
     */
    getWorkflowDefinitionSchema(id: string): Promise<any>;
    /**
     * Find workflow definition by type (kyc/kyb)
     */
    findWorkflowDefinitionByType(type: 'kyc' | 'kyb'): Promise<WorkflowDefinition | null>;
    /**
     * Create a collection flow URL for document/information collection
     */
    createCollectionFlowUrl(request: CollectionFlowRequest): Promise<CollectionFlowResponse>;
    /**
     * Get collection flow state
     */
    getCollectionFlowState(workflowId: string): Promise<any>;
    /**
     * Update collection flow state
     */
    updateCollectionFlowState(workflowId: string, state: any): Promise<void>;
    /**
     * Get collection flow by ID
     */
    getCollectionFlow(collectionFlowId: string): Promise<any>;
    /**
     * Send a workflow event to trigger state transitions
     */
    sendWorkflowEvent(workflowId: string, event: WorkflowEvent): Promise<any>;
    /**
     * Send workflow event using alternative endpoint
     */
    sendWorkflowEventAlt(workflowId: string, event: WorkflowEvent): Promise<any>;
    /**
     * Get workflow context
     */
    getWorkflowContext(workflowId: string): Promise<any>;
    /**
     * Get workflow logs for audit trail
     */
    getWorkflowLogs(workflowId: string, options?: {
        type?: string;
        limit?: number;
    }): Promise<any[]>;
    /**
     * Get workflow log summary
     */
    getWorkflowLogSummary(workflowId: string): Promise<any>;
    /**
     * Get Ballerine metrics
     */
    getMetrics(): Promise<any>;
    /**
     * Get Prometheus metrics
     */
    getPrometheusMetrics(): Promise<string>;
    /**
     * List all workflows with filters
     */
    listWorkflows(filters?: {
        status?: string;
        page?: number;
        limit?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    }): Promise<any>;
}
export declare const ballerineService: BallerineService;
//# sourceMappingURL=ballerine.d.ts.map