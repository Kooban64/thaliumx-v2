/**
 * Database Service for CEX Compliance Service
 * Enterprise-grade PostgreSQL connection management with pooling
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../config';
import { logger } from '../../utils/logger';

// ==================== DATABASE SERVICE ====================

/**
 * Query parameters type
 */
export type QueryParams = (string | number | boolean | Date | null | undefined | string[] | number[])[];

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Database Service - Manages PostgreSQL connections and queries
 */
export class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly connectionRetryDelayMs = 5000;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    if (this.pool) {
      logger.warn('Database pool already initialized');
      return;
    }

    try {
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        user: config.database.user,
        password: config.database.password,
        ssl: false, // Disable SSL for internal Docker network
        max: config.database.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        query_timeout: 30000,
      });

      // Set up pool event handlers
      this.pool.on('connect', () => {
        logger.debug('New database connection established');
      });

      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error', { error: err.message });
      });

      this.pool.on('remove', () => {
        logger.debug('Database connection removed from pool');
      });

      // Test connection
      await this.testConnection();
      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.info('Database service initialized successfully', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        maxConnections: config.database.maxConnections,
      });
    } catch (error) {
      this.connectionAttempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to initialize database connection', {
        error: errorMessage,
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
      });

      if (this.connectionAttempts < this.maxConnectionAttempts) {
        logger.info(`Retrying database connection in ${this.connectionRetryDelayMs}ms...`);
        await this.delay(this.connectionRetryDelayMs);
        return this.initialize();
      }

      throw new Error(`Failed to connect to database after ${this.maxConnectionAttempts} attempts: ${errorMessage}`);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time');
      logger.debug('Database connection test successful', {
        serverTime: result.rows[0]?.current_time,
      });
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParams
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - startTime;

      logger.debug('Query executed', {
        query: text.substring(0, 100),
        params: params?.length ?? 0,
        rows: result.rowCount,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Query execution failed', {
        query: text.substring(0, 100),
        error: errorMessage,
        duration,
      });

      throw error;
    }
  }

  /**
   * Execute a query and return single row
   */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParams
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParams
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');

      const result = await callback(client);

      await client.query('COMMIT');
      const duration = Date.now() - startTime;
      logger.debug('Transaction committed', { duration });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Transaction rolled back', {
        error: errorMessage,
        duration,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a batch of queries
   */
  async batch(queries: Array<{ text: string; params?: QueryParams }>): Promise<QueryResult[]> {
    return this.transaction(async (client) => {
      const results: QueryResult[] = [];
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      return results;
    });
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Get connection latency
   */
  async getLatency(): Promise<number> {
    if (!this.pool) {
      return -1;
    }

    const startTime = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return Date.now() - startTime;
    } catch {
      return -1;
    }
  }

  /**
   * Shutdown database connection pool
   */
  async shutdown(): Promise<void> {
    if (!this.pool) {
      logger.warn('Database pool not initialized, nothing to shutdown');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection pool closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error closing database pool', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Helper method for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton database service instance
 */
export const databaseService = new DatabaseService();
