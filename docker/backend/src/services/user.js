"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("./database");
const logger_1 = require("./logger");
const utils_1 = require("../utils");
class UserService {
    static async createUser(userData) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const user = await UserModel.create(userData);
            logger_1.LoggerService.info('User created', { userId: user.id, email: user.email });
            return user.toJSON();
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to create user:', error);
            throw error;
        }
    }
    static async getUserById(id) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const user = await UserModel.findByPk(id);
            return user ? user.toJSON() : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get user by ID:', error);
            throw error;
        }
    }
    static async getUserByEmail(email) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const user = await UserModel.findOne({ where: { email } });
            return user ? user.toJSON() : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get user by email:', error);
            throw error;
        }
    }
    static async getUserByUsername(username) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const user = await UserModel.findOne({ where: { username } });
            return user ? user.toJSON() : null;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get user by username:', error);
            throw error;
        }
    }
    static async updateUser(id, updateData) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const [affectedRows] = await UserModel.update(updateData, { where: { id } });
            if (affectedRows === 0) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            const user = await this.getUserById(id);
            if (!user) {
                throw (0, utils_1.createError)('User not found after update', 404, 'USER_NOT_FOUND');
            }
            logger_1.LoggerService.info('User updated', { userId: id });
            return user;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update user:', error);
            throw error;
        }
    }
    static async deleteUser(id) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const affectedRows = await UserModel.destroy({ where: { id } });
            if (affectedRows === 0) {
                throw (0, utils_1.createError)('User not found', 404, 'USER_NOT_FOUND');
            }
            logger_1.LoggerService.info('User deleted', { userId: id });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to delete user:', error);
            throw error;
        }
    }
    static async getUsersByTenant(tenantId, limit = 50, offset = 0) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const users = await UserModel.findAll({
                where: { tenantId },
                limit,
                offset,
                order: [['createdAt', 'DESC']]
            });
            return users.map(user => user.toJSON());
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get users by tenant:', error);
            throw error;
        }
    }
    static async getUsersByRole(role, limit = 50, offset = 0) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const users = await UserModel.findAll({
                where: { role },
                limit,
                offset,
                order: [['createdAt', 'DESC']]
            });
            return users.map(user => user.toJSON());
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get users by role:', error);
            throw error;
        }
    }
    static async updateLastLogin(id) {
        try {
            await this.updateUser(id, { lastLoginAt: new Date() });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update last login:', error);
            throw error;
        }
    }
    static async updateKycStatus(id, kycStatus, kycLevel) {
        try {
            const user = await this.updateUser(id, { kycStatus, kycLevel });
            logger_1.LoggerService.logKYC(id, 'status_updated', { kycStatus, kycLevel });
            return user;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to update KYC status:', error);
            throw error;
        }
    }
    static async activateUser(id) {
        try {
            const user = await this.updateUser(id, { isActive: true });
            logger_1.LoggerService.info('User activated', { userId: id });
            return user;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to activate user:', error);
            throw error;
        }
    }
    static async deactivateUser(id) {
        try {
            const user = await this.updateUser(id, { isActive: false });
            logger_1.LoggerService.info('User deactivated', { userId: id });
            return user;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to deactivate user:', error);
            throw error;
        }
    }
    static async verifyUser(id) {
        try {
            const user = await this.updateUser(id, { isVerified: true });
            logger_1.LoggerService.info('User verified', { userId: id });
            return user;
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to verify user:', error);
            throw error;
        }
    }
    static async getUserStats(tenantId) {
        try {
            const UserModel = database_1.DatabaseService.getModel('User');
            const whereClause = tenantId ? { tenantId } : {};
            const [total, active, verified, byRole, byKycStatus] = await Promise.all([
                UserModel.count({ where: whereClause }),
                UserModel.count({ where: { ...whereClause, isActive: true } }),
                UserModel.count({ where: { ...whereClause, isVerified: true } }),
                UserModel.findAll({
                    attributes: ['role', [database_1.DatabaseService.getSequelize().fn('COUNT', '*'), 'count']],
                    where: whereClause,
                    group: ['role']
                }),
                UserModel.findAll({
                    attributes: ['kycStatus', [database_1.DatabaseService.getSequelize().fn('COUNT', '*'), 'count']],
                    where: whereClause,
                    group: ['kycStatus']
                })
            ]);
            const roleStats = byRole.reduce((acc, item) => {
                acc[item.role] = parseInt(item.dataValues.count);
                return acc;
            }, {});
            const kycStats = byKycStatus.reduce((acc, item) => {
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
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to get user stats:', error);
            throw error;
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.js.map