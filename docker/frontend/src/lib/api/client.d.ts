export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
}
export interface ApiError {
    message: string;
    status?: number;
    code?: string;
}
declare class ApiClient {
    private baseURL;
    private timeout;
    constructor(baseURL?: string, timeout?: number);
    private request;
    get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    post<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    put<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    healthCheck(): Promise<ApiResponse<{
        status: string;
        timestamp: string;
    }>>;
    getApiDocs(): Promise<ApiResponse<any>>;
}
export declare const apiClient: ApiClient;
export default apiClient;
//# sourceMappingURL=client.d.ts.map