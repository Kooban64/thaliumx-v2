"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemService = exports.UserService = exports.AuthService = void 0;
const client_1 = require("./client");
// Auth Service
class AuthService {
    static async login(credentials) {
        return client_1.apiClient.post('/api/auth/login', credentials);
    }
    static async register(userData) {
        return client_1.apiClient.post('/api/auth/register', userData);
    }
    static async logout() {
        return client_1.apiClient.post('/api/auth/logout');
    }
    static async refreshToken(refreshToken) {
        return client_1.apiClient.post('/api/auth/refresh', { refreshToken });
    }
    static async getCurrentUser() {
        return client_1.apiClient.get('/api/auth/me');
    }
    static async forgotPassword(email) {
        return client_1.apiClient.post('/api/auth/forgot-password', { email });
    }
    static async resetPassword(token, password) {
        return client_1.apiClient.post('/api/auth/reset-password', { token, password });
    }
}
exports.AuthService = AuthService;
// User Service
class UserService {
    static async getUsers() {
        return client_1.apiClient.get('/api/users');
    }
    static async getUserById(id) {
        return client_1.apiClient.get(`/api/users/${id}`);
    }
    static async updateUser(id, userData) {
        return client_1.apiClient.put(`/api/users/${id}`, userData);
    }
    static async deleteUser(id) {
        return client_1.apiClient.delete(`/api/users/${id}`);
    }
}
exports.UserService = UserService;
// System Service
class SystemService {
    static async getHealthStatus() {
        return client_1.apiClient.get('/health');
    }
    static async getApiDocumentation() {
        return client_1.apiClient.get('/api/docs');
    }
}
exports.SystemService = SystemService;
//# sourceMappingURL=services.js.map