'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useApi = useApi;
exports.useApiMutation = useApiMutation;
exports.useSystemHealth = useSystemHealth;
const react_1 = require("react");
// Hook for API calls with loading and error states
function useApi(apiCall, dependencies = []) {
    const [data, setData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const execute = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall();
            if (response.success) {
                setData(response.data || null);
            }
            else {
                setError(response.error || 'Unknown error occurred');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        }
        finally {
            setLoading(false);
        }
    }, dependencies);
    (0, react_1.useEffect)(() => {
        execute();
    }, [execute]);
    return { data, loading, error, refetch: execute };
}
// Hook for mutations (POST, PUT, DELETE)
function useApiMutation(apiCall) {
    const [data, setData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const mutate = (0, react_1.useCallback)(async (params) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiCall(params);
            if (response.success) {
                setData(response.data || null);
                return response;
            }
            else {
                setError(response.error || 'Unknown error occurred');
                return response;
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            return { success: false, error: errorMessage, timestamp: new Date().toISOString() };
        }
        finally {
            setLoading(false);
        }
    }, [apiCall]);
    return { data, loading, error, mutate };
}
// Hook for system health status
function useSystemHealth() {
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
//# sourceMappingURL=hooks.js.map