/**
 * CARF Repository for CEX Compliance Service
 * Manages CARF (Crypto-Asset Reporting Framework) report data
 */

import { QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, QueryOptions, PaginatedResult, QueryFilter } from './BaseRepository';
import { CARFReportsTable } from '../types/database';
import { CARFReportingData, CARFReportingEntity, CARFReportablePerson, CARFCryptoAsset, CARFTransaction, CARFReportingPeriod } from '../types/compliance';
import { databaseService } from '../services/database';

// ==================== DTOs ====================

/**
 * DTO for creating a new CARF report
 */
export interface CreateCARFReportDTO {
  reportingEntity: CARFReportingEntity;
  reportablePerson: CARFReportablePerson;
  cryptoAsset: CARFCryptoAsset;
  transaction: CARFTransaction;
  reportingPeriod: CARFReportingPeriod;
  tenantId: string;
  brokerId?: string;
  userId?: string;
}

/**
 * DTO for updating a CARF report
 */
export interface UpdateCARFReportDTO {
  status?: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate?: Date;
  acknowledgmentDate?: Date;
  rejectionReason?: string;
  version?: string;
}

// ==================== REPOSITORY ====================

/**
 * CARF Repository - Manages CARF report data
 */
export class CARFRepository extends BaseRepository<CARFReportsTable, CreateCARFReportDTO, UpdateCARFReportDTO> {
  protected readonly tableName = 'compliance.carf_reports';
  protected readonly primaryKey = 'id';

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: QueryResultRow): CARFReportsTable {
    return {
      id: row['id'] as string,
      reporting_entity_name: row['reporting_entity_name'] as string,
      reporting_entity_country: row['reporting_entity_country'] as string,
      reporting_entity_registration_number: row['reporting_entity_registration_number'] as string,
      reporting_entity_address: row['reporting_entity_address'] as string,
      reporting_entity_tax_id: row['reporting_entity_tax_id'] as string | null,
      reporting_entity_lei: row['reporting_entity_lei'] as string | null,
      reportable_person_name: row['reportable_person_name'] as string,
      reportable_person_address: row['reportable_person_address'] as string,
      reportable_person_date_of_birth: row['reportable_person_date_of_birth'] as string | null,
      reportable_person_national_id: row['reportable_person_national_id'] as string | null,
      reportable_person_country: row['reportable_person_country'] as string,
      reportable_person_tax_id: row['reportable_person_tax_id'] as string | null,
      reportable_person_occupation: row['reportable_person_occupation'] as string | null,
      reportable_person_customer_type: row['reportable_person_customer_type'] as 'individual' | 'business' | 'trust',
      crypto_asset_type: row['crypto_asset_type'] as string,
      crypto_asset_amount: row['crypto_asset_amount'] as string,
      crypto_asset_value: row['crypto_asset_value'] as string,
      crypto_asset_currency: row['crypto_asset_currency'] as string,
      crypto_asset_exchange_rate: row['crypto_asset_exchange_rate'] as string,
      crypto_asset_market_value: row['crypto_asset_market_value'] as string | null,
      transaction_type: row['transaction_type'] as 'exchange' | 'transfer' | 'disposal' | 'acquisition' | 'mining' | 'staking',
      transaction_date: new Date(row['transaction_date'] as string),
      transaction_counterparty: row['transaction_counterparty'] as string | null,
      transaction_platform: row['transaction_platform'] as string | null,
      transaction_fees: row['transaction_fees'] as string,
      transaction_description: row['transaction_description'] as string | null,
      transaction_hash: row['transaction_hash'] as string | null,
      transaction_wallet_address: row['transaction_wallet_address'] as string | null,
      reporting_period_start_date: new Date(row['reporting_period_start_date'] as string),
      reporting_period_end_date: new Date(row['reporting_period_end_date'] as string),
      reporting_period_fiscal_year: row['reporting_period_fiscal_year'] as string | null,
      status: row['status'] as 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected',
      report_id: row['report_id'] as string,
      submission_date: row['submission_date'] ? new Date(row['submission_date'] as string) : null,
      acknowledgment_date: row['acknowledgment_date'] ? new Date(row['acknowledgment_date'] as string) : null,
      rejection_reason: row['rejection_reason'] as string | null,
      version: row['version'] as string,
      tenant_id: row['tenant_id'] as string,
      broker_id: row['broker_id'] as string | null,
      user_id: row['user_id'] as string | null,
      created_at: new Date(row['created_at'] as string),
      updated_at: new Date(row['updated_at'] as string),
    };
  }

  /**
   * Map entity to database row for insert
   */
  protected mapEntityToInsertRow(entity: CreateCARFReportDTO): Record<string, unknown> {
    const reportId = `CARF-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    return {
      id: uuidv4(),
      reporting_entity_name: entity.reportingEntity.name,
      reporting_entity_country: entity.reportingEntity.country,
      reporting_entity_registration_number: entity.reportingEntity.registrationNumber,
      reporting_entity_address: entity.reportingEntity.address,
      reporting_entity_tax_id: entity.reportingEntity.taxId ?? null,
      reporting_entity_lei: entity.reportingEntity.lei ?? null,
      reportable_person_name: entity.reportablePerson.name,
      reportable_person_address: entity.reportablePerson.address,
      reportable_person_date_of_birth: entity.reportablePerson.dateOfBirth ?? null,
      reportable_person_national_id: entity.reportablePerson.nationalId ?? null,
      reportable_person_country: entity.reportablePerson.country,
      reportable_person_tax_id: entity.reportablePerson.taxId ?? null,
      reportable_person_occupation: entity.reportablePerson.occupation ?? null,
      reportable_person_customer_type: entity.reportablePerson.customerType,
      crypto_asset_type: entity.cryptoAsset.type,
      crypto_asset_amount: entity.cryptoAsset.amount,
      crypto_asset_value: entity.cryptoAsset.value,
      crypto_asset_currency: entity.cryptoAsset.currency,
      crypto_asset_exchange_rate: entity.cryptoAsset.exchangeRate,
      crypto_asset_market_value: entity.cryptoAsset.marketValue ?? null,
      transaction_type: entity.transaction.type,
      transaction_date: entity.transaction.date,
      transaction_counterparty: entity.transaction.counterparty ?? null,
      transaction_platform: entity.transaction.platform ?? null,
      transaction_fees: entity.transaction.fees,
      transaction_description: entity.transaction.description ?? null,
      transaction_hash: entity.transaction.transactionHash ?? null,
      transaction_wallet_address: entity.transaction.walletAddress ?? null,
      reporting_period_start_date: entity.reportingPeriod.startDate,
      reporting_period_end_date: entity.reportingPeriod.endDate,
      reporting_period_fiscal_year: entity.reportingPeriod.fiscalYear ?? null,
      status: 'draft',
      report_id: reportId,
      submission_date: null,
      acknowledgment_date: null,
      rejection_reason: null,
      version: '1.0',
      tenant_id: entity.tenantId,
      broker_id: entity.brokerId ?? null,
      user_id: entity.userId ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Map entity to database row for update
   */
  protected mapEntityToUpdateRow(entity: UpdateCARFReportDTO): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.status !== undefined) row['status'] = entity.status;
    if (entity.submissionDate !== undefined) row['submission_date'] = entity.submissionDate;
    if (entity.acknowledgmentDate !== undefined) row['acknowledgment_date'] = entity.acknowledgmentDate;
    if (entity.rejectionReason !== undefined) row['rejection_reason'] = entity.rejectionReason;
    if (entity.version !== undefined) row['version'] = entity.version;

    return row;
  }

  /**
   * Convert database table row to CARFReportingData domain object
   */
  tableToCARFReportingData(table: CARFReportsTable): CARFReportingData {
    const data: CARFReportingData = {
      id: table.id,
      reportingEntity: {
        name: table.reporting_entity_name,
        country: table.reporting_entity_country,
        registrationNumber: table.reporting_entity_registration_number,
        address: table.reporting_entity_address,
      },
      reportablePerson: {
        name: table.reportable_person_name,
        address: table.reportable_person_address,
        country: table.reportable_person_country,
        customerType: table.reportable_person_customer_type,
      },
      cryptoAsset: {
        type: table.crypto_asset_type,
        amount: table.crypto_asset_amount,
        value: table.crypto_asset_value,
        currency: table.crypto_asset_currency,
        exchangeRate: table.crypto_asset_exchange_rate,
      },
      transaction: {
        type: table.transaction_type,
        date: table.transaction_date,
        fees: table.transaction_fees,
      },
      reportingPeriod: {
        startDate: table.reporting_period_start_date,
        endDate: table.reporting_period_end_date,
      },
      status: table.status,
      reportId: table.report_id,
      version: table.version,
      createdAt: table.created_at,
      updatedAt: table.updated_at,
    };

    // Add optional reporting entity fields
    if (table.reporting_entity_tax_id) data.reportingEntity.taxId = table.reporting_entity_tax_id;
    if (table.reporting_entity_lei) data.reportingEntity.lei = table.reporting_entity_lei;

    // Add optional reportable person fields
    if (table.reportable_person_date_of_birth) data.reportablePerson.dateOfBirth = table.reportable_person_date_of_birth;
    if (table.reportable_person_national_id) data.reportablePerson.nationalId = table.reportable_person_national_id;
    if (table.reportable_person_tax_id) data.reportablePerson.taxId = table.reportable_person_tax_id;
    if (table.reportable_person_occupation) data.reportablePerson.occupation = table.reportable_person_occupation;

    // Add optional crypto asset fields
    if (table.crypto_asset_market_value) data.cryptoAsset.marketValue = table.crypto_asset_market_value;

    // Add optional transaction fields
    if (table.transaction_counterparty) data.transaction.counterparty = table.transaction_counterparty;
    if (table.transaction_platform) data.transaction.platform = table.transaction_platform;
    if (table.transaction_description) data.transaction.description = table.transaction_description;
    if (table.transaction_hash) data.transaction.transactionHash = table.transaction_hash;
    if (table.transaction_wallet_address) data.transaction.walletAddress = table.transaction_wallet_address;

    // Add optional reporting period fields
    if (table.reporting_period_fiscal_year) data.reportingPeriod.fiscalYear = table.reporting_period_fiscal_year;

    // Add optional status fields
    if (table.submission_date) data.submissionDate = table.submission_date;
    if (table.acknowledgment_date) data.acknowledgmentDate = table.acknowledgment_date;
    if (table.rejection_reason) data.rejectionReason = table.rejection_reason;

    return data;
  }

  /**
   * Find CARF report by report ID
   */
  async findByReportId(reportId: string): Promise<CARFReportsTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE report_id = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [reportId]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find CARF reports by tenant
   */
  async findByTenant(tenantId: string, options?: QueryOptions): Promise<PaginatedResult<CARFReportsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'tenant_id', operator: '=', value: tenantId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find CARF reports by broker
   */
  async findByBroker(brokerId: string, options?: QueryOptions): Promise<PaginatedResult<CARFReportsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'broker_id', operator: '=', value: brokerId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find CARF reports by user
   */
  async findByUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<CARFReportsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'user_id', operator: '=', value: userId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find CARF reports by status
   */
  async findByStatus(
    status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected',
    options?: QueryOptions
  ): Promise<PaginatedResult<CARFReportsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'status', operator: '=', value: status });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find CARF reports by reporting period
   */
  async findByReportingPeriod(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<CARFReportsTable[]> {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE reporting_period_start_date >= $1
        AND reporting_period_end_date <= $2
    `;
    const params: (Date | string)[] = [startDate, endDate];

    if (tenantId) {
      query += ' AND tenant_id = $3';
      params.push(tenantId);
    }

    query += ' ORDER BY reporting_period_start_date DESC';

    const result = await databaseService.queryAll<QueryResultRow>(query, params);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find CARF reports by crypto asset type
   */
  async findByCryptoAssetType(
    assetType: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<CARFReportsTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'crypto_asset_type', operator: '=', value: assetType });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find pending reports ready for submission
   */
  async findPendingSubmission(): Promise<CARFReportsTable[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100
    `;
    const result = await databaseService.queryAll<QueryResultRow>(query);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update report status
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected',
    rejectionReason?: string
  ): Promise<CARFReportsTable | null> {
    const update: UpdateCARFReportDTO = { status };
    
    if (status === 'submitted') {
      update.submissionDate = new Date();
    } else if (status === 'acknowledged') {
      update.acknowledgmentDate = new Date();
    } else if (status === 'rejected' && rejectionReason) {
      update.rejectionReason = rejectionReason;
    }
    
    return this.update(id, update);
  }

  /**
   * Get CARF statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    submitted: number;
    acknowledged: number;
    rejected: number;
    byAssetType: Record<string, number>;
    byTransactionType: Record<string, number>;
    totalValue: string;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COALESCE(SUM(CAST(crypto_asset_value AS DECIMAL)), 0) as total_value
      FROM ${this.tableName}
      ${whereClause}
    `;
    const result = await databaseService.queryOne<{
      total: string;
      draft: string;
      pending: string;
      submitted: string;
      acknowledged: string;
      rejected: string;
      total_value: string;
    }>(query, params);

    const assetTypeQuery = `
      SELECT crypto_asset_type as asset_type, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY crypto_asset_type
    `;
    const assetTypeResult = await databaseService.queryAll<{
      asset_type: string;
      count: string;
    }>(assetTypeQuery, params);

    const transactionTypeQuery = `
      SELECT transaction_type, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY transaction_type
    `;
    const transactionTypeResult = await databaseService.queryAll<{
      transaction_type: string;
      count: string;
    }>(transactionTypeQuery, params);

    const byAssetType: Record<string, number> = {};
    for (const row of assetTypeResult) {
      byAssetType[row.asset_type] = parseInt(row.count, 10);
    }

    const byTransactionType: Record<string, number> = {};
    for (const row of transactionTypeResult) {
      byTransactionType[row.transaction_type] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(result?.total ?? '0', 10),
      draft: parseInt(result?.draft ?? '0', 10),
      pending: parseInt(result?.pending ?? '0', 10),
      submitted: parseInt(result?.submitted ?? '0', 10),
      acknowledged: parseInt(result?.acknowledged ?? '0', 10),
      rejected: parseInt(result?.rejected ?? '0', 10),
      byAssetType,
      byTransactionType,
      totalValue: result?.total_value ?? '0',
    };
  }

  /**
   * Generate annual report for a user
   */
  async generateAnnualReport(
    userId: string,
    year: number,
    tenantId: string
  ): Promise<CARFReportsTable[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
        AND tenant_id = $2
        AND transaction_date >= $3
        AND transaction_date <= $4
      ORDER BY transaction_date ASC
    `;
    const result = await databaseService.queryAll<QueryResultRow>(query, [
      userId,
      tenantId,
      startDate,
      endDate,
    ]);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get user's total crypto holdings for a period
   */
  async getUserHoldings(
    userId: string,
    tenantId: string,
    endDate: Date
  ): Promise<Record<string, { amount: string; value: string }>> {
    const query = `
      SELECT 
        crypto_asset_type,
        SUM(CASE 
          WHEN transaction_type IN ('acquisition', 'mining', 'staking') THEN CAST(crypto_asset_amount AS DECIMAL)
          WHEN transaction_type IN ('disposal', 'transfer') THEN -CAST(crypto_asset_amount AS DECIMAL)
          ELSE 0
        END) as net_amount,
        SUM(CASE 
          WHEN transaction_type IN ('acquisition', 'mining', 'staking') THEN CAST(crypto_asset_value AS DECIMAL)
          WHEN transaction_type IN ('disposal', 'transfer') THEN -CAST(crypto_asset_value AS DECIMAL)
          ELSE 0
        END) as net_value
      FROM ${this.tableName}
      WHERE user_id = $1
        AND tenant_id = $2
        AND transaction_date <= $3
      GROUP BY crypto_asset_type
    `;
    const result = await databaseService.queryAll<{
      crypto_asset_type: string;
      net_amount: string;
      net_value: string;
    }>(query, [userId, tenantId, endDate]);

    const holdings: Record<string, { amount: string; value: string }> = {};
    for (const row of result) {
      holdings[row.crypto_asset_type] = {
        amount: row.net_amount,
        value: row.net_value,
      };
    }
    return holdings;
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton CARF repository instance
 */
export const carfRepository = new CARFRepository();
