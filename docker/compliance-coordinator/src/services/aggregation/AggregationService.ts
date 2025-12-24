/**
 * Aggregation Service
 * Aggregates compliance data from all services
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getChainAnalysisService } from '../chainanalysis';
import { createComponentLogger, logAggregationEvent } from '../../utils/logger';
import type {
  ComplianceServiceType,
  AggregatedRiskAssessment,
  AggregatedTravelRule,
} from '../../types/coordinator';
import type {
  AggregatedRiskAssessmentTable,
  AggregatedTravelRuleTable,
} from '../../types/database';

const logger = createComponentLogger('aggregation-service');

/**
 * Risk assessment input from services
 */
export interface RiskAssessmentInput {
  sourceService: ComplianceServiceType;
  sourceAssessmentId: string;
  entityType: string;
  entityId: string;
  transactionHash?: string | undefined;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  reviewRequired: boolean;
  assessmentDate: Date;
}

/**
 * Travel rule input from services
 */
export interface TravelRuleInput {
  sourceService: ComplianceServiceType;
  sourceTravelRuleId: string;
  entityType: string;
  entityId: string;
  transactionHash?: string | undefined;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  asset: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: Record<string, unknown> | undefined;
  beneficiaryInfo?: Record<string, unknown> | undefined;
  vaspInfo?: Record<string, unknown> | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
}

/**
 * CARF input from services
 */
export interface CARFInput {
  sourceService: ComplianceServiceType;
  sourceCarfId: string;
  reportId: string;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  periodStart: Date;
  periodEnd: Date;
  fiscalYear?: string | undefined;
  totalVolumeUSD: string;
  netGainLossUSD: string;
  transactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  serviceData: Record<string, unknown>;
}

/**
 * Aggregation Service
 */
export class AggregationService {
  /**
   * Aggregate risk assessment from a service
   */
  async aggregateRiskAssessment(input: RiskAssessmentInput): Promise<AggregatedRiskAssessment> {
    logger.info('Aggregating risk assessment', {
      sourceService: input.sourceService,
      sourceAssessmentId: input.sourceAssessmentId,
    });

    const db = getDatabaseService();
    const chainAnalysis = getChainAnalysisService();

    // Enhance risk assessment with ChainAnalysis data
    let enhancedRiskScore = input.riskScore;
    let enhancedFlags = [...input.flags];
    let enhancedRecommendations = [...input.recommendations];

    try {
      // Get ChainAnalysis data if we have address or transaction info
      if (input.entityType === 'address' && input.entityId) {
        logger.info('Fetching ChainAnalysis address risk data', {
          address: input.entityId,
          tenantId: input.tenantId,
        });

        const chainAnalysisResult = await chainAnalysis.scoreAddressRisk({
          address: input.entityId,
          chain: 'ethereum', // Default to Ethereum, could be made configurable
        });

        if (chainAnalysisResult.success && chainAnalysisResult.data) {
          const chainData = chainAnalysisResult.data;

          // Enhance risk score (weighted average with ChainAnalysis)
          const chainWeight = 0.3; // 30% weight to ChainAnalysis
          enhancedRiskScore = (input.riskScore * (1 - chainWeight)) + (chainData.riskScore * chainWeight);

          // Add ChainAnalysis flags
          enhancedFlags.push(...chainData.labels.map(label => `chainanalysis:${label}`));

          // Add ChainAnalysis recommendations
          if (chainData.riskScore > 0.7) {
            enhancedRecommendations.push('ChainAnalysis indicates high blockchain risk - review transaction patterns');
          }

          logger.info('Enhanced risk assessment with ChainAnalysis data', {
            originalScore: input.riskScore,
            chainAnalysisScore: chainData.riskScore,
            enhancedScore: enhancedRiskScore,
            addedFlags: chainData.labels.length,
          });
        }
      } else if (input.entityType === 'transaction' && input.transactionHash) {
        logger.info('Fetching ChainAnalysis transaction risk data', {
          txHash: input.transactionHash,
          tenantId: input.tenantId,
        });

        const chainAnalysisResult = await chainAnalysis.scoreTransactionRisk({
          txHash: input.transactionHash,
          chain: 'ethereum',
        });

        if (chainAnalysisResult.success && chainAnalysisResult.data) {
          const chainData = chainAnalysisResult.data;

          // Enhance risk score
          const chainWeight = 0.4; // 40% weight for transaction analysis
          enhancedRiskScore = (input.riskScore * (1 - chainWeight)) + (chainData.riskScore * chainWeight);

          // Add ChainAnalysis flags
          enhancedFlags.push(...chainData.labels.map(label => `chainanalysis:${label}`));

          // Add ChainAnalysis recommendations
          if (chainData.riskScore > 0.8) {
            enhancedRecommendations.push('ChainAnalysis indicates critical blockchain risk - immediate review required');
          }

          logger.info('Enhanced transaction risk assessment with ChainAnalysis data', {
            txHash: input.transactionHash,
            originalScore: input.riskScore,
            chainAnalysisScore: chainData.riskScore,
            enhancedScore: enhancedRiskScore,
          });
        }
      }
    } catch (error) {
      logger.warn('ChainAnalysis enhancement failed, using original assessment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entityType: input.entityType,
        entityId: input.entityId,
        transactionHash: input.transactionHash,
      });
      // Continue with original assessment if ChainAnalysis fails
    }

