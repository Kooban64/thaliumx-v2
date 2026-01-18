/**
 * Multi-Platform Launch Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { MultiPlatformLaunchService, PlatformLaunch, LaunchPlan } from '../services/multi-platform-launch';
import { LoggerService } from '../services/logger';
import Joi from 'joi';

const router: Router = Router();

// Validation schemas
const createLaunchSchema = Joi.object({
  platformType: Joi.string().valid('dex', 'cex', 'aggregator', 'bridge').required(),
  platformName: Joi.string().required(),
  platformId: Joi.string().optional(),
  status: Joi.string().valid('planned', 'pending', 'approved', 'active', 'paused', 'completed', 'cancelled').optional(),
  chainId: Joi.number().required(),
  tokenAddress: Joi.string().required(),
  liquidityAmount: Joi.number().optional(),
  fees: Joi.object({
    listingFee: Joi.number().optional(),
    liquidityFee: Joi.number().optional(),
    totalCost: Joi.number().optional()
  }).optional(),
  requirements: Joi.object({
    minLiquidity: Joi.number().optional(),
    minTradingVolume: Joi.number().optional(),
    kycRequired: Joi.boolean().optional(),
    auditRequired: Joi.boolean().optional()
  }).optional(),
  metadata: Joi.object().optional()
});

const updateLaunchSchema = Joi.object({
  status: Joi.string().valid('planned', 'pending', 'approved', 'active', 'paused', 'completed', 'cancelled').optional(),
  pairAddress: Joi.string().optional(),
  liquidityAmount: Joi.number().optional(),
  launchDate: Joi.date().optional(),
  launchUrl: Joi.string().uri().optional(),
  fees: Joi.object().optional(),
  requirements: Joi.object().optional(),
  metadata: Joi.object().optional()
});

/**
 * GET /api/multi-platform-launch/launches
 * Get all platform launches
 */
router.get('/launches',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await MultiPlatformLaunchService.initialize();
      const launches = MultiPlatformLaunchService.getLaunches();
      
      res.json({
        success: true,
        data: launches
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/multi-platform-launch/launches/recommended
 * Get recommended platforms (cheap/free first)
 */
router.get('/launches/recommended',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await MultiPlatformLaunchService.initialize();
      const recommended = MultiPlatformLaunchService.getRecommendedPlatforms();
      
      res.json({
        success: true,
        data: recommended
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/multi-platform-launch/launches/:launchId
 * Get launch by ID
 */
router.get('/launches/:launchId',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const launchId = req.params.launchId;
      if (!launchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Launch ID is required' }
        });
      }

      const launch = MultiPlatformLaunchService.getLaunch(launchId);
      
      if (!launch) {
        return res.status(404).json({
          success: false,
          error: { code: 'LAUNCH_NOT_FOUND', message: 'Launch not found' }
        });
      }
      
      return res.json({
        success: true,
        data: launch
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/multi-platform-launch/launches
 * Create a new platform launch
 */
router.post('/launches',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = createLaunchSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0]?.message || 'Validation error' }
        });
      }

      await MultiPlatformLaunchService.initialize();
      const launch = await MultiPlatformLaunchService.createLaunch(value as Omit<PlatformLaunch, 'id' | 'createdAt' | 'updatedAt'>);
      
      return res.status(201).json({
        success: true,
        data: launch
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PUT /api/multi-platform-launch/launches/:launchId
 * Update platform launch
 */
router.put('/launches/:launchId',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const launchId = req.params.launchId;
      if (!launchId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Launch ID is required' }
        });
      }

      const { error, value } = updateLaunchSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0]?.message || 'Validation error' }
        });
      }

      await MultiPlatformLaunchService.initialize();
      const updated = await MultiPlatformLaunchService.updateLaunch(launchId, value);
      
      return res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/multi-platform-launch/status
 * Get launch status summary
 */
router.get('/status',
  authenticateToken,
  requireRole(['admin', 'super_admin', 'platform-admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await MultiPlatformLaunchService.initialize();
      const summary = MultiPlatformLaunchService.getStatusSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
