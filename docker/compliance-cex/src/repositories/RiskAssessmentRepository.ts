/**
 * Risk Assessment Repository for CEX Compliance Service
 * Manages risk assessment data for AML/CFT compliance
 */

import { QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, QueryOptions, PaginatedResult, QueryFilter } from './BaseRepository';
import { RiskAssessmentsTable } from '../types/database';
import { RiskAssessmentData, RiskFactors, RiskFlag, RiskRecommendation } from '../types/compliance';
import { databaseService } from '../services/database';

// ==================== DTOs ====================

/**
 * DTO for creating a new risk assessment
 */
export interface CreateRiskAssessmentDTO {
  transactionId: string;
  userId: string;
  brokerId: string;
  tenantId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  flags: RiskFlag[];
  recommendations: RiskRecommendation[];
  assessor: string;
  reviewRequired?: boolean;
  validUntil?: Date;
}

/**
 * DTO for updating a risk assessment
 */
export interface UpdateRiskAssessmentDTO {
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  factors?: Partial<RiskFactors>;
  flags?: RiskFlag[];
  recommendations?: RiskRecommendation[];
  reviewRequired?: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  overrideReason?: string;
  validUntil?: Date;
}

// ==================== REPOSITORY ====================

/**
 * Risk Assessment Repository - Manages risk assessment data
 */