    // Check if already aggregated
    const existing = await db.queryOne<AggregatedRiskAssessmentTable>(`
      SELECT * FROM aggregated_risk_assessments
      WHERE source_service = $1 AND source_assessment_id = $2
    `, [input.sourceService, input.sourceAssessmentId]);

    if (existing) {
      // Update existing with enhanced data
      await db.query(`
        UPDATE aggregated_risk_assessments
        SET risk_score = $1,
            risk_level = $2,
            flags = $3,
            recommendations = $4,
            review_required = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        enhancedRiskScore,
        this.calculateRiskLevel(enhancedRiskScore),
        enhancedFlags,
        enhancedRecommendations,
        input.reviewRequired || enhancedRiskScore > 0.8, // Auto-escalate review for high ChainAnalysis risk
        existing.id,
      ]);

      logAggregationEvent('updated', 'risk_assessment', input.sourceService, input.sourceAssessmentId, existing.id);

      return this.mapRiskAssessmentTableToData(existing);
    }

    // Create new aggregated record
    const id = uuidv4();
    const now = new Date();

    await db.query(`
      INSERT INTO aggregated_risk_assessments (
        id, source_service, source_assessment_id, entity_type, entity_id,
        transaction_hash, user_id, tenant_id, broker_id, risk_score, risk_level,
        flags, recommendations, review_required, assessment_date,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      id,
      input.sourceService,
      input.sourceAssessmentId,
      input.entityType,
      input.entityId,
      input.transactionHash,
      input.userId,
      input.tenantId,
      input.brokerId,
      enhancedRiskScore,
      this.calculateRiskLevel(enhancedRiskScore),
      enhancedFlags,
      enhancedRecommendations,
      input.reviewRequired || enhancedRiskScore > 0.8, // Auto-escalate review for high ChainAnalysis risk
      input.assessmentDate,
    ]);

    logAggregationEvent('aggregated', 'risk_assessment', input.sourceService, input.sourceAssessmentId, id);

    return {
      id,
      sourceService: input.sourceService,
      sourceAssessmentId: input.sourceAssessmentId,
      entityType: input.entityType as AggregatedRiskAssessment['entityType'],
      entityId: input.entityId,
      transactionHash: input.transactionHash,
      userId: input.userId,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      riskScore: enhancedRiskScore,
      riskLevel: this.calculateRiskLevel(enhancedRiskScore),
      flags: enhancedFlags,
      recommendations: enhancedRecommendations,
      reviewRequired: input.reviewRequired || enhancedRiskScore > 0.8,
      assessmentDate: input.assessmentDate,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Aggregate travel rule from a service
   */
  async aggregateTravelRule(input: TravelRuleInput): Promise<AggregatedTravelRule> {
    logger.info('Aggregating travel rule', {
      sourceService: input.sourceService,
      sourceTravelRuleId: input.sourceTravelRuleId,
    });

    const db = getDatabaseService();

    // Check if already aggregated
    const existing = await db.queryOne<AggregatedTravelRuleTable>(`
      SELECT * FROM aggregated_travel_rules
      WHERE source_service = $1 AND source_travel_rule_id = $2
    `, [input.sourceService, input.sourceTravelRuleId]);

    if (existing) {
      // Update status
      await db.query(`
        UPDATE aggregated_travel_rules
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [input.status, existing.id]);

      logAggregationEvent('updated', 'travel_rule', input.sourceService, input.sourceTravelRuleId, existing.id);

      return this.mapTravelRuleTableToData({ ...existing, status: input.status });
    }

    // Create new aggregated record
    const id = uuidv4();
    const now = new Date();

    await db.query(`
      INSERT INTO aggregated_travel_rules (
        id, source_service, source_travel_rule_id, entity_type, entity_id,
        transaction_hash, from_address, to_address, amount, amount_usd, asset,
        status, message_id, originator_info, beneficiary_info, vasp_info,
        tenant_id, broker_id, user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      id,
      input.sourceService,
      input.sourceTravelRuleId,
      input.entityType,
      input.entityId,
      input.transactionHash,
      input.fromAddress,
      input.toAddress,
      input.amount,
      input.amountUSD,
      input.asset,
      input.status,
      input.messageId,
      input.originatorInfo ? JSON.stringify(input.originatorInfo) : null,
      input.beneficiaryInfo ? JSON.stringify(input.beneficiaryInfo) : null,
      input.vaspInfo ? JSON.stringify(input.vaspInfo) : null,
      input.tenantId,
      input.brokerId,
      input.userId,
    ]);

    logAggregationEvent('aggregated', 'travel_rule', input.sourceService, input.sourceTravelRuleId, id);

    return {
      id,
      sourceService: input.sourceService,
      sourceTravelRuleId: input.sourceTravelRuleId,
      entityType: input.entityType as AggregatedTravelRule['entityType'],
      entityId: input.entityId,
      transactionHash: input.transactionHash,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amount: input.amount,
      amountUSD: input.amountUSD,
      asset: input.asset,
      status: input.status,
      messageId: input.messageId,
      originatorInfo: input.originatorInfo,
      beneficiaryInfo: input.beneficiaryInfo,
      vaspInfo: input.vaspInfo,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get aggregated risk assessments
   */
  async getRiskAssessments(
    tenantId: string,
    options?: {
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      reviewRequired?: boolean;
      sourceService?: ComplianceServiceType;
      limit?: number;
      offset?: number;
    }
  ): Promise<AggregatedRiskAssessment[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.riskLevel) {
      whereClause += ` AND risk_level = $${paramIndex}`;
      params.push(options.riskLevel);
      paramIndex++;
    }

    if (options?.reviewRequired !== undefined) {
      whereClause += ` AND review_required = $${paramIndex}`;
      params.push(options.reviewRequired);
      paramIndex++;
    }

    if (options?.sourceService) {
      whereClause += ` AND source_service = $${paramIndex}`;
      params.push(options.sourceService);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<AggregatedRiskAssessmentTable>(`
      SELECT * FROM aggregated_risk_assessments
      ${whereClause}
      ORDER BY assessment_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapRiskAssessmentTableToData(row));
  }

  /**
   * Get aggregated travel rules
   */
  async getTravelRules(
    tenantId: string,
    options?: {
      status?: string;
      sourceService?: ComplianceServiceType;
      limit?: number;
      offset?: number;
    }
  ): Promise<AggregatedTravelRule[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.sourceService) {
      whereClause += ` AND source_service = $${paramIndex}`;
      params.push(options.sourceService);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<AggregatedTravelRuleTable>(`
      SELECT * FROM aggregated_travel_rules
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapTravelRuleTableToData(row));
  }

  /**
   * Get platform statistics
   */
  async getPlatformStatistics(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    totalAssessments: number;
    highRiskCount: number;
    criticalRiskCount: number;
    pendingReviews: number;
    travelRuleMessages: number;
    travelRuleCompliance: number;
    byService: Record<ComplianceServiceType, {
      assessments: number;
      highRisk: number;
      travelRule: number;
    }>;
  }> {
    const db = getDatabaseService();

    // Get assessment stats
    const assessmentStats = await db.queryOne<{
      total: string;
      high_risk: string;
      critical_risk: string;
      pending_reviews: string;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_risk,
        COUNT(*) FILTER (WHERE review_required = true AND reviewed_at IS NULL) as pending_reviews
      FROM aggregated_risk_assessments
      WHERE tenant_id = $1
        AND assessment_date >= $2
        AND assessment_date <= $3
    `, [tenantId, periodStart, periodEnd]);

    // Get travel rule stats
    const travelRuleStats = await db.queryOne<{
      total: string;
      acknowledged: string;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged
      FROM aggregated_travel_rules
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `, [tenantId, periodStart, periodEnd]);

    // Get stats by service
    const serviceStats = await db.queryAll<{
      source_service: string;
      assessments: string;
      high_risk: string;
    }>(`
      SELECT
        source_service,
        COUNT(*) as assessments,
        COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical')) as high_risk
      FROM aggregated_risk_assessments
      WHERE tenant_id = $1
        AND assessment_date >= $2
        AND assessment_date <= $3
      GROUP BY source_service
    `, [tenantId, periodStart, periodEnd]);

    const travelRuleByService = await db.queryAll<{
      source_service: string;
      count: string;
    }>(`
      SELECT source_service, COUNT(*) as count
      FROM aggregated_travel_rules
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY source_service
    `, [tenantId, periodStart, periodEnd]);

    const byService: Record<ComplianceServiceType, { assessments: number; highRisk: number; travelRule: number }> = {
      cex: { assessments: 0, highRisk: 0, travelRule: 0 },
      dex: { assessments: 0, highRisk: 0, travelRule: 0 },
      nft: { assessments: 0, highRisk: 0, travelRule: 0 },
      token: { assessments: 0, highRisk: 0, travelRule: 0 },
      chainanalysis: { assessments: 0, highRisk: 0, travelRule: 0 },
      'omni-exchange': { assessments: 0, highRisk: 0, travelRule: 0 },
    };

    for (const stat of serviceStats) {
      const service = stat.source_service as ComplianceServiceType;
      if (byService[service]) {
        byService[service].assessments = parseInt(stat.assessments, 10);
        byService[service].highRisk = parseInt(stat.high_risk, 10);
      }
    }

    for (const stat of travelRuleByService) {
      const service = stat.source_service as ComplianceServiceType;
      if (byService[service]) {
        byService[service].travelRule = parseInt(stat.count, 10);
      }
    }

    const totalTravelRule = parseInt(travelRuleStats?.total ?? '0', 10);
    const acknowledgedTravelRule = parseInt(travelRuleStats?.acknowledged ?? '0', 10);

    return {
      totalAssessments: parseInt(assessmentStats?.total ?? '0', 10),
      highRiskCount: parseInt(assessmentStats?.high_risk ?? '0', 10),
      criticalRiskCount: parseInt(assessmentStats?.critical_risk ?? '0', 10),
      pendingReviews: parseInt(assessmentStats?.pending_reviews ?? '0', 10),
      travelRuleMessages: totalTravelRule,
      travelRuleCompliance: totalTravelRule > 0 ? (acknowledgedTravelRule / totalTravelRule) * 100 : 100,
      byService,
    };
  }

  /**
   * Calculate risk level from risk score
   */
  private calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.3) return 'medium';
    return 'low';
  }

  /**
   * Map risk assessment table to data
   */
  private mapRiskAssessmentTableToData(row: AggregatedRiskAssessmentTable): AggregatedRiskAssessment {
    return {
      id: row.id,
      sourceService: row.source_service as ComplianceServiceType,
      sourceAssessmentId: row.source_assessment_id,
      entityType: row.entity_type as AggregatedRiskAssessment['entityType'],
      entityId: row.entity_id,
      transactionHash: row.transaction_hash ?? undefined,
      userId: row.user_id ?? undefined,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      flags: row.flags,
      recommendations: row.recommendations,
      reviewRequired: row.review_required,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      assessmentDate: row.assessment_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map travel rule table to data
   */
  private mapTravelRuleTableToData(row: AggregatedTravelRuleTable): AggregatedTravelRule {
    return {
      id: row.id,
      sourceService: row.source_service as ComplianceServiceType,
      sourceTravelRuleId: row.source_travel_rule_id,
      entityType: row.entity_type as AggregatedTravelRule['entityType'],
      entityId: row.entity_id,
      transactionHash: row.transaction_hash ?? undefined,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      amountUSD: row.amount_usd,
      asset: row.asset,
      status: row.status,
      messageId: row.message_id,
      originatorInfo: row.originator_info ?? undefined,
      beneficiaryInfo: row.beneficiary_info ?? undefined,
      vaspInfo: row.vasp_info ?? undefined,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      userId: row.user_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Singleton instance
 */
let aggregationServiceInstance: AggregationService | null = null;

export function getAggregationService(): AggregationService {
  if (!aggregationServiceInstance) {
    aggregationServiceInstance = new AggregationService();
  }
  return aggregationServiceInstance;
}

export default getAggregationService;
