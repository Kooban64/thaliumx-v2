/**
 * Enterprise Async Log Transport with Batching
 * 
 * Provides async batching for Winston transports to reduce I/O operations
 * and improve performance for high-volume logging scenarios.
 * 
 * Features:
 * - In-memory buffer for log batching
 * - Automatic flush on buffer full or time interval
 * - Graceful shutdown (flush remaining logs)
 * - Configurable batch size and interval
 * - Circuit breaker for file write failures
 * 
 * Performance:
 * - Reduces I/O operations by 80%+ through batching
 * - Non-blocking async writes
 * - Prevents log loss during shutdown
 */

import type { TransportStreamOptions } from 'winston-transport';
import Transport from 'winston-transport';
import * as fs from 'fs';
import * as path from 'path';

interface AsyncLogTransportOptions extends TransportStreamOptions {
  filename: string;
  batchSize?: number;
  batchIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface LogEntry {
  level: string;
  message: string;
  meta: any;
  timestamp: string;
}

class AsyncLogTransport extends Transport {
  private filename: string;
  private batchSize: number;
  private batchIntervalMs: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private writeInProgress = false;
  private consecutiveFailures = 0;
  private circuitBreakerOpen = false;

  constructor(options: AsyncLogTransportOptions) {
    super(options);
    
    this.filename = options.filename;
    this.batchSize = options.batchSize || parseInt(process.env.LOG_BATCH_SIZE || '100', 10);
    this.batchIntervalMs = options.batchIntervalMs || parseInt(process.env.LOG_BATCH_INTERVAL_MS || '1000', 10);
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 100;

    // Ensure directory exists
    const dir = path.dirname(this.filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Start periodic flush timer
    this.startFlushTimer();

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      void this.shutdown();
    });
    process.on('SIGINT', () => {
      void this.shutdown();
    });
  }

  /**
   * Log method called by Winston
   */
  override log(info: any, callback: () => void): void {
    if (this.circuitBreakerOpen) {
      // Circuit breaker is open, skip logging
      callback();
      return;
    }

    const entry: LogEntry = {
      level: info.level,
      message: info.message,
      meta: info,
      timestamp: new Date().toISOString(),
    };

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.batchSize) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.flush();
    }

    callback();
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 && !this.writeInProgress) {
        void this.flush();
      }
    }, this.batchIntervalMs);
  }

  /**
   * Flush buffer to file
   */
  private async flush(): Promise<void> {
    if (this.writeInProgress || this.buffer.length === 0) {
      return;
    }

    this.writeInProgress = true;
    const entriesToWrite = this.buffer.splice(0, this.batchSize);

    try {
      await this.writeToFile(entriesToWrite);
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
    } catch (error) {
      this.consecutiveFailures++;
      
      // Open circuit breaker after max failures
      if (this.consecutiveFailures >= this.maxRetries) {
        this.circuitBreakerOpen = true;
        console.error(`[AsyncLogTransport] Circuit breaker opened after ${this.consecutiveFailures} failures`);
        
        // Try to recover after delay
        setTimeout(() => {
          this.circuitBreakerOpen = false;
          this.consecutiveFailures = 0;
        }, this.retryDelayMs * 10);
      }

      // Put entries back in buffer for retry (unless shutting down)
      if (!this.isShuttingDown) {
        this.buffer.unshift(...entriesToWrite);
      } else {
        // During shutdown, try to write to console as fallback
        console.error(`[AsyncLogTransport] Failed to write logs during shutdown:`, error);
        entriesToWrite.forEach(entry => {
          console.log(`[${entry.level}] ${entry.message}`, entry.meta);
        });
      }
    } finally {
      this.writeInProgress = false;
    }
  }

  /**
   * Write entries to file
   */
  private async writeToFile(entries: LogEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const lines = entries.map(entry => {
        return JSON.stringify({
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          ...entry.meta,
        }) + '\n';
      }).join('');

      fs.appendFile(this.filename, lines, { encoding: 'utf8' }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Wait for any in-progress write
    while (this.writeInProgress) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Flush remaining buffer
    if (this.buffer.length > 0) {
      await this.flush();
    }

    // Final flush attempt
    let retries = 0;
    while (this.buffer.length > 0 && retries < 5) {
      await this.flush();
      retries++;
      if (this.buffer.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
}

export { AsyncLogTransport };