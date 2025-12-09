"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const presale_1 = require("../services/presale");
const wallet_system_1 = require("../services/wallet-system");
const database_1 = require("../services/database");
const idempotency_1 = require("../services/idempotency");
const smart_contracts_1 = require("../services/smart-contracts");
const error_handler_1 = require("../middleware/error-handler");
const error_handler_2 = require("../middleware/error-handler");
const joi_1 = __importDefault(require("joi"));
const decimal_js_1 = require("decimal.js");
const logger_1 = require("../services/logger");
const ethers_1 = require("ethers");
const config_1 = require("../services/config");
const router = (0, express_1.Router)();
// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================
const createPresaleSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    symbol: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    phase: joi_1.default.string().valid('private', 'public', 'community', 'institutional').required(),
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required(),
    tokenPrice: joi_1.default.number().positive().required(),
    totalSupply: joi_1.default.number().positive().required(),
    availableSupply: joi_1.default.number().positive().required(),
    minInvestment: joi_1.default.number().positive().required(),
    maxInvestment: joi_1.default.number().positive().required(),
    softCap: joi_1.default.number().positive().required(),
    hardCap: joi_1.default.number().positive().required(),
    tiers: joi_1.default.array().items(joi_1.default.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond')).required(),
    vestingSchedule: joi_1.default.object({
        type: joi_1.default.string().valid('linear', 'cliff', 'custom').required(),
        cliffPeriod: joi_1.default.number().min(0).required(),
        vestingPeriod: joi_1.default.number().positive().required(),
        releaseFrequency: joi_1.default.number().positive().required(),
        description: joi_1.default.string().required()
    }).required(),
    whitelistRequired: joi_1.default.boolean().required(),
    kycRequired: joi_1.default.boolean().required(),
    referralEnabled: joi_1.default.boolean().required(),
    bonusEnabled: joi_1.default.boolean().required(),
    metadata: joi_1.default.object({
        website: joi_1.default.string().uri().required(),
        whitepaper: joi_1.default.string().uri().required(),
        socialMedia: joi_1.default.object({
            twitter: joi_1.default.string().uri().optional(),
            telegram: joi_1.default.string().uri().optional(),
            discord: joi_1.default.string().uri().optional(),
            linkedin: joi_1.default.string().uri().optional()
        }).required(),
        team: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required(),
            role: joi_1.default.string().required(),
            bio: joi_1.default.string().required(),
            linkedin: joi_1.default.string().uri().optional(),
            twitter: joi_1.default.string().uri().optional(),
            avatar: joi_1.default.string().uri().optional()
        })).required(),
        advisors: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required(),
            expertise: joi_1.default.string().required(),
            bio: joi_1.default.string().required(),
            linkedin: joi_1.default.string().uri().optional(),
            avatar: joi_1.default.string().uri().optional()
        })).required(),
        partners: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required(),
            type: joi_1.default.string().required(),
            description: joi_1.default.string().required(),
            logo: joi_1.default.string().uri().optional(),
            website: joi_1.default.string().uri().optional()
        })).required(),
        roadmap: joi_1.default.array().items(joi_1.default.object({
            quarter: joi_1.default.string().required(),
            title: joi_1.default.string().required(),
            description: joi_1.default.string().required(),
            status: joi_1.default.string().valid('completed', 'in-progress', 'upcoming').required()
        })).required(),
        tokenomics: joi_1.default.object({
            totalSupply: joi_1.default.number().positive().required(),
            presaleAllocation: joi_1.default.number().positive().required(),
            teamAllocation: joi_1.default.number().positive().required(),
            advisorAllocation: joi_1.default.number().positive().required(),
            marketingAllocation: joi_1.default.number().positive().required(),
            liquidityAllocation: joi_1.default.number().positive().required(),
            treasuryAllocation: joi_1.default.number().positive().required(),
            vestingSchedules: joi_1.default.object({
                team: joi_1.default.object({
                    type: joi_1.default.string().valid('linear', 'cliff', 'custom').required(),
                    cliffPeriod: joi_1.default.number().min(0).required(),
                    vestingPeriod: joi_1.default.number().positive().required(),
                    releaseFrequency: joi_1.default.number().positive().required(),
                    description: joi_1.default.string().required()
                }).required(),
                advisor: joi_1.default.object({
                    type: joi_1.default.string().valid('linear', 'cliff', 'custom').required(),
                    cliffPeriod: joi_1.default.number().min(0).required(),
                    vestingPeriod: joi_1.default.number().positive().required(),
                    releaseFrequency: joi_1.default.number().positive().required(),
                    description: joi_1.default.string().required()
                }).required(),
                marketing: joi_1.default.object({
                    type: joi_1.default.string().valid('linear', 'cliff', 'custom').required(),
                    cliffPeriod: joi_1.default.number().min(0).required(),
                    vestingPeriod: joi_1.default.number().positive().required(),
                    releaseFrequency: joi_1.default.number().positive().required(),
                    description: joi_1.default.string().required()
                }).required()
            }).required()
        }).required(),
        legal: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required(),
            type: joi_1.default.string().required(),
            url: joi_1.default.string().uri().required(),
            version: joi_1.default.string().required(),
            lastUpdated: joi_1.default.date().required()
        })).required()
    }).required()
});
const makeInvestmentSchema = joi_1.default.object({
    walletAddress: joi_1.default.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().messages({
        'string.pattern.base': 'Invalid Ethereum address format'
    }),
    presaleId: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    paymentMethod: joi_1.default.string().valid('USDT', 'USDC', 'ETH', 'BTC', 'BANK_TRANSFER', 'CREDIT_CARD').required(),
    tier: joi_1.default.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond').required(),
    referralCode: joi_1.default.string().optional()
});
const addToWhitelistSchema = joi_1.default.object({
    presaleId: joi_1.default.string().required(),
    userId: joi_1.default.string().required(),
    email: joi_1.default.string().email().required(),
    walletAddress: joi_1.default.string().required(),
    tier: joi_1.default.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond').required(),
    maxInvestment: joi_1.default.number().positive().required(),
    kycLevel: joi_1.default.string().required()
});
const approveWhitelistSchema = joi_1.default.object({
    entryId: joi_1.default.string().required(),
    reason: joi_1.default.string().optional()
});
// =============================================================================
// PRESALE MANAGEMENT ROUTES
// =============================================================================
/**
 * POST /api/presale/presales
 * Create a new presale
 */
