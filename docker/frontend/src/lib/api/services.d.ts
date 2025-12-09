import { ApiResponse } from './client';
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
export declare class AuthService {
    static login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>>;
    static register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>>;
    static logout(): Promise<ApiResponse<void>>;
    static refreshToken(refreshToken: string): Promise<ApiResponse<{
        accessToken: string;
    }>>;
    static getCurrentUser(): Promise<ApiResponse<User>>;
    static forgotPassword(email: string): Promise<ApiResponse<void>>;
    static resetPassword(token: string, password: string): Promise<ApiResponse<void>>;
}
export declare class UserService {
    static getUsers(): Promise<ApiResponse<User[]>>;
    static getUserById(id: string): Promise<ApiResponse<User>>;
    static updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>>;
    static deleteUser(id: string): Promise<ApiResponse<void>>;
}
export declare class SystemService {
    static getHealthStatus(): Promise<ApiResponse<{
        status: string;
        timestamp: string;
        services: {
            database: string;
            redis: string;
            api: string;
        };
    }>>;
    static getApiDocumentation(): Promise<ApiResponse<any>>;
}
//# sourceMappingURL=services.d.ts.map