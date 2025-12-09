'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from './client';

// Hook for API calls with loading and error states
export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall();
      if (response.success) {
        setData(response.data || null);
      } else {
        setError(response.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

// Hook for mutations (POST, PUT, DELETE)
export function useApiMutation<T, P = any>(
  apiCall: (params: P) => Promise<ApiResponse<T>>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (params: P) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiCall(params);
      if (response.success) {
        setData(response.data || null);
        return response;
      } else {
        setError(response.error || 'Unknown error occurred');
        return response;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage, timestamp: new Date().toISOString() };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return { data, loading, error, mutate };
}

// Hook for system health status
export function useSystemHealth() {
  return useApi(async () => {
    const response = await fetch('http://localhost:3002/health');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        status: data.status || 'unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        services: {
          database: 'pending',
          redis: 'pending',
          api: 'online'
        }
      },
      timestamp: new Date().toISOString()
    };
  });
}
