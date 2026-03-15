/**
 * NFT Risk Assessment Service
 * Assesses risk for NFT transactions
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { getWashTradingService } from '../wash-trading';
import { getContentScreeningService } from '../content-screening';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import {
  NFTRiskAssessmentData,
  NFTRiskFactors,
  NFTRiskFlag,
  NFTRiskRecommendation,
} from '../../types/compliance';
import { NftRiskAssessmentRow } from '../../types/database';

const logger = createComponentLogger('nft-risk-assessment-service');

/**
 * Risk assessment input
 */
export interface RiskAssessmentInput {
  transactionId: string;
  transactionHash: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  sellerAddress: string;
  buyerAddress: string;
  price: string;
  priceUSD: string;
  marketplace: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
}

/**
 * NFT Risk Assessment Service
 */
export class NFTRiskAssessmentService {
  private riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  constructor() {
    const config = getConfig();
    this.riskThresholds = config.riskThresholds;
  }

  /**
   * Assess risk for an NFT transaction
   */
  async assessTransaction(input: RiskAssessmentInput): Promise<NFTRiskAssessmentData> {
    const startTime = Date.now();
    logger.info('Assessing NFT transaction risk', {
      transactionId: input.transactionId,
      contractAddress: input.contractAddress,
      tokenId: input.tokenId,
    });

    try {
      // Calculate individual risk factors
      const factors = await this.calculateRiskFactors(input);

      // Calculate overall risk score
      const riskScore = this.calculateOverallScore(factors);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(riskScore);

      // Identify risk flags
      const flags = await this.identifyRiskFlags(input, factors);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskLevel, flags);

      // Determine if review is required
      const reviewRequired = this.isReviewRequired(riskLevel, flags);

      // Create assessment result
      const assessment: NFTRiskAssessmentData = {
        id: uuidv4(),
        transactionId: input.transactionId,
        transactionHash: input.transactionHash,
        contractAddress: input.contractAddress,
        tokenId: input.tokenId,
        sellerAddress: input.sellerAddress,
        buyerAddress: input.buyerAddress,
        userId: input.userId,
        tenantId: input.tenantId,
        brokerId: input.brokerId,
        riskScore,
        riskLevel,
        factors,
        flags,
        recommendations,
        assessmentDate: new Date(),
        assessor: 'nft-compliance-service',
        reviewRequired,
      };

      // Save assessment to database
      await this.saveAssessment(assessment);

      // Publish events
      await this.publishAssessmentCreated(assessment);

      // Publish high risk alert if needed
      if (riskLevel === 'high' || riskLevel === 'critical') {
        await this.publishHighRiskAlert(assessment);
      }

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
      logger.error('Failed to assess NFT transaction risk', {
        transactionId: input.transactionId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Calculate individual risk factors
   */
  private async calculateRiskFactors(input: RiskAssessmentInput): Promise<NFTRiskFactors> {
    const [
      sellerRisk,
      buyerRisk,
      collectionRisk,
      priceRisk,
      contentRisk,
      washTradingRisk,
      marketplaceRisk,
      geographyRisk,
    ] = await Promise.all([
      this.assessSellerRisk(input.sellerAddress, input.chainId, input.tenantId),
      this.assessBuyerRisk(input.buyerAddress, input.chainId, input.tenantId),
      this.assessCollectionRisk(input.contractAddress, input.chainId, input.tenantId),
      this.assessPriceRisk(input.contractAddress, input.tokenId, input.chainId, parseFloat(input.priceUSD), input.tenantId),
      this.assessContentRisk(input.contractAddress, input.tokenId, input.chainId, input.tenantId),
      this.assessWashTradingRisk(input.contractAddress, input.tokenId, input.chainId, input.sellerAddress, input.buyerAddress, input.tenantId),
      this.assessMarketplaceRisk(input.marketplace),
      this.assessGeographyRisk(input.sellerAddress, input.buyerAddress),
    ]);

    return {
      sellerRisk,
      buyerRisk,
      collectionRisk,
      priceRisk,
      contentRisk,
      washTradingRisk,
      marketplaceRisk,
      geographyRisk,
    };
  }

  /**
   * Assess seller risk
   */
  private async assessSellerRisk(
    sellerAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<number> {
    const db = getDatabaseService();

    // Check seller's transaction history
    const history = await db.queryOne<{ saleCount: string; avgRisk: string }>(`
      SELECT COUNT(*) as sale_count, AVG(risk_score) as avg_risk
      FROM nft_sales
      WHERE seller_address = $1
        AND chain_id = $2
        AND tenant_id = $3
    `, [sellerAddress, chainId, tenantId]);

    if (!history || parseInt(history.saleCount, 10) === 0) {
      // New seller - moderate risk
      return 40;
    }

    const avgRisk = parseFloat(history.avgRisk) || 0;
    return Math.min(100, avgRisk);
  }

  /**
   * Assess buyer risk
   */
  private async assessBuyerRisk(
    buyerAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<number> {
    const db = getDatabaseService();

    // Check buyer's transaction history
    const history = await db.queryOne<{ purchaseCount: string; avgRisk: string }>(`
      SELECT COUNT(*) as purchase_count, AVG(risk_score) as avg_risk
      FROM nft_sales
      WHERE buyer_address = $1
        AND chain_id = $2
        AND tenant_id = $3
    `, [buyerAddress, chainId, tenantId]);

    if (!history || parseInt(history.purchaseCount, 10) === 0) {
      // New buyer - moderate risk
      return 40;
    }

    const avgRisk = parseFloat(history.avgRisk) || 0;
    return Math.min(100, avgRisk);
  }

  /**
   * Assess collection risk
   */
  private async assessCollectionRisk(
    contractAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<number> {
    const db = getDatabaseService();

    // Check collection risk score
    const collection = await db.queryOne<{ riskScore: number | null; verified: boolean }>(`
      SELECT risk_score, verified
      FROM nft_collections
      WHERE contract_address = $1
        AND chain_id = $2
        AND tenant_id = $3
    `, [contractAddress, chainId, tenantId]);

    if (!collection) {
      // Unknown collection - higher risk
      return 60;
    }

    // Verified collections get lower risk
    if (collection.verified) {
      return Math.max(0, (collection.riskScore || 20) - 20);
    }

    return collection.riskScore ?? 40;
  }

  /**
   * Assess price risk
   */
  private async assessPriceRisk(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    priceUSD: number,
    tenantId: string
  ): Promise<number> {
    const db = getDatabaseService();

    // Get average price for this token
    const avgPrice = await db.queryOne<{ avgPrice: string | null }>(`
      SELECT AVG(CAST(price_usd AS DECIMAL)) as avg_price
      FROM nft_sales
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
    `, [contractAddress, tokenId, chainId, tenantId]);

    if (!avgPrice || !avgPrice.avgPrice) {
      // No price history - moderate risk
      return 30;
    }

    const avg = parseFloat(avgPrice.avgPrice);
    if (avg === 0) return 30;

    // Calculate price deviation
    const deviation = Math.abs((priceUSD - avg) / avg) * 100;

    // Higher deviation = higher risk
    if (deviation > 200) return 80;
    if (deviation > 100) return 60;
    if (deviation > 50) return 40;
    return 20;
  }

  /**
   * Assess content risk
   */
  private async assessContentRisk(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    tenantId: string
  ): Promise<number> {
    const contentService = getContentScreeningService();

    // Get latest content screening
    const history = await contentService.getTokenHistory(
      contractAddress,
      tokenId,
      chainId,
      tenantId
    );

    if (history.length === 0) {
      // No screening - moderate risk
      return 40;
    }

    const latest = history[0];
    if (latest && latest.isFlagged) {
      return 90;
    }

    return latest ? latest.moderationScore : 40;
  }

  /**
   * Assess wash trading risk
   */
  private async assessWashTradingRisk(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    sellerAddress: string,
    buyerAddress: string,
    tenantId: string
  ): Promise<number> {
    const washTradingService = getWashTradingService();

    // Analyze for wash trading
    const result = await washTradingService.analyzeSale(
      uuidv4(), // Temporary sale ID for analysis
      contractAddress,
      tokenId,
      chainId,
      sellerAddress,
      buyerAddress,
      '0',
      '0',
      tenantId
    );

    return result.confidence;
  }

  /**
   * Assess marketplace risk
   */
  private async assessMarketplaceRisk(marketplace: string): Promise<number> {
    // Known marketplaces with their risk scores
    const marketplaceRisks: Record<string, number> = {
      opensea: 10,
      blur: 15,
      looksrare: 20,
      x2y2: 25,
      rarible: 20,
      foundation: 15,
      superrare: 10,
      niftygateway: 10,
      unknown: 50,
    };

    const normalizedMarketplace = marketplace.toLowerCase();
    return marketplaceRisks[normalizedMarketplace] ?? marketplaceRisks['unknown'] ?? 50;
  }

  /**
   * Assess geography risk
   */
  private async assessGeographyRisk(
    _sellerAddress: string,
    _buyerAddress: string
  ): Promise<number> {
    // In production, this would use IP geolocation or KYC data
    // For now, return a default moderate risk
    return 30;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallScore(factors: NFTRiskFactors): number {
    const weights = {
      sellerRisk: 0.15,
      buyerRisk: 0.15,
      collectionRisk: 0.15,
      priceRisk: 0.10,
      contentRisk: 0.15,
      washTradingRisk: 0.15,
      marketplaceRisk: 0.05,
      geographyRisk: 0.10,
    };

    const score =
      factors.sellerRisk * weights.sellerRisk +
      factors.buyerRisk * weights.buyerRisk +
      factors.collectionRisk * weights.collectionRisk +
      factors.priceRisk * weights.priceRisk +
      factors.contentRisk * weights.contentRisk +
      factors.washTradingRisk * weights.washTradingRisk +
      factors.marketplaceRisk * weights.marketplaceRisk +
      factors.geographyRisk * weights.geographyRisk;

    return Math.round(score);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.riskThresholds.critical) return 'critical';
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Identify risk flags
   */
  private async identifyRiskFlags(
    input: RiskAssessmentInput,
    factors: NFTRiskFactors
  ): Promise<NFTRiskFlag[]> {
    const flags: NFTRiskFlag[] = [];

    // Check wash trading
    if (factors.washTradingRisk >= 70) {
      flags.push('wash_trading');
    }

    // Check price manipulation
    if (factors.priceRisk >= 60) {
      flags.push('price_manipulation');
    }

    // Check content issues
    if (factors.contentRisk >= 70) {
      flags.push('adult_content');
    }

    // Check unverified collection
    if (factors.collectionRisk >= 60) {
      flags.push('unverified_collection');
    }

    // Check high value transaction
    const priceUSD = parseFloat(input.priceUSD);
    if (priceUSD >= 10000) {
      flags.push('high_value_transaction');
    }

    // Check new wallet
    if (factors.sellerRisk >= 40 || factors.buyerRisk >= 40) {
      flags.push('new_wallet');
    }

    // Check suspicious activity
    if (factors.sellerRisk >= 70 || factors.buyerRisk >= 70) {
      flags.push('suspicious_activity');
    }

    return flags;
  }

  /**
   * Generate recommendations based on risk
   */
  private generateRecommendations(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: NFTRiskFlag[]
  ): NFTRiskRecommendation[] {
    const recommendations: NFTRiskRecommendation[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('block_transaction');
      recommendations.push('report_to_authorities');
    }

    if (riskLevel === 'high') {
      recommendations.push('manual_review');
      recommendations.push('enhanced_monitoring');
    }

    if (flags.includes('wash_trading')) {
      recommendations.push('enhanced_monitoring');
    }

    if (flags.includes('adult_content') || flags.includes('illegal_content')) {
      recommendations.push('content_review');
    }

    if (flags.includes('high_value_transaction')) {
      recommendations.push('source_of_funds_verification');
    }

    if (flags.includes('stolen_nft') || flags.includes('counterfeit')) {
      recommendations.push('verify_ownership');
      recommendations.push('verify_authenticity');
    }

    if (flags.includes('suspicious_activity')) {
      recommendations.push('contact_user');
    }

    return [...new Set(recommendations)];
  }

  /**
   * Determine if manual review is required
   */
  private isReviewRequired(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: NFTRiskFlag[]
  ): boolean {
    if (riskLevel === 'high' || riskLevel === 'critical') {
      return true;
    }

    const reviewFlags: NFTRiskFlag[] = [
      'sanctions_match',
      'stolen_nft',
      'counterfeit',
      'illegal_content',
    ];

    return flags.some((flag) => reviewFlags.includes(flag));
  }

  /**
   * Save assessment to database
   */
  private async saveAssessment(assessment: NFTRiskAssessmentData): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO nft_risk_assessments (
        id, transaction_id, transaction_hash, contract_address, token_id,
        seller_address, buyer_address, user_id, tenant_id, broker_id,
        risk_score, risk_level, factor_seller_risk, factor_buyer_risk,
        factor_collection_risk, factor_price_risk, factor_content_risk,
        factor_wash_trading_risk, factor_marketplace_risk, factor_geography_risk,
        flags, recommendations, assessment_date, assessor, review_required,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      assessment.id,
      assessment.transactionId,
      assessment.transactionHash,
      assessment.contractAddress,
      assessment.tokenId,
      assessment.sellerAddress,
      assessment.buyerAddress,
      assessment.userId,
      assessment.tenantId,
      assessment.brokerId,
      assessment.riskScore,
      assessment.riskLevel,
      assessment.factors.sellerRisk,
      assessment.factors.buyerRisk,
      assessment.factors.collectionRisk,
      assessment.factors.priceRisk,
      assessment.factors.contentRisk,
      assessment.factors.washTradingRisk,
      assessment.factors.marketplaceRisk,
      assessment.factors.geographyRisk,
      assessment.flags,
      assessment.recommendations,
      assessment.assessmentDate,
      assessment.assessor,
      assessment.reviewRequired,
    ]);
  }

  /**
   * Publish assessment created event
   */
  private async publishAssessmentCreated(assessment: NFTRiskAssessmentData): Promise<void> {
    const producer = getEventProducer();

    await producer.publishRiskAssessmentCreated(
      assessment.id,
      assessment.transactionId,
      assessment.transactionHash,
      assessment.contractAddress,
      assessment.tokenId,
      assessment.sellerAddress,
      assessment.buyerAddress,
      assessment.riskScore,
      assessment.riskLevel,
      assessment.flags,
      assessment.recommendations,
      assessment.reviewRequired,
      assessment.tenantId,
      assessment.brokerId,
      assessment.userId
    );
  }

  /**
   * Publish high risk alert
   */
  private async publishHighRiskAlert(assessment: NFTRiskAssessmentData): Promise<void> {
    const producer = getEventProducer();

    const urgency: 'immediate' | 'high' | 'medium' =
      assessment.riskLevel === 'critical' ? 'immediate' : 'high';

    await producer.publishHighRiskAlert(
      assessment.id,
      assessment.transactionId,
      assessment.transactionHash,
      assessment.contractAddress,
      assessment.tokenId,
      assessment.riskScore,
      assessment.riskLevel as 'high' | 'critical',
      assessment.flags,
      urgency,
      assessment.recommendations,
      assessment.tenantId,
      assessment.brokerId
    );
  }

  /**
   * Review an assessment
   */
  async reviewAssessment(
    assessmentId: string,
    reviewedBy: string,
    approved: boolean,
    reviewNotes?: string,
    overrideReason?: string,
    newRiskLevel?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<NFTRiskAssessmentData> {
    const db = getDatabaseService();

    // Update assessment
    await db.query(`
      UPDATE nft_risk_assessments
      SET reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2,
          override_reason = $3,
          risk_level = COALESCE($4, risk_level),
          review_required = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [reviewedBy, reviewNotes, overrideReason, newRiskLevel, assessmentId]);

    // Get updated assessment
    const row = await db.queryOne<NftRiskAssessmentRow>(`
      SELECT * FROM nft_risk_assessments WHERE id = $1
    `, [assessmentId]);

    if (!row) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    const assessment = this.mapTableToAssessment(row);

    // Publish review event
    const producer = getEventProducer();
    await producer.send('nft.compliance.risk_assessments', {
      eventId: uuidv4(),
      eventType: 'nft.risk_assessment.reviewed',
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId: assessment.tenantId,
      payload: {
        assessmentId,
        transactionId: assessment.transactionId,
        reviewedBy,
        approved,
        overrideReason,
        newRiskLevel,
        actionTaken: approved ? 'approved' : 'rejected',
      },
    });

    logger.logRiskAssessmentEvent(
      'reviewed',
      assessmentId,
      assessment.riskScore,
      assessment.riskLevel,
      { reviewedBy, approved }
    );

    return assessment;
  }

  /**
   * Get assessment by ID
   */
  async getAssessment(assessmentId: string): Promise<NFTRiskAssessmentData | null> {
    const db = getDatabaseService();

    const row = await db.queryOne<NftRiskAssessmentRow>(`
      SELECT * FROM nft_risk_assessments WHERE id = $1
    `, [assessmentId]);

    if (!row) {
      return null;
    }

    return this.mapTableToAssessment(row);
  }

  /**
   * Get assessments for a transaction
   */
  async getTransactionAssessments(
    transactionId: string,
    tenantId: string
  ): Promise<NFTRiskAssessmentData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NftRiskAssessmentRow>(`
      SELECT * FROM nft_risk_assessments
      WHERE transaction_id = $1 AND tenant_id = $2
      ORDER BY assessment_date DESC
    `, [transactionId, tenantId]);

    return rows.map((row) => this.mapTableToAssessment(row));
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews(tenantId: string, limit = 100): Promise<NFTRiskAssessmentData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NftRiskAssessmentRow>(`
      SELECT * FROM nft_risk_assessments
      WHERE tenant_id = $1
        AND review_required = true
        AND reviewed_by IS NULL
      ORDER BY risk_score DESC, assessment_date ASC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToAssessment(row));
  }

  /**
   * Map database table to assessment type
   */
  private mapTableToAssessment(row: NftRiskAssessmentRow): NFTRiskAssessmentData {
    return {
      id: row.id,
      transactionId: row.transactionId,
      transactionHash: row.transactionHash,
      contractAddress: row.contractAddress,
      tokenId: row.tokenId,
      sellerAddress: row.sellerAddress,
      buyerAddress: row.buyerAddress,
      userId: row.userId ?? undefined,
      tenantId: row.tenantId,
      brokerId: row.brokerId ?? undefined,
      riskScore: row.riskScore,
      riskLevel: row.riskLevel,
      factors: {
        sellerRisk: row.factorSellerRisk,
        buyerRisk: row.factorBuyerRisk,
        collectionRisk: row.factorCollectionRisk,
        priceRisk: row.factorPriceRisk,
        contentRisk: row.factorContentRisk,
        washTradingRisk: row.factorWashTradingRisk,
        marketplaceRisk: row.factorMarketplaceRisk,
        geographyRisk: row.factorGeographyRisk,
      },
      flags: row.flags as NFTRiskFlag[],
      recommendations: row.recommendations as NFTRiskRecommendation[],
      assessmentDate: row.assessmentDate,
      assessor: row.assessor,
      reviewRequired: row.reviewRequired,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewedAt: row.reviewedAt ?? undefined,
      reviewNotes: row.reviewNotes ?? undefined,
      overrideReason: row.overrideReason ?? undefined,
    };
  }
}

/**
 * Singleton NFT risk assessment service instance
 */
let nftRiskAssessmentServiceInstance: NFTRiskAssessmentService | null = null;

/**
 * Get NFT risk assessment service instance
 */
export function getNFTRiskAssessmentService(): NFTRiskAssessmentService {
  if (!nftRiskAssessmentServiceInstance) {
    nftRiskAssessmentServiceInstance = new NFTRiskAssessmentService();
  }
  return nftRiskAssessmentServiceInstance;
}

export default getNFTRiskAssessmentService;
