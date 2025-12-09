/**
 * Token Sale Routes - API endpoints for Token Sale Platform
 * 
 * Production-ready routes for:
 * - Presale Phase Management
 * - Investment Processing
 * - Vesting Management
 * - Statistics and Reporting
 * - Eligibility Checking
 */

import { Router, Request, Response } from 'express';
import { TokenSaleService } from '../services/token-sale';
import { LoggerService } from '../services/logger';
import { AppError } from '../utils';
import { authenticateToken, requireRole, validateRequest } from '../middleware/error-handler';
import Joi from 'joi';

const router: Router = Router();

// =============================================================================
// PRESALE PHASE MANAGEMENT ROUTES
// =============================================================================

/**
 * Create Presale Phase
 * POST /api/token-sale/phases
 */
router.post('/phases',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  validateRequest(Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().min(10).max(500).required(),
    phaseType: Joi.string().valid('PRIVATE', 'PUBLIC', 'COMMUNITY', 'INSTITUTIONAL').required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    tokenPrice: Joi.number().positive().required(),
    minInvestment: Joi.number().positive().required(),
    maxInvestment: Joi.number().positive().required(),
    totalTokensAllocated: Joi.number().positive().required(),
    kycLevelRequired: Joi.string().valid('L0', 'L1', 'L2', 'L3').required(),
    vestingScheduleId: Joi.string().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        description,
        phaseType,
        startDate,
        endDate,
        tokenPrice,
        minInvestment,
        maxInvestment,
        totalTokensAllocated,
        kycLevelRequired,
        vestingScheduleId
      } = req.body;

      LoggerService.info('Creating presale phase', {
        name,
        phaseType,
        tokenPrice,
        totalTokensAllocated
      });

      const phase = await TokenSaleService.createPresalePhase(
        name,
        description,
        phaseType,
        new Date(startDate),
        new Date(endDate),
        tokenPrice,
        minInvestment,
        maxInvestment,
        totalTokensAllocated,
        kycLevelRequired,
        vestingScheduleId
      );

      res.status(201).json({
        success: true,
        data: phase,
        message: 'Presale phase created successfully'
      });

    } catch (error) {
      LoggerService.error('Create presale phase failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get All Presale Phases
 * GET /api/token-sale/phases
 */
router.get('/phases',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Fetching presale phases');

      const { activeOnly } = req.query;
      const phases = await TokenSaleService.getPresalePhases(activeOnly === 'true');

      res.json({
        success: true,
        data: phases,
        count: phases.length
      });

    } catch (error) {
      LoggerService.error('Get presale phases failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Presale Phase Details
 * GET /api/token-sale/phases/:phaseId
 */
router.get('/phases/:phaseId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { phaseId } = req.params;

      LoggerService.info('Fetching presale phase details', {
        phaseId
      });

      if (!phaseId) {
        res.status(400).json({
          success: false,
          error: 'Phase ID is required'
        });
        return;
      }

      const phase = await TokenSaleService.getPresalePhase(phaseId);

      if (!phase) {
        res.status(404).json({
          success: false,
          error: 'Presale phase not found',
          code: 'PHASE_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: phase
      });

    } catch (error) {
      LoggerService.error('Get presale phase details failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// INVESTMENT PROCESSING ROUTES
// =============================================================================

/**
 * Process Investment
 * POST /api/token-sale/investments
 */
router.post('/investments',
  authenticateToken,
  validateRequest(Joi.object({
    phaseId: Joi.string().required(),
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    investmentAmountUSD: Joi.number().positive().required(),
    paymentMethod: Joi.string().valid('USDT', 'USDC', 'ETH', 'BTC', 'BANK_TRANSFER').required(),
    paymentTxHash: Joi.string().optional()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, brokerId, userId } = req.user as any;
      const {
        phaseId,
        walletAddress,
        investmentAmountUSD,
        paymentMethod,
        paymentTxHash
      } = req.body;

      LoggerService.info('Processing investment', {
        userId,
        tenantId,
        brokerId,
        phaseId,
        investmentAmountUSD,
        paymentMethod
      });

      const investment = await TokenSaleService.processInvestment(
        userId,
        tenantId,
        brokerId,
        phaseId,
        walletAddress,
        investmentAmountUSD,
        paymentMethod,
        paymentTxHash
      );

      res.status(201).json({
        success: true,
        data: investment,
        message: 'Investment processed successfully'
      });

    } catch (error) {
      LoggerService.error('Process investment failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Check Investment Eligibility
 * POST /api/token-sale/eligibility
 */
router.post('/eligibility',
  authenticateToken,
  validateRequest(Joi.object({
    phaseId: Joi.string().required(),
    investmentAmountUSD: Joi.number().positive().required()
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { phaseId, investmentAmountUSD } = req.body;

      LoggerService.info('Checking investment eligibility', {
        userId,
        phaseId,
        investmentAmountUSD
      });

      const eligibility = await TokenSaleService.checkInvestmentEligibility(
        userId,
        phaseId,
        investmentAmountUSD
      );

      res.json({
        success: true,
        data: eligibility
      });

    } catch (error) {
      LoggerService.error('Check investment eligibility failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get User Investments
 * GET /api/token-sale/investments
 */
router.get('/investments',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;
      const { phaseId, status } = req.query;

      LoggerService.info('Fetching user investments', {
        userId,
        phaseId,
        status
      });

      const investments = await TokenSaleService.getUserInvestments(
        userId,
        phaseId as string | undefined,
        status as any
      );

      res.json({
        success: true,
        data: investments,
        count: investments.length
      });

    } catch (error) {
      LoggerService.error('Get user investments failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Investment Details
 * GET /api/token-sale/investments/:investmentId
 */
router.get('/investments/:investmentId',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { investmentId } = req.params;
      const { userId } = req.user as any;

      LoggerService.info('Fetching investment details', {
        investmentId,
        userId
      });

      if (!investmentId) {
        res.status(400).json({
          success: false,
          error: 'Investment ID is required'
        });
        return;
      }

      const investment = await TokenSaleService.getInvestment(investmentId);

      if (!investment) {
        res.status(404).json({
          success: false,
          error: 'Investment not found',
          code: 'INVESTMENT_NOT_FOUND'
        });
        return;
      }

      // Verify investment belongs to user
      if (investment.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      res.json({
        success: true,
        data: investment
      });

    } catch (error) {
      LoggerService.error('Get investment details failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// STATISTICS AND REPORTING ROUTES
// =============================================================================

/**
 * Get Token Sale Statistics
 * GET /api/token-sale/stats
 */
router.get('/stats',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Fetching token sale statistics');

      const stats = await TokenSaleService.getTokenSaleStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      LoggerService.error('Get token sale stats failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get Phase Statistics
 * GET /api/token-sale/phases/:phaseId/stats
 */
router.get('/phases/:phaseId/stats',
  authenticateToken,
  requireRole(['platform-admin', 'broker-admin']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { phaseId } = req.params;

      LoggerService.info('Fetching phase statistics', {
        phaseId
      });

      if (!phaseId) {
        res.status(400).json({
          success: false,
          error: 'Phase ID is required'
        });
        return;
      }

      const stats = await TokenSaleService.getPhaseStats(phaseId);

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Presale phase not found',
          code: 'PHASE_NOT_FOUND'
        });
        return;
      }

      // Calculate average investment
      const averageInvestment = stats.investments > 0 
        ? stats.usdRaised / stats.investments 
        : 0;

      res.json({
        success: true,
        data: {
          ...stats,
          averageInvestment
        }
      });

    } catch (error) {
      LoggerService.error('Get phase stats failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// VESTING MANAGEMENT ROUTES
// =============================================================================

/**
 * Get Vesting Schedules
 * GET /api/token-sale/vesting/schedules
 */
router.get('/vesting/schedules',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      LoggerService.info('Fetching vesting schedules');

      const { activeOnly } = req.query;
      const schedules = await TokenSaleService.getVestingSchedules(activeOnly === 'true');

      res.json({
        success: true,
        data: schedules,
        count: schedules.length
      });

    } catch (error) {
      LoggerService.error('Get vesting schedules failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

/**
 * Get User Vesting Entries
 * GET /api/token-sale/vesting/entries
 */
router.get('/vesting/entries',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.user as any;

      LoggerService.info('Fetching user vesting entries', {
        userId
      });

      const entries = await TokenSaleService.getUserVestingEntries(userId);

      res.json({
        success: true,
        data: entries,
        count: entries.length
      });

    } catch (error) {
      LoggerService.error('Get user vesting entries failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  }
);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Token Sale Service Health Check
 * GET /api/token-sale/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = TokenSaleService.isHealthy();
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'Token Sale Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.error('Token sale health check failed:', error);
    res.status(503).json({
      success: false,
      service: 'Token Sale Service',
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
