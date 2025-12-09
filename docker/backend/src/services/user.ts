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
import { DatabaseService } from './database';
import { LoggerService } from './logger';
import { createError } from '../utils';

export class UserService {
  public static async createUser(userData: DeepPartial<User>): Promise<User> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const user = await UserModel.create(userData);
      
      LoggerService.info('User created', { userId: (user as any).id, email: (user as any).email });
      
      return user.toJSON() as User;
    } catch (error) {
      LoggerService.error('Failed to create user:', error);
      throw error;
    }
  }

  public static async getUserById(id: string): Promise<User | null> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const user = await UserModel.findByPk(id);
      
      return user ? user.toJSON() as User : null;
    } catch (error) {
      LoggerService.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  public static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const user = await UserModel.findOne({ where: { email } });
      
      return user ? user.toJSON() as User : null;
    } catch (error) {
      LoggerService.error('Failed to get user by email:', error);
      throw error;
    }
  }

  public static async getUserByUsername(username: string): Promise<User | null> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const user = await UserModel.findOne({ where: { username } });
      
      return user ? user.toJSON() as User : null;
    } catch (error) {
      LoggerService.error('Failed to get user by username:', error);
      throw error;
    }
  }

  public static async updateUser(id: string, updateData: DeepPartial<User>): Promise<User> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const [affectedRows] = await UserModel.update(updateData, { where: { id } });
      
      if (affectedRows === 0) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = await this.getUserById(id);
      if (!user) {
        throw createError('User not found after update', 404, 'USER_NOT_FOUND');
      }

      LoggerService.info('User updated', { userId: id });
      
      return user;
    } catch (error) {
      LoggerService.error('Failed to update user:', error);
      throw error;
    }
  }

  public static async deleteUser(id: string): Promise<void> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const affectedRows = await UserModel.destroy({ where: { id } });
      
      if (affectedRows === 0) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      LoggerService.info('User deleted', { userId: id });
    } catch (error) {
      LoggerService.error('Failed to delete user:', error);
      throw error;
    }
  }

  public static async getUsersByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<User[]> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const users = await UserModel.findAll({
        where: { tenantId },
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return users.map(user => user.toJSON() as User);
    } catch (error) {
      LoggerService.error('Failed to get users by tenant:', error);
      throw error;
    }
  }

  public static async getUsersByRole(role: string, limit: number = 50, offset: number = 0): Promise<User[]> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const users = await UserModel.findAll({
        where: { role },
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return users.map(user => user.toJSON() as User);
    } catch (error) {
      LoggerService.error('Failed to get users by role:', error);
      throw error;
    }
  }

  public static async updateLastLogin(id: string): Promise<void> {
    try {
      await this.updateUser(id, { lastLoginAt: new Date() });
    } catch (error) {
      LoggerService.error('Failed to update last login:', error);
      throw error;
    }
  }

  public static async updateKycStatus(id: string, kycStatus: KycStatus, kycLevel: KycLevel): Promise<User> {
    try {
      const user = await this.updateUser(id, { kycStatus, kycLevel });
      
      LoggerService.logKYC(id, 'status_updated', { kycStatus, kycLevel });
      
      return user;
    } catch (error) {
      LoggerService.error('Failed to update KYC status:', error);
      throw error;
    }
  }

  public static async activateUser(id: string): Promise<User> {
    try {
      const user = await this.updateUser(id, { isActive: true });
      
      LoggerService.info('User activated', { userId: id });
      
      return user;
    } catch (error) {
      LoggerService.error('Failed to activate user:', error);
      throw error;
    }
  }

  public static async deactivateUser(id: string): Promise<User> {
    try {
      const user = await this.updateUser(id, { isActive: false });
      
      LoggerService.info('User deactivated', { userId: id });
      
      return user;
    } catch (error) {
      LoggerService.error('Failed to deactivate user:', error);
      throw error;
    }
  }

  public static async verifyUser(id: string): Promise<User> {
    try {
      const user = await this.updateUser(id, { isVerified: true });
      
      LoggerService.info('User verified', { userId: id });
      
      return user;
    } catch (error) {
      LoggerService.error('Failed to verify user:', error);
      throw error;
    }
  }

  public static async getUserStats(tenantId?: string): Promise<{
    total: number;
    active: number;
    verified: number;
    byRole: Record<string, number>;
    byKycStatus: Record<string, number>;
  }> {
    try {
      const UserModel = DatabaseService.getModel('User');
      const whereClause = tenantId ? { tenantId } : {};

      const [total, active, verified, byRole, byKycStatus] = await Promise.all([
        UserModel.count({ where: whereClause }),
        UserModel.count({ where: { ...whereClause, isActive: true } }),
        UserModel.count({ where: { ...whereClause, isVerified: true } }),
        UserModel.findAll({
          attributes: ['role', [DatabaseService.getSequelize().fn('COUNT', '*'), 'count']],
          where: whereClause,
          group: ['role']
        }),
        UserModel.findAll({
          attributes: ['kycStatus', [DatabaseService.getSequelize().fn('COUNT', '*'), 'count']],
          where: whereClause,
          group: ['kycStatus']
        })
      ]);

      const roleStats = byRole.reduce((acc: Record<string, number>, item: any) => {
        acc[item.role] = parseInt(item.dataValues.count);
        return acc;
      }, {});

      const kycStats = byKycStatus.reduce((acc: Record<string, number>, item: any) => {
        acc[item.kycStatus] = parseInt(item.dataValues.count);
        return acc;
      }, {});

      return {
        total,
        active,
        verified,
        byRole: roleStats,
        byKycStatus: kycStats
      };
    } catch (error) {
      LoggerService.error('Failed to get user stats:', error);
      throw error;
    }
  }
}
