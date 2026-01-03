/**
 * Workflow React Hooks
 * 
 * React hooks for workflow data fetching and mutations
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi, useApiMutation } from '../hooks';
import {
  startWorkflow,
  getWorkflowStatus,
  getUserWorkflows,
  retryWorkflowStep,
  cancelWorkflow,
  getWorkflowTypes,
  getWorkflowHealth,
  StartWorkflowRequest,
  RetryWorkflowRequest,
  CancelWorkflowRequest
} from '../workflows';
import { WorkflowState, WorkflowFilters, WorkflowType, WorkflowStatus } from '../types/workflows';

/**
 * Hook to fetch and poll workflow status
 * Automatically polls for active workflows
 */
export function useWorkflowStatus(
  workflowId: string | null,
  options?: {
    pollInterval?: number; // Polling interval in ms (default: 3000ms)
    enabled?: boolean; // Whether to enable polling (default: true)
  }
) {
  const { pollInterval = 3000, enabled = true } = options || {};
  const [data, setData] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!workflowId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getWorkflowStatus(workflowId);
      if (response.success && response.data) {
        const workflow = response.data.workflow;
        setData(workflow);

        // Stop polling if workflow is completed, failed, or cancelled
        if (
          workflow.status === WorkflowStatus.COMPLETED ||
          workflow.status === WorkflowStatus.FAILED ||
          workflow.status === WorkflowStatus.CANCELLED
        ) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } else {
        setError(response.error || 'Failed to fetch workflow status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [workflowId, enabled]);

  useEffect(() => {
    if (!workflowId || !enabled) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchStatus();

    // Set up polling for active workflows
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(() => {
      if (isActiveRef.current && data?.status === WorkflowStatus.RUNNING) {
        fetchStatus();
      }
    }, pollInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [workflowId, enabled, pollInterval, fetchStatus, data?.status]);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchStatus
  };
}

/**
 * Hook to fetch user workflows with filtering
 */
export function useUserWorkflows(
  userId: string | null,
  filters?: WorkflowFilters
) {
  return useApi(
    () => {
      if (!userId) {
        return Promise.resolve({
          success: true,
          data: { workflows: [], count: 0 },
          timestamp: new Date().toISOString()
        });
      }
      return getUserWorkflows(userId, filters);
    },
    [userId, filters?.status, filters?.workflowType, filters?.limit, filters?.offset]
  );
}

/**
 * Hook for starting a workflow
 */
export function useStartWorkflow() {
  return useApiMutation<{ workflowId: string; workflowType: WorkflowType; status: WorkflowStatus }, StartWorkflowRequest>(
    (request: StartWorkflowRequest) => startWorkflow(request)
  );
}

/**
 * Hook for retrying a workflow step
 */
export function useRetryWorkflow() {
  return useApiMutation<{ message: string }, { workflowId: string; request: RetryWorkflowRequest }>(
    ({ workflowId, request }) => retryWorkflowStep(workflowId, request)
  );
}

/**
 * Hook for cancelling a workflow
 */
export function useCancelWorkflow() {
  return useApiMutation<{ message: string }, { workflowId: string; request: CancelWorkflowRequest }>(
    ({ workflowId, request }) => cancelWorkflow(workflowId, request)
  );
}

/**
 * Hook to get available workflow types
 */
export function useWorkflowTypes() {
  return useApi(
    () => getWorkflowTypes(),
    []
  );
}

/**
 * Hook to get workflow orchestrator health
 */
export function useWorkflowHealth() {
  return useApi(
    () => getWorkflowHealth(),
    []
  );
}

/**
 * Combined hook for workflow actions (retry, cancel)
 */
export function useWorkflowActions() {
  const retryMutation = useRetryWorkflow();
  const cancelMutation = useCancelWorkflow();

  const retry = useCallback(
    async (workflowId: string, stepIndex?: number, stepName?: string) => {
      return retryMutation.mutate({
        workflowId,
        request: { stepIndex, stepName }
      });
    },
    [retryMutation]
  );

  const cancel = useCallback(
    async (workflowId: string, reason?: string) => {
      return cancelMutation.mutate({
        workflowId,
        request: { reason }
      });
    },
    [cancelMutation]
  );

  return {
    retry,
    cancel,
    retryLoading: retryMutation.loading,
    cancelLoading: cancelMutation.loading,
    retryError: retryMutation.error,
    cancelError: cancelMutation.error
  };
}
