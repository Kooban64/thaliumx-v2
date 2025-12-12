/**
 * Database Service for Token Compliance
 * PostgreSQL connection management and query execution
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';

const logger = createComponentLogger('database-service');

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  healthy: boolean;
  latency: number;
  connectionCount: number;
  error?: string | undefined;
}

/**
 * Database Service class
 */
export class DatabaseService {
  private pool: Pool | null = null;
  private connected = false;

  /**
   * Connect to the database
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
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      logger.info('Database connected successfully', {
        host: config.database.host,
        database: config.database.database,
      });
    } catch (error) {
      logger.error('Failed to connect to database', error as Error);
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      logger.info('Database disconnected');
    }
  }

  /**
   * Check if database is healthy
   */
  isHealthy(): boolean {
    return this.connected && this.pool !== null;
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const startTime = Date.now();
    try {
      const result = await this.pool.query<T>(sql, params);
      const duration = Date.now() - startTime;
      logger.logDatabaseOperation('query', 'unknown', duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        sql: sql.substring(0, 100),
        duration,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Execute a query and return single row
   */
  async queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
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
   * Health check
   */
  async healthCheck(): Promise<DatabaseHealthCheck> {
    if (!this.pool) {
      return {
        healthy: false,
        latency: 0,
        connectionCount: 0,
        error: 'Database not connected',
      };
    }

    const startTime = Date.now();
    try {
      await this.pool.query('SELECT 1');
      const latency = Date.now() - startTime;
      return {
        healthy: true,
        latency,
        connectionCount: this.pool.totalCount,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        connectionCount: this.pool.totalCount,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Singleton database service instance
 */
let databaseServiceInstance: DatabaseService | null = null;

/**
 * Get database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}

/**
 * Reset database service (for testing)
 */
export function resetDatabaseService(): void {
  databaseServiceInstance = null;
}

export default getDatabaseService;
