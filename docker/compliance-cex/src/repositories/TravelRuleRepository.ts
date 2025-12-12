/**
 * Travel Rule Repository for CEX Compliance Service
 * Manages Travel Rule message data for FATF compliance
 */

import { QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, QueryOptions, PaginatedResult, QueryFilter } from './BaseRepository';
import { TravelRuleTable } from '../types/database';
import { TravelRuleData, TravelRuleOriginator, TravelRuleBeneficiary, TravelRuleTransaction, TravelRuleVASP } from '../types/compliance';
import { databaseService } from '../services/database';

// ==================== DTOs ====================

/**
 * DTO for creating a new Travel Rule message
 */
export interface CreateTravelRuleDTO {
  originator: TravelRuleOriginator;
  beneficiary: TravelRuleBeneficiary;
  transaction: TravelRuleTransaction;
  vasp: TravelRuleVASP;
  tenantId: string;
  brokerId?: string;
  userId?: string;
  maxRetries?: number;
}

/**
 * DTO for updating a Travel Rule message
 */
export interface UpdateTravelRuleDTO {
  status?: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  responseTimestamp?: Date;
  errorMessage?: string;
  retryCount?: number;
  nextRetryAt?: Date;
}

// ==================== REPOSITORY ====================

/**
 * Travel Rule Repository - Manages Travel Rule message data
 */
