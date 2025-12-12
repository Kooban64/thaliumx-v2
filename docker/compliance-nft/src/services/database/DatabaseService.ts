/**
 * Database Service for NFT Compliance
 * PostgreSQL connection management and query execution
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';

const logger = createComponentLogger('database-service');

/**
 * Query options
 */
export interface QueryOptions {
  timeout?: number;
  rowMode?: 'array' | 'object';
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Database Service class
 */
export class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;

  /**
   * Initialize database connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database pool already initialized');
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

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      logger.info('Database connection established', {
        host: config.database.host,
        database: config.database.database,
      });
    } catch (error) {
      logger.error('Failed to connect to database', error as Error);
      throw error;
    }
  }

  /**
   * Close database connection pool
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Get pool instance
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const startTime = Date.now();

    try {
      let result: QueryResult<T>;

      if (options?.rowMode) {
        result = await pool.query<T>(sql, params);
      } else {
        result = await pool.query<T>(sql, params);
      }

      const duration = Date.now() - startTime;
      logger.logDatabaseOperation('query', 'unknown', duration, {
        rowCount: result['rowCount'] ?? 0,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        sql: sql.substring(0, 200),
        durationMs: duration,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute a query and return row count
   */
  async execute(sql: string, params?: unknown[]): Promise<number> {
    const result = await this.query(sql, params);
    return result.rowCount ?? 0;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');

      const duration = Date.now() - startTime;
      logger.logDatabaseOperation('transaction', 'multiple', duration);

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = Date.now() - startTime;
      logger.error('Transaction failed, rolled back', {
        durationMs: duration,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();
    try {
      await this.query('SELECT 1');
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    const pool = this.getPool();
    return {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  }

  /**
   * Run database migrations
   */
  async runMigrations(migrationsDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create migrations table if not exists
    await this.query(`
      CREATE TABLE IF NOT EXISTS nft_compliance_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executed = await this.queryAll<{ name: string }>(
      'SELECT name FROM nft_compliance_migrations ORDER BY id'
    );
    const executedNames = new Set(executed.map((m) => m.name));

    // Get migration files
    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of files) {
      if (!executedNames.has(file)) {
        logger.info(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        await this.transaction(async (client) => {
          await client.query(sql);
          await client.query(
            'INSERT INTO nft_compliance_migrations (name) VALUES ($1)',
            [file]
          );
        });

        logger.info(`Migration completed: ${file}`);
      }
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
export async function resetDatabaseService(): Promise<void> {
  if (databaseServiceInstance) {
    await databaseServiceInstance.disconnect();
    databaseServiceInstance = null;
  }
}

export default getDatabaseService;
