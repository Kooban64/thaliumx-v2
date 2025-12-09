/**
 * Presale Routes
 * 
 * API endpoints for Presale Service:
 * - Presale Management
 * - Investment Processing
 * - Whitelist Management
 * - Referral Programs
 * - Statistics and Analytics
 * - Compliance Monitoring
 * - Vesting Management
 */

import { Router } from 'express';
import { PresaleService } from '../services/presale';
import { WalletSystemService } from '../services/wallet-system';
import { DatabaseService } from '../services/database';
import { IdempotencyService } from '../services/idempotency';
import { SmartContractService } from '../services/smart-contracts';
import { Web3WalletService } from '../services/web3-wallet';
import { authenticateToken, requireRole } from '../middleware/error-handler';
import { validateRequest } from '../middleware/error-handler';
import Joi from 'joi';
import { Decimal } from 'decimal.js';
import { LoggerService } from '../services/logger';
import { ethers, Wallet } from 'ethers';
import { ConfigService } from '../services/config';
import { getContractAddresses } from '../contracts/addresses/testnet';

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createPresaleSchema = Joi.object({
  name: Joi.string().required(),
  symbol: Joi.string().required(),
  description: Joi.string().required(),
  phase: Joi.string().valid('private', 'public', 'community', 'institutional').required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  tokenPrice: Joi.number().positive().required(),
  totalSupply: Joi.number().positive().required(),
  availableSupply: Joi.number().positive().required(),
  minInvestment: Joi.number().positive().required(),
  maxInvestment: Joi.number().positive().required(),
  softCap: Joi.number().positive().required(),
  hardCap: Joi.number().positive().required(),
  tiers: Joi.array().items(Joi.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond')).required(),
  vestingSchedule: Joi.object({
    type: Joi.string().valid('linear', 'cliff', 'custom').required(),
    cliffPeriod: Joi.number().min(0).required(),
    vestingPeriod: Joi.number().positive().required(),
    releaseFrequency: Joi.number().positive().required(),
    description: Joi.string().required()
  }).required(),
  whitelistRequired: Joi.boolean().required(),
  kycRequired: Joi.boolean().required(),
  referralEnabled: Joi.boolean().required(),
  bonusEnabled: Joi.boolean().required(),
  metadata: Joi.object({
    website: Joi.string().uri().required(),
    whitepaper: Joi.string().uri().required(),
    socialMedia: Joi.object({
      twitter: Joi.string().uri().optional(),
      telegram: Joi.string().uri().optional(),
      discord: Joi.string().uri().optional(),
      linkedin: Joi.string().uri().optional()
    }).required(),
    team: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      role: Joi.string().required(),
      bio: Joi.string().required(),
      linkedin: Joi.string().uri().optional(),
      twitter: Joi.string().uri().optional(),
      avatar: Joi.string().uri().optional()
    })).required(),
    advisors: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      expertise: Joi.string().required(),
      bio: Joi.string().required(),
      linkedin: Joi.string().uri().optional(),
      avatar: Joi.string().uri().optional()
    })).required(),
    partners: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      description: Joi.string().required(),
      logo: Joi.string().uri().optional(),
      website: Joi.string().uri().optional()
    })).required(),
    roadmap: Joi.array().items(Joi.object({
      quarter: Joi.string().required(),
      title: Joi.string().required(),
      description: Joi.string().required(),
      status: Joi.string().valid('completed', 'in-progress', 'upcoming').required()
    })).required(),
    tokenomics: Joi.object({
      totalSupply: Joi.number().positive().required(),
      presaleAllocation: Joi.number().positive().required(),
      teamAllocation: Joi.number().positive().required(),
      advisorAllocation: Joi.number().positive().required(),
      marketingAllocation: Joi.number().positive().required(),
      liquidityAllocation: Joi.number().positive().required(),
      treasuryAllocation: Joi.number().positive().required(),
      vestingSchedules: Joi.object({
        team: Joi.object({
          type: Joi.string().valid('linear', 'cliff', 'custom').required(),
          cliffPeriod: Joi.number().min(0).required(),
          vestingPeriod: Joi.number().positive().required(),
          releaseFrequency: Joi.number().positive().required(),
          description: Joi.string().required()
        }).required(),
        advisor: Joi.object({
          type: Joi.string().valid('linear', 'cliff', 'custom').required(),
          cliffPeriod: Joi.number().min(0).required(),
          vestingPeriod: Joi.number().positive().required(),
          releaseFrequency: Joi.number().positive().required(),
          description: Joi.string().required()
        }).required(),
        marketing: Joi.object({
          type: Joi.string().valid('linear', 'cliff', 'custom').required(),
          cliffPeriod: Joi.number().min(0).required(),
          vestingPeriod: Joi.number().positive().required(),
          releaseFrequency: Joi.number().positive().required(),
          description: Joi.string().required()
        }).required()
      }).required()
    }).required(),
    legal: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      version: Joi.string().required(),
      lastUpdated: Joi.date().required()
    })).required()
  }).required()
});

const makeInvestmentSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().messages({
    'string.pattern.base': 'Invalid Ethereum address format'
  }),
  presaleId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('USDT', 'USDC', 'ETH', 'BTC', 'BANK_TRANSFER', 'CREDIT_CARD').required(),
  tier: Joi.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond').required(),
  referralCode: Joi.string().optional()
});

const addToWhitelistSchema = Joi.object({
  presaleId: Joi.string().required(),
  userId: Joi.string().required(),
  email: Joi.string().email().required(),
  walletAddress: Joi.string().required(),
  tier: Joi.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond').required(),
  maxInvestment: Joi.number().positive().required(),
  kycLevel: Joi.string().required()
});

const approveWhitelistSchema = Joi.object({
  entryId: Joi.string().required(),
  reason: Joi.string().optional()
});

// =============================================================================
// PRESALE MANAGEMENT ROUTES
// =============================================================================

/**
 * POST /api/presale/presales
 * Create a new presale
 */
router.post('/presales', authenticateToken, requireRole(['admin', 'presale_manager']), validateRequest(createPresaleSchema), async (req, res) => {
  try {
    const presale = await PresaleService.createPresale(req.body);
    
    res.status(201).json({
      success: true,
      data: presale,
      message: 'Presale created successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to create presale:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'PRESALE_CREATION_FAILED',
        message: 'Failed to create presale'
      }
    });
  }
});

/**
 * GET /api/presale/presales
 * Get all presales
 */
router.get('/presales', authenticateToken, async (req, res) => {
  try {
    const presales = await PresaleService.getAllPresales();
    
    res.json({
      success: true,
      data: presales,
      count: presales.length
    });
  } catch (error) {
    LoggerService.error('Failed to get presales:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get presales'
      }
    });
  }
});

/**
 * GET /api/presale/presales/:id
 * Get specific presale
 */
router.get('/presales/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Presale ID is required'
      });
      return;
    }
    
    const presale = await PresaleService.getPresale(id);
    
    res.json({
      success: true,
      data: presale
    });
  } catch (error) {
    LoggerService.error('Failed to get presale:', error);
    res.status(404).json({
      success: false,
      error: {
        code: 'PRESALE_NOT_FOUND',
        message: 'Presale not found'
      }
    });
  }
});

/**
 * PUT /api/presale/presales/:id
 * Update presale
 */
router.put('/presales/:id', authenticateToken, requireRole(['admin', 'presale_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Presale ID is required'
      });
      return;
    }
    
    const presale = await PresaleService.updatePresale(id, req.body);
    
    res.json({
      success: true,
      data: presale,
      message: 'Presale updated successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to update presale:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'PRESALE_UPDATE_FAILED',
        message: 'Failed to update presale'
      }
    });
  }
});

// =============================================================================
// INVESTMENT ROUTES
// =============================================================================

/**
 * POST /api/presale/investments
 * Make an investment
 */
