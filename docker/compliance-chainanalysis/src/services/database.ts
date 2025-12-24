/**
 * Database service for ChainAnalysis
 */

import { Pool } from 'pg';
import { getConfig } from '../config';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('database');
const config = getConfig();

export class DatabaseService {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: config.database.url,
        max: config.database.poolSize,
        ssl: config.database.ssl,
        connectionTimeoutMillis: 5000, // 5 second timeout
      });

      // Test connection
      await this.query('SELECT 1');
      logger.info('Database connected successfully');
    } catch (error) {
      logger.warn('Database connection failed - continuing without database', {
        error: error instanceof Error ? error.message : String(error),
        url: config.database.url.replace(/:[^:]+@/, ':***@'), // Hide password in logs
      });
      // Don't throw - allow service to continue without database
      this.pool = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query failed', { error, query: text });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}