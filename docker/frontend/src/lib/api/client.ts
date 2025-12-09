// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const API_TIMEOUT = 10000; // 10 seconds

// CSRF token management
let csrfToken: string | null = null;

export async function getCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  try {
    const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
      credentials: 'include'
    });
    const data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken!;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    throw error;
  }
}

// API Response Types
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

// API Client Class
class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add CSRF token for non-GET requests
    if (options.method && options.method !== 'GET') {
      try {
        const csrfToken = await getCSRFToken();
        defaultHeaders['X-CSRF-Token'] = csrfToken;
      } catch (error) {
        console.warn('Failed to get CSRF token:', error);
      }
    }

    const config: RequestInit = {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get('/health');
  }

  // API Documentation
  async getApiDocs(): Promise<ApiResponse<any>> {
    return this.get('/api/docs');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export types and client
export default apiClient;
