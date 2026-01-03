/**
 * Workflow API Client
 * 
 * API client functions for workflow orchestrator endpoints
 */

import apiClient, { ApiResponse } from './client';
import {
  WorkflowType,
  // WorkflowStatus, // Unused
  WorkflowState,
  // WorkflowInput, // Unused
  WorkflowResult,
  // WorkflowExecutionOptions, // Unused
  WorkflowFilters,
  WorkflowHealth
} from './types/workflows';

export interface StartWorkflowRequest {
  workflowType: WorkflowType;
  userId?: string;
  tenantId?: string;
  brokerId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  enableCompensation?: boolean;
}

export interface RetryWorkflowRequest {
  stepIndex?: number;
  stepName?: string;
}

export interface CancelWorkflowRequest {
  reason?: string;
}

export interface ContinueWorkflowRequest {
  stepResult: Record<string, any>;
  nextStep?: string;
}

export async function startWorkflow(
  input: StartWorkflowRequest
): Promise<ApiResponse<WorkflowResult>> {
  return apiClient.post<WorkflowResult>('/api/workflows/start', input);
}

export async function getWorkflowStatus(
  workflowId: string
): Promise<ApiResponse<{ workflow: WorkflowState }>> {
  return apiClient.get<{ workflow: WorkflowState }>(`/api/workflows/${workflowId}/status`);
}

export async function getUserWorkflows(
  userId: string,
  filters?: WorkflowFilters
): Promise<ApiResponse<{ workflows: WorkflowState[]; count: number }>> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.workflowType) params.append('workflowType', filters.workflowType);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  const url = `/api/workflows/user/${userId}${queryString ? `?${queryString}` : ''}`;
  
  return apiClient.get<{ workflows: WorkflowState[]; count: number }>(url);
}

export async function retryWorkflowStep(
  workflowId: string,
  request: RetryWorkflowRequest
): Promise<ApiResponse<{ message: string }>> {
  return apiClient.post<{ message: string }>(`/api/workflows/${workflowId}/retry`, request);
}

export async function cancelWorkflow(
  workflowId: string,
  request: CancelWorkflowRequest
): Promise<ApiResponse<{ message: string }>> {
  return apiClient.post<{ message: string }>(`/api/workflows/${workflowId}/cancel`, request);
}

export async function continueWorkflow(
  workflowId: string,
  request: ContinueWorkflowRequest
): Promise<ApiResponse<{ message: string }>> {
  return apiClient.post<{ message: string }>(`/api/workflows/${workflowId}/continue`, request);
}

export async function getWorkflowTypes(): Promise<ApiResponse<{ types: WorkflowType[] }>> {
  return apiClient.get<{ types: WorkflowType[] }>('/api/workflows/types');
}

export async function getWorkflowHealth(): Promise<ApiResponse<WorkflowHealth>> {
  return apiClient.get<WorkflowHealth>('/api/workflows/health');
}

export async function getWorkflowHistory(
  workflowId: string
): Promise<ApiResponse<{ history: any[] }>> {
  return apiClient.get<{ history: any[] }>(`/api/workflows/${workflowId}/history`);
}

export const workflowsApi = {
  start: startWorkflow,
  getStatus: getWorkflowStatus,
  getUserWorkflows,
  retry: retryWorkflowStep,
  cancel: cancelWorkflow,
  continue: continueWorkflow,
  getTypes: getWorkflowTypes,
  getHealth: getWorkflowHealth,
  getHistory: getWorkflowHistory
};
