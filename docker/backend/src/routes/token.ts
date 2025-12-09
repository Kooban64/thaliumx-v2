/**
 * Token Routes
 * 
 * REST API endpoints for token operations:
 * - Token wallet management
 * - P2P transfers
 * - Staking operations
 * - Token sales
 * - Transaction history
 * 
 * Production-ready with comprehensive validation
 */

import { Router, Request, Response } from 'express';
import { TokenService } from '../services/token';
import { LoggerService } from '../services/logger';
import { authenticateToken } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { AppError, createError } from '../utils';

const router: Router = Router();

// =============================================================================
// WALLET MANAGEMENT
// =============================================================================

/**
 * Create token wallet
 * POST /api/token/wallets
 */
router.post('/wallets', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { tokenSymbol, tokenAddress } = req.body;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const wallet = await TokenService.createWallet(userId, tenantId, tokenSymbol, tokenAddress);
    
    LoggerService.info('Token wallet created via API', { 
      walletId: wallet.id, 
      userId, 
      tokenSymbol 
    });
    
    res.status(201).json({
      success: true,
      data: wallet,
      message: 'Token wallet created successfully'
    });
  } catch (error) {
    LoggerService.error('Wallet creation API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

/**
 * Get user token wallets
 * GET /api/token/wallets
 */
router.get('/wallets', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const wallets = await TokenService.getUserWallets(userId, tenantId);
    
    res.json({
      success: true,
      data: wallets
    });
  } catch (error) {
    LoggerService.error('Get wallets API error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * Get specific token wallet
 * GET /api/token/wallets/:tokenSymbol
 */
router.get('/wallets/:tokenSymbol', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { tokenSymbol } = req.params;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    if (!tokenSymbol) {
      res.status(400).json({
        success: false,
        error: 'Token symbol is required'
      });
      return;
    }
    
    const wallet = await TokenService.getWallet(userId, tenantId, tokenSymbol);
    
    if (!wallet) {
      throw createError('Token wallet not found', 404, 'WALLET_NOT_FOUND');
    }
    
    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    LoggerService.error('Get wallet API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

// =============================================================================
// TRANSFERS
// =============================================================================

/**
 * Transfer tokens to another user
 * POST /api/token/transfers
 */
router.post('/transfers', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const fromUserId = req.user?.userId;
    const fromTenantId = req.user?.tenantId;
    const { toUserId, toTenantId, tokenSymbol, amount, description } = req.body;
    
    if (!fromUserId || !fromTenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    // Prevent self-transfer
    if (fromUserId === toUserId && fromTenantId === toTenantId) {
      throw createError('Cannot transfer to yourself', 400, 'SELF_TRANSFER_NOT_ALLOWED');
    }
    
    const transaction = await TokenService.transfer(fromUserId, fromTenantId, toUserId, toTenantId, tokenSymbol, amount, description);
    
    LoggerService.info('Token transfer initiated via API', { 
      transactionId: transaction.id, 
      fromUserId, 
      toUserId, 
      amount, 
      tokenSymbol 
    });
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transfer initiated successfully'
    });
  } catch (error) {
    LoggerService.error('Transfer API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

// =============================================================================
// STAKING
// =============================================================================

/**
 * Get staking pools
 * GET /api/token/staking/pools
 */
router.get('/staking/pools', async (req: Request, res: Response): Promise<void> => {
  try {
    const pools = await TokenService.getStakingPools();
    
    res.json({
      success: true,
      data: pools
    });
  } catch (error) {
    LoggerService.error('Get staking pools API error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * Stake tokens
 * POST /api/token/staking/stake
 */
router.post('/staking/stake', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { tokenSymbol, amount, poolId } = req.body;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const transaction = await TokenService.stake(userId, tenantId, tokenSymbol, amount, poolId);
    
    LoggerService.info('Token staking initiated via API', { 
      transactionId: transaction.id, 
      userId, 
      amount, 
      tokenSymbol,
      poolId
    });
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Staking initiated successfully'
    });
  } catch (error) {
    LoggerService.error('Staking API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

/**
 * Unstake tokens
 * POST /api/token/staking/unstake
 */
router.post('/staking/unstake', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { positionId } = req.body;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const transaction = await TokenService.unstake(userId, tenantId, positionId);
    
    LoggerService.info('Token unstaking initiated via API', { 
      transactionId: transaction.id, 
      userId, 
      positionId
    });
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Unstaking initiated successfully'
    });
  } catch (error) {
    LoggerService.error('Unstaking API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

/**
 * Get user staking positions
 * GET /api/token/staking/positions
 */
router.get('/staking/positions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const positions = await TokenService.getUserStakingPositions(userId, tenantId);
    
    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    LoggerService.error('Get staking positions API error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

// =============================================================================
// TOKEN SALES
// =============================================================================

/**
 * Get active token sales
 * GET /api/token/sales
 */
router.get('/sales', async (req: Request, res: Response): Promise<void> => {
  try {
    const sales = await TokenService.getActiveTokenSales();
    
    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    LoggerService.error('Get token sales API error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * Purchase tokens
 * POST /api/token/sales/:saleId/purchase
 */
router.post('/sales/:saleId/purchase', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { saleId } = req.params;
    const { amount, paymentMethod } = req.body;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    if (!saleId) {
      res.status(400).json({
        success: false,
        error: 'Sale ID is required'
      });
      return;
    }
    
    const transaction = await TokenService.purchaseTokens(userId, tenantId, saleId, amount, paymentMethod);
    
    LoggerService.info('Token purchase initiated via API', { 
      transactionId: transaction.id, 
      userId, 
      saleId,
      amount
    });
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Token purchase initiated successfully'
    });
  } catch (error) {
    LoggerService.error('Token purchase API error:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  }
});

// =============================================================================
// TRANSACTION HISTORY
// =============================================================================

/**
 * Get transaction history
 * GET /api/token/transactions
 */
router.get('/transactions', authenticateToken, validateRequest, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { tokenSymbol, limit, offset } = req.query;
    
    if (!userId || !tenantId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    const transactions = await TokenService.getTransactionHistory(
      userId, 
      tenantId, 
      tokenSymbol as string, 
      Number(limit) || 50, 
      Number(offset) || 0
    );
    
    res.json({
      success: true,
      data: {
        transactions,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0
      }
    });
  } catch (error) {
    LoggerService.error('Get transactions API error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Token service health check
 * GET /api/token/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'token',
        timestamp: new Date(),
        features: {
          walletManagement: 'active',
          transfers: 'active',
          staking: 'active',
          tokenSales: 'active',
          gasFeeIntegration: 'active',
          multiTenantSupport: 'active'
        }
      }
    });
  } catch (error) {
    LoggerService.error('Token health check error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Token service unhealthy',
        code: 'SERVICE_UNHEALTHY'
      }
    });
  }
});

export default router;
