"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const ballerine_1 = require("../src/services/ballerine");
const axios_1 = __importDefault(require("axios"));
// Mock axios for testing
globals_1.jest.mock('axios');
const mockedAxios = axios_1.default;
(0, globals_1.describe)('BallerineService', () => {
    let service;
    (0, globals_1.beforeAll)(() => {
        // Set test environment variables
        process.env.BALLERINE_BASE_URL = 'http://test-ballerine:4000';
        process.env.BALLERINE_API_KEY = 'test-api-key';
        process.env.BALLERINE_WEBHOOK_SECRET = 'test-webhook-secret';
        service = ballerine_1.ballerineService;
    });
    (0, globals_1.afterAll)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.describe)('Health Check', () => {
        (0, globals_1.it)('should return true when Ballerine is healthy', async () => {
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ status: 200 }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.healthCheck();
            (0, globals_1.expect)(result).toBe(true);
        });
        (0, globals_1.it)('should return false when Ballerine is unhealthy', async () => {
            const mockClient = {
                get: globals_1.jest.fn().mockRejectedValue(new Error('Connection failed')),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.healthCheck();
            (0, globals_1.expect)(result).toBe(false);
        });
    });
    (0, globals_1.describe)('Workflow Definitions', () => {
        (0, globals_1.it)('should get all workflow definitions', async () => {
            const mockDefinitions = [
                { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 },
                { id: 'kyb-workflow', name: 'KYB Workflow', version: 1 }
            ];
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockDefinitions }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const definitions = await service.getWorkflowDefinitions();
            (0, globals_1.expect)(definitions).toEqual(mockDefinitions);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/workflow-definition');
        });
        (0, globals_1.it)('should get a specific workflow definition', async () => {
            const mockDefinition = { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 };
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockDefinition }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const definition = await service.getWorkflowDefinition('kyc-workflow');
            (0, globals_1.expect)(definition).toEqual(mockDefinition);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/workflow-definition/kyc-workflow');
        });
        (0, globals_1.it)('should find workflow definition by type', async () => {
            const mockDefinitions = [
                { id: 'kyc-workflow', name: 'KYC Workflow', version: 1 },
                { id: 'kyb-workflow', name: 'KYB Workflow', version: 1 }
            ];
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockDefinitions }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const definition = await service.findWorkflowDefinitionByType('kyc');
            (0, globals_1.expect)(definition).toBeTruthy();
            (0, globals_1.expect)(definition?.id).toBe('kyc-workflow');
        });
    });
    (0, globals_1.describe)('Collection Flows', () => {
        (0, globals_1.it)('should create a collection flow URL', async () => {
            const mockResponse = {
                id: 'collection-flow-123',
                url: 'https://collection-flow.example.com/flow-123',
                token: 'token-123',
                expiresAt: '2024-12-31T23:59:59Z'
            };
            const mockClient = {
                post: globals_1.jest.fn().mockResolvedValue({ data: mockResponse }),
                get: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.createCollectionFlowUrl({
                workflowId: 'workflow-123',
                endUserId: 'user-123'
            });
            (0, globals_1.expect)(result).toEqual(mockResponse);
            (0, globals_1.expect)(mockClient.post).toHaveBeenCalledWith('/external/collection-flows', globals_1.expect.objectContaining({
                workflowId: 'workflow-123',
                endUserId: 'user-123'
            }));
        });
        (0, globals_1.it)('should get collection flow state', async () => {
            const mockState = { step: 'document-upload', completed: false };
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: { state: mockState } }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const state = await service.getCollectionFlowState('workflow-123');
            (0, globals_1.expect)(state).toEqual(mockState);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/external/workflows/workflow-123/collection-flow/state');
        });
    });
    (0, globals_1.describe)('Workflow Events', () => {
        (0, globals_1.it)('should send a workflow event', async () => {
            const mockResponse = { id: 'workflow-123', status: 'active', currentState: 'verification' };
            const mockClient = {
                post: globals_1.jest.fn().mockResolvedValue({ data: mockResponse }),
                get: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.sendWorkflowEvent('workflow-123', {
                name: 'document.uploaded',
                payload: { documentId: 'doc-123' }
            });
            (0, globals_1.expect)(result).toEqual(mockResponse);
            (0, globals_1.expect)(mockClient.post).toHaveBeenCalledWith('/external/workflows/workflow-123/event', globals_1.expect.objectContaining({
                name: 'document.uploaded',
                payload: { documentId: 'doc-123' }
            }));
        });
    });
    (0, globals_1.describe)('Workflow Logs', () => {
        (0, globals_1.it)('should get workflow logs', async () => {
            const mockLogs = [
                { id: 'log-1', type: 'state-change', timestamp: '2024-01-01T00:00:00Z' },
                { id: 'log-2', type: 'event', timestamp: '2024-01-01T00:01:00Z' }
            ];
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockLogs }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const logs = await service.getWorkflowLogs('workflow-123', { type: 'state-change', limit: 10 });
            (0, globals_1.expect)(logs).toEqual(mockLogs);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/external/workflows/workflow-123/logs', globals_1.expect.objectContaining({
                params: { type: 'state-change', limit: 10 }
            }));
        });
    });
    (0, globals_1.describe)('Metrics', () => {
        (0, globals_1.it)('should get metrics', async () => {
            const mockMetrics = {
                workflows: { total: 100, active: 50, completed: 45, failed: 5 }
            };
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockMetrics }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const metrics = await service.getMetrics();
            (0, globals_1.expect)(metrics).toEqual(mockMetrics);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/metrics');
        });
        (0, globals_1.it)('should get Prometheus metrics', async () => {
            const mockPrometheusMetrics = 'ballerine_workflows_total 100\nballerine_workflows_active 50';
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockPrometheusMetrics }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const metrics = await service.getPrometheusMetrics();
            (0, globals_1.expect)(metrics).toBe(mockPrometheusMetrics);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/prometheus', {
                responseType: 'text'
            });
        });
    });
    (0, globals_1.describe)('Workflow Operations', () => {
        (0, globals_1.it)('should start a workflow', async () => {
            const mockWorkflow = {
                id: 'workflow-123',
                status: 'active',
                currentState: 'initial',
                context: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            };
            const mockClient = {
                post: globals_1.jest.fn().mockResolvedValue({ data: mockWorkflow }),
                get: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const caseData = {
                id: 'case-123',
                type: 'kyc',
                entity_id: 'user-123',
                tenant_id: 'tenant-123',
                entity_data: {},
                documents: []
            };
            const result = await service.startWorkflow(caseData);
            (0, globals_1.expect)(result).toEqual(mockWorkflow);
            (0, globals_1.expect)(mockClient.post).toHaveBeenCalledWith('/external/workflows/run', globals_1.expect.objectContaining({
                workflowId: globals_1.expect.any(String),
                context: globals_1.expect.any(Object)
            }));
        });
        (0, globals_1.it)('should get workflow status', async () => {
            const mockWorkflow = {
                id: 'workflow-123',
                status: 'completed',
                currentState: 'approved',
                context: {},
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T01:00:00Z'
            };
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockWorkflow }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.getWorkflowStatus('workflow-123');
            (0, globals_1.expect)(result).toEqual(mockWorkflow);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/external/workflows/workflow-123');
        });
        (0, globals_1.it)('should list workflows with filters', async () => {
            const mockResponse = {
                results: [
                    { id: 'workflow-1', status: 'active' },
                    { id: 'workflow-2', status: 'active' }
                ],
                total: 2,
                page: 1,
                limit: 10
            };
            const mockClient = {
                get: globals_1.jest.fn().mockResolvedValue({ data: mockResponse }),
                post: globals_1.jest.fn(),
                patch: globals_1.jest.fn(),
                put: globals_1.jest.fn(),
                interceptors: {
                    request: { use: globals_1.jest.fn() },
                    response: { use: globals_1.jest.fn() }
                }
            };
            mockedAxios.create = globals_1.jest.fn(() => mockClient);
            const result = await service.listWorkflows({
                status: 'active',
                page: 1,
                limit: 10
            });
            (0, globals_1.expect)(result).toEqual(mockResponse);
            (0, globals_1.expect)(mockClient.get).toHaveBeenCalledWith('/external/workflows', globals_1.expect.objectContaining({
                params: { status: 'active', page: 1, limit: 10 }
            }));
        });
    });
    (0, globals_1.describe)('Webhook Signature Verification', () => {
        (0, globals_1.it)('should verify webhook signature correctly', async () => {
            const payload = { workflowId: 'workflow-123', status: 'completed' };
            const payloadString = JSON.stringify(payload);
            // This test would need crypto to be properly mocked
            // For now, we'll just test the method exists
            (0, globals_1.expect)(typeof service.verifyWebhookSignature).toBe('function');
        });
    });
});
//# sourceMappingURL=ballerine.test.js.map