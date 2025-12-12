/**
 * Database Service for DEX Compliance
 * PostgreSQL connection management with connection pooling
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../config';
import { logger } from '../../utils/logger';

// ==================== DATABASE SERVICE ====================

/**
 * Database service for managing PostgreSQL connections
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool | null = null;
  private isConnected = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database connection pool
   */
  public async initialize(): Promise<void> {
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
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        max: config.database.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      logger.info('Database connection pool initialized', {
        host: config.database.host,
        database: config.database.database,
        maxConnections: config.database.maxConnections,
      });

      // Set up error handler
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error', { error: err.message });
        this.isConnected = false;
      });
    } catch (error) {
      logger.error('Failed to initialize database pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.connect();
  }

  /**
   * Execute a query
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
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
        duration,
        rowCount: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query failed', {
        query: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
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
   * Check database health
   */
  public async healthCheck(): Promise<{ status: 'connected' | 'disconnected'; latency: number }> {
    if (!this.pool) {
      return { status: 'disconnected', latency: -1 };
    }

    const startTime = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return {
        status: 'connected',
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        status: 'disconnected',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Get connection status
   */
  public getStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
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
   * Close database connection pool
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }
}

// ==================== EXPORT ====================

export const databaseService = DatabaseService.getInstance();
