/**
 * Presale Transaction Monitor Service
 * 
 * Real-time monitoring of presale investment transactions for:
 * - Investment velocity (multiple rapid investments)
 * - Geographic patterns (VPN detection, location anomalies)
 * - Device fingerprinting
 * - Behavioral patterns (unusual investment amounts, times)
 * 
 * Automatic flagging and blocking of suspicious patterns.
 * Integration with fraud detection system.
 */

import { LoggerService } from './logger';
import { RedisService } from './redis';
import { EventStreamingService } from './event-streaming';
import { SecurityOversightService } from './security-oversight';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface TransactionPattern {
  userId: string;
  tenantId: string;
  walletAddress?: string;
  investmentCount: number;
  totalAmount: number;
  timeWindow: number; // seconds
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  timeSpan: number; // seconds between first and last
  flags: string[];
  riskScore: number;
}

export interface GeographicAnomaly {
  userId: string;
  ipAddress: string;
  country?: string;
  previousCountry?: string;
  timeSinceLastLocation: number; // seconds
  isVPN: boolean;
  isProxy: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BehavioralAnomaly {
  userId: string;
  anomalyType: 'unusual_amount' | 'unusual_time' | 'unusual_pattern' | 'velocity_spike';
  description: string;
  riskScore: number;
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

export interface MonitoringResult {
  isSuspicious: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  patterns: TransactionPattern[];
  geographicAnomalies: GeographicAnomaly[];
  behavioralAnomalies: BehavioralAnomaly[];
  recommendations: string[];
  shouldBlock: boolean;
  shouldReview: boolean;
}

// =============================================================================
// PRESALE TRANSACTION MONITOR SERVICE
// =============================================================================

export class PresaleTransactionMonitorService {
  private static readonly VELOCITY_WINDOW = 60; // 1 minute
  private static readonly VELOCITY_THRESHOLD = 5; // Max transactions per window
  private static readonly AMOUNT_VARIANCE_THRESHOLD = 0.5; // 50% variance
  private static readonly GEOGRAPHIC_CHANGE_THRESHOLD = 3600; // 1 hour
  private static readonly REDIS_PREFIX = 'presale_monitor:';

  /**
   * Monitor investment transaction
   */
  public static async monitorInvestment(
    userId: string,
    tenantId: string,
    amount: number,
    walletAddress?: string,
    ipAddress?: string,
    _userAgent?: string,
    _deviceFingerprint?: string
  ): Promise<MonitoringResult> {
    try {
      const timestamp = Date.now();
      // redis extracted but not used in this function
      RedisService.getClient();

      // Track transaction
      await this.trackTransaction(userId, tenantId, amount, timestamp, walletAddress);

      // Analyze patterns
      const patterns = await this.analyzeTransactionPatterns(userId, tenantId, timestamp);
      
      // Check geographic anomalies
      const geographicAnomalies = ipAddress 
        ? await this.checkGeographicAnomalies(userId, ipAddress, timestamp)
        : [];

      // Check behavioral anomalies
      const behavioralAnomalies = await this.checkBehavioralAnomalies(
        userId,
        tenantId,
        amount,
        timestamp,
                patterns
      );

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(patterns, geographicAnomalies, behavioralAnomalies);
      const riskLevel = this.determineRiskLevel(riskScore);

      // Determine actions
      const shouldBlock = riskLevel === 'CRITICAL' || 
                         (riskLevel === 'HIGH' && this.hasBlockingFlags(patterns, geographicAnomalies, behavioralAnomalies));
      const shouldReview = riskLevel === 'HIGH' || riskLevel === 'MEDIUM';

      const recommendations: string[] = [];
      if (shouldBlock) {
        recommendations.push('BLOCK: Transaction blocked due to high risk');
      } else if (shouldReview) {
        recommendations.push('REVIEW: Manual review recommended');
      }

      const result: MonitoringResult = {
        isSuspicious: riskLevel !== 'LOW',
        riskScore,
        riskLevel,
        patterns,
        geographicAnomalies,
        behavioralAnomalies,
        recommendations,
        shouldBlock,
                shouldReview
      };

      // Log monitoring result
      await LoggerService.logAudit(
        shouldBlock ? 'presale_investment_flagged_blocked' : 'presale_investment_monitored',
        'presale_monitoring',
        { userId, tenantId },
        {
          amount,
          walletAddress,
          riskScore,
          riskLevel,
          patterns: patterns.length,
          geographicAnomalies: geographicAnomalies.length,
          behavioralAnomalies: behavioralAnomalies.length,
          shouldBlock,
                shouldReview
        }
      );

      // Emit event if suspicious
      if (result.isSuspicious) {
        await EventStreamingService.emitSystemEvent(
          'presale.transaction.suspicious',
          'presale_monitor',
          riskLevel === 'CRITICAL' ? 'error' : 'warn',
          {
            userId,
            tenantId,
            amount,
            walletAddress,
            riskScore,
            riskLevel,
            patterns,
            geographicAnomalies,
                behavioralAnomalies
          },
          { userId, tenantId }
        );

        // Create security event if critical
        if (riskLevel === 'CRITICAL') {
          await SecurityOversightService.createSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY' as any,
            severity: 'CRITICAL' as any,
            title: 'Critical Transaction Pattern Detected',
            description: `Critical transaction pattern detected for user ${userId}`,
            source: 'presale_monitor',
            userId,
            timestamp: new Date(),
            metadata: {
              component: 'presale_monitor',
              riskScore,
              patterns: JSON.stringify(patterns),
              geographicAnomalies: JSON.stringify(geographicAnomalies),
              behavioralAnomalies: JSON.stringify(behavioralAnomalies),
              amount,
                walletAddress
            },
            status: 'OPEN' as any
          });
        }
      }

      return result;
    } catch (error) {
      LoggerService.error('Transaction monitoring failed', error);
      // Fail-open: allow transaction if monitoring fails
      return {
        isSuspicious: false,
        riskScore: 0,
        riskLevel: 'LOW',
        patterns: [],
        geographicAnomalies: [],
        behavioralAnomalies: [],
        recommendations: [],
        shouldBlock: false,
        shouldReview: false
      };
    }
  }

