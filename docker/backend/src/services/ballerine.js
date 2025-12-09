"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ballerineService = exports.BallerineService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const crypto = __importStar(require("crypto"));
// =============================================================================
// BALLERINE SERVICE CLASS
// =============================================================================
class BallerineService {
    client;
    baseURL;
    apiKey;
    webhookSecret;
    constructor() {
        this.baseURL = process.env.BALLERINE_BASE_URL || 'http://ballerine-workflow:4000';
        this.apiKey = process.env.BALLERINE_API_KEY || process.env.VAULT_BALLERINE_API_KEY || 'ballerine_oss_api_key_12345';
        this.webhookSecret = process.env.BALLERINE_WEBHOOK_SECRET || process.env.VAULT_BALLERINE_WEBHOOK_SECRET || 'ballerine_webhook_secret_67890';
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
            },
            timeout: 30000, // 30 seconds timeout
        });
        // Add request/response interceptors for logging
        this.client.interceptors.request.use((config) => {
            logger_1.LoggerService.info('Ballerine API Request', {
                method: config.method,
                url: config.url,
            });
            return config;
        }, (error) => {
            logger_1.LoggerService.error('Ballerine API Request Error', { error: error.message });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            logger_1.LoggerService.info('Ballerine API Response', {
                status: response.status,
                url: response.config.url,
            });
            return response;
        }, (error) => {
            logger_1.LoggerService.error('Ballerine API Response Error', {
                status: error.response?.status,
                message: error.message,
                data: error.response?.data
            });
            return Promise.reject(error);
        });
    }
    /**
     * Start a new Ballerine workflow
     */
    async startWorkflow(caseData) {
        try {
            // Enhanced workflow request with comprehensive entity data
            const workflowRequest = {
                workflowDefinitionId: caseData.type === 'kyc' ? 'kyc-workflow' : 'kyb-workflow',
                context: {
                    entity: {
                        ...caseData.entity_data,
                        // Add standard fields for Ballerine
                        id: caseData.id,
                        type: caseData.type,
                        tenantId: caseData.tenant_id,
                        // Enhanced entity data structure
                        personalInformation: caseData.entity_data?.personalInformation || {},
                        addressInformation: caseData.entity_data?.addressInformation || {},
                        financialInformation: caseData.entity_data?.financialInformation || {},
                        riskIndicators: caseData.entity_data?.riskIndicators || [],
                        documents: caseData.documents || [],
                        metadata: {
                            ...caseData.entity_data?.metadata,
                            source: 'thaliumx_platform',
                            timestamp: new Date().toISOString(),
                            version: '2.0'
                        }
                    },
                    tenantId: caseData.tenant_id,
                    caseId: caseData.id,
                    documents: caseData.documents || [],
                    metadata: {
                        workflowType: caseData.type,
                        priority: caseData.priority || 'normal',
                        regulatoryRequirements: caseData.regulatoryRequirements || [],
                        riskLevel: caseData.riskLevel || 'medium'
                    }
                },
            };
            logger_1.LoggerService.info('Starting Ballerine workflow', {
                caseId: caseData.id,
                type: caseData.type,
                tenantId: caseData.tenant_id,
                workflowDefinitionId: workflowRequest.workflowDefinitionId,
                entityType: workflowRequest.context.entity.type
            });
            // Ballerine OSS uses /external/workflows/run endpoint
            // Format: { workflowId, context: { entity, documents }, config }
            const ballerineRequest = {
                workflowId: workflowRequest.workflowDefinitionId,
                context: {
                    entity: workflowRequest.context.entity,
                    documents: workflowRequest.context.documents || [],
                    metadata: workflowRequest.context.metadata
                },
                config: {
                    subscriptions: [
                        {
                            type: 'webhook',
                            url: process.env.BALLERINE_WEBHOOK_URL || `${process.env.BACKEND_URL}/api/kyc/webhooks/ballerine`,
                            events: ['workflow.completed', 'workflow.state-changed']
                        }
                    ]
                }
            };
            const response = await this.client.post('/external/workflows/run', ballerineRequest);
            logger_1.LoggerService.info('Ballerine workflow started successfully', {
                caseId: caseData.id,
                workflowId: response.data.id,
                status: response.data.status,
                currentState: response.data.currentState
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to start Ballerine workflow', {
                caseId: caseData.id,
                type: caseData.type,
                tenantId: caseData.tenant_id,
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Failed to start Ballerine workflow: ${error.message}`);
        }
    }
    /**
     * Get workflow status
     */
    async getWorkflowStatus(workflowId) {
        try {
            const response = await this.client.get(`/external/workflows/${workflowId}`);
            logger_1.LoggerService.info('Retrieved Ballerine workflow status', {
                workflowId,
                status: response.data.status,
                currentState: response.data.currentState,
                updatedAt: response.data.updatedAt
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Ballerine workflow status', {
                workflowId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to get workflow status: ${error.message}`);
        }
    }
    /**
     * Get workflow decisions
     */
    async getWorkflowDecisions(workflowId) {
        try {
            // Note: Ballerine returns decisions in workflow status response
            // If separate endpoint exists, it would be here
            const response = await this.client.get(`/external/workflows/${workflowId}`);
            const decisions = response.data.decisions || [];
            logger_1.LoggerService.info('Retrieved Ballerine workflow decisions', {
                workflowId,
                decisionCount: decisions.length
            });
            return decisions;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Ballerine workflow decisions', {
                workflowId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to get workflow decisions: ${error.message}`);
        }
    }
    /**
     * Get workflow documents
     */
    async getWorkflowDocuments(workflowId) {
        try {
            // Documents are in workflow context
            const response = await this.client.get(`/external/workflows/${workflowId}`);
            return response.data.context?.documents || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Ballerine workflow documents', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow documents: ${error.message}`);
        }
    }
    /**
     * Update workflow state
     */
    async updateWorkflowState(workflowId, state, data) {
        try {
            // Ballerine uses PATCH /external/workflows/:id to update workflow
            const updatePayload = {
                context: {
                    ...data,
                    metadata: {
                        ...(data.metadata || {}),
                        updatedBy: 'thaliumx_platform',
                        timestamp: new Date().toISOString(),
                        source: 'kyc_service'
                    }
                }
            };
            await this.client.patch(`/external/workflows/${workflowId}`, updatePayload);
            logger_1.LoggerService.info('Ballerine workflow state updated', {
                workflowId,
                state,
                hasData: !!data,
                metadata: updatePayload.context?.metadata || data?.metadata || {}
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update Ballerine workflow state', {
                workflowId,
                state,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to update workflow state: ${error.message}`);
        }
    }
    /**
     * Get workflow risk assessment
     */
    async getWorkflowRiskAssessment(workflowId) {
        try {
            // Risk assessment is in workflow context
            const response = await this.client.get(`/external/workflows/${workflowId}`);
            const riskData = {
                riskScore: response.data.context?.riskScore || 0.5,
                riskLevel: response.data.context?.riskLevel || 'medium',
                factors: response.data.context?.riskFactors || []
            };
            logger_1.LoggerService.info('Retrieved Ballerine workflow risk assessment', {
                workflowId,
                riskScore: riskData.riskScore
            });
            return riskData;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Ballerine workflow risk assessment', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow risk assessment: ${error.message}`);
        }
    }
    /**
     * Submit additional documents to workflow
     */
    async submitAdditionalDocuments(workflowId, documents) {
        try {
            // Update workflow context with new documents
            const currentWorkflow = await this.client.get(`/external/workflows/${workflowId}`);
            const currentDocuments = currentWorkflow.data.context?.documents || [];
            await this.client.patch(`/external/workflows/${workflowId}`, {
                context: {
                    documents: [...currentDocuments, ...documents],
                    metadata: {
                        ...(currentWorkflow.data.context?.metadata || {}),
                        submittedBy: 'thaliumx_platform',
                        timestamp: new Date().toISOString()
                    }
                }
            });
            logger_1.LoggerService.info('Additional documents submitted to Ballerine workflow', {
                workflowId,
                documentCount: documents.length
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to submit additional documents to Ballerine workflow', {
                workflowId,
                documentCount: documents.length,
                error: error.message
            });
            throw new Error(`Failed to submit additional documents: ${error.message}`);
        }
    }
    /**
     * Get workflow compliance report
     */
    async getWorkflowComplianceReport(workflowId) {
        try {
            // Compliance data is in workflow context
            const response = await this.client.get(`/external/workflows/${workflowId}`);
            const report = {
                workflowId,
                overallStatus: response.data.status === 'completed' ? 'compliant' : 'pending',
                checks: response.data.context?.complianceChecks || [],
                timestamp: new Date().toISOString()
            };
            logger_1.LoggerService.info('Retrieved Ballerine workflow compliance report', {
                workflowId,
                complianceStatus: report.overallStatus
            });
            return report;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Ballerine workflow compliance report', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow compliance report: ${error.message}`);
        }
    }
    /**
     * Verify webhook signature
     */
    async verifyWebhookSignature(payload, signature) {
        try {
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(payloadString)
                .digest('hex');
            return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
        }
        catch (error) {
            logger_1.LoggerService.error('Verify webhook signature failed', { error: error.message });
            return false;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/api/v1/_health/ready');
            return response.status === 200;
        }
        catch (error) {
            logger_1.LoggerService.error('Ballerine health check failed', { error: error.message });
            return false;
        }
    }
    // =============================================================================
    // ADVANCED FEATURES - WORKFLOW DEFINITIONS
    // =============================================================================
    /**
     * Get all workflow definitions
     */
    async getWorkflowDefinitions() {
        try {
            const response = await this.client.get('/workflow-definition');
            logger_1.LoggerService.info('Retrieved workflow definitions', {
                count: response.data?.length || 0
            });
            return response.data || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow definitions', {
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to get workflow definitions: ${error.message}`);
        }
    }
    /**
     * Get a specific workflow definition
     */
    async getWorkflowDefinition(id) {
        try {
            const response = await this.client.get(`/workflow-definition/${id}`);
            logger_1.LoggerService.info('Retrieved workflow definition', {
                definitionId: id,
                name: response.data?.name
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow definition', {
                definitionId: id,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to get workflow definition: ${error.message}`);
        }
    }
    /**
     * Get workflow definition input context schema
     */
    async getWorkflowDefinitionSchema(id) {
        try {
            const response = await this.client.get(`/workflow-definition/${id}/input-context-schema`);
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow definition schema', {
                definitionId: id,
                error: error.message
            });
            throw new Error(`Failed to get workflow definition schema: ${error.message}`);
        }
    }
    /**
     * Find workflow definition by type (kyc/kyb)
     */
    async findWorkflowDefinitionByType(type) {
        try {
            const definitions = await this.getWorkflowDefinitions();
            const typeLower = type.toLowerCase();
            // Try to find by name pattern
            const found = definitions.find(def => def.name?.toLowerCase().includes(typeLower) ||
                def.id?.toLowerCase().includes(typeLower));
            if (found) {
                logger_1.LoggerService.info('Found workflow definition by type', {
                    type,
                    definitionId: found.id,
                    definitionName: found.name
                });
                return found;
            }
            logger_1.LoggerService.warn('No workflow definition found for type', { type });
            return null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to find workflow definition by type', {
                type,
                error: error.message
            });
            return null;
        }
    }
    // =============================================================================
    // ADVANCED FEATURES - COLLECTION FLOWS
    // =============================================================================
    /**
     * Create a collection flow URL for document/information collection
     */
    async createCollectionFlowUrl(request) {
        try {
            const payload = {
                workflowId: request.workflowId,
                endUserId: request.endUserId,
                config: {
                    ...request.config,
                    redirectUrl: request.config?.redirectUrl || process.env.BALLERINE_REDIRECT_URL || `${process.env.BACKEND_URL}/api/kyc/collection-flow/callback`
                }
            };
            const response = await this.client.post('/external/collection-flows', payload);
            logger_1.LoggerService.info('Created collection flow URL', {
                workflowId: request.workflowId,
                collectionFlowId: response.data.id,
                hasUrl: !!response.data.url
            });
            return {
                id: response.data.id,
                url: response.data.url,
                token: response.data.token,
                expiresAt: response.data.expiresAt
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create collection flow URL', {
                workflowId: request.workflowId,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to create collection flow URL: ${error.message}`);
        }
    }
    /**
     * Get collection flow state
     */
    async getCollectionFlowState(workflowId) {
        try {
            const response = await this.client.get(`/external/workflows/${workflowId}/collection-flow/state`);
            return response.data.state;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get collection flow state', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get collection flow state: ${error.message}`);
        }
    }
    /**
     * Update collection flow state
     */
    async updateCollectionFlowState(workflowId, state) {
        try {
            await this.client.put(`/external/workflows/${workflowId}/collection-flow/state`, { state });
            logger_1.LoggerService.info('Updated collection flow state', {
                workflowId,
                hasState: !!state
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update collection flow state', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to update collection flow state: ${error.message}`);
        }
    }
    /**
     * Get collection flow by ID
     */
    async getCollectionFlow(collectionFlowId) {
        try {
            const response = await this.client.get(`/external/collection-flows/${collectionFlowId}`);
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get collection flow', {
                collectionFlowId,
                error: error.message
            });
            throw new Error(`Failed to get collection flow: ${error.message}`);
        }
    }
    // =============================================================================
    // ADVANCED FEATURES - WORKFLOW EVENTS
    // =============================================================================
    /**
     * Send a workflow event to trigger state transitions
     */
    async sendWorkflowEvent(workflowId, event) {
        try {
            const response = await this.client.post(`/external/workflows/${workflowId}/event`, {
                name: event.name,
                payload: event.payload || {}
            });
            logger_1.LoggerService.info('Sent workflow event', {
                workflowId,
                eventName: event.name,
                hasPayload: !!event.payload
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to send workflow event', {
                workflowId,
                eventName: event.name,
                error: error.message,
                status: error.response?.status
            });
            throw new Error(`Failed to send workflow event: ${error.message}`);
        }
    }
    /**
     * Send workflow event using alternative endpoint
     */
    async sendWorkflowEventAlt(workflowId, event) {
        try {
            const response = await this.client.post(`/external/workflows/${workflowId}/send-event`, {
                name: event.name,
                payload: event.payload || {}
            });
            logger_1.LoggerService.info('Sent workflow event (alt)', {
                workflowId,
                eventName: event.name
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to send workflow event (alt)', {
                workflowId,
                eventName: event.name,
                error: error.message
            });
            throw new Error(`Failed to send workflow event: ${error.message}`);
        }
    }
    /**
     * Get workflow context
     */
    async getWorkflowContext(workflowId) {
        try {
            const response = await this.client.get(`/external/workflows/${workflowId}/context`);
            return response.data.context;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow context', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow context: ${error.message}`);
        }
    }
    // =============================================================================
    // ADVANCED FEATURES - WORKFLOW LOGS
    // =============================================================================
    /**
     * Get workflow logs for audit trail
     */
    async getWorkflowLogs(workflowId, options) {
        try {
            const params = {};
            if (options?.type)
                params.type = options.type;
            if (options?.limit)
                params.limit = options.limit;
            const response = await this.client.get(`/external/workflows/${workflowId}/logs`, { params });
            return response.data || [];
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow logs', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow logs: ${error.message}`);
        }
    }
    /**
     * Get workflow log summary
     */
    async getWorkflowLogSummary(workflowId) {
        try {
            const response = await this.client.get(`/external/workflows/${workflowId}/logs/summary`);
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get workflow log summary', {
                workflowId,
                error: error.message
            });
            throw new Error(`Failed to get workflow log summary: ${error.message}`);
        }
    }
    // =============================================================================
    // ADVANCED FEATURES - METRICS & MONITORING
    // =============================================================================
    /**
     * Get Ballerine metrics
     */
    async getMetrics() {
        try {
            const response = await this.client.get('/metrics');
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get metrics', { error: error.message });
            throw new Error(`Failed to get metrics: ${error.message}`);
        }
    }
    /**
     * Get Prometheus metrics
     */
    async getPrometheusMetrics() {
        try {
            const response = await this.client.get('/prometheus', {
                responseType: 'text'
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get Prometheus metrics', { error: error.message });
            throw new Error(`Failed to get Prometheus metrics: ${error.message}`);
        }
    }
    /**
     * List all workflows with filters
     */
    async listWorkflows(filters) {
        try {
            const params = {};
            if (filters?.status)
                params.status = filters.status;
            if (filters?.page)
                params.page = filters.page;
            if (filters?.limit)
                params.limit = filters.limit;
            if (filters?.orderBy)
                params.orderBy = filters.orderBy;
            if (filters?.orderDirection)
                params.orderDirection = filters.orderDirection;
            const response = await this.client.get('/external/workflows', { params });
            logger_1.LoggerService.info('Listed workflows', {
                count: response.data?.results?.length || 0,
                total: response.data?.total || 0,
                filters
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to list workflows', {
                filters,
                error: error.message
            });
            throw new Error(`Failed to list workflows: ${error.message}`);
        }
    }
}
exports.BallerineService = BallerineService;
// Export singleton instance
exports.ballerineService = new BallerineService();
//# sourceMappingURL=ballerine.js.map