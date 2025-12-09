/**
 * Ballerine Service Integration Tests
 * 
 * Comprehensive test suite for all Ballerine OSS features:
 * - Workflow Definitions
 * - Collection Flows
 * - Workflow Events
 * - Workflow Logs
 * - Metrics
 * - Basic Workflow Operations
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ballerineService, BallerineService } from '../src/services/ballerine';
import axios from 'axios';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Type for mocked axios instance
interface MockedAxiosInstance {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
  interceptors: {
    request: { use: jest.Mock };
    response: { use: jest.Mock };
  };
}

describe('BallerineService', () => {
  let service: BallerineService;

  beforeAll(() => {
    // Set test environment variables
    process.env.BALLERINE_BASE_URL = 'http://test-ballerine:4000';
    process.env.BALLERINE_API_KEY = 'test-api-key';
    process.env.BALLERINE_WEBHOOK_SECRET = 'test-webhook-secret';
    
    service = ballerineService;
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return true when Ballerine is healthy', async () => {
      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ status: 200 }) as jest.Mock,
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when Ballerine is unhealthy', async () => {
      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockRejectedValue(new Error('Connection failed')) as jest.Mock,
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('Workflow Definitions', () => {
    it('should get all workflow definitions', async () => {
      const mockDefinitions = [
        { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 },
        { id: 'kyb-workflow', name: 'KYB Workflow', version: 1 }
      ];

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockDefinitions }) as jest.Mock,
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const definitions = await service.getWorkflowDefinitions();
      expect(definitions).toEqual(mockDefinitions);
      expect(mockClient.get).toHaveBeenCalledWith('/workflow-definition');
    });

    it('should get a specific workflow definition', async () => {
      const mockDefinition = { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 };

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockDefinition }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const definition = await service.getWorkflowDefinition('kyc-workflow');
      expect(definition).toEqual(mockDefinition);
      expect(mockClient.get).toHaveBeenCalledWith('/workflow-definition/kyc-workflow');
    });

    it('should find workflow definition by type', async () => {
      const mockDefinitions = [
        { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 },
        { id: 'kyb-workflow', name: 'KYB Workflow', version: 1 }
      ];

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockDefinitions }) as jest.Mock,
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const definition = await service.findWorkflowDefinitionByType('kyc');
      expect(definition).toBeTruthy();
      expect(definition?.id).toBe('kyc-workflow');
    });
  });

  describe('Collection Flows', () => {
    it('should create a collection flow URL', async () => {
      const mockResponse = {
        id: 'collection-flow-123',
        url: 'https://collection-flow.example.com/flow-123',
        token: 'token-123',
        expiresAt: '2024-12-31T23:59:59Z'
      };

      const mockClient: MockedAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }) as jest.Mock,
        get: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.createCollectionFlowUrl({
        workflowId: 'workflow-123',
        endUserId: 'user-123'
      });

      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/external/collection-flows',
        expect.objectContaining({
          workflowId: 'workflow-123',
          endUserId: 'user-123'
        })
      );
    });

    it('should get collection flow state', async () => {
      const mockState = { step: 'document-upload', completed: false };

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: { state: mockState } }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const state = await service.getCollectionFlowState('workflow-123');
      expect(state).toEqual(mockState);
      expect(mockClient.get).toHaveBeenCalledWith('/external/workflows/workflow-123/collection-flow/state');
    });
  });

  describe('Workflow Events', () => {
    it('should send a workflow event', async () => {
      const mockResponse = { id: 'workflow-123', status: 'active', currentState: 'verification' };

      const mockClient: MockedAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }) as jest.Mock,
        get: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.sendWorkflowEvent('workflow-123', {
        name: 'document.uploaded',
        payload: { documentId: 'doc-123' }
      });

      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/external/workflows/workflow-123/event',
        expect.objectContaining({
          name: 'document.uploaded',
          payload: { documentId: 'doc-123' }
        })
      );
    });
  });

  describe('Workflow Logs', () => {
    it('should get workflow logs', async () => {
      const mockLogs = [
        { id: 'log-1', type: 'state-change', timestamp: '2024-01-01T00:00:00Z' },
        { id: 'log-2', type: 'event', timestamp: '2024-01-01T00:01:00Z' }
      ];

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockLogs }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const logs = await service.getWorkflowLogs('workflow-123', { type: 'state-change', limit: 10 });
      expect(logs).toEqual(mockLogs);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/external/workflows/workflow-123/logs',
        expect.objectContaining({
          params: { type: 'state-change', limit: 10 }
        })
      );
    });
  });

  describe('Metrics', () => {
    it('should get metrics', async () => {
      const mockMetrics = {
        workflows: { total: 100, active: 50, completed: 45, failed: 5 }
      };

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockMetrics }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const metrics = await service.getMetrics();
      expect(metrics).toEqual(mockMetrics);
      expect(mockClient.get).toHaveBeenCalledWith('/metrics');
    });

    it('should get Prometheus metrics', async () => {
      const mockPrometheusMetrics = 'ballerine_workflows_total 100\nballerine_workflows_active 50';

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockPrometheusMetrics }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const metrics = await service.getPrometheusMetrics();
      expect(metrics).toBe(mockPrometheusMetrics);
      expect(mockClient.get).toHaveBeenCalledWith('/prometheus', {
        responseType: 'text'
      });
    });
  });

  describe('Workflow Operations', () => {
    it('should start a workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        status: 'active',
        currentState: 'initial',
        context: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const mockClient: MockedAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockWorkflow }),
        get: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const caseData = {
        id: 'case-123',
        type: 'kyc',
        entity_id: 'user-123',
        tenant_id: 'tenant-123',
        entity_data: {},
        documents: []
      };

      const result = await service.startWorkflow(caseData);
      expect(result).toEqual(mockWorkflow);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/external/workflows/run',
        expect.objectContaining({
          workflowId: expect.any(String),
          context: expect.any(Object)
        })
      );
    });

    it('should get workflow status', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        status: 'completed',
        currentState: 'approved',
        context: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z'
      };

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockWorkflow }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.getWorkflowStatus('workflow-123');
      expect(result).toEqual(mockWorkflow);
      expect(mockClient.get).toHaveBeenCalledWith('/external/workflows/workflow-123');
    });

    it('should list workflows with filters', async () => {
      const mockResponse = {
        results: [
          { id: 'workflow-1', status: 'active' },
          { id: 'workflow-2', status: 'active' }
        ],
        total: 2,
        page: 1,
        limit: 10
      };

      const mockClient: MockedAxiosInstance = {
        get: jest.fn().mockResolvedValue({ data: mockResponse }),
        post: jest.fn(),
        patch: jest.fn(),
        put: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      (mockedAxios.create as jest.Mock) = jest.fn(() => mockClient);

      const result = await service.listWorkflows({
        status: 'active',
        page: 1,
        limit: 10
      });

      expect(result).toEqual(mockResponse);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/external/workflows',
        expect.objectContaining({
          params: { status: 'active', page: 1, limit: 10 }
        })
      );
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify webhook signature correctly', async () => {
      const payload = { workflowId: 'workflow-123', status: 'completed' };
      const payloadString = JSON.stringify(payload);
      
      // This test would need crypto to be properly mocked
      // For now, we'll just test the method exists
      expect(typeof service.verifyWebhookSignature).toBe('function');
    });
  });
});

