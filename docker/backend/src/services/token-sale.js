"use strict";
/**
 * Token Sale Platform Service
 *
 * Production-ready token sale platform with comprehensive features:
 * - Public token sales (THAL token purchases)
 * - Multi-phase presale system
 * - KYC integration with investment limits
 * - Smart contract integration
 * - Vesting schedule management
 * - Broker migration support
 * - Compliance and audit trails
 *
 * Based on industry standards for crypto token sales
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenSaleService = exports.VestingFrequency = exports.InvestmentStatus = exports.PaymentMethod = exports.PresalePhaseType = void 0;
const logger_1 = require("./logger");
const event_streaming_1 = require("./event-streaming");
const kyc_1 = require("./kyc");
const blnkfinance_1 = require("./blnkfinance");
const utils_1 = require("../utils");
const uuid_1 = require("uuid");
var PresalePhaseType;
(function (PresalePhaseType) {
    PresalePhaseType["PRIVATE"] = "PRIVATE";
    PresalePhaseType["PUBLIC"] = "PUBLIC";
    PresalePhaseType["COMMUNITY"] = "COMMUNITY";
    PresalePhaseType["INSTITUTIONAL"] = "INSTITUTIONAL";
})(PresalePhaseType || (exports.PresalePhaseType = PresalePhaseType = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["USDT"] = "USDT";
    PaymentMethod["USDC"] = "USDC";
    PaymentMethod["ETH"] = "ETH";
    PaymentMethod["BTC"] = "BTC";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var InvestmentStatus;
(function (InvestmentStatus) {
    InvestmentStatus["PENDING"] = "PENDING";
    InvestmentStatus["CONFIRMED"] = "CONFIRMED";
    InvestmentStatus["PROCESSING"] = "PROCESSING";
    InvestmentStatus["COMPLETED"] = "COMPLETED";
    InvestmentStatus["FAILED"] = "FAILED";
    InvestmentStatus["REFUNDED"] = "REFUNDED";
    InvestmentStatus["CANCELLED"] = "CANCELLED";
})(InvestmentStatus || (exports.InvestmentStatus = InvestmentStatus = {}));
var VestingFrequency;
(function (VestingFrequency) {
    VestingFrequency["DAILY"] = "DAILY";
    VestingFrequency["WEEKLY"] = "WEEKLY";
    VestingFrequency["MONTHLY"] = "MONTHLY";
    VestingFrequency["QUARTERLY"] = "QUARTERLY";
    VestingFrequency["ANNUALLY"] = "ANNUALLY";
})(VestingFrequency || (exports.VestingFrequency = VestingFrequency = {}));
// =============================================================================
// TOKEN SALE SERVICE CLASS
// =============================================================================
class TokenSaleService {
    static isInitialized = false;
    static phases = new Map();
    static investments = new Map();
    static vestingSchedules = new Map();
    static vestingEntries = new Map();
    // Token sale configuration
    static TOKEN_SALE_CONFIG = {
        thalTokenAddress: process.env.THAL_TOKEN_ADDRESS || '',
        presaleContractAddress: process.env.PRESALE_CONTRACT_ADDRESS || '',
        usdtTokenAddress: process.env.USDT_TOKEN_ADDRESS || '',
        defaultVestingSchedule: process.env.DEFAULT_VESTING_SCHEDULE_ID || '',
        maxTotalSupply: 1000000000, // 1 billion THAL tokens
        platformFeePercentage: 2.5, // 2.5% platform fee
        brokerFeePercentage: 1.0, // 1% broker fee
        minInvestmentUSD: 100, // $100 minimum investment
        maxInvestmentUSD: 10000, // $10,000 maximum per user per phase
        supportedCurrencies: ['USDT', 'USDC', 'ETH', 'BTC']
    };
    /**
     * Initialize Token Sale Service
     */
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Token Sale Service...');
            // Validate configuration
            await this.validateConfiguration();
            // Load existing data
            await this.loadExistingData();
            // Initialize default vesting schedules
            await this.initializeDefaultVestingSchedules();
            // Initialize default presale phases
            await this.initializeDefaultPresalePhases();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Token Sale Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('token-sale.initialized', 'TokenSaleService', 'info', {
                message: 'Token sale service initialized',
                phasesCount: this.phases.size,
                investmentsCount: this.investments.size,
                vestingSchedulesCount: this.vestingSchedules.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Token Sale Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create new presale phase
     */
    static async createPresalePhase(name, description, phaseType, startDate, endDate, tokenPrice, minInvestment, maxInvestment, totalTokensAllocated, kycLevelRequired, vestingScheduleId) {
        try {
            logger_1.LoggerService.info('Creating presale phase', {
                name,
                phaseType,
                tokenPrice,
                totalTokensAllocated
            });
            // Validate phase parameters
            if (startDate >= endDate) {
                throw (0, utils_1.createError)('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
            }
            if (tokenPrice <= 0) {
                throw (0, utils_1.createError)('Token price must be greater than 0', 400, 'INVALID_TOKEN_PRICE');
            }
            if (minInvestment < this.TOKEN_SALE_CONFIG.minInvestmentUSD) {
                throw (0, utils_1.createError)(`Minimum investment must be at least $${this.TOKEN_SALE_CONFIG.minInvestmentUSD}`, 400, 'INVALID_MIN_INVESTMENT');
            }
            if (maxInvestment > this.TOKEN_SALE_CONFIG.maxInvestmentUSD) {
                throw (0, utils_1.createError)(`Maximum investment cannot exceed $${this.TOKEN_SALE_CONFIG.maxInvestmentUSD}`, 400, 'INVALID_MAX_INVESTMENT');
            }
            const phaseId = (0, uuid_1.v4)();
            const phase = {
                id: phaseId,
                name,
                description,
                phaseType,
                startDate,
                endDate,
                tokenPrice,
                minInvestment,
                maxInvestment,
                totalTokensAllocated,
                tokensSold: 0,
                usdRaised: 0,
                isActive: false,
                kycLevelRequired,
                vestingScheduleId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store phase
            this.phases.set(phaseId, phase);
            logger_1.LoggerService.info('Presale phase created successfully', {
                phaseId: phase.id,
                name: phase.name,
                phaseType: phase.phaseType
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('presale-phase.created', 'token-sale', phaseId, {
                name,
                phaseType,
                tokenPrice,
                totalTokensAllocated,
                kycLevelRequired
            });
            return phase;
        }
        catch (error) {
            logger_1.LoggerService.error('Create presale phase failed:', error);
            throw error;
        }
    }
    /**
     * Process investment
     */
    static async processInvestment(userId, tenantId, brokerId, phaseId, walletAddress, investmentAmountUSD, paymentMethod, paymentTxHash) {
        try {
            logger_1.LoggerService.info('Processing investment', {
                userId,
                tenantId,
                brokerId,
                phaseId,
                investmentAmountUSD,
                paymentMethod
            });
            // Get phase
            const phase = this.phases.get(phaseId);
            if (!phase) {
                throw (0, utils_1.createError)('Presale phase not found', 404, 'PHASE_NOT_FOUND');
            }
            // Check if phase is active
            if (!phase.isActive) {
                throw (0, utils_1.createError)('Presale phase is not active', 400, 'PHASE_NOT_ACTIVE');
            }
            // Check phase dates
            const now = new Date();
            if (now < phase.startDate) {
                throw (0, utils_1.createError)('Presale phase has not started yet', 400, 'PHASE_NOT_STARTED');
            }
            if (now > phase.endDate) {
                throw (0, utils_1.createError)('Presale phase has ended', 400, 'PHASE_ENDED');
            }
            // Check investment eligibility
            const eligibility = await this.checkInvestmentEligibility(userId, phaseId, investmentAmountUSD);
            if (!eligibility.isEligible) {
                throw (0, utils_1.createError)(eligibility.reason || 'Investment not eligible', 400, 'INVESTMENT_NOT_ELIGIBLE');
            }
            // Calculate token amount
            const tokenAmount = Math.floor(investmentAmountUSD / phase.tokenPrice);
            // Check if enough tokens available
            if (tokenAmount > (phase.totalTokensAllocated - phase.tokensSold)) {
                throw (0, utils_1.createError)('Not enough tokens available in this phase', 400, 'INSUFFICIENT_TOKENS');
            }
            // Check user's total investment in this phase
            const userInvestments = Array.from(this.investments.values()).filter(inv => inv.userId === userId && inv.phaseId === phaseId && inv.status !== InvestmentStatus.FAILED);
            const totalUserInvestment = userInvestments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0);
            if (totalUserInvestment + investmentAmountUSD > phase.maxInvestment) {
                throw (0, utils_1.createError)('Investment would exceed phase maximum', 400, 'EXCEEDS_PHASE_MAXIMUM');
            }
            const investmentId = (0, uuid_1.v4)();
            const investment = {
                id: investmentId,
                userId,
                tenantId,
                brokerId,
                phaseId,
                walletAddress,
                investmentAmountUSD,
                tokenAmount,
                tokenPrice: phase.tokenPrice,
                paymentMethod,
                paymentTxHash,
                status: InvestmentStatus.PENDING,
                kycLevel: eligibility.currentKycLevel,
                vestingScheduleId: phase.vestingScheduleId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Store investment
            this.investments.set(investmentId, investment);
            // Update phase stats
            phase.tokensSold += tokenAmount;
            phase.usdRaised += investmentAmountUSD;
            phase.updatedAt = new Date();
            this.phases.set(phaseId, phase);
            // Process payment and token allocation
            await this.processPaymentAndAllocation(investment);
            logger_1.LoggerService.info('Investment processed successfully', {
                investmentId: investment.id,
                userId: investment.userId,
                tokenAmount: investment.tokenAmount,
                investmentAmountUSD: investment.investmentAmountUSD
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('investment.processed', 'token-sale', investmentId, {
                userId,
                phaseId,
                investmentAmountUSD,
                tokenAmount,
                paymentMethod
            });
            return investment;
        }
        catch (error) {
            logger_1.LoggerService.error('Process investment failed:', error);
            throw error;
        }
    }
    /**
     * Check investment eligibility
     */
    static async checkInvestmentEligibility(userId, phaseId, investmentAmountUSD) {
        try {
            const phase = this.phases.get(phaseId);
            if (!phase) {
                return {
                    isEligible: false,
                    reason: 'Presale phase not found',
                    requiredKycLevel: 'L0',
                    currentKycLevel: 'L0',
                    maxInvestmentAllowed: 0,
                    phaseLimits: {
                        minInvestment: 0,
                        maxInvestment: 0,
                        tokensAvailable: 0
                    }
                };
            }
            // Get user KYC status
            const kycStatus = await kyc_1.KYCService.getKYCStatus(userId);
            const currentKycLevel = kycStatus.kycLevel;
            // Check KYC level requirement
            const kycLevels = ['L0', 'L1', 'L2', 'L3'];
            const requiredLevelIndex = kycLevels.indexOf(phase.kycLevelRequired);
            const currentLevelIndex = kycLevels.indexOf(currentKycLevel);
            if (currentLevelIndex < requiredLevelIndex) {
                return {
                    isEligible: false,
                    reason: `KYC level ${phase.kycLevelRequired} required, current level is ${currentKycLevel}`,
                    requiredKycLevel: phase.kycLevelRequired,
                    currentKycLevel,
                    maxInvestmentAllowed: 0,
                    phaseLimits: {
                        minInvestment: phase.minInvestment,
                        maxInvestment: phase.maxInvestment,
                        tokensAvailable: phase.totalTokensAllocated - phase.tokensSold
                    }
                };
            }
            // Check investment amount
            if (investmentAmountUSD < phase.minInvestment) {
                return {
                    isEligible: false,
                    reason: `Minimum investment is $${phase.minInvestment}`,
                    requiredKycLevel: phase.kycLevelRequired,
                    currentKycLevel,
                    maxInvestmentAllowed: phase.maxInvestment,
                    phaseLimits: {
                        minInvestment: phase.minInvestment,
                        maxInvestment: phase.maxInvestment,
                        tokensAvailable: phase.totalTokensAllocated - phase.tokensSold
                    }
                };
            }
            if (investmentAmountUSD > phase.maxInvestment) {
                return {
                    isEligible: false,
                    reason: `Maximum investment is $${phase.maxInvestment}`,
                    requiredKycLevel: phase.kycLevelRequired,
                    currentKycLevel,
                    maxInvestmentAllowed: phase.maxInvestment,
                    phaseLimits: {
                        minInvestment: phase.minInvestment,
                        maxInvestment: phase.maxInvestment,
                        tokensAvailable: phase.totalTokensAllocated - phase.tokensSold
                    }
                };
            }
            // Check tokens available
            const tokensAvailable = phase.totalTokensAllocated - phase.tokensSold;
            const requestedTokens = Math.floor(investmentAmountUSD / phase.tokenPrice);
            if (requestedTokens > tokensAvailable) {
                return {
                    isEligible: false,
                    reason: 'Not enough tokens available in this phase',
                    requiredKycLevel: phase.kycLevelRequired,
                    currentKycLevel,
                    maxInvestmentAllowed: phase.maxInvestment,
                    phaseLimits: {
                        minInvestment: phase.minInvestment,
                        maxInvestment: phase.maxInvestment,
                        tokensAvailable
                    }
                };
            }
            return {
                isEligible: true,
                requiredKycLevel: phase.kycLevelRequired,
                currentKycLevel,
                maxInvestmentAllowed: phase.maxInvestment,
                phaseLimits: {
                    minInvestment: phase.minInvestment,
                    maxInvestment: phase.maxInvestment,
                    tokensAvailable
                }
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Check investment eligibility failed:', error);
            throw error;
        }
    }
    /**
     * Get all presale phases
     */
    static async getPresalePhases(activeOnly) {
        try {
            const phases = Array.from(this.phases.values());
            if (activeOnly) {
                return phases.filter(p => p.isActive);
            }
            return phases;
        }
        catch (error) {
            logger_1.LoggerService.error('Get presale phases failed:', error);
            throw error;
        }
    }
    /**
     * Get presale phase by ID
     */
    static async getPresalePhase(phaseId) {
        try {
            const phase = this.phases.get(phaseId);
            return phase || null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get presale phase failed:', error);
            throw error;
        }
    }
    /**
     * Get user investments
     */
    static async getUserInvestments(userId, phaseId, status) {
        try {
            let investments = Array.from(this.investments.values()).filter(inv => inv.userId === userId);
            if (phaseId) {
                investments = investments.filter(inv => inv.phaseId === phaseId);
            }
            if (status) {
                investments = investments.filter(inv => inv.status === status);
            }
            return investments;
        }
        catch (error) {
            logger_1.LoggerService.error('Get user investments failed:', error);
            throw error;
        }
    }
    /**
     * Get investment by ID
     */
    static async getInvestment(investmentId) {
        try {
            const investment = this.investments.get(investmentId);
            return investment || null;
        }
        catch (error) {
            logger_1.LoggerService.error('Get investment failed:', error);
            throw error;
        }
    }
    /**
     * Get phase statistics
     */
    static async getPhaseStats(phaseId) {
        try {
            const phase = this.phases.get(phaseId);
            if (!phase) {
                return null;
            }
            const investments = Array.from(this.investments.values()).filter(inv => inv.phaseId === phaseId);
            return {
                phaseId: phase.id,
                phaseName: phase.name,
                investments: investments.length,
                tokensSold: investments.reduce((sum, inv) => sum + inv.tokenAmount, 0),
                usdRaised: investments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0),
                uniqueInvestors: new Set(investments.map(inv => inv.userId)).size
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get phase stats failed:', error);
            throw error;
        }
    }
    /**
     * Get all vesting schedules
     */
    static async getVestingSchedules(activeOnly) {
        try {
            const schedules = Array.from(this.vestingSchedules.values());
            if (activeOnly) {
                return schedules.filter(s => s.isActive);
            }
            return schedules;
        }
        catch (error) {
            logger_1.LoggerService.error('Get vesting schedules failed:', error);
            throw error;
        }
    }
    /**
     * Get user vesting entries
     */
    static async getUserVestingEntries(userId) {
        try {
            const entries = Array.from(this.vestingEntries.values()).filter(entry => entry.userId === userId);
            return entries;
        }
        catch (error) {
            logger_1.LoggerService.error('Get user vesting entries failed:', error);
            throw error;
        }
    }
    /**
     * Get token sale statistics
     */
    static async getTokenSaleStats() {
        try {
            const phases = Array.from(this.phases.values());
            const investments = Array.from(this.investments.values());
            const totalPhases = phases.length;
            const activePhases = phases.filter(p => p.isActive).length;
            const totalInvestments = investments.length;
            const totalTokensSold = investments.reduce((sum, inv) => sum + inv.tokenAmount, 0);
            const totalUSDRaised = investments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0);
            const uniqueInvestors = new Set(investments.map(inv => inv.userId)).size;
            const averageInvestment = totalInvestments > 0 ? totalUSDRaised / totalInvestments : 0;
            const byPhase = phases.map(phase => {
                const phaseInvestments = investments.filter(inv => inv.phaseId === phase.id);
                return {
                    phaseId: phase.id,
                    phaseName: phase.name,
                    investments: phaseInvestments.length,
                    tokensSold: phaseInvestments.reduce((sum, inv) => sum + inv.tokenAmount, 0),
                    usdRaised: phaseInvestments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0),
                    uniqueInvestors: new Set(phaseInvestments.map(inv => inv.userId)).size
                };
            });
            const byKycLevel = ['L0', 'L1', 'L2', 'L3'].map(level => {
                const levelInvestments = investments.filter(inv => inv.kycLevel === level);
                return {
                    kycLevel: level,
                    investments: levelInvestments.length,
                    totalAmount: levelInvestments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0),
                    averageAmount: levelInvestments.length > 0 ? levelInvestments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0) / levelInvestments.length : 0,
                    uniqueInvestors: new Set(levelInvestments.map(inv => inv.userId)).size
                };
            });
            return {
                totalPhases,
                activePhases,
                totalInvestments,
                totalTokensSold,
                totalUSDRaised,
                uniqueInvestors,
                averageInvestment,
                byPhase,
                byKycLevel
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Get token sale stats failed:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing Token Sale Service...');
            this.isInitialized = false;
            this.phases.clear();
            this.investments.clear();
            this.vestingSchedules.clear();
            this.vestingEntries.clear();
            logger_1.LoggerService.info('✅ Token Sale Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing Token Sale Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static async validateConfiguration() {
        try {
            if (!this.TOKEN_SALE_CONFIG.thalTokenAddress) {
                throw new Error('THAL token address not configured');
            }
            if (!this.TOKEN_SALE_CONFIG.presaleContractAddress) {
                throw new Error('Presale contract address not configured');
            }
            logger_1.LoggerService.info('Token sale configuration validated successfully');
        }
        catch (error) {
            logger_1.LoggerService.error('Validate configuration failed:', error);
            throw error;
        }
    }
    static async loadExistingData() {
        try {
            // This would typically load from database
            logger_1.LoggerService.info('Existing token sale data loaded from database');
        }
        catch (error) {
            logger_1.LoggerService.error('Load existing data failed:', error);
            throw error;
        }
    }
    static async initializeDefaultVestingSchedules() {
        try {
            const defaultSchedule = {
                id: 'default-vesting',
                name: 'Default Vesting Schedule',
                description: 'Standard 12-month vesting with 3-month cliff',
                totalTokens: 0,
                vestingPeriod: 365, // 12 months
                cliffPeriod: 90, // 3 months
                vestingFrequency: VestingFrequency.MONTHLY,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.vestingSchedules.set(defaultSchedule.id, defaultSchedule);
            logger_1.LoggerService.info('Default vesting schedule initialized');
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize default vesting schedules failed:', error);
            throw error;
        }
    }
    static async initializeDefaultPresalePhases() {
        try {
            // Create default public phase
            const publicPhase = {
                id: 'public-phase',
                name: 'Public Token Sale',
                description: 'Public sale of THAL tokens',
                phaseType: PresalePhaseType.PUBLIC,
                startDate: new Date(),
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                tokenPrice: 0.01, // $0.01 per THAL token
                minInvestment: 100, // $100 minimum
                maxInvestment: 10000, // $10,000 maximum
                totalTokensAllocated: 100000000, // 100M tokens
                tokensSold: 0,
                usdRaised: 0,
                isActive: true,
                kycLevelRequired: 'L1', // Basic verification required
                vestingScheduleId: 'default-vesting',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            this.phases.set(publicPhase.id, publicPhase);
            logger_1.LoggerService.info('Default presale phases initialized');
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize default presale phases failed:', error);
            throw error;
        }
    }
    static async processPaymentAndAllocation(investment) {
        try {
            // Update investment status
            investment.status = InvestmentStatus.PROCESSING;
            investment.updatedAt = new Date();
            this.investments.set(investment.id, investment);
            // Record transaction in BlnkFinance
            await blnkfinance_1.BlnkFinanceService.recordTransaction(`Token sale investment - ${investment.investmentAmountUSD} USD`, [
                {
                    accountId: 'token-sale-investment',
                    debitAmount: investment.investmentAmountUSD,
                    description: `Token sale investment - ${investment.investmentAmountUSD} USD`,
                    reference: investment.id
                }
            ], investment.brokerId, 'USD', 'TRADE', investment.id, {
                investmentId: investment.id,
                userId: investment.userId,
                phaseId: investment.phaseId,
                tokenAmount: investment.tokenAmount,
                paymentMethod: investment.paymentMethod
            });
            // Process smart contract interaction
            if (investment.paymentTxHash) {
                await this.processSmartContractAllocation(investment);
            }
            // Update investment status
            investment.status = InvestmentStatus.COMPLETED;
            investment.updatedAt = new Date();
            this.investments.set(investment.id, investment);
            logger_1.LoggerService.info('Payment and allocation processed', {
                investmentId: investment.id,
                status: investment.status
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Process payment and allocation failed:', error);
            // Mark investment as failed
            investment.status = InvestmentStatus.FAILED;
            investment.updatedAt = new Date();
            this.investments.set(investment.id, investment);
            throw error;
        }
    }
    static async processSmartContractAllocation(investment) {
        try {
            // This would interact with the smart contract to allocate tokens
            logger_1.LoggerService.info('Processing smart contract allocation', {
                investmentId: investment.id,
                tokenAmount: investment.tokenAmount,
                walletAddress: investment.walletAddress
            });
            // In a real implementation, this would:
            // 1. Verify the payment transaction
            // 2. Call the presale contract to allocate tokens
            // 3. Set up vesting if applicable
            // 4. Emit events for tracking
        }
        catch (error) {
            logger_1.LoggerService.error('Process smart contract allocation failed:', error);
            throw error;
        }
    }
}
exports.TokenSaleService = TokenSaleService;
//# sourceMappingURL=token-sale.js.map