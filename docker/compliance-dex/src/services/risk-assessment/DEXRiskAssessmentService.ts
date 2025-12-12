/**
 * DEX Risk Assessment Service
 * Comprehensive risk assessment for DEX transactions
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  DEXRiskAssessmentData,
  DEXRiskFactors,
  DEXRiskFlag,
  DEXRiskRecommendation,
  DEXSwapData,
  DEXLiquidityData,
  BridgeTransaction,
  WalletScreeningResult,
  ProtocolRiskAssessment,
} from '../../types/compliance';
import { databaseService } from '../database';
import { eventProducer } from '../events';
import { walletScreeningService } from '../wallet-screening';
import { DEXRiskAssessmentCompletedEvent, HighRiskAlertEvent } from '../../types/events';

// ==================== RISK WEIGHTS ====================

const RISK_WEIGHTS = {
  walletRisk: 0.25,
  protocolRisk: 0.15,
  transactionRisk: 0.20,
  geographyRisk: 0.10,
  patternRisk: 0.10,
  velocityRisk: 0.10,
  concentrationRisk: 0.05,
  counterpartyRisk: 0.05,
} as const;

// ==================== PROTOCOL RISK DATABASE ====================

const PROTOCOL_RISK_SCORES: Record<string, number> = {
  // Well-established protocols
  'uniswap': 10,
  'sushiswap': 15,
  'curve': 12,
  'balancer': 15,
  'aave': 10,
  'compound': 10,
  'maker': 8,
  '1inch': 15,
  'pancakeswap': 18,
  'quickswap': 20,
  
  // Medium risk protocols
  'dydx': 25,
  'gmx': 28,
  'perpetual': 30,
  
  // Higher risk / newer protocols
  'unknown': 50,
};

// ==================== DEX RISK ASSESSMENT SERVICE ====================

/**
 * Service for assessing risk of DEX transactions
 */
export class DEXRiskAssessmentService {
  private static instance: DEXRiskAssessmentService;
  private protocolRiskCache: Map<string, ProtocolRiskAssessment> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DEXRiskAssessmentService {
    if (!DEXRiskAssessmentService.instance) {
      DEXRiskAssessmentService.instance = new DEXRiskAssessmentService();
    }
    return DEXRiskAssessmentService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    logger.info('DEX Risk Assessment Service initialized');
  }