router.post('/investments', authenticateToken, validateRequest(makeInvestmentSchema), async (req, res): Promise<void> => {
  try {
    const { presaleId, amount, paymentMethod, tier, referralCode, walletAddress } = req.body;
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId || 'thaliumx-tenant';
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'TENANT_REQUIRED', message: 'Tenant context is required' } });
      return;
    }
    // Optional realm validation if present in token
    const tokenRealm = (req as any).user?.realm;
    if (tokenRealm && typeof tokenRealm === 'string') {
      const expectedRealm = tenantId === 'thaliumx-tenant' ? 'thaliumx-tenant' : tenantId;
      if (tokenRealm !== expectedRealm) {
        res.status(403).json({ success: false, error: { code: 'REALM_MISMATCH', message: 'Invalid realm for tenant context' } });
        return;
      }
    }
    // Optional broker attribution via referral code or header (e.g., X-Broker-Code)
    const attributedBrokerId = (req.headers['x-broker-code'] as string) || (req.query.brokerCode as string) || undefined;

    // Idempotency handling (safe retries)
    const idemKeyHeader = (req.headers['idempotency-key'] as string) || undefined;
    const idemKey = IdempotencyService.makeKey([
      'presale:invest',
      tenantId,
      userId,
      presaleId,
      amount,
      paymentMethod,
      tier,
      referralCode,
      walletAddress,
      idemKeyHeader
    ]);
    const cached = IdempotencyService.get(idemKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    // Best-effort: ensure user has FIAT and USDT-capable hot wallet (no funds moved)
    try {
      const ws = new WalletSystemService(DatabaseService.getSequelize());
      // Initialize lazily only what's needed
      const existing = ws.getUserWallets(userId);
      const hasFiat = existing.some(w => w.walletType === 'fiat');
      const hasHot = existing.some(w => w.walletType === 'crypto_hot');
      if (!hasFiat || !hasHot) {
        await ws.createUserWalletInfrastructure(
          userId,
          tenantId,
          tenantId, // broker-equivalent for public tenant
          {
            firstName: (req as any).user?.firstName || 'User',
            lastName: (req as any).user?.lastName || 'Presale',
            email: (req as any).user?.email || 'unknown@thaliumx.com'
          }
        );
      }
    } catch (walletErr) {
      LoggerService.warn('Non-blocking wallet provisioning failed; continuing', { error: (walletErr as any)?.message, userId, tenantId });
    }
    
    const investment = await PresaleService.makeInvestment(
      presaleId,
      userId,
      tenantId,
      new Decimal(amount),
      paymentMethod,
      tier,
      referralCode,
      walletAddress, // Pass wallet address for on-chain purchase
      attributedBrokerId
    );
    
    const responseBody = {
      success: true,
      data: investment,
      message: 'Investment made successfully'
    };
    IdempotencyService.set(idemKey, 201, responseBody);
    res.status(201).json(responseBody);
    return;
  } catch (error) {
    LoggerService.error('Failed to make investment:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'INVESTMENT_FAILED',
        message: 'Failed to make investment'
      }
    });
  }
});

/**
 * GET /api/presale/investments
 * Get investments by user
 */
router.get('/investments', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const investments = await PresaleService.getInvestmentsByUser(userId);
    
    res.json({
      success: true,
      data: investments,
      count: investments.length
    });
  } catch (error) {
    LoggerService.error('Failed to get investments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get investments'
      }
    });
  }
});

/**
 * GET /api/presale/investments/:id
 * Get specific investment
 */
router.get('/investments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Investment ID is required'
      });
      return;
    }
    
    const investment = await PresaleService.getInvestment(id);
    
    res.json({
      success: true,
      data: investment
    });
  } catch (error) {
    LoggerService.error('Failed to get investment:', error);
    res.status(404).json({
      success: false,
      error: {
        code: 'INVESTMENT_NOT_FOUND',
        message: 'Investment not found'
      }
    });
  }
});

/**
 * GET /api/presale/presales/:id/investments
 * Get investments by presale
 */
router.get('/presales/:id/investments', authenticateToken, requireRole(['admin', 'presale_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Presale ID is required'
      });
      return;
    }
    
    const investments = await PresaleService.getInvestmentsByPresale(id);
    
    res.json({
      success: true,
      data: investments,
      count: investments.length
    });
  } catch (error) {
    LoggerService.error('Failed to get presale investments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get presale investments'
      }
    });
  }
});

// =============================================================================
// WHITELIST ROUTES
// =============================================================================

/**
 * POST /api/presale/whitelist
 * Add to whitelist
 */
router.post('/whitelist', authenticateToken, requireRole(['admin', 'presale_manager']), validateRequest(addToWhitelistSchema), async (req, res) => {
  try {
    const { presaleId, userId, email, walletAddress, tier, maxInvestment, kycLevel } = req.body;
    
    const entry = await PresaleService.addToWhitelist(
      presaleId,
      userId,
      email,
      walletAddress,
      tier,
      maxInvestment,
      kycLevel
    );
    
    res.status(201).json({
      success: true,
      data: entry,
      message: 'Added to whitelist successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to add to whitelist:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'WHITELIST_ADD_FAILED',
        message: 'Failed to add to whitelist'
      }
    });
  }
});

/**
 * PUT /api/presale/whitelist/:id/approve
 * Approve whitelist entry
 */
