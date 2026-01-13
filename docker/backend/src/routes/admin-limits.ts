/**
 * Admin Limit Management Routes
 * 
 * Express router for managing transaction limits dynamically.
 * 
 * Endpoints:
 * - GET /limits/kyc - Get all KYC level limits
 * - GET /limits/kyc/:level - Get KYC limits for specific level
 * - PUT /limits/kyc/:level - Update KYC limits
 * - GET /limits/roles - Get all role limits
 * - GET /limits/roles/:role - Get role limits
 * - PUT /limits/roles/:role - Update role limits
 * - GET /limits/users/:userId - Get user overrides
 * - POST /limits/users/:userId/override - Create user override
 * - DELETE /limits/users/:userId/override/:id - Delete user override
 * - GET /limits/history - Get limit change history
 * - POST /limits/validate - Validate limit changes
 * 
 * Security:
 * - All routes require authentication
 * - Admin/super_admin role required
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import type { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database';
import { Op } from 'sequelize';
import { NotificationService } from '../services/notification';

const router: Router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

// KYC Level Limits
router.get('/limits/kyc', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const LimitModel: any = DatabaseService.getModel('Limit');
    if (!LimitModel) {
      res.json({
        success: true,
        data: {
          L0: {},
          L1: {},
          L2: {},
          L3: {},
          INSTITUTIONAL: {},
        },
        timestamp: new Date(),
      });
      return;
    }

    const limits = await LimitModel.findAll({
      where: { type: 'kyc' },
    });

    const result: Record<string, any> = {
      L0: {},
      L1: {},
      L2: {},
      L3: {},
      INSTITUTIONAL: {},
    };

    limits.forEach((limit: any) => {
      const level = limit.level || 'L0';
      result[level] = limit.config || {};
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/limits/kyc/:level', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { level } = req.params;
    const LimitModel: any = DatabaseService.getModel('Limit');
    
    if (!LimitModel) {
      res.json({
        success: true,
        data: {},
        timestamp: new Date(),
      });
      return;
    }

    const limit = await LimitModel.findOne({
      where: { type: 'kyc', level },
    });

    res.json({
      success: true,
      data: limit?.config || {},
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/limits/kyc/:level', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { level } = req.params;
    const limits = req.body;
    const user = (req as any).user;

    const LimitModel: any = DatabaseService.getModel('Limit');
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');

    if (LimitModel) {
      const [limit] = await LimitModel.findOrCreate({
        where: { type: 'kyc', level },
        defaults: { config: {} },
      });

      const oldConfig = limit.config || {};
      await limit.update({ config: limits });

      // Log change
      const changes = Object.keys(limits).reduce((acc, key) => {
        if (oldConfig[key] !== limits[key]) {
          acc[key] = { before: oldConfig[key], after: limits[key] };
        }
        return acc;
      }, {} as Record<string, any>);

      if (AuditLogModel) {
        await AuditLogModel.create({
          action: 'limit_updated',
          resourceType: 'limit',
          resourceId: limit.id,
          userId: user.id || user.userId,
          metadata: {
            type: 'kyc',
            level,
            changes,
          },
        });
      }

      // Notify affected users
      if (Object.keys(changes).length > 0) {
        const affectedUsers = await NotificationService.getAffectedUsers('kyc', level as string);
        if (affectedUsers.length > 0) {
          await NotificationService.notifyLimitChange('kyc', level as string, affectedUsers, changes);
        }
      }
    }

    res.json({
      success: true,
      data: limits,
      message: `KYC limits for ${level} updated successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// Role Limits
router.get('/limits/roles', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const LimitModel: any = DatabaseService.getModel('Limit');
    
    if (!LimitModel) {
      res.json({
        success: true,
        data: {},
        timestamp: new Date(),
      });
      return;
    }

    const limits = await LimitModel.findAll({
      where: { type: 'role' },
    });

    const result: Record<string, any> = {};
    limits.forEach((limit: any) => {
      result[limit.role] = limit.config || {};
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/limits/roles/:role', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role } = req.params;
    const LimitModel: any = DatabaseService.getModel('Limit');
    
    if (!LimitModel) {
      res.json({
        success: true,
        data: {},
        timestamp: new Date(),
      });
      return;
    }

    const limit = await LimitModel.findOne({
      where: { type: 'role', role },
    });

    res.json({
      success: true,
      data: limit?.config || {},
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/limits/roles/:role', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role } = req.params;
    const limits = req.body;
    const user = (req as any).user;

    const LimitModel: any = DatabaseService.getModel('Limit');
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');

    if (LimitModel) {
      const [limit] = await LimitModel.findOrCreate({
        where: { type: 'role', role },
        defaults: { config: {} },
      });

      const oldConfig = limit.config || {};
      await limit.update({ config: limits });

      // Log change
      const changes = Object.keys(limits).reduce((acc, key) => {
        if (oldConfig[key] !== limits[key]) {
          acc[key] = { before: oldConfig[key], after: limits[key] };
        }
        return acc;
      }, {} as Record<string, any>);

      if (AuditLogModel) {
        await AuditLogModel.create({
          action: 'limit_updated',
          resourceType: 'limit',
          resourceId: limit.id,
          userId: user.id || user.userId,
          metadata: {
            type: 'role',
            role,
            changes,
          },
        });
      }

      // Notify affected users
      if (Object.keys(changes).length > 0) {
        const affectedUsers = await NotificationService.getAffectedUsers('role', role as string);
        if (affectedUsers.length > 0) {
          await NotificationService.notifyLimitChange('role', role as string, affectedUsers, changes);
        }
      }
    }

    res.json({
      success: true,
      data: limits,
      message: `Role limits for ${role} updated successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// User Overrides
router.get('/limits/users/:userId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const UserOverrideModel: any = DatabaseService.getModel('UserLimitOverride');
    
    if (!UserOverrideModel) {
      res.json({
        success: true,
        data: [],
        timestamp: new Date(),
      });
      return;
    }

    const overrides = await UserOverrideModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: overrides.map((o: any) => o.toJSON()),
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/limits/users/:userId/override', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { type, limits, expiresAt, reason } = req.body;
    const user = (req as any).user;

    const UserOverrideModel: any = DatabaseService.getModel('UserLimitOverride');
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');

    if (!UserOverrideModel) {
      res.status(501).json({
        success: false,
        error: 'User override model not available',
        timestamp: new Date(),
      });
      return;
    }

    const override = await UserOverrideModel.create({
      userId,
      type,
      limits,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reason,
      approvedBy: user.id || user.userId,
      approvedAt: new Date(),
    });

    // Log change
    if (AuditLogModel) {
      await AuditLogModel.create({
        action: 'user_override_created',
        resourceType: 'user_override',
        resourceId: override.id,
        userId: user.id || user.userId,
        metadata: {
          targetUserId: userId,
          type,
          limits,
        },
      });
    }

    // Notify user about override
    await NotificationService.sendNotification({
      userId,
      title: 'Limit Override Applied',
      message: `A ${type} limit override has been applied to your account. Reason: ${reason}`,
      type: 'info',
      channels: ['inapp', 'email'],
      metadata: {
        overrideId: override.id,
        type,
        limits,
      },
    });

    res.json({
      success: true,
      data: override.toJSON(),
      message: 'User override created successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/limits/users/:userId/override/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, id } = req.params;
    const user = (req as any).user;

    const UserOverrideModel: any = DatabaseService.getModel('UserLimitOverride');
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');

    if (!UserOverrideModel) {
      res.status(501).json({
        success: false,
        error: 'User override model not available',
        timestamp: new Date(),
      });
      return;
    }

    const override = await UserOverrideModel.findOne({
      where: { id, userId },
    });

    if (!override) {
      res.status(404).json({
        success: false,
        error: 'Override not found',
        timestamp: new Date(),
      });
      return;
    }

    await override.destroy();

    // Log change
    if (AuditLogModel) {
      await AuditLogModel.create({
        action: 'user_override_deleted',
        resourceType: 'user_override',
        resourceId: id,
        userId: user.id || user.userId,
        metadata: {
          targetUserId: userId,
        },
      });
    }

    res.json({
      success: true,
      message: 'User override deleted successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// Limit History
router.get('/limits/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, target, startDate, endDate, page = 1, limit = 20 } = req.query;
    const AuditLogModel: any = DatabaseService.getModel('AuditLog');

    if (!AuditLogModel) {
      res.json({
        success: true,
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0,
        },
        timestamp: new Date(),
      });
      return;
    }

    const where: any = {
      action: { [Op.in]: ['limit_updated', 'user_override_created', 'user_override_deleted'] },
    };

    if (type) {
      where['metadata.type'] = type;
    }

    if (target) {
      where[Op.or] = [
        { 'metadata.level': target },
        { 'metadata.role': target },
        { 'metadata.targetUserId': target },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate as string);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate as string);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await AuditLogModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    const history = rows.map((log: any) => {
      const metadata = log.metadata || {};
      return {
        id: log.id,
        type: metadata.type || 'unknown',
        target: metadata.level || metadata.role || metadata.targetUserId || 'unknown',
        changes: metadata.changes || {},
        changedBy: log.userId,
        changedAt: log.createdAt,
        reason: metadata.reason,
      };
    });

    res.json({
      success: true,
      data: history,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / Number(limit)),
        hasNext: offset + Number(limit) < count,
        hasPrev: Number(page) > 1,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// Limit Validation
router.post('/limits/validate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, target, limits } = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    Object.entries(limits).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 0) {
        errors.push(`${key} must be a positive number`);
      }
      if (typeof value === 'number' && value > 1000000000) {
        warnings.push(`${key} is very large (${value.toLocaleString()})`);
      }
    });

    // Check limit hierarchy (KYC levels should increase)
    if (type === 'kyc') {
      const levelOrder = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'];
      const currentIndex = levelOrder.indexOf(target);
      if (currentIndex > 0) {
        // Could check against previous level limits
        warnings.push(`Consider checking limits are higher than ${levelOrder[currentIndex - 1]}`);
      }
    }

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
