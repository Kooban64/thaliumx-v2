/**
 * Token Risk Assessment Service
 * Assesses risk for token transfers
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { getWalletScreeningService } from '../wallet-screening';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import type {
  TokenRiskAssessmentData,
  TokenRiskFactors,
  TokenRiskFlag,
  TokenRiskRecommendation,
} from '../../types/compliance';
import type { TokenRiskAssessmentTable } from '../../types/database';

const logger = createComponentLogger('token-risk-assessment-service');

/**
 * Risk assessment input
 */
export interface RiskAssessmentInput {
  transferId: string;
  transactionHash: string;
  contractAddress: string;
  tokenSymbol: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
}

/**
 * Token Risk Assessment Service
 */
export class TokenRiskAssessmentService {
  /**
   * Assess risk for a token transfer
   */
  async assessTransfer(input: RiskAssessmentInput): Promise<TokenRiskAssessmentData> {
    const startTime = Date.now();
    logger.info('Assessing token transfer risk', {
      transferId: input.transferId,
      contractAddress: input.contractAddress,
    });

    try {
      const config = getConfig();
      const walletScreeningService = getWalletScreeningService();

      // Screen sender and recipient wallets
      const [senderScreening, recipientScreening] = await Promise.all([
        walletScreeningService.screenWallet(input.fromAddress, input.chainId, input.tenantId),
        walletScreeningService.screenWallet(input.toAddress, input.chainId, input.tenantId),
      ]);

      // Calculate risk factors
      const factors: TokenRiskFactors = {
        senderRisk: senderScreening.riskScore,
        recipientRisk: recipientScreening.riskScore,
        tokenRisk: await this.assessTokenRisk(input.contractAddress, input.chainId),
        amountRisk: this.assessAmountRisk(parseFloat(input.amountUSD)),
        velocityRisk: await this.assessVelocityRisk(input.fromAddress, input.chainId, input.tenantId),
        patternRisk: await this.assessPatternRisk(input.fromAddress, input.toAddress, input.chainId, input.tenantId),
        geographyRisk: 0, // Would require IP/jurisdiction data
        contractRisk: await this.assessContractRisk(input.contractAddress, input.chainId),
      };

      // Collect flags
      const flags: TokenRiskFlag[] = [];

      // Add flags from wallet screenings
      if (senderScreening.sanctionsMatch || recipientScreening.sanctionsMatch) {
        flags.push('sanctions_match');
      }
      if (senderScreening.riskScore >= config.riskThresholds.high || recipientScreening.riskScore >= config.riskThresholds.high) {
        flags.push('high_risk_wallet');
      }
      if (senderScreening.mixerExposure > 10 || recipientScreening.mixerExposure > 10) {
        flags.push('mixer_interaction');
      }
      if (senderScreening.flags.includes('tornado_cash') || recipientScreening.flags.includes('tornado_cash')) {
        flags.push('tornado_cash');
      }

      // Amount-based flags
      const amountUSD = parseFloat(input.amountUSD);
      if (amountUSD >= 100000) {
        flags.push('high_value_transfer');
      }
      if (amountUSD >= 1000000) {
        flags.push('whale_movement');
      }

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(factors, flags);
      const riskLevel = this.getRiskLevel(riskScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskScore, riskLevel, flags);

      // Determine if review is required
      const reviewRequired = riskLevel === 'high' || riskLevel === 'critical' || flags.includes('sanctions_match');

      // Create assessment
      const assessment: TokenRiskAssessmentData = {
        id: uuidv4(),
        transferId: input.transferId,
        transactionHash: input.transactionHash,
        contractAddress: input.contractAddress,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amount: input.amount,
        amountUSD: input.amountUSD,
        userId: input.userId,
        tenantId: input.tenantId,
        brokerId: input.brokerId,
        riskScore,
        riskLevel,
        factors,
        flags,
        recommendations,
        assessmentDate: new Date(),
        assessor: 'token-compliance-service',
        reviewRequired,
      };

      // Save to database
      await this.saveAssessment(assessment);

      // Publish events
      await this.publishAssessmentEvents(assessment);

      const duration = Date.now() - startTime;
      logger.logRiskAssessmentEvent(
        'completed',
        assessment.id,
        riskScore,
        riskLevel,
        { durationMs: duration, flagCount: flags.length }
      );

      return assessment;
    } catch (error) {
      logger.error('Failed to assess token transfer risk', {
        transferId: input.transferId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Assess token contract risk
   */
  private async assessTokenRisk(_contractAddress: string, _chainId: number): Promise<number> {
    // In production, would check token contract for:
    // - Honeypot detection
    // - Rug pull indicators
    // - Contract verification status
    // - Token age and trading history
    return 0;
  }

  /**
   * Assess amount risk
   */
  private assessAmountRisk(amountUSD: number): number {
    if (amountUSD >= 1000000) return 80;
    if (amountUSD >= 100000) return 50;
    if (amountUSD >= 10000) return 30;
    if (amountUSD >= 1000) return 10;
    return 0;
  }

  /**
   * Assess velocity risk (frequency of transactions)
   */
  private async assessVelocityRisk(
    fromAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<number> {
    const db = getDatabaseService();
    const oneHourAgo = new Date(Date.now() - 3600000);

    const result = await db.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM token_transfers
      WHERE from_address = $1
        AND chain_id = $2
        AND tenant_id = $3
        AND timestamp > $4
    `, [fromAddress.toLowerCase(), chainId, tenantId, oneHourAgo]);

    const count = parseInt(result?.count ?? '0', 10);
    if (count >= 50) return 80;
    if (count >= 20) return 50;
    if (count >= 10) return 30;
    return 0;
  }

  /**
   * Assess pattern risk
   */
  private async assessPatternRisk(
    _fromAddress: string,
    _toAddress: string,
    _chainId: number,
    _tenantId: string
  ): Promise<number> {
    // Check for suspicious patterns like:
    // - Repeated transfers between same addresses
    // - Round number amounts
    // - Timing patterns
    return 0;
  }

  /**
   * Assess contract risk
   */
  private async assessContractRisk(_contractAddress: string, _chainId: number): Promise<number> {
    // In production, would analyze contract for risks
    return 0;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(factors: TokenRiskFactors, flags: TokenRiskFlag[]): number {
    // Weighted average of factors
    const weights = {
      senderRisk: 0.25,
      recipientRisk: 0.25,
      tokenRisk: 0.15,
      amountRisk: 0.10,
      velocityRisk: 0.10,
      patternRisk: 0.05,
      geographyRisk: 0.05,
      contractRisk: 0.05,
    };

    let score = 0;
    score += factors.senderRisk * weights.senderRisk;
    score += factors.recipientRisk * weights.recipientRisk;
    score += factors.tokenRisk * weights.tokenRisk;
    score += factors.amountRisk * weights.amountRisk;
    score += factors.velocityRisk * weights.velocityRisk;
    score += factors.patternRisk * weights.patternRisk;
    score += factors.geographyRisk * weights.geographyRisk;
    score += factors.contractRisk * weights.contractRisk;

    // Add flag penalties
    const flagPenalties: Partial<Record<TokenRiskFlag, number>> = {
      sanctions_match: 50,
      high_risk_wallet: 20,
      mixer_interaction: 25,
      tornado_cash: 30,
      stolen_funds: 40,
      high_value_transfer: 10,
      whale_movement: 15,
    };

    for (const flag of flags) {
      score += flagPenalties[flag] ?? 0;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    const config = getConfig();
    if (score >= config.riskThresholds.critical) return 'critical';
    if (score >= config.riskThresholds.high) return 'high';
    if (score >= config.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    _riskScore: number,
    riskLevel: string,
    flags: TokenRiskFlag[]
  ): TokenRiskRecommendation[] {
    const recommendations: TokenRiskRecommendation[] = [];

    if (flags.includes('sanctions_match')) {
      recommendations.push('block_transfer');
      recommendations.push('report_to_authorities');
    }

    if (flags.includes('mixer_interaction') || flags.includes('tornado_cash')) {
      recommendations.push('verify_source_of_funds');
      recommendations.push('enhanced_monitoring');
    }

    if (riskLevel === 'critical') {
      recommendations.push('block_transfer');
      recommendations.push('manual_review');
    } else if (riskLevel === 'high') {
      recommendations.push('manual_review');
      recommendations.push('enhanced_monitoring');
    } else if (riskLevel === 'medium') {
      recommendations.push('enhanced_monitoring');
    }

    if (flags.includes('high_value_transfer')) {
      recommendations.push('verify_source_of_funds');
    }

    return [...new Set(recommendations)];
  }

  /**
   * Save assessment to database
   */
  private async saveAssessment(assessment: TokenRiskAssessmentData): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO token_risk_assessments (
        id, transfer_id, transaction_hash, contract_address,
        from_address, to_address, amount, amount_usd,
        user_id, tenant_id, broker_id, risk_score, risk_level,
        factor_sender_risk, factor_recipient_risk, factor_token_risk,
        factor_amount_risk, factor_velocity_risk, factor_pattern_risk,
        factor_geography_risk, factor_contract_risk,
        flags, recommendations, assessment_date, assessor,
        review_required, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      assessment.id,
      assessment.transferId,
      assessment.transactionHash,
      assessment.contractAddress,
      assessment.fromAddress,
      assessment.toAddress,
      assessment.amount,
      assessment.amountUSD,
      assessment.userId,
      assessment.tenantId,
      assessment.brokerId,
      assessment.riskScore,
      assessment.riskLevel,
      assessment.factors.senderRisk,
      assessment.factors.recipientRisk,
      assessment.factors.tokenRisk,
      assessment.factors.amountRisk,
      assessment.factors.velocityRisk,
      assessment.factors.patternRisk,
      assessment.factors.geographyRisk,
      assessment.factors.contractRisk,
      assessment.flags,
      assessment.recommendations,
      assessment.assessmentDate,
      assessment.assessor,
      assessment.reviewRequired,
    ]);
  }

  /**
   * Publish assessment events
   */
  private async publishAssessmentEvents(assessment: TokenRiskAssessmentData): Promise<void> {
    const producer = getEventProducer();

    await producer.publishRiskAssessmentCreated(
      assessment.id,
      assessment.transferId,
      assessment.transactionHash,
      assessment.contractAddress,
      assessment.fromAddress,
      assessment.toAddress,
      assessment.amount,
      assessment.amountUSD,
      assessment.riskScore,
      assessment.riskLevel,
      assessment.flags,
      assessment.recommendations,
      assessment.reviewRequired,
      assessment.tenantId,
      assessment.brokerId,
      assessment.userId
    );

    if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
      await producer.publishHighRiskAlert(
        assessment.id,
        assessment.transferId,
        assessment.transactionHash,
        assessment.contractAddress,
        assessment.fromAddress,
        assessment.toAddress,
        assessment.amount,
        assessment.amountUSD,
        assessment.riskScore,
        assessment.riskLevel,
        assessment.flags,
        assessment.riskLevel === 'critical' ? 'immediate' : 'high',
        assessment.recommendations,
        assessment.tenantId,
        assessment.brokerId
      );
    }
  }

  /**
   * Get assessment by ID
   */
  async getAssessment(assessmentId: string): Promise<TokenRiskAssessmentData | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<TokenRiskAssessmentTable>(`
      SELECT * FROM token_risk_assessments WHERE id = $1
    `, [assessmentId]);

    if (!row) return null;
    return this.mapTableToData(row);
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews(tenantId: string, limit = 100): Promise<TokenRiskAssessmentData[]> {
    const db = getDatabaseService();
    const rows = await db.queryAll<TokenRiskAssessmentTable>(`
      SELECT * FROM token_risk_assessments
      WHERE tenant_id = $1
        AND review_required = true
        AND reviewed_at IS NULL
      ORDER BY assessment_date DESC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Review assessment
   */
  async reviewAssessment(
    assessmentId: string,
    reviewedBy: string,
    _approved: boolean,
    reviewNotes?: string,
    overrideReason?: string,
    newRiskLevel?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<TokenRiskAssessmentData | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE token_risk_assessments
      SET reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2,
          override_reason = $3,
          risk_level = COALESCE($4, risk_level),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [reviewedBy, reviewNotes, overrideReason, newRiskLevel, assessmentId]);

    return await this.getAssessment(assessmentId);
  }

  /**
   * Map database table to data type
   */
  private mapTableToData(row: TokenRiskAssessmentTable): TokenRiskAssessmentData {
    return {
      id: row.id,
      transferId: row.transfer_id,
      transactionHash: row.transaction_hash,
      contractAddress: row.contract_address,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      amountUSD: row.amount_usd,
      userId: row.user_id ?? undefined,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      factors: {
        senderRisk: row.factor_sender_risk,
        recipientRisk: row.factor_recipient_risk,
        tokenRisk: row.factor_token_risk,
        amountRisk: row.factor_amount_risk,
        velocityRisk: row.factor_velocity_risk,
        patternRisk: row.factor_pattern_risk,
        geographyRisk: row.factor_geography_risk,
        contractRisk: row.factor_contract_risk,
      },
      flags: row.flags as TokenRiskFlag[],
      recommendations: row.recommendations as TokenRiskRecommendation[],
      assessmentDate: row.assessment_date,
      assessor: row.assessor,
      reviewRequired: row.review_required,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
      overrideReason: row.override_reason ?? undefined,
    };
  }

  /**
   * Assess approval risk
   */
  async assessApproval(approval: {
    id: string;
    transactionHash: string;
    contractAddress: string;
    chainId: number;
    ownerAddress: string;
    spenderAddress: string;
    amount: string;
    isUnlimited: boolean;
    tenantId: string;
    userId?: string;
  }): Promise<TokenRiskAssessmentData> {
    const input: RiskAssessmentInput = {
      transferId: approval.id,
      transactionHash: approval.transactionHash,
      contractAddress: approval.contractAddress,
      tokenSymbol: 'APPROVAL',
      chainId: approval.chainId,
      fromAddress: approval.ownerAddress,
      toAddress: approval.spenderAddress,
      amount: approval.amount,
      amountUSD: '0', // Approvals don't have direct USD value
      userId: approval.userId,
      tenantId: approval.tenantId,
    };

    const assessment = await this.assessTransfer(input);

    // Add unlimited approval flag if applicable
    if (approval.isUnlimited && !assessment.flags.includes('unlimited_approval')) {
      assessment.flags.push('unlimited_approval');
      assessment.riskScore = Math.min(100, assessment.riskScore + 20);
      assessment.recommendations.push('revoke_approval');
    }

    return assessment;
  }

  /**
   * Assess presale risk
   */
  async assessPresale(presale: {
    id: string;
    contractAddress: string;
    chainId: number;
    presaleAddress: string;
    tenantId: string;
    userId?: string;
    totalRaised: string;
    participantCount: number;
  }): Promise<TokenRiskAssessmentData> {
    const input: RiskAssessmentInput = {
      transferId: presale.id,
      transactionHash: '',
      contractAddress: presale.contractAddress,
      tokenSymbol: 'PRESALE',
      chainId: presale.chainId,
      fromAddress: presale.presaleAddress,
      toAddress: presale.presaleAddress,
      amount: presale.totalRaised,
      amountUSD: presale.totalRaised,
      userId: presale.userId,
      tenantId: presale.tenantId,
    };

    return await this.assessTransfer(input);
  }

  /**
   * Get assessments for a wallet
   */
  async getWalletAssessments(
    walletAddress: string,
    tenantId: string,
    limit = 100
  ): Promise<TokenRiskAssessmentData[]> {
    const db = getDatabaseService();
    const normalizedAddress = walletAddress.toLowerCase();

    const rows = await db.queryAll<TokenRiskAssessmentTable>(`
      SELECT * FROM token_risk_assessments
      WHERE (from_address = $1 OR to_address = $1)
        AND tenant_id = $2
      ORDER BY assessment_date DESC
      LIMIT $3
    `, [normalizedAddress, tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }
}

/**
 * Singleton instance
 */
let tokenRiskAssessmentServiceInstance: TokenRiskAssessmentService | null = null;

export function getTokenRiskAssessmentService(): TokenRiskAssessmentService {
  if (!tokenRiskAssessmentServiceInstance) {
    tokenRiskAssessmentServiceInstance = new TokenRiskAssessmentService();
  }
  return tokenRiskAssessmentServiceInstance;
}

export default getTokenRiskAssessmentService;