export class TravelRuleRepository extends BaseRepository<TravelRuleTable, CreateTravelRuleDTO, UpdateTravelRuleDTO> {
  protected readonly tableName = 'compliance.travel_rule_messages';
  protected readonly primaryKey = 'id';

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: QueryResultRow): TravelRuleTable {
    return {
      id: row['id'] as string,
      originator_name: row['originator_name'] as string,
      originator_account_number: row['originator_account_number'] as string,
      originator_address: row['originator_address'] as string,
      originator_date_of_birth: row['originator_date_of_birth'] as string | null,
      originator_national_id: row['originator_national_id'] as string | null,
      originator_country: row['originator_country'] as string,
      originator_broker_id: row['originator_broker_id'] as string,
      originator_customer_id: row['originator_customer_id'] as string,
      originator_customer_type: row['originator_customer_type'] as 'individual' | 'business' | 'trust',
      originator_tax_id: row['originator_tax_id'] as string | null,
      originator_occupation: row['originator_occupation'] as string | null,
      originator_source_of_funds: row['originator_source_of_funds'] as string | null,
      beneficiary_name: row['beneficiary_name'] as string,
      beneficiary_account_number: row['beneficiary_account_number'] as string,
      beneficiary_address: row['beneficiary_address'] as string,
      beneficiary_date_of_birth: row['beneficiary_date_of_birth'] as string | null,
      beneficiary_national_id: row['beneficiary_national_id'] as string | null,
      beneficiary_country: row['beneficiary_country'] as string,
      beneficiary_broker_id: row['beneficiary_broker_id'] as string | null,
      beneficiary_customer_id: row['beneficiary_customer_id'] as string | null,
      beneficiary_customer_type: row['beneficiary_customer_type'] as 'individual' | 'business' | 'trust' | null,
      transaction_amount: row['transaction_amount'] as string,
      transaction_currency: row['transaction_currency'] as string,
      transaction_id: row['transaction_id'] as string,
      transaction_timestamp: new Date(row['transaction_timestamp'] as string),
      transaction_purpose: row['transaction_purpose'] as string,
      transaction_reference: row['transaction_reference'] as string | null,
      transaction_exchange_rate: row['transaction_exchange_rate'] as string | null,
      transaction_fee: row['transaction_fee'] as string | null,
      originator_vasp_name: row['originator_vasp_name'] as string,
      originator_vasp_country: row['originator_vasp_country'] as string,
      originator_vasp_registration_number: row['originator_vasp_registration_number'] as string,
      originator_vasp_address: row['originator_vasp_address'] as string,
      originator_vasp_lei: row['originator_vasp_lei'] as string | null,
      originator_vasp_did: row['originator_vasp_did'] as string | null,
      beneficiary_vasp_name: row['beneficiary_vasp_name'] as string | null,
      beneficiary_vasp_country: row['beneficiary_vasp_country'] as string | null,
      beneficiary_vasp_registration_number: row['beneficiary_vasp_registration_number'] as string | null,
      beneficiary_vasp_address: row['beneficiary_vasp_address'] as string | null,
      beneficiary_vasp_lei: row['beneficiary_vasp_lei'] as string | null,
      beneficiary_vasp_did: row['beneficiary_vasp_did'] as string | null,
      status: row['status'] as 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed',
      message_id: row['message_id'] as string,
      timestamp: new Date(row['timestamp'] as string),
      response_timestamp: row['response_timestamp'] ? new Date(row['response_timestamp'] as string) : null,
      error_message: row['error_message'] as string | null,
      retry_count: row['retry_count'] as number,
      max_retries: row['max_retries'] as number,
      next_retry_at: row['next_retry_at'] ? new Date(row['next_retry_at'] as string) : null,
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
  protected mapEntityToInsertRow(entity: CreateTravelRuleDTO): Record<string, unknown> {
    const messageId = `TR-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    return {
      id: uuidv4(),
      originator_name: entity.originator.name,
      originator_account_number: entity.originator.accountNumber,
      originator_address: entity.originator.address,
      originator_date_of_birth: entity.originator.dateOfBirth ?? null,
      originator_national_id: entity.originator.nationalId ?? null,
      originator_country: entity.originator.country,
      originator_broker_id: entity.originator.brokerId,
      originator_customer_id: entity.originator.customerId,
      originator_customer_type: entity.originator.customerType,
      originator_tax_id: entity.originator.taxId ?? null,
      originator_occupation: entity.originator.occupation ?? null,
      originator_source_of_funds: entity.originator.sourceOfFunds ?? null,
      beneficiary_name: entity.beneficiary.name,
      beneficiary_account_number: entity.beneficiary.accountNumber,
      beneficiary_address: entity.beneficiary.address,
      beneficiary_date_of_birth: entity.beneficiary.dateOfBirth ?? null,
      beneficiary_national_id: entity.beneficiary.nationalId ?? null,
      beneficiary_country: entity.beneficiary.country,
      beneficiary_broker_id: entity.beneficiary.brokerId ?? null,
      beneficiary_customer_id: entity.beneficiary.customerId ?? null,
      beneficiary_customer_type: entity.beneficiary.customerType ?? null,
      transaction_amount: entity.transaction.amount,
      transaction_currency: entity.transaction.currency,
      transaction_id: entity.transaction.transactionId,
      transaction_timestamp: entity.transaction.timestamp,
      transaction_purpose: entity.transaction.purpose,
      transaction_reference: entity.transaction.reference ?? null,
      transaction_exchange_rate: entity.transaction.exchangeRate ?? null,
      transaction_fee: entity.transaction.fee ?? null,
      originator_vasp_name: entity.vasp.originatorVASP.name,
      originator_vasp_country: entity.vasp.originatorVASP.country,
      originator_vasp_registration_number: entity.vasp.originatorVASP.registrationNumber,
      originator_vasp_address: entity.vasp.originatorVASP.address,
      originator_vasp_lei: entity.vasp.originatorVASP.lei ?? null,
      originator_vasp_did: entity.vasp.originatorVASP.did ?? null,
      beneficiary_vasp_name: entity.vasp.beneficiaryVASP?.name ?? null,
      beneficiary_vasp_country: entity.vasp.beneficiaryVASP?.country ?? null,
      beneficiary_vasp_registration_number: entity.vasp.beneficiaryVASP?.registrationNumber ?? null,
      beneficiary_vasp_address: entity.vasp.beneficiaryVASP?.address ?? null,
      beneficiary_vasp_lei: entity.vasp.beneficiaryVASP?.lei ?? null,
      beneficiary_vasp_did: entity.vasp.beneficiaryVASP?.did ?? null,
      status: 'pending',
      message_id: messageId,
      timestamp: new Date(),
      response_timestamp: null,
      error_message: null,
      retry_count: 0,
      max_retries: entity.maxRetries ?? 3,
      next_retry_at: null,
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
  protected mapEntityToUpdateRow(entity: UpdateTravelRuleDTO): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.status !== undefined) row['status'] = entity.status;
    if (entity.responseTimestamp !== undefined) row['response_timestamp'] = entity.responseTimestamp;
    if (entity.errorMessage !== undefined) row['error_message'] = entity.errorMessage;
    if (entity.retryCount !== undefined) row['retry_count'] = entity.retryCount;
    if (entity.nextRetryAt !== undefined) row['next_retry_at'] = entity.nextRetryAt;

    return row;
  }

  /**
   * Convert database table row to TravelRuleData domain object
   */
  tableToTravelRuleData(table: TravelRuleTable): TravelRuleData {
    const data: TravelRuleData = {
      id: table.id,
      originator: {
        name: table.originator_name,
        accountNumber: table.originator_account_number,
        address: table.originator_address,
        country: table.originator_country,
        brokerId: table.originator_broker_id,
        customerId: table.originator_customer_id,
        customerType: table.originator_customer_type,
      },
      beneficiary: {
        name: table.beneficiary_name,
        accountNumber: table.beneficiary_account_number,
        address: table.beneficiary_address,
        country: table.beneficiary_country,
      },
      transaction: {
        amount: table.transaction_amount,
        currency: table.transaction_currency,
        transactionId: table.transaction_id,
        timestamp: table.transaction_timestamp,
        purpose: table.transaction_purpose,
      },
      vasp: {
        originatorVASP: {
          name: table.originator_vasp_name,
          country: table.originator_vasp_country,
          registrationNumber: table.originator_vasp_registration_number,
          address: table.originator_vasp_address,
        },
      },
      status: table.status,
      messageId: table.message_id,
      timestamp: table.timestamp,
      retryCount: table.retry_count,
      maxRetries: table.max_retries,
    };

    // Add optional originator fields
    if (table.originator_date_of_birth) data.originator.dateOfBirth = table.originator_date_of_birth;
    if (table.originator_national_id) data.originator.nationalId = table.originator_national_id;
    if (table.originator_tax_id) data.originator.taxId = table.originator_tax_id;
    if (table.originator_occupation) data.originator.occupation = table.originator_occupation;
    if (table.originator_source_of_funds) data.originator.sourceOfFunds = table.originator_source_of_funds;

    // Add optional beneficiary fields
    if (table.beneficiary_date_of_birth) data.beneficiary.dateOfBirth = table.beneficiary_date_of_birth;
    if (table.beneficiary_national_id) data.beneficiary.nationalId = table.beneficiary_national_id;
    if (table.beneficiary_broker_id) data.beneficiary.brokerId = table.beneficiary_broker_id;
    if (table.beneficiary_customer_id) data.beneficiary.customerId = table.beneficiary_customer_id;
    if (table.beneficiary_customer_type) data.beneficiary.customerType = table.beneficiary_customer_type;

    // Add optional transaction fields
    if (table.transaction_reference) data.transaction.reference = table.transaction_reference;
    if (table.transaction_exchange_rate) data.transaction.exchangeRate = table.transaction_exchange_rate;
    if (table.transaction_fee) data.transaction.fee = table.transaction_fee;

    // Add optional VASP fields
    if (table.originator_vasp_lei) data.vasp.originatorVASP.lei = table.originator_vasp_lei;
    if (table.originator_vasp_did) data.vasp.originatorVASP.did = table.originator_vasp_did;

    // Add beneficiary VASP if present
    if (table.beneficiary_vasp_name) {
      data.vasp.beneficiaryVASP = {
        name: table.beneficiary_vasp_name,
        country: table.beneficiary_vasp_country ?? '',
        registrationNumber: table.beneficiary_vasp_registration_number ?? '',
        address: table.beneficiary_vasp_address ?? '',
      };
      if (table.beneficiary_vasp_lei) data.vasp.beneficiaryVASP.lei = table.beneficiary_vasp_lei;
      if (table.beneficiary_vasp_did) data.vasp.beneficiaryVASP.did = table.beneficiary_vasp_did;
    }

    // Add optional status fields
    if (table.response_timestamp) data.responseTimestamp = table.response_timestamp;
    if (table.error_message) data.errorMessage = table.error_message;
    if (table.next_retry_at) data.nextRetryAt = table.next_retry_at;

    return data;
  }

  /**
   * Find Travel Rule message by message ID
   */
  async findByMessageId(messageId: string): Promise<TravelRuleTable | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE message_id = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [messageId]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find Travel Rule messages by transaction ID
   */
  async findByTransactionId(transactionId: string): Promise<TravelRuleTable[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE transaction_id = $1 ORDER BY created_at DESC`;
    const result = await databaseService.queryAll<QueryResultRow>(query, [transactionId]);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find Travel Rule messages by tenant
   */
  async findByTenant(tenantId: string, options?: QueryOptions): Promise<PaginatedResult<TravelRuleTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'tenant_id', operator: '=', value: tenantId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find Travel Rule messages by broker
   */
  async findByBroker(brokerId: string, options?: QueryOptions): Promise<PaginatedResult<TravelRuleTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'broker_id', operator: '=', value: brokerId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find Travel Rule messages by user
   */
  async findByUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<TravelRuleTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'user_id', operator: '=', value: userId });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find Travel Rule messages by status
   */
  async findByStatus(
    status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed',
    options?: QueryOptions
  ): Promise<PaginatedResult<TravelRuleTable>> {
    const filters: QueryFilter[] = options?.filters ?? [];
    filters.push({ field: 'status', operator: '=', value: status });
    return this.findAll({ ...options, filters });
  }

  /**
   * Find pending messages ready for retry
   */
  async findPendingRetries(): Promise<TravelRuleTable[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status IN ('pending', 'failed')
        AND retry_count < max_retries
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT 100
    `;
    const result = await databaseService.queryAll<QueryResultRow>(query);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update message status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed',
    errorMessage?: string
  ): Promise<TravelRuleTable | null> {
    const update: UpdateTravelRuleDTO = { status };
    if (status === 'acknowledged' || status === 'received') {
      update.responseTimestamp = new Date();
    }
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    return this.update(id, update);
  }

  /**
   * Increment retry count and set next retry time
   */
  async incrementRetry(id: string, retryDelayMs: number): Promise<TravelRuleTable | null> {
    const query = `
      UPDATE ${this.tableName}
      SET retry_count = retry_count + 1,
          next_retry_at = NOW() + INTERVAL '${retryDelayMs} milliseconds',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await databaseService.queryOne<QueryResultRow>(query, [id]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Get Travel Rule statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    received: number;
    acknowledged: number;
    failed: number;
    byCountry: Record<string, number>;
    byCurrency: Record<string, number>;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'received') as received,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM ${this.tableName}
      ${whereClause}
    `;
    const result = await databaseService.queryOne<{
      total: string;
      pending: string;
      sent: string;
      received: string;
      acknowledged: string;
      failed: string;
    }>(query, params);

    const countryQuery = `
      SELECT beneficiary_country as country, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY beneficiary_country
    `;
    const countryResult = await databaseService.queryAll<{
      country: string;
      count: string;
    }>(countryQuery, params);

    const currencyQuery = `
      SELECT transaction_currency as currency, COUNT(*) as count
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY transaction_currency
    `;
    const currencyResult = await databaseService.queryAll<{
      currency: string;
      count: string;
    }>(currencyQuery, params);

    const byCountry: Record<string, number> = {};
    for (const row of countryResult) {
      byCountry[row.country] = parseInt(row.count, 10);
    }

    const byCurrency: Record<string, number> = {};
    for (const row of currencyResult) {
      byCurrency[row.currency] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(result?.total ?? '0', 10),
      pending: parseInt(result?.pending ?? '0', 10),
      sent: parseInt(result?.sent ?? '0', 10),
      received: parseInt(result?.received ?? '0', 10),
      acknowledged: parseInt(result?.acknowledged ?? '0', 10),
      failed: parseInt(result?.failed ?? '0', 10),
      byCountry,
      byCurrency,
    };
  }

  /**
   * Get total transaction value for a period
   */
  async getTotalValue(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    currency?: string
  ): Promise<{ totalAmount: string; transactionCount: number }> {
    const currencyClause = currency ? 'AND transaction_currency = $4' : '';
    const params = currency
      ? [tenantId, startDate, endDate, currency]
      : [tenantId, startDate, endDate];

    const query = `
      SELECT 
        COALESCE(SUM(CAST(transaction_amount AS DECIMAL)), 0) as total_amount,
        COUNT(*) as transaction_count
      FROM ${this.tableName}
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
        ${currencyClause}
    `;
    const result = await databaseService.queryOne<{
      total_amount: string;
      transaction_count: string;
    }>(query, params);

    return {
      totalAmount: result?.total_amount ?? '0',
      transactionCount: parseInt(result?.transaction_count ?? '0', 10),
    };
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton Travel Rule repository instance
 */
export const travelRuleRepository = new TravelRuleRepository();
