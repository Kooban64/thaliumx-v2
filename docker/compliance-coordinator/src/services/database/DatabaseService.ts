/**
 * Database Service for Compliance Coordinator
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';

const logger = createComponentLogger('database-service');

/**
 * Database Service
 */
export class DatabaseService {
  private pool: Pool | null = null;

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database already connected');
      return;
    }

    const config = getConfig();

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('Database connected successfully', {
        host: config.database.host,
        database: config.database.database,
      });
    } finally {
      client.release();
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  /**
   * Get pool
   */
  private getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  /**
   * Execute query
   */
  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const startTime = Date.now();

    try {
      const result = await pool.query<T>(sql, params);
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        logger.warn('Slow query detected', {
          duration,
          sql: sql.substring(0, 100),
        });
      }

      return result;
    } catch (error) {
      logger.error('Query failed', {
        error: (error as Error).message,
        sql: sql.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Query single row
   */
  async queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  /**
   * Query all rows
   */
  async queryAll<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.pool !== null;
  }
}

/**
 * Singleton instance
 */
let databaseServiceInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}

export default getDatabaseService;
