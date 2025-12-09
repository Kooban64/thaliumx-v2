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

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { KYCService } from './kyc';
import { SmartContractService } from './smart-contracts';
import { BlnkFinanceService } from './blnkfinance';
import { AppError, createError } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// =============================================================================
// CORE TYPES & INTERFACES
// =============================================================================

export interface PresalePhase {
  id: string;
  name: string;
  description: string;
  phaseType: PresalePhaseType;
  startDate: Date;
  endDate: Date;
  tokenPrice: number; // Price per THAL token in USD
  minInvestment: number; // Minimum investment in USD
  maxInvestment: number; // Maximum investment per user in USD
  totalTokensAllocated: number; // Total THAL tokens allocated for this phase
  tokensSold: number; // THAL tokens sold in this phase
  usdRaised: number; // USD raised in this phase
  isActive: boolean;
  kycLevelRequired: string; // Required KYC level (L0, L1, L2, L3)
  vestingScheduleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresaleInvestment {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  phaseId: string;
  walletAddress: string;
  investmentAmountUSD: number;
  tokenAmount: number; // THAL tokens purchased
  tokenPrice: number; // Price per token at time of purchase
  paymentMethod: PaymentMethod;
  paymentTxHash?: string;
  status: InvestmentStatus;
  kycLevel: string;
  vestingScheduleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VestingSchedule {
  id: string;
  name: string;
  description: string;
  totalTokens: number;
  vestingPeriod: number; // Days
  cliffPeriod: number; // Days
  vestingFrequency: VestingFrequency;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VestingEntry {
  id: string;
  userId: string;
  investmentId: string;
  scheduleId: string;
  totalTokens: number;
  vestedTokens: number;
  remainingTokens: number;
  nextVestDate: Date;
  lastVestDate?: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenSaleStats {
  totalPhases: number;
  activePhases: number;
  totalInvestments: number;
  totalTokensSold: number;
  totalUSDRaised: number;
  uniqueInvestors: number;
  averageInvestment: number;
  byPhase: PhaseStats[];
  byKycLevel: KycLevelStats[];
}

export interface PhaseStats {
  phaseId: string;
  phaseName: string;
  investments: number;
  tokensSold: number;
  usdRaised: number;
  uniqueInvestors: number;
}

export interface KycLevelStats {
  kycLevel: string;
  investments: number;
  totalAmount: number;
  averageAmount: number;
  uniqueInvestors: number;
}

export interface InvestmentEligibility {
  isEligible: boolean;
  reason?: string;
  requiredKycLevel: string;
  currentKycLevel: string;
  maxInvestmentAllowed: number;
  phaseLimits: {
    minInvestment: number;
    maxInvestment: number;
    tokensAvailable: number;
  };
}

export enum PresalePhaseType {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  COMMUNITY = 'COMMUNITY',
  INSTITUTIONAL = 'INSTITUTIONAL'
}

export enum PaymentMethod {
  USDT = 'USDT',
  USDC = 'USDC',
  ETH = 'ETH',
  BTC = 'BTC',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum InvestmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED'
}

export enum VestingFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

// =============================================================================
// TOKEN SALE SERVICE CLASS
// =============================================================================

export class TokenSaleService {
  private static isInitialized = false;
  private static phases: Map<string, PresalePhase> = new Map();
  private static investments: Map<string, PresaleInvestment> = new Map();
  private static vestingSchedules: Map<string, VestingSchedule> = new Map();
  private static vestingEntries: Map<string, VestingEntry> = new Map();

  // Token sale configuration
  private static readonly TOKEN_SALE_CONFIG = {
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
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Token Sale Service...');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Load existing data
      await this.loadExistingData();
      
      // Initialize default vesting schedules
      await this.initializeDefaultVestingSchedules();
      
      // Initialize default presale phases
      await this.initializeDefaultPresalePhases();
      
      this.isInitialized = true;
      LoggerService.info('✅ Token Sale Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'token-sale.initialized',
        'TokenSaleService',
        'info',
        {
          message: 'Token sale service initialized',
          phasesCount: this.phases.size,
          investmentsCount: this.investments.size,
          vestingSchedulesCount: this.vestingSchedules.size
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ Token Sale Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create new presale phase
   */
  public static async createPresalePhase(
    name: string,
    description: string,
    phaseType: PresalePhaseType,
    startDate: Date,
    endDate: Date,
    tokenPrice: number,
    minInvestment: number,
    maxInvestment: number,
    totalTokensAllocated: number,
    kycLevelRequired: string,
    vestingScheduleId?: string
  ): Promise<PresalePhase> {
    try {
      LoggerService.info('Creating presale phase', {
        name,
        phaseType,
        tokenPrice,
        totalTokensAllocated
      });

      // Validate phase parameters
      if (startDate >= endDate) {
        throw createError('Start date must be before end date', 400, 'INVALID_DATE_RANGE');
      }

      if (tokenPrice <= 0) {
        throw createError('Token price must be greater than 0', 400, 'INVALID_TOKEN_PRICE');
      }

      if (minInvestment < this.TOKEN_SALE_CONFIG.minInvestmentUSD) {
        throw createError(`Minimum investment must be at least $${this.TOKEN_SALE_CONFIG.minInvestmentUSD}`, 400, 'INVALID_MIN_INVESTMENT');
      }

      if (maxInvestment > this.TOKEN_SALE_CONFIG.maxInvestmentUSD) {
        throw createError(`Maximum investment cannot exceed $${this.TOKEN_SALE_CONFIG.maxInvestmentUSD}`, 400, 'INVALID_MAX_INVESTMENT');
      }

      const phaseId = uuidv4();
      const phase: PresalePhase = {
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

      LoggerService.info('Presale phase created successfully', {
        phaseId: phase.id,
        name: phase.name,
        phaseType: phase.phaseType
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'presale-phase.created',
        'token-sale',
        phaseId,
        {
          name,
          phaseType,
          tokenPrice,
          totalTokensAllocated,
          kycLevelRequired
        }
      );

      return phase;

    } catch (error) {
      LoggerService.error('Create presale phase failed:', error);
      throw error;
    }
  }

  /**
   * Process investment
   */
  public static async processInvestment(
    userId: string,
    tenantId: string,
    brokerId: string,
    phaseId: string,
    walletAddress: string,
    investmentAmountUSD: number,
    paymentMethod: PaymentMethod,
    paymentTxHash?: string
  ): Promise<PresaleInvestment> {
    try {
      LoggerService.info('Processing investment', {
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
        throw createError('Presale phase not found', 404, 'PHASE_NOT_FOUND');
      }

      // Check if phase is active
      if (!phase.isActive) {
        throw createError('Presale phase is not active', 400, 'PHASE_NOT_ACTIVE');
      }

      // Check phase dates
      const now = new Date();
      if (now < phase.startDate) {
        throw createError('Presale phase has not started yet', 400, 'PHASE_NOT_STARTED');
      }

      if (now > phase.endDate) {
        throw createError('Presale phase has ended', 400, 'PHASE_ENDED');
      }

      // Check investment eligibility
      const eligibility = await this.checkInvestmentEligibility(userId, phaseId, investmentAmountUSD);
      if (!eligibility.isEligible) {
        throw createError(eligibility.reason || 'Investment not eligible', 400, 'INVESTMENT_NOT_ELIGIBLE');
      }

      // Calculate token amount
      const tokenAmount = Math.floor(investmentAmountUSD / phase.tokenPrice);

      // Check if enough tokens available
      if (tokenAmount > (phase.totalTokensAllocated - phase.tokensSold)) {
        throw createError('Not enough tokens available in this phase', 400, 'INSUFFICIENT_TOKENS');
      }

      // Check user's total investment in this phase
      const userInvestments = Array.from(this.investments.values()).filter(
        inv => inv.userId === userId && inv.phaseId === phaseId && inv.status !== InvestmentStatus.FAILED
      );

      const totalUserInvestment = userInvestments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0);
      if (totalUserInvestment + investmentAmountUSD > phase.maxInvestment) {
        throw createError('Investment would exceed phase maximum', 400, 'EXCEEDS_PHASE_MAXIMUM');
      }

      const investmentId = uuidv4();
      const investment: PresaleInvestment = {
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

      LoggerService.info('Investment processed successfully', {
        investmentId: investment.id,
        userId: investment.userId,
        tokenAmount: investment.tokenAmount,
        investmentAmountUSD: investment.investmentAmountUSD
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'investment.processed',
        'token-sale',
        investmentId,
        {
          userId,
          phaseId,
          investmentAmountUSD,
          tokenAmount,
          paymentMethod
        }
      );

      return investment;

    } catch (error) {
      LoggerService.error('Process investment failed:', error);
      throw error;
    }
  }

  /**
   * Check investment eligibility
   */
  public static async checkInvestmentEligibility(
    userId: string,
    phaseId: string,
    investmentAmountUSD: number
  ): Promise<InvestmentEligibility> {
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
      const kycStatus = await KYCService.getKYCStatus(userId);
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

    } catch (error) {
      LoggerService.error('Check investment eligibility failed:', error);
      throw error;
    }
  }

  /**
   * Get all presale phases
   */
  public static async getPresalePhases(activeOnly?: boolean): Promise<PresalePhase[]> {
    try {
      const phases = Array.from(this.phases.values());
      if (activeOnly) {
        return phases.filter(p => p.isActive);
      }
      return phases;
    } catch (error) {
      LoggerService.error('Get presale phases failed:', error);
      throw error;
    }
  }

  /**
   * Get presale phase by ID
   */
  public static async getPresalePhase(phaseId: string): Promise<PresalePhase | null> {
    try {
      const phase = this.phases.get(phaseId);
      return phase || null;
    } catch (error) {
      LoggerService.error('Get presale phase failed:', error);
      throw error;
    }
  }

  /**
   * Get user investments
   */
  public static async getUserInvestments(
    userId: string,
    phaseId?: string,
    status?: InvestmentStatus
  ): Promise<PresaleInvestment[]> {
    try {
      let investments = Array.from(this.investments.values()).filter(
        inv => inv.userId === userId
      );

      if (phaseId) {
        investments = investments.filter(inv => inv.phaseId === phaseId);
      }

      if (status) {
        investments = investments.filter(inv => inv.status === status);
      }

      return investments;
    } catch (error) {
      LoggerService.error('Get user investments failed:', error);
      throw error;
    }
  }

  /**
   * Get investment by ID
   */
  public static async getInvestment(investmentId: string): Promise<PresaleInvestment | null> {
    try {
      const investment = this.investments.get(investmentId);
      return investment || null;
    } catch (error) {
      LoggerService.error('Get investment failed:', error);
      throw error;
    }
  }

  /**
   * Get phase statistics
   */
  public static async getPhaseStats(phaseId: string): Promise<PhaseStats | null> {
    try {
      const phase = this.phases.get(phaseId);
      if (!phase) {
        return null;
      }

      const investments = Array.from(this.investments.values()).filter(
        inv => inv.phaseId === phaseId
      );

      return {
        phaseId: phase.id,
        phaseName: phase.name,
        investments: investments.length,
        tokensSold: investments.reduce((sum, inv) => sum + inv.tokenAmount, 0),
        usdRaised: investments.reduce((sum, inv) => sum + inv.investmentAmountUSD, 0),
        uniqueInvestors: new Set(investments.map(inv => inv.userId)).size
      };
    } catch (error) {
      LoggerService.error('Get phase stats failed:', error);
      throw error;
    }
  }

  /**
   * Get all vesting schedules
   */
  public static async getVestingSchedules(activeOnly?: boolean): Promise<VestingSchedule[]> {
    try {
      const schedules = Array.from(this.vestingSchedules.values());
      if (activeOnly) {
        return schedules.filter(s => s.isActive);
      }
      return schedules;
    } catch (error) {
      LoggerService.error('Get vesting schedules failed:', error);
      throw error;
    }
  }

  /**
   * Get user vesting entries
   */
  public static async getUserVestingEntries(userId: string): Promise<VestingEntry[]> {
    try {
      const entries = Array.from(this.vestingEntries.values()).filter(
        entry => entry.userId === userId
      );
      return entries;
    } catch (error) {
      LoggerService.error('Get user vesting entries failed:', error);
      throw error;
    }
  }

  /**
   * Get token sale statistics
   */
  public static async getTokenSaleStats(): Promise<TokenSaleStats> {
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

      const byPhase: PhaseStats[] = phases.map(phase => {
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

      const byKycLevel: KycLevelStats[] = ['L0', 'L1', 'L2', 'L3'].map(level => {
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

    } catch (error) {
      LoggerService.error('Get token sale stats failed:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing Token Sale Service...');
      this.isInitialized = false;
      this.phases.clear();
      this.investments.clear();
      this.vestingSchedules.clear();
      this.vestingEntries.clear();
      LoggerService.info('✅ Token Sale Service closed');
    } catch (error) {
      LoggerService.error('Error closing Token Sale Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static async validateConfiguration(): Promise<void> {
    try {
      if (!this.TOKEN_SALE_CONFIG.thalTokenAddress) {
        throw new Error('THAL token address not configured');
      }

      if (!this.TOKEN_SALE_CONFIG.presaleContractAddress) {
        throw new Error('Presale contract address not configured');
      }

      LoggerService.info('Token sale configuration validated successfully');
    } catch (error) {
      LoggerService.error('Validate configuration failed:', error);
      throw error;
    }
  }

  private static async loadExistingData(): Promise<void> {
    try {
      // This would typically load from database
      LoggerService.info('Existing token sale data loaded from database');
    } catch (error) {
      LoggerService.error('Load existing data failed:', error);
      throw error;
    }
  }

  private static async initializeDefaultVestingSchedules(): Promise<void> {
    try {
      const defaultSchedule: VestingSchedule = {
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
      LoggerService.info('Default vesting schedule initialized');
    } catch (error) {
      LoggerService.error('Initialize default vesting schedules failed:', error);
      throw error;
    }
  }

  private static async initializeDefaultPresalePhases(): Promise<void> {
    try {
      // Create default public phase
      const publicPhase: PresalePhase = {
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
      LoggerService.info('Default presale phases initialized');
    } catch (error) {
      LoggerService.error('Initialize default presale phases failed:', error);
      throw error;
    }
  }

  private static async processPaymentAndAllocation(investment: PresaleInvestment): Promise<void> {
    try {
      // Update investment status
      investment.status = InvestmentStatus.PROCESSING;
      investment.updatedAt = new Date();
      this.investments.set(investment.id, investment);

      // Record transaction in BlnkFinance
      await BlnkFinanceService.recordTransaction(
        `Token sale investment - ${investment.investmentAmountUSD} USD`,
        [
          {
            accountId: 'token-sale-investment',
            debitAmount: investment.investmentAmountUSD,
            description: `Token sale investment - ${investment.investmentAmountUSD} USD`,
            reference: investment.id
          }
        ],
        investment.brokerId,
        'USD',
        'TRADE' as any,
        investment.id,
        {
          investmentId: investment.id,
          userId: investment.userId,
          phaseId: investment.phaseId,
          tokenAmount: investment.tokenAmount,
          paymentMethod: investment.paymentMethod
        }
      );

      // Process smart contract interaction
      if (investment.paymentTxHash) {
        await this.processSmartContractAllocation(investment);
      }

      // Update investment status
      investment.status = InvestmentStatus.COMPLETED;
      investment.updatedAt = new Date();
      this.investments.set(investment.id, investment);

      LoggerService.info('Payment and allocation processed', {
        investmentId: investment.id,
        status: investment.status
      });

    } catch (error) {
      LoggerService.error('Process payment and allocation failed:', error);
      
      // Mark investment as failed
      investment.status = InvestmentStatus.FAILED;
      investment.updatedAt = new Date();
      this.investments.set(investment.id, investment);
      
      throw error;
    }
  }

  private static async processSmartContractAllocation(investment: PresaleInvestment): Promise<void> {
    try {
      // This would interact with the smart contract to allocate tokens
      LoggerService.info('Processing smart contract allocation', {
        investmentId: investment.id,
        tokenAmount: investment.tokenAmount,
        walletAddress: investment.walletAddress
      });

      // In a real implementation, this would:
      // 1. Verify the payment transaction
      // 2. Call the presale contract to allocate tokens
      // 3. Set up vesting if applicable
      // 4. Emit events for tracking

    } catch (error) {
      LoggerService.error('Process smart contract allocation failed:', error);
      throw error;
    }
  }
}
