/**
 * Enterprise Log Replay Service
 * 
 * Provides log replay capabilities for debugging and analysis:
 * - Replay logs for a specific correlation ID
 * - Time-travel debugging (reconstruct system state)
 * - Support for distributed trace replay
 * - Export logs for external analysis tools
 * 
 * Features:
 * - Query logs by correlation ID across all services
 * - Reconstruct request flow across microservices
 * - Export logs in various formats (JSON, CSV)
 * - Filter and search capabilities
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  service?: string;
  [key: string]: unknown;
}

interface ReplayOptions {
  correlationId: string;
  startTime?: Date;
  endTime?: Date;
  services?: string[];
  levels?: string[];
  format?: 'json' | 'csv';
}

class LogReplayService {
  private static logDirectories: string[] = [];

  /**
   * Initialize log replay service
   */
  public static initialize(): void {
    // Discover log directories
    const baseLogDir = process.env.LOG_DIR || '/var/log/thaliumx';
    this.logDirectories = [
      path.join(baseLogDir, 'backend'),
      path.join(baseLogDir, 'compliance-dex'),
      path.join(baseLogDir, 'compliance-cex'),
      path.join(baseLogDir, 'compliance-chainanalysis'),
      path.join(baseLogDir, 'compliance-nft'),
      path.join(baseLogDir, 'compliance-token'),
      path.join(baseLogDir, 'compliance-coordinator'),
    ].filter(dir => fs.existsSync(dir));
  }

  /**
   * Replay logs for a correlation ID
   */
  public static async replayByCorrelationId(options: ReplayOptions): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];
    const startTime = options.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const endTime = options.endTime || new Date();

    for (const logDir of this.logDirectories) {
      const serviceLogs = await this.searchLogsInDirectory(
        logDir,
        options.correlationId,
        startTime,
        endTime,
        options.services,
        options.levels
      );
      logs.push(...serviceLogs);
    }

    // Sort by timestamp
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return logs;
  }

  /**
   * Search logs in a directory
   */
  private static async searchLogsInDirectory(
    logDir: string,
    correlationId: string,
    startTime: Date,
    endTime: Date,
    services?: string[],
    levels?: string[]
  ): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];
    const logFiles = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));

    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const fileLogs = await this.searchLogFile(filePath, correlationId, startTime, endTime, services, levels);
      logs.push(...fileLogs);
    }

    return logs;
  }

  /**
   * Search a single log file
   */
  private static async searchLogFile(
    filePath: string,
    correlationId: string,
    startTime: Date,
    endTime: Date,
    services?: string[],
    levels?: string[]
  ): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      const logs: LogEntry[] = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let buffer = '';

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const entry = JSON.parse(line) as LogEntry;
            
            // Check if entry matches criteria
            if (entry.correlationId === correlationId || entry.requestId === correlationId) {
              const entryTime = new Date(entry.timestamp);
              
              if (entryTime >= startTime && entryTime <= endTime) {
                if (services && entry.service && !services.includes(entry.service)) {
                  continue;
                }
                if (levels && !levels.includes(entry.level)) {
                  continue;
                }
                logs.push(entry);
              }
            }
          } catch {
            // Not JSON, skip
          }
        }
      });

      stream.on('end', () => {
        resolve(logs);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Export logs in specified format
   */
  public static exportLogs(logs: LogEntry[], format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    if (logs.length === 0) {
      return '';
    }

    const firstLog = logs[0];
    if (!firstLog) {
      return '';
    }

    const headers = Object.keys(firstLog).join(',');
    const rows = logs.map(log => {
      return Object.values(log).map(val => {
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return String(val).replace(/,/g, ';'); // Escape commas
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Get log timeline for a correlation ID
   */
  public static async getTimeline(correlationId: string): Promise<Array<{ service: string; timestamp: string; message: string }>> {
    const logs = await this.replayByCorrelationId({ correlationId });
    
    return logs.map(log => ({
      service: (log.service as string) || 'unknown',
      timestamp: log.timestamp,
      message: log.message,
    }));
  }
}

export { LogReplayService };