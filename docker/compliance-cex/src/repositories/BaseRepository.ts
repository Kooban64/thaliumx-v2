/**
 * Base Repository for CEX Compliance Service
 * Abstract base class for all database repositories
 */

import { QueryResultRow } from 'pg';
import { databaseService, QueryParams } from '../services/database';
import { logger } from '../utils/logger';
import { PaginationParams, DateRangeParams } from '../types/database';

// ==================== BASE REPOSITORY ====================

/**
 * Generic filter type for queries
 */
export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';
  value: unknown;
}

/**
 * Query options for repository methods
 */
export interface QueryOptions {
  pagination?: PaginationParams;
  dateRange?: DateRangeParams;
  dateField?: string;
  filters?: QueryFilter[];
}

/**
 * Paginated result type
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Abstract base repository class
 */
export abstract class BaseRepository<T extends QueryResultRow, CreateDTO, UpdateDTO> {
  protected abstract readonly tableName: string;
  protected abstract readonly primaryKey: string;

  /**
   * Map database row to entity
   */
  protected abstract mapRowToEntity(row: QueryResultRow): T;

  /**
   * Map entity to database row for insert
   */
  protected abstract mapEntityToInsertRow(entity: CreateDTO): Record<string, unknown>;

  /**
   * Map entity to database row for update
   */
  protected abstract mapEntityToUpdateRow(entity: UpdateDTO): Record<string, unknown>;

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await databaseService.queryOne<QueryResultRow>(query, [id]);
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Find all entities with optional pagination
   */
  async findAll(options?: QueryOptions): Promise<PaginatedResult<T>> {
    const { whereClause, params, paramIndex } = this.buildWhereClause(options);
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const countResult = await databaseService.queryOne<{ total: string }>(countQuery, params);
    const total = parseInt(countResult?.total ?? '0', 10);

    // Data query with pagination
    const pagination = options?.pagination ?? { limit: 100, offset: 0 };
    const orderBy = pagination.sortBy 
      ? `ORDER BY ${pagination.sortBy} ${pagination.sortOrder ?? 'ASC'}`
      : `ORDER BY created_at DESC`;
    
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      ${whereClause}
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataParams = [...params, pagination.limit, pagination.offset];
    const dataResult = await databaseService.queryAll<QueryResultRow>(dataQuery, dataParams);

    return {
      data: dataResult.map((row) => this.mapRowToEntity(row)),
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + dataResult.length < total,
    };
  }

  /**
   * Find entities by field value
   */
  async findByField(field: string, value: unknown): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${field} = $1`;
    const result = await databaseService.queryAll<QueryResultRow>(query, [value as QueryParams[0]]);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find entities by multiple field values
   */
  async findByFields(fields: Record<string, unknown>): Promise<T[]> {
    const entries = Object.entries(fields);
    const whereClause = entries.map((_, i) => `${entries[i]?.[0]} = $${i + 1}`).join(' AND ');
    const params = entries.map(([, value]) => value as QueryParams[0]);
    
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    const result = await databaseService.queryAll<QueryResultRow>(query, params);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Create a new entity
   */
  async create(entity: CreateDTO): Promise<T> {
    const row = this.mapEntityToInsertRow(entity);
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await databaseService.queryOne<QueryResultRow>(query, values as QueryParams);
    if (!result) {
      throw new Error(`Failed to create entity in ${this.tableName}`);
    }

    logger.debug(`Created entity in ${this.tableName}`, { id: result[this.primaryKey] });
    return this.mapRowToEntity(result);
  }

  /**
   * Create multiple entities
   */
  async createMany(entities: CreateDTO[]): Promise<T[]> {
    if (entities.length === 0) {
      return [];
    }

    const rows = entities.map((entity) => this.mapEntityToInsertRow(entity));
    const columns = Object.keys(rows[0] ?? {});
    
    let paramIndex = 1;
    const valuesClauses: string[] = [];
    const allParams: QueryParams = [];

    for (const row of rows) {
      const placeholders = columns.map(() => `$${paramIndex++}`).join(', ');
      valuesClauses.push(`(${placeholders})`);
      allParams.push(...(Object.values(row) as QueryParams));
    }

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${valuesClauses.join(', ')}
      RETURNING *
    `;

    const result = await databaseService.queryAll<QueryResultRow>(query, allParams);
    logger.debug(`Created ${result.length} entities in ${this.tableName}`);
    return result.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update an entity by ID
   */
  async update(id: string, entity: UpdateDTO): Promise<T | null> {
    const row = this.mapEntityToUpdateRow(entity);
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    
    if (entries.length === 0) {
      return this.findById(id);
    }

    const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    const params = [...entries.map(([, value]) => value as QueryParams[0]), id];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE ${this.primaryKey} = $${entries.length + 1}
      RETURNING *
    `;

    const result = await databaseService.queryOne<QueryResultRow>(query, params);
    if (result) {
      logger.debug(`Updated entity in ${this.tableName}`, { id });
    }
    return result ? this.mapRowToEntity(result) : null;
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await databaseService.query(query, [id]);
    const deleted = (result.rowCount ?? 0) > 0;
    
    if (deleted) {
      logger.debug(`Deleted entity from ${this.tableName}`, { id });
    }
    return deleted;
  }

  /**
   * Soft delete an entity by ID (if table supports it)
   */
  async softDelete(id: string): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE ${this.primaryKey} = $1 AND deleted_at IS NULL
    `;
    const result = await databaseService.query(query, [id]);
    const deleted = (result.rowCount ?? 0) > 0;
    
    if (deleted) {
      logger.debug(`Soft deleted entity from ${this.tableName}`, { id });
    }
    return deleted;
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`;
    const result = await databaseService.queryOne(query, [id]);
    return result !== null;
  }

  /**
   * Count entities with optional filters
   */
  async count(options?: QueryOptions): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(options);
    const query = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
    const result = await databaseService.queryOne<{ total: string }>(query, params);
    return parseInt(result?.total ?? '0', 10);
  }

  /**
   * Build WHERE clause from options
   */
  protected buildWhereClause(options?: QueryOptions): {
    whereClause: string;
    params: QueryParams;
    paramIndex: number;
  } {
    const conditions: string[] = [];
    const params: QueryParams = [];
    let paramIndex = 1;

    // Date range filter
    if (options?.dateRange && options.dateField) {
      conditions.push(`${options.dateField} >= $${paramIndex++}`);
      params.push(options.dateRange.startDate);
      conditions.push(`${options.dateField} <= $${paramIndex++}`);
      params.push(options.dateRange.endDate);
    }

    // Custom filters
    if (options?.filters) {
      for (const filter of options.filters) {
        if (filter.operator === 'IS NULL') {
          conditions.push(`${filter.field} IS NULL`);
        } else if (filter.operator === 'IS NOT NULL') {
          conditions.push(`${filter.field} IS NOT NULL`);
        } else if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
          const values = filter.value as unknown[];
          const placeholders = values.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${filter.field} ${filter.operator} (${placeholders})`);
          params.push(...(values as QueryParams));
        } else {
          conditions.push(`${filter.field} ${filter.operator} $${paramIndex++}`);
          params.push(filter.value as QueryParams[0]);
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params, paramIndex };
  }
}
