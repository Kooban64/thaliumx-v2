/**
 * Enterprise Log Analytics Service
 * 
 * Provides real-time log analysis, pattern detection, and trend analysis.
 * 
 * Features:
 * - Real-time log analysis
 * - Pattern detection (anomalies, security threats)
 * - Trend analysis
 * - Custom query builder
 * - Performance metrics extraction
 */

import * as fs from 'fs';

interface LogPattern {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  lastSeen: Date;
}

interface TrendData {
  timeRange: { start: Date; end: Date };
  errorRate: number;
  logVolume: number;
  averageResponseTime: number;
  topErrors: Array<{ message: string; count: number }>;
}

class LogAnalyticsService {
  private static patterns: Map<string, LogPattern> = new Map();
  private static initialized = false;

  /**
   * Initialize log analytics
   */
  public static initialize(): void {
    this.loadPatterns();
    this.initialized = true;
  }

  /**
   * Load detection patterns
   */
  private static loadPatterns(): void {
    // Security threat patterns
    this.patterns.set('sql_injection', {
      pattern: '(?i)(union|select|insert|delete|drop|exec|script)',
      description: 'Potential SQL injection attempt',
      severity: 'critical',
      count: 0,
      lastSeen: new Date(0),
    });

    this.patterns.set('xss_attempt', {
      pattern: '(?i)(<script|javascript:|onerror=|onload=)',
      description: 'Potential XSS attempt',
      severity: 'high',
      count: 0,
      lastSeen: new Date(0),
    });

    this.patterns.set('unauthorized_access', {
      pattern: '(?i)(unauthorized|forbidden|401|403)',
      description: 'Unauthorized access attempt',
      severity: 'medium',
      count: 0,
      lastSeen: new Date(0),
    });

    this.patterns.set('rate_limit_exceeded', {
      pattern: '(?i)(rate limit|too many requests|429)',
      description: 'Rate limit exceeded',
      severity: 'low',
      count: 0,
      lastSeen: new Date(0),
    });
  }

  /**
   * Analyze log entry for patterns
   */
  public static analyzeLogEntry(logEntry: unknown): LogPattern[] {
    if (!this.initialized) {
      this.initialize();
    }

    const detectedPatterns: LogPattern[] = [];
    const logString = JSON.stringify(logEntry);

    for (const [, pattern] of this.patterns.entries()) {
      const regex = new RegExp(pattern.pattern, 'g');
      if (regex.test(logString)) {
        pattern.count++;
        pattern.lastSeen = new Date();
        detectedPatterns.push({ ...pattern });
      }
    }

    return detectedPatterns;
  }

  /**
   * Get trend data for a time range
   */
  public static async getTrends(
    logDir: string | undefined,
    startTime: Date,
    endTime: Date
  ): Promise<TrendData> {
    const logDirPath: string = (logDir as string) || process.env.LOG_DIR || '/var/log/thaliumx/backend';
    const logs = await this.readLogsInRange(logDirPath, startTime, endTime);
    
    const errorLogs = logs.filter((log: any) => log.level === 'error');
    const errorRate = logs.length > 0 ? (errorLogs.length / logs.length) * 100 : 0;
    
    // Extract response times
    const responseTimes = logs
      .filter((log: any) => log.duration)
      .map((log: any) => {
        const durationStr = String(log.duration || '');
        const match = durationStr.match(/(\d+)ms/);
        return match && match[1] ? parseInt(match[1], 10) : 0;
      })
      .filter((time: number) => time > 0);
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;

    // Count top errors
    const errorCounts = new Map<string, number>();
    for (const log of errorLogs) {
      const message = (log as any).message || 'Unknown error';
      errorCounts.set(message, (errorCounts.get(message) || 0) + 1);
    }

    const topErrors = Array.from(errorCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      timeRange: { start: startTime, end: endTime },
      errorRate,
      logVolume: logs.length,
      averageResponseTime,
      topErrors,
    };
  }

  /**
   * Read logs in time range
   */
  private static async readLogsInRange(
    logDir: string,
    startTime: Date,
    endTime: Date
  ): Promise<unknown[]> {
    const logs: unknown[] = [];
    
    if (!fs.existsSync(logDir)) {
      return logs;
    }

    const files = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
    
    for (const file of files) {
      const filePath = `${logDir}/${file}`;
      const fileLogs = await this.readLogFile(filePath, startTime, endTime);
      logs.push(...fileLogs);
    }

    return logs;
  }

  /**
   * Read a single log file
   */
  private static async readLogFile(
    filePath: string,
    startTime: Date,
    endTime: Date
  ): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const logs: unknown[] = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let buffer = '';

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const entry = JSON.parse(line);
            const entryTime = new Date(entry.timestamp);
            
            if (entryTime >= startTime && entryTime <= endTime) {
              logs.push(entry);
            }
          } catch {
            // Not JSON, skip
          }
        }
      });

      stream.on('end', () => resolve(logs));
      stream.on('error', reject);
    });
  }

  /**
   * Get pattern statistics
   */
  public static getPatternStats(): Record<string, { count: number; lastSeen: Date; severity: string }> {
    const stats: Record<string, { count: number; lastSeen: Date; severity: string }> = {};
    
    const policiesArray = Array.from(this.patterns.entries());
    for (const [name, pattern] of policiesArray) {
      stats[name] = {
        count: pattern.count,
        lastSeen: pattern.lastSeen,
        severity: pattern.severity,
      };
    }
    
    return stats;
  }
}

export { LogAnalyticsService };