export class RiskAssessmentRepository extends BaseRepository<RiskAssessmentsTable, CreateRiskAssessmentDTO, UpdateRiskAssessmentDTO> {
  protected readonly tableName = 'compliance.risk_assessments';
  protected readonly primaryKey = 'id';

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: QueryResultRow): RiskAssessmentsTable {
    return {
      id: row['id'] as string,
      transaction_id: row['transaction_id'] as string,
      user_id: row['user_id'] as string,
      broker_id: row['broker_id'] as string,
      tenant_id: row['tenant_id'] as string,
      risk_score: row['risk_score'] as number,
      risk_level: row['risk_level'] as 'low' | 'medium' | 'high' | 'critical',
      factor_amount: row['factor_amount'] as number,
      factor_frequency: row['factor_frequency'] as number,
      factor_geography: row['factor_geography'] as number,
      factor_counterparty: row['factor_counterparty'] as number,
      factor_pattern: row['factor_pattern'] as number,
      factor_velocity: row['factor_velocity'] as number,
      factor_concentration: row['factor_concentration'] as number,
      factor_source_of_funds: row['factor_source_of_funds'] as number,
      flags: row['flags'] as string[],
      recommendations: row['recommendations'] as string[],
      assessment_date: new Date(row['assessment_date'] as string),
      assessor: row['assessor'] as string,
      review_required: row['review_required'] as boolean,
      reviewed_by: row['reviewed_by'] as string | null,
      reviewed_at: row['reviewed_at'] ? new Date(row['reviewed_at'] as string) : null,
      review_notes: row['review_notes'] as string | null,
      override_reason: row['override_reason'] as string | null,
      valid_until: row['valid_until'] ? new Date(row['valid_until'] as string) : null,
      created_at: new Date(row['created_at'] as string),
      updated_at: new Date(row['updated_at'] as string),
    };
  }

  /**
   * Map entity to database row for insert
   */
  protected mapEntityToInsertRow(entity: CreateRiskAssessmentDTO): Record<string, unknown> {
    return {
      id: uuidv4(),
      transaction_id: entity.transactionId,
      user_id: entity.userId,
      broker_id: entity.brokerId,
      tenant_id: entity.tenantId,
      risk_score: entity.riskScore,
      risk_level: entity.riskLevel,
      factor_amount: entity.factors.amount,
      factor_frequency: entity.factors.frequency,
      factor_geography: entity.factors.geography,
      factor_counterparty: entity.factors.counterparty,
      factor_pattern: entity.factors.pattern,
      factor_velocity: entity.factors.velocity,
      factor_concentration: entity.factors.concentration,
      factor_source_of_funds: entity.factors.sourceOfFunds,
      flags: entity.flags,
      recommendations: entity.recommendations,
      assessment_date: new Date(),
      assessor: entity.assessor,
      review_required: entity.reviewRequired ?? false,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      override_reason: null,
      valid_until: entity.validUntil ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Map entity to database row for update
   */
  protected mapEntityToUpdateRow(entity: UpdateRiskAssessmentDTO): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.riskScore !== undefined) row['risk_score'] = entity.riskScore;
    if (entity.riskLevel !== undefined) row['risk_level'] = entity.riskLevel;
    if (entity.factors?.amount !== undefined) row['factor_amount'] = entity.factors.amount;
    if (entity.factors?.frequency !== undefined) row['factor_frequency'] = entity.factors.frequency;
    if (entity.factors?.geography !== undefined) row['factor_geography'] = entity.factors.geography;
    if (entity.factors?.counterparty !== undefined) row['factor_counterparty'] = entity.factors.counterparty;
    if (entity.factors?.pattern !== undefined) row['factor_pattern'] = entity.factors.pattern;
    if (entity.factors?.velocity !== undefined) row['factor_velocity'] = entity.factors.velocity;
    if (entity.factors?.concentration !== undefined) row['factor_concentration'] = entity.factors.concentration;
    if (entity.factors?.sourceOfFunds !== undefined) row['factor_source_of_funds'] = entity.factors.sourceOfFunds;
    if (entity.flags !== undefined) row['flags'] = entity.flags;
    if (entity.recommendations !== undefined) row['recommendations'] = entity.recommendations;
    if (entity.reviewRequired !== undefined) row['review_required'] = entity.reviewRequired;
    if (entity.reviewedBy !== undefined) row['reviewed_by'] = entity.reviewedBy;
    if (entity.reviewedAt !== undefined) row['reviewed_at'] = entity.reviewedAt;
    if (entity.reviewNotes !== undefined) row['review_notes'] = entity.reviewNotes;
    if (entity.overrideReason !== undefined) row['override_reason'] = entity.overrideReason;
    if (entity.validUntil !== undefined) row['valid_until'] = entity.validUntil;

    return row;
  }

  /**
   * Convert database table row to RiskAssessmentData domain object
   */
  tableToRiskAssessmentData(table: RiskAssessmentsTable): RiskAssessmentData {
    const data: RiskAssessmentData = {
      id: table.id,
      transactionId: table.transaction_id,
      userId: table.user_id,
      brokerId: table.broker_id,
      tenantId: table.tenant_id,
      riskScore: table.risk_score,
      riskLevel: table.risk_level,
      factors: {
        amount: table.factor_amount,
        frequency: table.factor_frequency,
        geography: table.factor_geography,
        counterparty: table.factor_counterparty,
        pattern: table.factor_pattern,
        velocity: table.factor_velocity,
        concentration: table.factor_concentration,
        sourceOfFunds: table.factor_source_of_funds,
      },
      flags: table.flags as RiskFlag[],
      recommendations: table.recommendations as RiskRecommendation[],
      assessmentDate: table.assessment_date,
      assessor: table.assessor,
      reviewRequired: table.review_required,
    };

    // Add optional fields
    if (table.reviewed_by) data.reviewedBy = table.reviewed_by;
    if (table.reviewed_at) data.reviewedAt = table.reviewed_at;
    if (table.review_notes) data.reviewNotes = table.review_notes;
    if (table.override_reason) data.overrideReason = table.override_reason;
    if (table.valid_until) data.validUntil = table.valid_until;

    return data;
  }

  /**
   * Find risk assessment by transaction ID
   */
  async findByTransactionId(transactionId: string): Promise<RiskAssessmentsTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE transaction_id = $1 ORDER BY created_at DESC LIMIT 1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [transactionId]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find all risk assessments for a transaction
   */
  async findAllByTransactionId(transactionId: string): Promise<RiskAssessmentsTable[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE transaction_id = $1 ORDER BY created_at DESC`;
    const result = await databaseService.queryAll<QueryResultRow>(query, [transactionId]);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find risk assessments by tenant
   */
  async findByTenant(tenantId: string, options?: QueryOptions): Promise<PaginatedResult<RiskAssessmentsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'tenant_id', operator: '=', value: tenantId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find risk assessments by broker
   */
  async findByBroker(brokerId: string, options?: QueryOptions): Promise<PaginatedResult<RiskAssessmentsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'broker_id', operator: '=', value: brokerId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find risk assessments by user
   */
  async findByUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<RiskAssessmentsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'user_id', operator: '=', value: userId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find risk assessments by risk level
   */
  async findByRiskLevel(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    options?: QueryOptions
  ): Promise<PaginatedResult<RiskAssessmentsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'risk_level', operator: '=', value: riskLevel });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find high-risk assessments requiring review
   */
  async findRequiringReview(tenantId?: string): Promise<RiskAssessmentsTable[]> {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE review_required = true
        AND reviewed_at IS NULL
    `;
    const params: string[] = [];

    if (tenantId) {
      query += ' AND tenant_id = $1';
      params.push(tenantId);
    }

    query += ' ORDER BY risk_score DESC, created_at ASC LIMIT 100';

    const result = await databaseService.queryAll<QueryResultRow>(query, params);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find assessments with specific flags
   */
  async findByFlags(flags: RiskFlag[], tenantId?: string): Promise<RiskAssessmentsTable[]> {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE flags && $1::text[]
    `;
    const params: (string[] | string)[] = [flags];

    if (tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await databaseService.queryAll<QueryResultRow>(query, params);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Mark assessment as reviewed
   */
  async markReviewed(
    id: string,
    reviewedBy: string,
    reviewNotes?: string,
    overrideReason?: string
  ): Promise<RiskAssessmentsTable | null> {
    const update: UpdateRiskAssessmentDTO = {
      reviewedBy,
      reviewedAt: new Date(),
      reviewRequired: false,
    };
    if (reviewNotes !== undefined) update.reviewNotes = reviewNotes;
    if (overrideReason !== undefined) update.overrideReason = overrideReason;
    return this.update(id, update);
  }

  /**
   * Override risk level
   */
  async overrideRiskLevel(
    id: string,
    newRiskLevel: 'low' | 'medium' | 'high' | 'critical',
    reviewedBy: string,
    overrideReason: string
  ): Promise<RiskAssessmentsTable | null> {
    return this.update(id, {
      riskLevel: newRiskLevel,
      reviewedBy,
      reviewedAt: new Date(),
      overrideReason,
      reviewRequired: false,
    });
  }

  /**
   * Get user's latest risk assessment
   */
  async getLatestForUser(userId: string, tenantId: string): Promise<RiskAssessmentsTable | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await databaseService.queryOne<QueryResultRow>(query, [userId, tenantId]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Get user's average risk score
   */
  async getUserAverageRiskScore(userId: string, tenantId: string): Promise<number> {
    const query = `
      SELECT AVG(risk_score) as avg_score
      FROM ${this.tableName}
      WHERE user_id = $1 AND tenant_id = $2
    `;
    const result = await databaseService.queryOne<{ avg_score: string }>(query, [userId, tenantId]);
    return parseFloat(result?.avg_score ?? '0');
  }

  /**
   * Get risk assessment statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    byRiskLevel: Record<string, number>;
    averageScore: number;
    requiresReview: number;
    reviewed: number;
    topFlags: Array<{ flag: string; count: number }>;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE risk_level = 'low') as low,
        COUNT(*) FILTER (WHERE risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical,
        AVG(risk_score) as avg_score,
        COUNT(*) FILTER (WHERE review_required = true AND reviewed_at IS NULL) as requires_review,
        COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL) as reviewed
      FROM ${this.tableName}
      ${whereClause}
    `;
    const result = await databaseService.queryOne<{
      total: string;
      low: string;
      medium: string;
      high: string;
      critical: string;
      avg_score: string;
      requires_review: string;
      reviewed: string;
    }>(query, params);

    // Get top flags
    const flagsQuery = `
      SELECT flag, COUNT(*) as count
      FROM ${this.tableName}, UNNEST(flags) as flag
      ${whereClause}
      GROUP BY flag
      ORDER BY count DESC
      LIMIT 10
    `;
    const flagsResult = await databaseService.queryAll<{
      flag: string;
      count: string;
    }>(flagsQuery, params);

    return {
      total: parseInt(result?.total ?? '0', 10),
      byRiskLevel: {
        low: parseInt(result?.low ?? '0', 10),
        medium: parseInt(result?.medium ?? '0', 10),
        high: parseInt(result?.high ?? '0', 10),
        critical: parseInt(result?.critical ?? '0', 10),
      },
      averageScore: parseFloat(result?.avg_score ?? '0'),
      requiresReview: parseInt(result?.requires_review ?? '0', 10),
      reviewed: parseInt(result?.reviewed ?? '0', 10),
      topFlags: flagsResult.map((row) => ({
        flag: row.flag,
        count: parseInt(row.count, 10),
      })),
    };
  }

  /**
   * Get risk trend for a user over time
   */
  async getUserRiskTrend(
    userId: string,
    tenantId: string,
    days: number = 30
  ): Promise<Array<{ date: string; score: number; level: string }>> {
    const query = `
      SELECT 
        DATE(assessment_date) as date,
        AVG(risk_score) as avg_score,
        MODE() WITHIN GROUP (ORDER BY risk_level) as mode_level
      FROM ${this.tableName}
      WHERE user_id = $1 
        AND tenant_id = $2
        AND assessment_date >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(assessment_date)
      ORDER BY date ASC
    `;
    const result = await databaseService.queryAll<{
      date: string;
      avg_score: string;
      mode_level: string;
    }>(query, [userId, tenantId]);

    return result.map((row) => ({
      date: row.date,
      score: parseFloat(row.avg_score),
      level: row.mode_level,
    }));
  }

  /**
   * Bulk create risk assessments
   */
  async bulkCreate(assessments: CreateRiskAssessmentDTO[]): Promise<RiskAssessmentsTable[]> {
    return this.createMany(assessments);
  }

  /**
   * Find expired assessments
   */
  async findExpired(): Promise<RiskAssessmentsTable[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE valid_until IS NOT NULL
        AND valid_until < NOW()
      ORDER BY valid_until ASC
      LIMIT 100
    `;
    const result = await databaseService.queryAll<QueryResultRow>(query);
    return result.map((row) => this.mapRowToEntity(row));
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton Risk Assessment repository instance
 */
export const riskAssessmentRepository = new RiskAssessmentRepository();