router.post('/presales', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), (0, error_handler_2.validateRequest)(createPresaleSchema), async (req, res) => {
    try {
        const presale = await presale_1.PresaleService.createPresale(req.body);
        res.status(201).json({
            success: true,
            data: presale,
            message: 'Presale created successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to create presale:', error);
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
router.get('/presales', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const presales = await presale_1.PresaleService.getAllPresales();
        res.json({
            success: true,
            data: presales,
            count: presales.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get presales:', error);
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
router.get('/presales/:id', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Presale ID is required'
            });
            return;
        }
        const presale = await presale_1.PresaleService.getPresale(id);
        res.json({
            success: true,
            data: presale
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get presale:', error);
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
router.put('/presales/:id', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Presale ID is required'
            });
            return;
        }
        const presale = await presale_1.PresaleService.updatePresale(id, req.body);
        res.json({
            success: true,
            data: presale,
            message: 'Presale updated successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to update presale:', error);
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
router.post('/investments', error_handler_1.authenticateToken, (0, error_handler_2.validateRequest)(makeInvestmentSchema), async (req, res) => {
    try {
        const { presaleId, amount, paymentMethod, tier, referralCode, walletAddress } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'thaliumx-tenant';
        if (!tenantId) {
            res.status(401).json({ success: false, error: { code: 'TENANT_REQUIRED', message: 'Tenant context is required' } });
            return;
        }
        // Optional realm validation if present in token
        const tokenRealm = req.user?.realm;
        if (tokenRealm && typeof tokenRealm === 'string') {
            const expectedRealm = tenantId === 'thaliumx-tenant' ? 'thaliumx-tenant' : tenantId;
            if (tokenRealm !== expectedRealm) {
                res.status(403).json({ success: false, error: { code: 'REALM_MISMATCH', message: 'Invalid realm for tenant context' } });
                return;
            }
        }
        // Optional broker attribution via referral code or header (e.g., X-Broker-Code)
        const attributedBrokerId = req.headers['x-broker-code'] || req.query.brokerCode || undefined;
        // Idempotency handling (safe retries)
        const idemKeyHeader = req.headers['idempotency-key'] || undefined;
        const idemKey = idempotency_1.IdempotencyService.makeKey([
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
        const cached = idempotency_1.IdempotencyService.get(idemKey);
        if (cached) {
            res.status(cached.status).json(cached.body);
            return;
        }
        // Best-effort: ensure user has FIAT and USDT-capable hot wallet (no funds moved)
        try {
            const ws = new wallet_system_1.WalletSystemService(database_1.DatabaseService.getSequelize());
            // Initialize lazily only what's needed
            const existing = ws.getUserWallets(userId);
            const hasFiat = existing.some(w => w.walletType === 'fiat');
            const hasHot = existing.some(w => w.walletType === 'crypto_hot');
            if (!hasFiat || !hasHot) {
                await ws.createUserWalletInfrastructure(userId, tenantId, tenantId, // broker-equivalent for public tenant
                {
                    firstName: req.user?.firstName || 'User',
                    lastName: req.user?.lastName || 'Presale',
                    email: req.user?.email || 'unknown@thaliumx.com'
                });
            }
        }
        catch (walletErr) {
            logger_1.LoggerService.warn('Non-blocking wallet provisioning failed; continuing', { error: walletErr?.message, userId, tenantId });
        }
        const investment = await presale_1.PresaleService.makeInvestment(presaleId, userId, tenantId, new decimal_js_1.Decimal(amount), paymentMethod, tier, referralCode, walletAddress, // Pass wallet address for on-chain purchase
        attributedBrokerId);
        const responseBody = {
            success: true,
            data: investment,
            message: 'Investment made successfully'
        };
        idempotency_1.IdempotencyService.set(idemKey, 201, responseBody);
        res.status(201).json(responseBody);
        return;
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to make investment:', error);
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
router.get('/investments', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const investments = await presale_1.PresaleService.getInvestmentsByUser(userId);
        res.json({
            success: true,
            data: investments,
            count: investments.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get investments:', error);
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
router.get('/investments/:id', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Investment ID is required'
            });
            return;
        }
        const investment = await presale_1.PresaleService.getInvestment(id);
        res.json({
            success: true,
            data: investment
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get investment:', error);
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
router.get('/presales/:id/investments', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Presale ID is required'
            });
            return;
        }
        const investments = await presale_1.PresaleService.getInvestmentsByPresale(id);
        res.json({
            success: true,
            data: investments,
            count: investments.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get presale investments:', error);
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
router.post('/whitelist', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), (0, error_handler_2.validateRequest)(addToWhitelistSchema), async (req, res) => {
    try {
        const { presaleId, userId, email, walletAddress, tier, maxInvestment, kycLevel } = req.body;
        const entry = await presale_1.PresaleService.addToWhitelist(presaleId, userId, email, walletAddress, tier, maxInvestment, kycLevel);
        res.status(201).json({
            success: true,
            data: entry,
            message: 'Added to whitelist successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to add to whitelist:', error);
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
router.put('/whitelist/:id/approve', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), (0, error_handler_2.validateRequest)(approveWhitelistSchema), async (req, res) => {
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
        const entry = await presale_1.PresaleService.approveWhitelistEntry(id, reason);
        res.json({
            success: true,
            data: entry,
            message: 'Whitelist entry approved successfully'
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to approve whitelist entry:', error);
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
router.get('/presales/:id/whitelist', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager']), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Presale ID is required'
            });
            return;
        }
        const entries = await presale_1.PresaleService.getWhitelistEntries(id);
        res.json({
            success: true,
            data: entries,
            count: entries.length
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get whitelist entries:', error);
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
router.get('/presales/:id/statistics', error_handler_1.authenticateToken, (0, error_handler_1.requireRole)(['admin', 'presale_manager', 'analyst']), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: 'Presale ID is required'
            });
            return;
        }
        const statistics = await presale_1.PresaleService.getPresaleStatistics(id);
        res.json({
            success: true,
            data: statistics
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get presale statistics:', error);
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
router.get('/health', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const isHealthy = presale_1.PresaleService.isHealthy();
        res.json({
            success: true,
            data: {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get presale health:', error);
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
router.get('/vesting/:scheduleId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const userId = req.user?.id;
        if (!scheduleId) {
            res.status(400).json({
                success: false,
                error: 'Schedule ID is required'
            });
            return;
        }
        // Get vesting schedule from blockchain
        const schedule = await smart_contracts_1.SmartContractService.getVestingSchedule(scheduleId);
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
        const userWalletAddress = req.user?.walletAddress || '';
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
        const releasableAmount = await smart_contracts_1.SmartContractService.getReleasableAmount(scheduleId);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get vesting schedule:', error);
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
router.post('/vesting/:scheduleId/claim', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const userId = req.user?.id;
        if (!scheduleId) {
            res.status(400).json({
                success: false,
                error: 'Schedule ID is required'
            });
            return;
        }
        // Get vesting schedule to verify ownership
        const schedule = await smart_contracts_1.SmartContractService.getVestingSchedule(scheduleId);
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
        const userWalletAddress = req.user?.walletAddress || '';
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
        const releasableAmount = await smart_contracts_1.SmartContractService.getReleasableAmount(scheduleId);
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
        const config = config_1.ConfigService.getConfig();
        const provider = new ethers_1.ethers.JsonRpcProvider(config.blockchain.rpcUrl);
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
        const userWalletInstance = new ethers_1.Wallet(config.blockchain.privateKey, provider);
        // Release tokens
        if (!scheduleId) {
            res.status(400).json({
                success: false,
                error: 'Schedule ID is required'
            });
            return;
        }
        const result = await smart_contracts_1.SmartContractService.releaseVestedTokens(userWalletInstance, scheduleId);
        logger_1.LoggerService.info('Vested tokens claimed successfully', {
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to claim vested tokens:', error);
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
router.get('/vesting/user/:userId', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.user?.id;
        // Verify user can access this data
        if (requestingUserId !== userId && !req.user?.roles?.includes('admin')) {
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
        const userWalletAddress = req.user?.walletAddress || '';
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
        const investments = await presale_1.PresaleService.getInvestmentsByUser(userId);
        const vestingSchedules = [];
        for (const investment of investments) {
            if (investment.metadata.vestingScheduleId) {
                const schedule = await smart_contracts_1.SmartContractService.getVestingSchedule(investment.metadata.vestingScheduleId);
                if (schedule) {
                    const releasableAmount = await smart_contracts_1.SmartContractService.getReleasableAmount(investment.metadata.vestingScheduleId);
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
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get user vesting schedules:', error);
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
router.get('/thal-balance/:address', error_handler_1.authenticateToken, async (req, res) => {
    try {
        const { address } = req.params;
        // Verify address format
        if (!ethers_1.ethers.isAddress(address)) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ADDRESS',
                    message: 'Invalid Ethereum address'
                }
            });
            return;
        }
        const balance = await smart_contracts_1.SmartContractService.getTHALBalance(address);
        res.json({
            success: true,
            data: {
                address,
                balance: balance.toString(),
                balanceFormatted: ethers_1.ethers.formatEther(balance)
            }
        });
    }
    catch (error) {
        logger_1.LoggerService.error('Failed to get THAL balance:', error);
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
exports.default = router;
//# sourceMappingURL=presale.js.map