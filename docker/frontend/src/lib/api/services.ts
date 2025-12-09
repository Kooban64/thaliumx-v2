import { apiClient, ApiResponse } from './client';

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Auth Service
export class AuthService {
  static async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/api/auth/login', credentials);
  }

  static async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/api/auth/register', userData);
  }

  static async logout(): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/api/auth/logout');
  }

  static async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> {
    return apiClient.post<{ accessToken: string }>('/api/auth/refresh', { refreshToken });
  }

  static async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/api/auth/me');
  }

  static async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/api/auth/forgot-password', { email });
  }

  static async resetPassword(token: string, password: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/api/auth/reset-password', { token, password });
  }
}

// User Service
export class UserService {
  static async getUsers(): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>('/api/users');
  }

  static async getUserById(id: string): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`/api/users/${id}`);
  }

  static async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/api/users/${id}`, userData);
  }

  static async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/users/${id}`);
  }
}

// System Service
export class SystemService {
  static async getHealthStatus(): Promise<ApiResponse<{
    status: string;
    timestamp: string;
    services: {
      database: string;
      redis: string;
      api: string;
    };
  }>> {
    return apiClient.get('/health');
  }

  static async getApiDocumentation(): Promise<ApiResponse<any>> {
    return apiClient.get('/api/docs');
  }
}
