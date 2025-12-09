/**
 * User Service
 *
 * Manages user data operations and user lifecycle management.
 *
 * Features:
 * - User creation, retrieval, and updates
 * - User search and filtering
 * - KYC status management
 * - User profile management
 * - Last login tracking
 * - User activation/deactivation
 *
 * Operations:
 * - Create users with validation
 * - Get users by ID, email, or username
 * - Update user information
 * - Search users with filters
 * - Manage KYC status and levels
 *
 * Security:
 * - All operations logged for audit
 * - Input validation on all operations
 * - Error handling with proper error codes
 */
import { User, DeepPartial, KycStatus, KycLevel } from '../types';
export declare class UserService {
    static createUser(userData: DeepPartial<User>): Promise<User>;
    static getUserById(id: string): Promise<User | null>;
    static getUserByEmail(email: string): Promise<User | null>;
    static getUserByUsername(username: string): Promise<User | null>;
    static updateUser(id: string, updateData: DeepPartial<User>): Promise<User>;
    static deleteUser(id: string): Promise<void>;
    static getUsersByTenant(tenantId: string, limit?: number, offset?: number): Promise<User[]>;
    static getUsersByRole(role: string, limit?: number, offset?: number): Promise<User[]>;
    static updateLastLogin(id: string): Promise<void>;
    static updateKycStatus(id: string, kycStatus: KycStatus, kycLevel: KycLevel): Promise<User>;
    static activateUser(id: string): Promise<User>;
    static deactivateUser(id: string): Promise<User>;
    static verifyUser(id: string): Promise<User>;
    static getUserStats(tenantId?: string): Promise<{
        total: number;
        active: number;
        verified: number;
        byRole: Record<string, number>;
        byKycStatus: Record<string, number>;
    }>;
}
//# sourceMappingURL=user.d.ts.map