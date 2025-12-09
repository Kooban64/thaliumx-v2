import { ApiResponse } from './client';
export declare function useApi<T>(apiCall: () => Promise<ApiResponse<T>>, dependencies?: any[]): {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};
export declare function useApiMutation<T, P = any>(apiCall: (params: P) => Promise<ApiResponse<T>>): {
    data: T | null;
    loading: boolean;
    error: string | null;
    mutate: (params: P) => Promise<ApiResponse<T>>;
};
export declare function useSystemHealth(): {
    data: {
        status: any;
        timestamp: any;
        services: {
            database: string;
            redis: string;
            api: string;
        };
    } | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};
//# sourceMappingURL=hooks.d.ts.map