router.put('/whitelist/:id/approve', authenticateToken, requireRole(['admin', 'presale_manager']), validateRequest(approveWhitelistSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Whitelist entry ID is required'
      });
      return;
    }
    
    const entry = await PresaleService.approveWhitelistEntry(id, reason);
    
    res.json({
      success: true,
      data: entry,
      message: 'Whitelist entry approved successfully'
    });
  } catch (error) {
    LoggerService.error('Failed to approve whitelist entry:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'WHITELIST_APPROVAL_FAILED',
        message: 'Failed to approve whitelist entry'
      }
    });
  }
});

/**
 * GET /api/presale/presales/:id/whitelist
 * Get whitelist entries by presale
 */
router.get('/presales/:id/whitelist', authenticateToken, requireRole(['admin', 'presale_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Presale ID is required'
      });
      return;
    }
    
    const entries = await PresaleService.getWhitelistEntries(id);
    
    res.json({
      success: true,
      data: entries,
      count: entries.length
    });
  } catch (error) {
    LoggerService.error('Failed to get whitelist entries:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get whitelist entries'
      }
    });
  }
});

// =============================================================================
// STATISTICS ROUTES
// =============================================================================

/**
 * GET /api/presale/presales/:id/statistics
 * Get presale statistics
 */
router.get('/presales/:id/statistics', authenticateToken, requireRole(['admin', 'presale_manager', 'analyst']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Presale ID is required'
      });
      return;
    }
    
    const statistics = await PresaleService.getPresaleStatistics(id);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    LoggerService.error('Failed to get presale statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get presale statistics'
      }
    });
  }
});

// =============================================================================
// HEALTH ROUTES
// =============================================================================

/**
 * GET /api/presale/health
 * Get presale service health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const isHealthy = PresaleService.isHealthy();
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get presale health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get presale health'
      }
    });
  }
});

// =============================================================================
// VESTING ROUTES
// =============================================================================

/**
 * GET /api/presale/vesting/:scheduleId
 * Get vesting schedule information
 */
router.get('/vesting/:scheduleId', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { scheduleId } = req.params;
    const userId = (req as any).user?.id;
    
    if (!scheduleId) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required'
      });
      return;
    }
    
    // Get vesting schedule from blockchain
    const schedule = await SmartContractService.getVestingSchedule(scheduleId);
    
    if (!schedule) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VESTING_SCHEDULE_NOT_FOUND',
          message: 'Vesting schedule not found'
        }
      });
      return;
    }

    // Verify user owns this schedule
    const userWalletAddress = (req as any).user?.walletAddress || '';
    
    if (!userWalletAddress || userWalletAddress.toLowerCase() !== schedule.beneficiary.toLowerCase()) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this vesting schedule'
        }
      });
      return;
    }

    // Get releasable amount
    if (!scheduleId) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required'
      });
      return;
    }
    
    const releasableAmount = await SmartContractService.getReleasableAmount(scheduleId);
    
    res.json({
      success: true,
      data: {
        scheduleId,
        beneficiary: schedule.beneficiary,
        totalAmount: schedule.totalAmount.toString(),
        releasedAmount: schedule.releasedAmount.toString(),
        releasableAmount: releasableAmount.toString(),
        startTime: new Date(schedule.startTime * 1000),
        cliffDuration: schedule.cliffDuration,
        vestingDuration: schedule.vestingDuration,
        revocable: schedule.revocable,
        revoked: schedule.revoked,
        category: schedule.category,
        lastClaimTime: new Date(schedule.lastClaimTime * 1000),
        nextClaimAvailable: new Date((schedule.lastClaimTime + 86400) * 1000) // 24 hours cooldown
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get vesting schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get vesting schedule'
      }
    });
  }
});

/**
 * POST /api/presale/vesting/:scheduleId/claim
 * Claim vested tokens
 */