  /**
   * Assess risk for a DEX swap transaction
   */
  public async assessSwapRisk(
    swap: DEXSwapData,
    walletScreening?: WalletScreeningResult
  ): Promise<DEXRiskAssessmentData> {
    const assessmentId = uuidv4();
    const startTime = Date.now();

    try {
      // Get wallet screening if not provided
      const screeningOptions: { userId?: string; brokerId?: string } = {};
      if (swap.userId) screeningOptions.userId = swap.userId;
      if (swap.brokerId) screeningOptions.brokerId = swap.brokerId;
      
      const screening = walletScreening || await walletScreeningService.screenWallet(
        swap.walletAddress,
        swap.chainId,
        swap.tenantId,
        screeningOptions
      );

      // Calculate risk factors
      const factors = await this.calculateSwapRiskFactors(swap, screening);

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(factors);
      const riskLevel = this.calculateRiskLevel(riskScore);

      // Determine flags and recommendations
      const flags = this.determineSwapFlags(swap, screening, factors);
      const recommendations = this.determineRecommendations(riskLevel, flags);

      const assessment: DEXRiskAssessmentData = {
        id: assessmentId,
        transactionId: swap.id,
        transactionHash: swap.transactionHash,
        walletAddress: swap.walletAddress,
        tenantId: swap.tenantId,
        riskScore,
        riskLevel,
        factors,
        flags,
        recommendations,
        assessmentDate: new Date(),
        assessor: config.serviceName,
        reviewRequired: riskLevel === 'high' || riskLevel === 'critical',
      };

      // Add optional fields
      if (swap.userId) {
        assessment.userId = swap.userId;
      }
      if (swap.brokerId) {
        assessment.brokerId = swap.brokerId;
      }

      // Store assessment
      await this.storeAssessment(assessment);

      // Publish events
      await this.publishAssessmentEvent(assessment);

      // Publish alert if high risk
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.publishHighRiskAlert(assessment, 'transaction');
      }

      const duration = Date.now() - startTime;
      logger.logCompliance('swap_risk_assessment_completed', assessmentId, {
        transactionHash: swap.transactionHash,
        riskScore,
        riskLevel,
        duration,
      });

      return assessment;
    } catch (error) {
      logger.error('Swap risk assessment failed', {
        swapId: swap.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Assess risk for a liquidity provision
   */
  public async assessLiquidityRisk(
    liquidity: DEXLiquidityData,
    walletScreening?: WalletScreeningResult
  ): Promise<DEXRiskAssessmentData> {
    const assessmentId = uuidv4();
    const startTime = Date.now();

    try {
      // Get wallet screening if not provided
      const screeningOptions: { userId?: string; brokerId?: string } = {};
      if (liquidity.userId) screeningOptions.userId = liquidity.userId;
      if (liquidity.brokerId) screeningOptions.brokerId = liquidity.brokerId;
      
      const screening = walletScreening || await walletScreeningService.screenWallet(
        liquidity.walletAddress,
        liquidity.chainId,
        liquidity.tenantId,
        screeningOptions
      );

      // Calculate risk factors
      const factors = await this.calculateLiquidityRiskFactors(liquidity, screening);

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(factors);
      const riskLevel = this.calculateRiskLevel(riskScore);

      // Determine flags and recommendations
      const flags = this.determineLiquidityFlags(liquidity, screening, factors);
      const recommendations = this.determineRecommendations(riskLevel, flags);

      const assessment: DEXRiskAssessmentData = {
        id: assessmentId,
        transactionId: liquidity.id,
        transactionHash: liquidity.transactionHash,
        walletAddress: liquidity.walletAddress,
        tenantId: liquidity.tenantId,
        riskScore,
        riskLevel,
        factors,
        flags,
        recommendations,
        assessmentDate: new Date(),
        assessor: config.serviceName,
        reviewRequired: riskLevel === 'high' || riskLevel === 'critical',
      };

      // Add optional fields
      if (liquidity.userId) {
        assessment.userId = liquidity.userId;
      }
      if (liquidity.brokerId) {
        assessment.brokerId = liquidity.brokerId;
      }

      // Store assessment
      await this.storeAssessment(assessment);

      // Publish events
      await this.publishAssessmentEvent(assessment);

      const duration = Date.now() - startTime;
      logger.logCompliance('liquidity_risk_assessment_completed', assessmentId, {
        transactionHash: liquidity.transactionHash,
        riskScore,
        riskLevel,
        duration,
      });

      return assessment;
    } catch (error) {
      logger.error('Liquidity risk assessment failed', {
        liquidityId: liquidity.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Assess risk for a bridge transaction
   */
  public async assessBridgeRisk(
    bridge: BridgeTransaction,
    walletScreening?: WalletScreeningResult
  ): Promise<DEXRiskAssessmentData> {
    const assessmentId = uuidv4();
    const startTime = Date.now();

    try {
      // Get wallet screening if not provided
      const screeningOptions: { userId?: string } = {};
      if (bridge.userId) screeningOptions.userId = bridge.userId;
      
      const screening = walletScreening || await walletScreeningService.screenWallet(
        bridge.sourceWallet,
        bridge.sourceChainId,
        bridge.tenantId,
        screeningOptions
      );

      // Calculate risk factors
      const factors = await this.calculateBridgeRiskFactors(bridge, screening);

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(factors);
      const riskLevel = this.calculateRiskLevel(riskScore);

      // Determine flags and recommendations
      const flags = this.determineBridgeFlags(bridge, screening, factors);
      const recommendations = this.determineRecommendations(riskLevel, flags);

      const assessment: DEXRiskAssessmentData = {
        id: assessmentId,
        transactionId: bridge.id,
        transactionHash: bridge.sourceTransactionHash,
        walletAddress: bridge.sourceWallet,
        tenantId: bridge.tenantId,
        riskScore,
        riskLevel,
        factors,
        flags,
        recommendations,
        assessmentDate: new Date(),
        assessor: config.serviceName,
        reviewRequired: riskLevel === 'high' || riskLevel === 'critical',
      };

      // Add optional fields
      if (bridge.userId) {
        assessment.userId = bridge.userId;
      }

      // Store assessment
      await this.storeAssessment(assessment);

      // Publish events
      await this.publishAssessmentEvent(assessment);

      // Publish alert if high risk
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.publishHighRiskAlert(assessment, 'bridge');
      }

      const duration = Date.now() - startTime;
      logger.logCompliance('bridge_risk_assessment_completed', assessmentId, {
        transactionHash: bridge.sourceTransactionHash,
        riskScore,
        riskLevel,
        duration,
      });

      return assessment;
    } catch (error) {
      logger.error('Bridge risk assessment failed', {
        bridgeId: bridge.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate risk factors for a swap
   */
  private async calculateSwapRiskFactors(
    swap: DEXSwapData,
    screening: WalletScreeningResult
  ): Promise<DEXRiskFactors> {
    // Wallet risk from screening
    const walletRisk = screening.riskScore;

    // Protocol risk
    const protocolRisk = this.getProtocolRiskScore(swap.protocol);

    // Transaction risk based on amount and characteristics
    const transactionRisk = this.calculateTransactionRisk(
      parseFloat(swap.amountInUSD),
      parseFloat(swap.priceImpact),
      parseFloat(swap.slippage)
    );

    // Geography risk (simplified - would use IP geolocation in production)
    const geographyRisk = 0;

    // Pattern risk (would analyze historical patterns)
    const patternRisk = await this.calculatePatternRisk(swap.walletAddress, swap.chainId);

    // Velocity risk (transaction frequency)
    const velocityRisk = await this.calculateVelocityRisk(swap.walletAddress, swap.chainId);

    // Concentration risk (single token/pool concentration)
    const concentrationRisk = 0; // Would analyze portfolio

    // Counterparty risk (pool/protocol counterparty)
    const counterpartyRisk = protocolRisk * 0.5;

    return {
      walletRisk,
      protocolRisk,
      transactionRisk,
      geographyRisk,
      patternRisk,
      velocityRisk,
      concentrationRisk,
      counterpartyRisk,
    };
  }

  /**
   * Calculate risk factors for liquidity provision
   */
  private async calculateLiquidityRiskFactors(
    liquidity: DEXLiquidityData,
    screening: WalletScreeningResult
  ): Promise<DEXRiskFactors> {
    const walletRisk = screening.riskScore;
    const protocolRisk = this.getProtocolRiskScore(liquidity.protocol);
    const transactionRisk = this.calculateLiquidityTransactionRisk(
      parseFloat(liquidity.totalValueUSD),
      liquidity.action
    );
    const geographyRisk = 0;
    const patternRisk = await this.calculatePatternRisk(liquidity.walletAddress, liquidity.chainId);
    const velocityRisk = await this.calculateVelocityRisk(liquidity.walletAddress, liquidity.chainId);
    const concentrationRisk = 10; // LP positions have inherent concentration risk
    const counterpartyRisk = protocolRisk * 0.5;

    return {
      walletRisk,
      protocolRisk,
      transactionRisk,
      geographyRisk,
      patternRisk,
      velocityRisk,
      concentrationRisk,
      counterpartyRisk,
    };
  }

  /**
   * Calculate risk factors for bridge transaction
   */
  private async calculateBridgeRiskFactors(
    bridge: BridgeTransaction,
    screening: WalletScreeningResult
  ): Promise<DEXRiskFactors> {
    const walletRisk = screening.riskScore;
    const protocolRisk = this.getProtocolRiskScore(bridge.bridgeProtocol) + 10; // Bridges have inherent risk
    const transactionRisk = this.calculateBridgeTransactionRisk(
      parseFloat(bridge.amountUSD),
      bridge.sourceWallet !== bridge.destinationWallet
    );
    const geographyRisk = 0;
    const patternRisk = await this.calculatePatternRisk(bridge.sourceWallet, bridge.sourceChainId);
    const velocityRisk = await this.calculateVelocityRisk(bridge.sourceWallet, bridge.sourceChainId);
    const concentrationRisk = 0;
    const counterpartyRisk = bridge.sourceWallet !== bridge.destinationWallet ? 30 : 10;

    return {
      walletRisk,
      protocolRisk,
      transactionRisk,
      geographyRisk,
      patternRisk,
      velocityRisk,
      concentrationRisk,
      counterpartyRisk,
    };
  }

  /**
   * Get protocol risk score
   */
  private getProtocolRiskScore(protocol: string): number {
    const normalizedProtocol = protocol.toLowerCase();
    const score = PROTOCOL_RISK_SCORES[normalizedProtocol];
    if (score !== undefined) {
      return score;
    }
    return PROTOCOL_RISK_SCORES['unknown'] ?? 50;
  }

  /**
   * Calculate transaction risk for swaps
   */
  private calculateTransactionRisk(
    amountUSD: number,
    priceImpact: number,
    slippage: number
  ): number {
    let risk = 0;

    // Amount-based risk
    if (amountUSD > 1000000) risk += 40;
    else if (amountUSD > 100000) risk += 25;
    else if (amountUSD > 10000) risk += 10;

    // Price impact risk
    if (priceImpact > 5) risk += 30;
    else if (priceImpact > 2) risk += 15;
    else if (priceImpact > 1) risk += 5;

    // Slippage risk
    if (slippage > 5) risk += 20;
    else if (slippage > 2) risk += 10;

    return Math.min(risk, 100);
  }

  /**
   * Calculate transaction risk for liquidity
   */
  private calculateLiquidityTransactionRisk(
    amountUSD: number,
    action: 'add' | 'remove'
  ): number {
    let risk = 0;

    // Amount-based risk
    if (amountUSD > 1000000) risk += 30;
    else if (amountUSD > 100000) risk += 20;
    else if (amountUSD > 10000) risk += 10;

    // Remove action has slightly higher risk (potential rug pull)
    if (action === 'remove') risk += 5;

    return Math.min(risk, 100);
  }

  /**
   * Calculate transaction risk for bridges
   */
  private calculateBridgeTransactionRisk(
    amountUSD: number,
    differentDestination: boolean
  ): number {
    let risk = 0;

    // Amount-based risk (bridges have higher thresholds)
    if (amountUSD > 500000) risk += 40;
    else if (amountUSD > 100000) risk += 25;
    else if (amountUSD > 10000) risk += 15;

    // Different destination wallet increases risk
    if (differentDestination) risk += 20;

    return Math.min(risk, 100);
  }

  /**
   * Calculate pattern risk
   */
  private async calculatePatternRisk(
    _walletAddress: string,
    _chainId: number
  ): Promise<number> {
    // In production, this would analyze:
    // - Transaction patterns
    // - Time-based patterns
    // - Amount patterns
    // - Counterparty patterns
    return 0;
  }

  /**
   * Calculate velocity risk
   */
  private async calculateVelocityRisk(
    _walletAddress: string,
    _chainId: number
  ): Promise<number> {
    // In production, this would analyze:
    // - Transaction frequency
    // - Volume velocity
    // - Unusual spikes
    return 0;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(factors: DEXRiskFactors): number {
    const weightedScore =
      factors.walletRisk * RISK_WEIGHTS.walletRisk +
      factors.protocolRisk * RISK_WEIGHTS.protocolRisk +
      factors.transactionRisk * RISK_WEIGHTS.transactionRisk +
      factors.geographyRisk * RISK_WEIGHTS.geographyRisk +
      factors.patternRisk * RISK_WEIGHTS.patternRisk +
      factors.velocityRisk * RISK_WEIGHTS.velocityRisk +
      factors.concentrationRisk * RISK_WEIGHTS.concentrationRisk +
      factors.counterpartyRisk * RISK_WEIGHTS.counterpartyRisk;

    return Math.round(Math.min(weightedScore, 100));
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= config.riskThresholds.high) return 'critical';
    if (score >= config.riskThresholds.medium) return 'high';
    if (score >= config.riskThresholds.low) return 'medium';
    return 'low';
  }

  /**
   * Determine flags for swap
   */
  private determineSwapFlags(
    swap: DEXSwapData,
    screening: WalletScreeningResult,
    _factors: DEXRiskFactors
  ): DEXRiskFlag[] {
    const flags: DEXRiskFlag[] = [];

    // Add wallet screening flags
    flags.push(...screening.flags);

    // Check for high slippage
    if (parseFloat(swap.slippage) > 5) {
      flags.push('high_slippage');
    }

    // Check for high price impact
    if (parseFloat(swap.priceImpact) > 5) {
      flags.push('price_manipulation');
    }

    return [...new Set(flags)]; // Remove duplicates
  }

  /**
   * Determine flags for liquidity
   */
  private determineLiquidityFlags(
    liquidity: DEXLiquidityData,
    screening: WalletScreeningResult,
    _factors: DEXRiskFactors
  ): DEXRiskFlag[] {
    const flags: DEXRiskFlag[] = [];

    // Add wallet screening flags
    flags.push(...screening.flags);

    // Check for potential rug pull (large removal)
    if (liquidity.action === 'remove' && parseFloat(liquidity.totalValueUSD) > 100000) {
      flags.push('rug_pull_risk');
    }

    return [...new Set(flags)];
  }

  /**
   * Determine flags for bridge
   */
  private determineBridgeFlags(
    bridge: BridgeTransaction,
    screening: WalletScreeningResult,
    _factors: DEXRiskFactors
  ): DEXRiskFlag[] {
    const flags: DEXRiskFlag[] = [];

    // Add wallet screening flags
    flags.push(...screening.flags);

    // Add existing bridge risk flags
    if (bridge.riskFlags) {
      flags.push(...(bridge.riskFlags as DEXRiskFlag[]));
    }

    return [...new Set(flags)];
  }

  /**
   * Determine recommendations based on risk
   */
  private determineRecommendations(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: DEXRiskFlag[]
  ): DEXRiskRecommendation[] {
    const recommendations: DEXRiskRecommendation[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('block_transaction');
      recommendations.push('report_to_authorities');
      recommendations.push('freeze_funds');
    } else if (riskLevel === 'high') {
      recommendations.push('manual_review');
      recommendations.push('enhanced_monitoring');
      recommendations.push('contact_user');
    } else if (riskLevel === 'medium') {
      recommendations.push('enhanced_monitoring');
    }

    // Flag-specific recommendations
    if (flags.includes('sanctions_match')) {
      recommendations.push('block_transaction');
      recommendations.push('report_to_authorities');
    }

    if (flags.includes('mixer_interaction')) {
      recommendations.push('source_of_funds_verification');
      recommendations.push('chain_analysis');
    }

    return [...new Set(recommendations)];
  }

  /**
   * Store assessment in database
   */
  private async storeAssessment(assessment: DEXRiskAssessmentData): Promise<void> {
    const query = `
      INSERT INTO dex_compliance.risk_assessments (
        id, transaction_id, transaction_hash, wallet_address, user_id, tenant_id, broker_id,
        risk_score, risk_level, factor_wallet_risk, factor_protocol_risk, factor_transaction_risk,
        factor_geography_risk, factor_pattern_risk, factor_velocity_risk, factor_concentration_risk,
        factor_counterparty_risk, flags, recommendations, assessment_date, assessor, review_required
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
    `;

    await databaseService.query(query, [
      assessment.id,
      assessment.transactionId,
      assessment.transactionHash,
      assessment.walletAddress,
      assessment.userId || null,
      assessment.tenantId,
      assessment.brokerId || null,
      assessment.riskScore,
      assessment.riskLevel,
      assessment.factors.walletRisk,
      assessment.factors.protocolRisk,
      assessment.factors.transactionRisk,
      assessment.factors.geographyRisk,
      assessment.factors.patternRisk,
      assessment.factors.velocityRisk,
      assessment.factors.concentrationRisk,
      assessment.factors.counterpartyRisk,
      assessment.flags,
      assessment.recommendations,
      assessment.assessmentDate,
      assessment.assessor,
      assessment.reviewRequired,
    ]);
  }

  /**
   * Publish assessment completed event
   */
  private async publishAssessmentEvent(assessment: DEXRiskAssessmentData): Promise<void> {
    const eventData: DEXRiskAssessmentCompletedEvent['data'] = {
      assessmentId: assessment.id,
      transactionId: assessment.transactionId,
      transactionHash: assessment.transactionHash,
      walletAddress: assessment.walletAddress,
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel,
      flags: assessment.flags as string[],
      recommendations: assessment.recommendations as string[],
      assessmentDate: assessment.assessmentDate.toISOString(),
      assessor: assessment.assessor,
    };

    // Add optional fields
    if (assessment.userId) {
      eventData.userId = assessment.userId;
    }
    if (assessment.brokerId) {
      eventData.brokerId = assessment.brokerId;
    }

    const event: DEXRiskAssessmentCompletedEvent = {
      id: uuidv4(),
      type: 'compliance.dex.risk_assessment.completed',
      source: config.serviceName,
      tenantId: assessment.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publishRiskAssessmentCompleted(event);
  }

  /**
   * Publish high risk alert
   */
  private async publishHighRiskAlert(
    assessment: DEXRiskAssessmentData,
    alertType: 'wallet' | 'transaction' | 'protocol' | 'bridge'
  ): Promise<void> {
    const eventData: HighRiskAlertEvent['data'] = {
      alertId: uuidv4(),
      alertType,
      entityId: assessment.transactionId,
      entityType: alertType,
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel as 'high' | 'critical',
      flags: assessment.flags as string[],
      recommendations: assessment.recommendations as string[],
      requiresAction: true,
    };

    // Add optional fields
    if (assessment.userId) {
      eventData.userId = assessment.userId;
    }
    if (assessment.brokerId) {
      eventData.brokerId = assessment.brokerId;
    }

    const event: HighRiskAlertEvent = {
      id: uuidv4(),
      type: 'compliance.dex.alert.high_risk',
      source: config.serviceName,
      tenantId: assessment.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publishHighRiskAlert(event);
  }

  /**
   * Get assessment by ID
   */
  public async getAssessment(assessmentId: string): Promise<DEXRiskAssessmentData | null> {
    const query = `
      SELECT * FROM dex_compliance.risk_assessments
      WHERE id = $1
    `;

    const result = await databaseService.query(query, [assessmentId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapRowToAssessment(row as Record<string, unknown>);
  }

  /**
   * Get assessments for a wallet
   */
  public async getWalletAssessments(
    walletAddress: string,
    limit = 10
  ): Promise<DEXRiskAssessmentData[]> {
    const query = `
      SELECT * FROM dex_compliance.risk_assessments
      WHERE wallet_address = $1
      ORDER BY assessment_date DESC
      LIMIT $2
    `;

    const result = await databaseService.query(query, [walletAddress.toLowerCase(), limit]);
    return result.rows.map(this.mapRowToAssessment);
  }

  /**
   * Map database row to assessment
   */
  private mapRowToAssessment(row: Record<string, unknown>): DEXRiskAssessmentData {
    const assessment: DEXRiskAssessmentData = {
      id: row['id'] as string,
      transactionId: row['transaction_id'] as string,
      transactionHash: row['transaction_hash'] as string,
      walletAddress: row['wallet_address'] as string,
      tenantId: row['tenant_id'] as string,
      riskScore: row['risk_score'] as number,
      riskLevel: row['risk_level'] as 'low' | 'medium' | 'high' | 'critical',
      factors: {
        walletRisk: row['factor_wallet_risk'] as number,
        protocolRisk: row['factor_protocol_risk'] as number,
        transactionRisk: row['factor_transaction_risk'] as number,
        geographyRisk: row['factor_geography_risk'] as number,
        patternRisk: row['factor_pattern_risk'] as number,
        velocityRisk: row['factor_velocity_risk'] as number,
        concentrationRisk: row['factor_concentration_risk'] as number,
        counterpartyRisk: row['factor_counterparty_risk'] as number,
      },
      flags: row['flags'] as DEXRiskFlag[],
      recommendations: row['recommendations'] as DEXRiskRecommendation[],
      assessmentDate: new Date(row['assessment_date'] as string),
      assessor: row['assessor'] as string,
      reviewRequired: row['review_required'] as boolean,
    };

    // Add optional fields
    if (row['user_id']) {
      assessment.userId = row['user_id'] as string;
    }
    if (row['broker_id']) {
      assessment.brokerId = row['broker_id'] as string;
    }
    if (row['reviewed_by']) {
      assessment.reviewedBy = row['reviewed_by'] as string;
    }
    if (row['reviewed_at']) {
      assessment.reviewedAt = new Date(row['reviewed_at'] as string);
    }
    if (row['review_notes']) {
      assessment.reviewNotes = row['review_notes'] as string;
    }
    if (row['override_reason']) {
      assessment.overrideReason = row['override_reason'] as string;
    }

    return assessment;
  }

  /**
   * Close service
   */
  public async close(): Promise<void> {
    this.protocolRiskCache.clear();
    logger.info('DEX Risk Assessment Service closed');
  }
}

// ==================== EXPORT ====================

export const dexRiskAssessmentService = DEXRiskAssessmentService.getInstance();