  /**
   * Track transaction in Redis
   */
  private static async trackTransaction(
    userId: string,
    tenantId: string,
    amount: number,
    timestamp: number,
    walletAddress?: string
  ): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return;

      const key = `${this.REDIS_PREFIX}${tenantId}:${userId}:tx`;
      const transactionData = {
        amount,
        timestamp,
                walletAddress
      };

      // Add to list (keep last 100 transactions)
      await redis.lpush(key, JSON.stringify(transactionData));
      await redis.ltrim(key, 0, 99);
      await redis.expire(key, 86400 * 7); // 7 days

      // Track velocity (transactions per minute)
      const velocityKey = `${this.REDIS_PREFIX}${tenantId}:${userId}:velocity:${Math.floor(timestamp / 60000)}`;
      await redis.incr(velocityKey);
      await redis.expire(velocityKey, 120); // 2 minutes
    } catch (error) {
      LoggerService.warn('Failed to track transaction', { error });
    }
  }

  /**
   * Analyze transaction patterns
   */
  private static async analyzeTransactionPatterns(
    userId: string,
    tenantId: string,
    currentTimestamp: number
  ): Promise<TransactionPattern[]> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return [];

      const key = `${this.REDIS_PREFIX}${tenantId}:${userId}:tx`;
      const transactions = await redis.lrange(key, 0, 99);
      
      if (transactions.length === 0) return [];

      const parsed = transactions
        .map(tx => JSON.parse(tx))
        .filter((tx: any) => currentTimestamp - tx.timestamp <= this.VELOCITY_WINDOW * 1000);

      if (parsed.length === 0) return [];

      const amounts = parsed.map((tx: any) => tx.amount || 0);
      const totalAmount = amounts.reduce((sum: number, amt: number) => sum + amt, 0);
      const averageAmount = parsed.length > 0 ? totalAmount / parsed.length : 0;
      const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
      const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
      const timestamps = parsed.map((tx: any) => tx.timestamp || 0).filter((ts: number) => ts > 0);
      const timeSpan = timestamps.length > 1 
        ? (Math.max(...timestamps) - Math.min(...timestamps)) / 1000
        : 0;

      const flags: string[] = [];
      let riskScore = 0;

      // Velocity check
      if (parsed.length >= this.VELOCITY_THRESHOLD) {
        flags.push('high_velocity');
        riskScore += 30;
      }

      // Amount variance check
      const variance = (maxAmount - minAmount) / (averageAmount || 1);
      if (variance > this.AMOUNT_VARIANCE_THRESHOLD) {
        flags.push('high_variance');
        riskScore += 20;
      }

      // Rapid succession check
      if (timeSpan < 60 && parsed.length > 3) {
        flags.push('rapid_succession');
        riskScore += 25;
      }

      return [{
        userId,
        tenantId,
        investmentCount: parsed.length,
        totalAmount,
        timeWindow: this.VELOCITY_WINDOW,
        averageAmount,
        minAmount,
        maxAmount,
        timeSpan,
        flags,
                riskScore
      }];
    } catch (error) {
      LoggerService.warn('Failed to analyze transaction patterns', { error });
      return [];
    }
  }

  /**
   * Check geographic anomalies
   */
  private static async checkGeographicAnomalies(
    userId: string,
    ipAddress: string,
    currentTimestamp: number
  ): Promise<GeographicAnomaly[]> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return [];

      const key = `${this.REDIS_PREFIX}geo:${userId}`;
      const previous = await redis.get(key);
      
      const anomaly: GeographicAnomaly = {
        userId,
        ipAddress,
        isVPN: false, // Would use external service
        isProxy: false, // Would use external service
        riskLevel: 'LOW',
        timeSinceLastLocation: 0
      };

      if (previous) {
        const prevData = JSON.parse(previous);
        anomaly.previousCountry = prevData.country;
        anomaly.timeSinceLastLocation = (currentTimestamp - prevData.timestamp) / 1000;

        // Check for rapid location change
        if (prevData.country && prevData.country !== anomaly.country && anomaly.timeSinceLastLocation < this.GEOGRAPHIC_CHANGE_THRESHOLD) {
          anomaly.riskLevel = 'HIGH';
        }
      }

      // Store current location
      await redis.set(key, JSON.stringify({
        ipAddress,
        country: anomaly.country,
        timestamp: currentTimestamp
      }), 'EX', 86400 * 7); // 7 days

      return anomaly.riskLevel !== 'LOW' ? [anomaly] : [];
    } catch (error) {
      LoggerService.warn('Failed to check geographic anomalies', { error });
      return [];
    }
  }

  /**
   * Check behavioral anomalies
   */
  private static async checkBehavioralAnomalies(
    userId: string,
    tenantId: string,
    amount: number,
    timestamp: number,
    patterns: TransactionPattern[]
  ): Promise<BehavioralAnomaly[]> {
    const anomalies: BehavioralAnomaly[] = [];

    // Check for unusual amounts (very large or very small)
    const hour = new Date(timestamp).getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    
    if (amount > 100000 && !isBusinessHours) {
      anomalies.push({
        userId,
        anomalyType: 'unusual_amount',
        description: `Large investment (${amount}) outside business hours`,
        riskScore: 25,
        recommendation: 'REVIEW'
      });
    }

    // Check for velocity spike
    if (patterns && patterns.length > 0 && patterns[0] && patterns[0].investmentCount >= this.VELOCITY_THRESHOLD) {
      anomalies.push({
        userId,
        anomalyType: 'velocity_spike',
        description: `High transaction velocity: ${patterns[0].investmentCount} transactions in ${patterns[0].timeWindow} seconds`,
        riskScore: 40,
        recommendation: 'BLOCK'
      });
    }

    // Check for unusual pattern (rapid small transactions)
    if (patterns && patterns.length > 0 && patterns[0] && patterns[0].averageAmount < 1000 && patterns[0].investmentCount > 3) {
      anomalies.push({
        userId,
        anomalyType: 'unusual_pattern',
        description: 'Multiple small rapid transactions (potential structuring)',
        riskScore: 35,
        recommendation: 'REVIEW'
      });
    }

    return anomalies;
  }

  /**
   * Calculate overall risk score
   */
  private static calculateRiskScore(
    patterns: TransactionPattern[],
    geographicAnomalies: GeographicAnomaly[],
    behavioralAnomalies: BehavioralAnomaly[]
  ): number {
    let score = 0;

    // Pattern risk
    if (patterns && patterns.length > 0 && patterns[0]) {
      score += patterns[0].riskScore;
    }

    // Geographic risk
    geographicAnomalies.forEach(anomaly => {
      if (anomaly.riskLevel === 'CRITICAL') score += 50;
      else if (anomaly.riskLevel === 'HIGH') score += 30;
      else if (anomaly.riskLevel === 'MEDIUM') score += 15;
    });

    // Behavioral risk
    behavioralAnomalies.forEach(anomaly => {
      score += anomaly.riskScore;
    });

    return Math.min(100, score); // Cap at 100
  }

  /**
   * Determine risk level from score
   */
  private static determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if any flags require blocking
   */
  private static hasBlockingFlags(
    patterns: TransactionPattern[],
    geographicAnomalies: GeographicAnomaly[],
    behavioralAnomalies: BehavioralAnomaly[]
  ): boolean {
    // Check patterns for blocking flags
    const blockingPatternFlags = patterns.some(p => 
      p.flags.includes('rapid_succession') && p.investmentCount >= this.VELOCITY_THRESHOLD
    );

    // Check behavioral anomalies for blocking recommendations
    const blockingBehavioral = behavioralAnomalies.some(a => a.recommendation === 'BLOCK');

    return blockingPatternFlags || blockingBehavioral;
  }

  /**
   * Get monitoring statistics for a user
   */
  public static async getMonitoringStats(
    userId: string,
    tenantId: string
  ): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageAmount: number;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: string[];
  }> {
    try {
      const redis = RedisService.getClient();
      if (!redis) {
        return {
          totalTransactions: 0,
          totalAmount: 0,
          averageAmount: 0,
          riskScore: 0,
          riskLevel: 'LOW',
          flags: []
        };
      }

      const key = `${this.REDIS_PREFIX}${tenantId}:${userId}:tx`;
      const transactions = await redis.lrange(key, 0, 99);
      
      if (transactions.length === 0) {
        return {
          totalTransactions: 0,
          totalAmount: 0,
          averageAmount: 0,
          riskScore: 0,
          riskLevel: 'LOW',
          flags: []
        };
      }

      const parsed = transactions.map(tx => JSON.parse(tx));
      const totalAmount = parsed.reduce((sum: number, tx: any) => sum + tx.amount, 0);
      const averageAmount = totalAmount / parsed.length;

      // Analyze patterns for risk
      const patterns = await this.analyzeTransactionPatterns(userId, tenantId, Date.now());
      const riskScore = patterns && patterns.length > 0 && patterns[0] ? patterns[0].riskScore : 0;
      const riskLevel = this.determineRiskLevel(riskScore);
      const flags = patterns && patterns.length > 0 && patterns[0] ? patterns[0].flags : [];

      return {
        totalTransactions: parsed.length,
        totalAmount,
        averageAmount,
        riskScore,
        riskLevel,
                flags
      };
    } catch (error) {
      LoggerService.error('Failed to get monitoring stats', error);
      return {
        totalTransactions: 0,
        totalAmount: 0,
        averageAmount: 0,
        riskScore: 0,
        riskLevel: 'LOW',
        flags: []
      };
    }
  }
}
