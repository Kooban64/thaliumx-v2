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

import axios, { AxiosInstance } from 'axios';
import { LoggerService } from './logger';
import * as crypto from 'crypto';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

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

// =============================================================================
// BALLERINE SERVICE CLASS
// =============================================================================

export class BallerineService {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.baseURL = process.env.BALLERINE_BASE_URL || 'http://ballerine-workflow:4000';
    this.apiKey = process.env.BALLERINE_API_KEY || process.env.VAULT_BALLERINE_API_KEY || 'ballerine_oss_api_key_12345';
    this.webhookSecret = process.env.BALLERINE_WEBHOOK_SECRET || process.env.VAULT_BALLERINE_WEBHOOK_SECRET || 'ballerine_webhook_secret_67890';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        LoggerService.info('Ballerine API Request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        LoggerService.error('Ballerine API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        LoggerService.info('Ballerine API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        LoggerService.error('Ballerine API Response Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Start a new Ballerine workflow
   */
  async startWorkflow(caseData: any): Promise<BallerineWorkflowResponse> {
    try {
      // Enhanced workflow request with comprehensive entity data
      const workflowRequest: BallerineWorkflowRequest = {
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

      LoggerService.info('Starting Ballerine workflow', {
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

      LoggerService.info('Ballerine workflow started successfully', {
        caseId: caseData.id,
        workflowId: response.data.id,
        status: response.data.status,
        currentState: response.data.currentState
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to start Ballerine workflow', {
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
  async getWorkflowStatus(workflowId: string): Promise<BallerineWorkflowResponse> {
    try {
      const response = await this.client.get(`/external/workflows/${workflowId}`);

      LoggerService.info('Retrieved Ballerine workflow status', {
        workflowId,
        status: response.data.status,
        currentState: response.data.currentState,
        updatedAt: response.data.updatedAt
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get Ballerine workflow status', {
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
  async getWorkflowDecisions(workflowId: string): Promise<any[]> {
    try {
      // Note: Ballerine returns decisions in workflow status response
      // If separate endpoint exists, it would be here
      const response = await this.client.get(`/external/workflows/${workflowId}`);
      const decisions = response.data.decisions || [];

      LoggerService.info('Retrieved Ballerine workflow decisions', {
        workflowId,
        decisionCount: decisions.length
      });

      return decisions;
    } catch (error: any) {
      LoggerService.error('Failed to get Ballerine workflow decisions', {
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
  async getWorkflowDocuments(workflowId: string): Promise<any[]> {
    try {
      // Documents are in workflow context
      const response = await this.client.get(`/external/workflows/${workflowId}`);
      return response.data.context?.documents || [];
    } catch (error: any) {
      LoggerService.error('Failed to get Ballerine workflow documents', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to get workflow documents: ${error.message}`);
    }
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(workflowId: string, state: string, data: any): Promise<void> {
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

      LoggerService.info('Ballerine workflow state updated', {
        workflowId,
        state,
        hasData: !!data,
        metadata: updatePayload.context?.metadata || data?.metadata || {}
      });
    } catch (error: any) {
      LoggerService.error('Failed to update Ballerine workflow state', {
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
  async getWorkflowRiskAssessment(workflowId: string): Promise<any> {
    try {
      // Risk assessment is in workflow context
      const response = await this.client.get(`/external/workflows/${workflowId}`);
      const riskData = {
        riskScore: response.data.context?.riskScore || 0.5,
        riskLevel: response.data.context?.riskLevel || 'medium',
        factors: response.data.context?.riskFactors || []
      };

      LoggerService.info('Retrieved Ballerine workflow risk assessment', {
        workflowId,
        riskScore: riskData.riskScore
      });

      return riskData;
    } catch (error: any) {
      LoggerService.error('Failed to get Ballerine workflow risk assessment', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to get workflow risk assessment: ${error.message}`);
    }
  }

  /**
   * Submit additional documents to workflow
   */
  async submitAdditionalDocuments(workflowId: string, documents: any[]): Promise<void> {
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

      LoggerService.info('Additional documents submitted to Ballerine workflow', {
        workflowId,
        documentCount: documents.length
      });
    } catch (error: any) {
      LoggerService.error('Failed to submit additional documents to Ballerine workflow', {
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
  async getWorkflowComplianceReport(workflowId: string): Promise<any> {
    try {
      // Compliance data is in workflow context
      const response = await this.client.get(`/external/workflows/${workflowId}`);
      const report = {
        workflowId,
        overallStatus: response.data.status === 'completed' ? 'compliant' : 'pending',
        checks: response.data.context?.complianceChecks || [],
        timestamp: new Date().toISOString()
      };

      LoggerService.info('Retrieved Ballerine workflow compliance report', {
        workflowId,
        complianceStatus: report.overallStatus
      });

      return report;
    } catch (error: any) {
      LoggerService.error('Failed to get Ballerine workflow compliance report', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to get workflow compliance report: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(payload: string | object, signature: string): Promise<boolean> {
    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error: any) {
      LoggerService.error('Verify webhook signature failed', { error: error.message });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/_health/ready');
      return response.status === 200;
    } catch (error: any) {
      LoggerService.error('Ballerine health check failed', { error: error.message });
      return false;
    }
  }

  // =============================================================================
  // ADVANCED FEATURES - WORKFLOW DEFINITIONS
  // =============================================================================

  /**
   * Get all workflow definitions
   */
  async getWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
    try {
      const response = await this.client.get('/workflow-definition');
      
      LoggerService.info('Retrieved workflow definitions', {
        count: response.data?.length || 0
      });

      return response.data || [];
    } catch (error: any) {
      LoggerService.error('Failed to get workflow definitions', {
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to get workflow definitions: ${error.message}`);
    }
  }

  /**
   * Get a specific workflow definition
   */
  async getWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
    try {
      const response = await this.client.get(`/workflow-definition/${id}`);
      
      LoggerService.info('Retrieved workflow definition', {
        definitionId: id,
        name: response.data?.name
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get workflow definition', {
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
  async getWorkflowDefinitionSchema(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/workflow-definition/${id}/input-context-schema`);
      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get workflow definition schema', {
        definitionId: id,
        error: error.message
      });
      throw new Error(`Failed to get workflow definition schema: ${error.message}`);
    }
  }

  /**
   * Find workflow definition by type (kyc/kyb)
   */
  async findWorkflowDefinitionByType(type: 'kyc' | 'kyb'): Promise<WorkflowDefinition | null> {
    try {
      const definitions = await this.getWorkflowDefinitions();
      const typeLower = type.toLowerCase();
      
      // Try to find by name pattern
      const found = definitions.find(def => 
        def.name?.toLowerCase().includes(typeLower) ||
        def.id?.toLowerCase().includes(typeLower)
      );

      if (found) {
        LoggerService.info('Found workflow definition by type', {
          type,
          definitionId: found.id,
          definitionName: found.name
        });
        return found;
      }

      LoggerService.warn('No workflow definition found for type', { type });
      return null;
    } catch (error: any) {
      LoggerService.error('Failed to find workflow definition by type', {
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
  async createCollectionFlowUrl(request: CollectionFlowRequest): Promise<CollectionFlowResponse> {
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

      LoggerService.info('Created collection flow URL', {
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
    } catch (error: any) {
      LoggerService.error('Failed to create collection flow URL', {
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
  async getCollectionFlowState(workflowId: string): Promise<any> {
    try {
      const response = await this.client.get(`/external/workflows/${workflowId}/collection-flow/state`);
      return response.data.state;
    } catch (error: any) {
      LoggerService.error('Failed to get collection flow state', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to get collection flow state: ${error.message}`);
    }
  }

  /**
   * Update collection flow state
   */
  async updateCollectionFlowState(workflowId: string, state: any): Promise<void> {
    try {
      await this.client.put(`/external/workflows/${workflowId}/collection-flow/state`, { state });

      LoggerService.info('Updated collection flow state', {
        workflowId,
        hasState: !!state
      });
    } catch (error: any) {
      LoggerService.error('Failed to update collection flow state', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to update collection flow state: ${error.message}`);
    }
  }

  /**
   * Get collection flow by ID
   */
  async getCollectionFlow(collectionFlowId: string): Promise<any> {
    try {
      const response = await this.client.get(`/external/collection-flows/${collectionFlowId}`);
      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get collection flow', {
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
  async sendWorkflowEvent(workflowId: string, event: WorkflowEvent): Promise<any> {
    try {
      const response = await this.client.post(`/external/workflows/${workflowId}/event`, {
        name: event.name,
        payload: event.payload || {}
      });

      LoggerService.info('Sent workflow event', {
        workflowId,
        eventName: event.name,
        hasPayload: !!event.payload
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to send workflow event', {
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
  async sendWorkflowEventAlt(workflowId: string, event: WorkflowEvent): Promise<any> {
    try {
      const response = await this.client.post(`/external/workflows/${workflowId}/send-event`, {
        name: event.name,
        payload: event.payload || {}
      });

      LoggerService.info('Sent workflow event (alt)', {
        workflowId,
        eventName: event.name
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to send workflow event (alt)', {
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
  async getWorkflowContext(workflowId: string): Promise<any> {
    try {
      const response = await this.client.get(`/external/workflows/${workflowId}/context`);
      return response.data.context;
    } catch (error: any) {
      LoggerService.error('Failed to get workflow context', {
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
  async getWorkflowLogs(workflowId: string, options?: { type?: string; limit?: number }): Promise<any[]> {
    try {
      const params: any = {};
      if (options?.type) params.type = options.type;
      if (options?.limit) params.limit = options.limit;

      const response = await this.client.get(`/external/workflows/${workflowId}/logs`, { params });
      return response.data || [];
    } catch (error: any) {
      LoggerService.error('Failed to get workflow logs', {
        workflowId,
        error: error.message
      });
      throw new Error(`Failed to get workflow logs: ${error.message}`);
    }
  }

  /**
   * Get workflow log summary
   */
  async getWorkflowLogSummary(workflowId: string): Promise<any> {
    try {
      const response = await this.client.get(`/external/workflows/${workflowId}/logs/summary`);
      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get workflow log summary', {
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
  async getMetrics(): Promise<any> {
    try {
      const response = await this.client.get('/metrics');
      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get metrics', { error: error.message });
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      const response = await this.client.get('/prometheus', {
        responseType: 'text'
      });
      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to get Prometheus metrics', { error: error.message });
      throw new Error(`Failed to get Prometheus metrics: ${error.message}`);
    }
  }

  /**
   * List all workflows with filters
   */
  async listWorkflows(filters?: {
    status?: string;
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<any> {
    try {
      const params: any = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;
      if (filters?.orderBy) params.orderBy = filters.orderBy;
      if (filters?.orderDirection) params.orderDirection = filters.orderDirection;

      const response = await this.client.get('/external/workflows', { params });

      LoggerService.info('Listed workflows', {
        count: response.data?.results?.length || 0,
        total: response.data?.total || 0,
        filters
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('Failed to list workflows', {
        filters,
        error: error.message
      });
      throw new Error(`Failed to list workflows: ${error.message}`);
    }
  }
}

// Export singleton instance
export const ballerineService = new BallerineService();