router.post('/vesting/:scheduleId/claim', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { scheduleId } = req.params;
    const userId = (req as any).user?.id;
    
    if (!scheduleId) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required'
      });
      return;
    }
    
    // Get vesting schedule to verify ownership
    const schedule = await SmartContractService.getVestingSchedule(scheduleId);
    
    if (!schedule) {
      res.status(404).json({
        success: false,
        error: {
          code: 'VESTING_SCHEDULE_NOT_FOUND',
          message: 'Vesting schedule not found'
        }
      });
      return;
    }

    // Verify user owns this schedule
    const userWalletAddress = (req as any).user?.walletAddress || '';
    
    if (!userWalletAddress || userWalletAddress.toLowerCase() !== schedule.beneficiary.toLowerCase()) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this vesting schedule'
        }
      });
      return;
    }

    // Check releasable amount
    if (!scheduleId) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required'
      });
      return;
    }
    
    const releasableAmount = await SmartContractService.getReleasableAmount(scheduleId);
    
    if (releasableAmount === 0n) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_TOKENS_RELEASABLE',
          message: 'No tokens available to release at this time'
        }
      });
      return;
    }

    // Get user's wallet for signing
    // NOTE: In production, users must sign transactions via frontend wallet
    const config = ConfigService.getConfig();
    const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    
    if (!config.blockchain.privateKey) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FRONTEND_SIGNING_REQUIRED',
          message: 'Token claim requires user to sign transaction. Please use frontend wallet connection.'
        }
      });
    }

    // Create wallet instance (for testing/backoffice - production should use frontend signing)
    const userWalletInstance = new Wallet(config.blockchain.privateKey, provider);

    // Release tokens
    if (!scheduleId) {
      res.status(400).json({
        success: false,
        error: 'Schedule ID is required'
      });
      return;
    }
    
    const result = await SmartContractService.releaseVestedTokens(
      userWalletInstance,
      scheduleId
    );

    LoggerService.info('Vested tokens claimed successfully', {
      scheduleId,
      userId,
      transactionHash: result.hash
    });

    res.json({
      success: true,
      data: {
        scheduleId,
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        releasableAmount: releasableAmount.toString()
      },
      message: 'Vested tokens claimed successfully'
    });
    return;
  } catch (error: any) {
    LoggerService.error('Failed to claim vested tokens:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLAIM_FAILED',
        message: error.message || 'Failed to claim vested tokens'
      }
    });
    return;
  }
});

/**
 * GET /api/presale/vesting/user/:userId
 * Get all vesting schedules for a user
 */
router.get('/vesting/user/:userId', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.id;
    
    // Verify user can access this data
    if (requestingUserId !== userId && !(req as any).user?.roles?.includes('admin')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied'
        }
      });
      return;
    }

    // Get user's wallet address from database or request
    // NOTE: In production, fetch from user's Web3Wallet records in database
    const userWalletAddress = (req as any).user?.walletAddress || '';
    
    if (!userWalletAddress) {
      res.json({
        success: true,
        data: [],
        message: 'No wallet address found for this user. Please connect your Web3 wallet.'
      });
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    // Get user's investments with vesting schedules
    const investments = await PresaleService.getInvestmentsByUser(userId);
    const vestingSchedules = [];

    for (const investment of investments) {
      if (investment.metadata.vestingScheduleId) {
        const schedule = await SmartContractService.getVestingSchedule(
          investment.metadata.vestingScheduleId
        );
        
        if (schedule) {
          const releasableAmount = await SmartContractService.getReleasableAmount(
            investment.metadata.vestingScheduleId
          );
          
          vestingSchedules.push({
            scheduleId: investment.metadata.vestingScheduleId,
            investmentId: investment.id,
            presaleId: investment.presaleId,
            totalAmount: schedule.totalAmount.toString(),
            releasedAmount: schedule.releasedAmount.toString(),
            releasableAmount: releasableAmount.toString(),
            startTime: new Date(schedule.startTime * 1000),
            cliffDuration: schedule.cliffDuration,
            vestingDuration: schedule.vestingDuration,
            lastClaimTime: new Date(schedule.lastClaimTime * 1000),
            category: schedule.category
          });
        }
      }
    }

    res.json({
      success: true,
      data: vestingSchedules,
      count: vestingSchedules.length
    });
  } catch (error) {
    LoggerService.error('Failed to get user vesting schedules:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get vesting schedules'
      }
    });
    return;
  }
});

/**
 * GET /api/presale/thal-balance/:address
 * Get THAL token balance for an address
 */
router.get('/thal-balance/:address', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { address } = req.params;
    
    // Verify address format
    if (!ethers.isAddress(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid Ethereum address'
        }
      });
      return;
    }

    const balance = await SmartContractService.getTHALBalance(address);
    
    res.json({
      success: true,
      data: {
        address,
        balance: balance.toString(),
        balanceFormatted: ethers.formatEther(balance)
      }
    });
  } catch (error) {
    LoggerService.error('Failed to get THAL balance:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get THAL balance'
      }
    });
    return;
  }
});

export default router;
