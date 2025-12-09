"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const API_TIMEOUT = 10000; // 10 seconds
// API Client Class
class ApiClient {
    baseURL;
    timeout;
    constructor(baseURL = API_BASE_URL, timeout = API_TIMEOUT) {
        this.baseURL = baseURL;
        this.timeout = timeout;
    }
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        const config = {
            ...options,
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
        }
        catch (error) {
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
    async get(endpoint, headers) {
        return this.request(endpoint, {
            method: 'GET',
            headers,
        });
    }
    async post(endpoint, data, headers) {
        return this.request(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
            headers,
        });
    }
    async put(endpoint, data, headers) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
            headers,
        });
    }
    async delete(endpoint, headers) {
        return this.request(endpoint, {
            method: 'DELETE',
            headers,
        });
    }
    // Health Check
    async healthCheck() {
        return this.get('/health');
    }
    // API Documentation
    async getApiDocs() {
        return this.get('/api/docs');
    }
}
// Create singleton instance
exports.apiClient = new ApiClient();
// Export types and client
exports.default = exports.apiClient;
//# sourceMappingURL=client.js.map