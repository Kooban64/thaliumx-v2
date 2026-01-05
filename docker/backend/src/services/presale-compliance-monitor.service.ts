/**
 * Presale Compliance Monitor Service
 * 
 * Real-time compliance monitoring for presale investments:
 * - Large transaction thresholds (SAR triggers)
 * - Structuring detection (multiple small transactions)
 * - High-risk country transactions
 * - PEP transactions
 * 
 * Automatic alert generation and integration with compliance reporting system.
 */

import { LoggerService } from './logger';
import { RedisService } from './redis';
import { EventStreamingService } from './event-streaming';
// ComplianceService imported but not used in this file
import { KYCService } from './kyc';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ComplianceAlert {
  alertId: string;
  type: 'SAR_TRIGGER' | 'STRUCTURING' | 'HIGH_RISK_COUNTRY' | 'PEP_TRANSACTION' | 'THRESHOLD_EXCEEDED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  tenantId: string;
  description: string;
  details: any;
  timestamp: Date;
  requiresReporting: boolean;
  autoFileSAR: boolean;
}

export interface StructuringPattern {
  userId: string;
  transactionCount: number;
  totalAmount: number;
  timeWindow: number; // seconds
  averageAmount: number;
  threshold: number;
  suspicionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ComplianceCheckResult {
  requiresAlert: boolean;
  requiresSAR: boolean;
  alerts: ComplianceAlert[];
  structuringPattern?: StructuringPattern;
  riskFactors: string[];
}

// =============================================================================
// PRESALE COMPLIANCE MONITOR SERVICE
// =============================================================================

export class PresaleComplianceMonitorService {
  private static readonly SAR_THRESHOLD = parseFloat(process.env.SAR_THRESHOLD || '10000'); // $10,000 USD
  private static readonly STRUCTURING_THRESHOLD = parseFloat(process.env.STRUCTURING_THRESHOLD || '9500'); // $9,500 USD
  private static readonly STRUCTURING_WINDOW = 24 * 60 * 60; // 24 hours in seconds
  private static readonly HIGH_RISK_COUNTRIES = (process.env.HIGH_RISK_COUNTRIES || '').split(',').filter(Boolean);
  private static readonly REDIS_PREFIX = 'presale_compliance:';

  /**
   * Monitor investment for compliance issues
   */
  public static async monitorCompliance(
    userId: string,
    tenantId: string,
    amount: number,
    country?: string,
    ipAddress?: string
  ): Promise<ComplianceCheckResult> {
    try {
      const alerts: ComplianceAlert[] = [];
      const riskFactors: string[] = [];
      let requiresSAR = false;
      let structuringPattern: StructuringPattern | undefined;

      // 1. Check for large transaction (SAR trigger)
      if (amount >= this.SAR_THRESHOLD) {
        const alert: ComplianceAlert = {
          alertId: `sar-${userId}-${Date.now()}`,
          type: 'SAR_TRIGGER',
          severity: 'HIGH',
          userId,
          tenantId,
          description: `Large transaction detected: $${amount} exceeds SAR threshold of $${this.SAR_THRESHOLD}`,
          details: {
            amount,
            threshold: this.SAR_THRESHOLD,
            country,
                ipAddress
          },
          timestamp: new Date(),
          requiresReporting: true,
          autoFileSAR: false // Manual review required
        };
        alerts.push(alert);
        requiresSAR = true;
        riskFactors.push('large_transaction');
      }

      // 2. Check for structuring (multiple transactions just below threshold)
      const structuringCheck = await this.checkStructuring(userId, tenantId, amount);
      if (structuringCheck) {
        structuringPattern = structuringCheck;
        const alert: ComplianceAlert = {
          alertId: `structuring-${userId}-${Date.now()}`,
          type: 'STRUCTURING',
          severity: structuringCheck.suspicionLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
          userId,
          tenantId,
          description: `Potential structuring detected: ${structuringCheck.transactionCount} transactions totaling $${structuringCheck.totalAmount} within ${structuringCheck.timeWindow} seconds`,
          details: {
            transactionCount: structuringCheck.transactionCount,
            totalAmount: structuringCheck.totalAmount,
            averageAmount: structuringCheck.averageAmount,
            timeWindow: structuringCheck.timeWindow,
            suspicionLevel: structuringCheck.suspicionLevel
          },
          timestamp: new Date(),
          requiresReporting: structuringCheck.suspicionLevel === 'HIGH',
          autoFileSAR: false
        };
        alerts.push(alert);
        riskFactors.push('structuring');
      }

      // 3. Check for high-risk country
      if (country && this.HIGH_RISK_COUNTRIES.length > 0 && this.HIGH_RISK_COUNTRIES.includes(country)) {
        const alert: ComplianceAlert = {
          alertId: `high-risk-country-${userId}-${Date.now()}`,
          type: 'HIGH_RISK_COUNTRY',
          severity: 'MEDIUM',
          userId,
          tenantId,
          description: `Transaction from high-risk country: ${country}`,
          details: {
            country,
            ipAddress,
                amount
          },
          timestamp: new Date(),
          requiresReporting: false,
          autoFileSAR: false
        };
        alerts.push(alert);
        riskFactors.push('high_risk_country');
      }

      // 4. Check for PEP (Politically Exposed Person)
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        // Check if user has any PEP checks with positive results
        const hasPEP = kycStatus.pepChecks && kycStatus.pepChecks.length > 0 && 
                       kycStatus.pepChecks.some((check: any) => check.status === 'MATCH' || check.status === 'POTENTIAL_MATCH');
        if (hasPEP) {
          const alert: ComplianceAlert = {
            alertId: `pep-transaction-${userId}-${Date.now()}`,
            type: 'PEP_TRANSACTION',
            severity: 'HIGH',
            userId,
            tenantId,
            description: `Transaction from PEP (Politically Exposed Person)`,
            details: {
              amount,
              pepStatus: true,
              pepChecks: kycStatus.pepChecks,
              kycLevel: kycStatus.kycLevel
            },
            timestamp: new Date(),
            requiresReporting: true,
            autoFileSAR: false
          };
          alerts.push(alert);
          riskFactors.push('pep_transaction');
        }
      } catch (error) {
        LoggerService.warn('Failed to check PEP status', { error, userId });
      }

      // 5. Check cumulative threshold (daily/weekly/monthly)
      const cumulativeCheck = await this.checkCumulativeThresholds(userId, tenantId, amount);
      if (cumulativeCheck.requiresAlert) {
        alerts.push(...cumulativeCheck.alerts);
        if (cumulativeCheck.requiresSAR) {
          requiresSAR = true;
        }
        riskFactors.push(...cumulativeCheck.riskFactors);
      }

      const result: ComplianceCheckResult = {
        requiresAlert: alerts.length > 0,
        requiresSAR,
        alerts,
        structuringPattern,
                riskFactors
      };

      // Log compliance check
      await LoggerService.logAudit(
        result.requiresAlert ? 'presale_compliance_alert' : 'presale_compliance_check',
        'presale_compliance',
        { userId, tenantId },
        {
          amount,
          alerts: alerts.length,
          requiresSAR,
          riskFactors,
                structuringPattern
        }
      );

      // Emit alerts if any
      if (alerts.length > 0) {
        for (const alert of alerts) {
          await EventStreamingService.emitSystemEvent(
            `presale.compliance.${alert.type.toLowerCase()}`,
            'presale_compliance',
            alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'error' : 'warn',
            alert.details,
            { userId, tenantId }
          );
        }

        // Create compliance report if SAR required
        if (requiresSAR) {
          await this.generateSARReport(userId, tenantId, amount, alerts);
        }
      }

      return result;
    } catch (error) {
      LoggerService.error('Compliance monitoring failed', error);
      // Fail-open: allow transaction if monitoring fails
      return {
        requiresAlert: false,
        requiresSAR: false,
        alerts: [],
        riskFactors: []
      };
    }
  }

  /**
   * Check for structuring pattern (multiple transactions just below threshold)
   */
  private static async checkStructuring(
    userId: string,
    tenantId: string,
    currentAmount: number
  ): Promise<StructuringPattern | undefined> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return undefined;

      const key = `${this.REDIS_PREFIX}${tenantId}:${userId}:tx_history`;
      const now = Date.now();
      const windowStart = now - (this.STRUCTURING_WINDOW * 1000);

      // Get recent transactions
      const transactions = await redis.lrange(key, 0, 99);
      const recent = transactions
        .map(tx => JSON.parse(tx))
        .filter((tx: any) => tx.timestamp >= windowStart);

      // Add current transaction
      recent.push({ amount: currentAmount, timestamp: now });

      // Check if multiple transactions are just below threshold
      const belowThreshold = recent.filter((tx: any) => 
        tx.amount >= this.STRUCTURING_THRESHOLD && tx.amount < this.SAR_THRESHOLD
      );

      if (belowThreshold.length < 2) return undefined;

      const totalAmount = recent.reduce((sum: number, tx: any) => sum + tx.amount, 0);
      const averageAmount = totalAmount / recent.length;
      // timeSpan extracted but not used in this function
      (Math.max(...recent.map((tx: any) => tx.timestamp)) - 
                       Math.min(...recent.map((tx: any) => tx.timestamp))) / 1000;

      // Determine suspicion level
      let suspicionLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (belowThreshold.length >= 5 && totalAmount >= this.SAR_THRESHOLD * 2) {
        suspicionLevel = 'HIGH';
      } else if (belowThreshold.length >= 3 && totalAmount >= this.SAR_THRESHOLD) {
        suspicionLevel = 'MEDIUM';
      }

      if (suspicionLevel === 'LOW') return undefined;

      return {
        userId,
        transactionCount: recent.length,
        totalAmount,
        timeWindow: this.STRUCTURING_WINDOW,
        averageAmount,
        threshold: this.SAR_THRESHOLD,
                suspicionLevel
      };
    } catch (error) {
      LoggerService.warn('Structuring check failed', { error });
      return undefined;
    }
  }

  /**
   * Check cumulative thresholds (daily/weekly/monthly)
   */
  private static async checkCumulativeThresholds(
    userId: string,
    tenantId: string,
    currentAmount: number
  ): Promise<{
    requiresAlert: boolean;
    requiresSAR: boolean;
    alerts: ComplianceAlert[];
    riskFactors: string[];
  }> {
    const alerts: ComplianceAlert[] = [];
    const riskFactors: string[] = [];
    let requiresSAR = false;

    try {
      const redis = RedisService.getClient();
      if (!redis) return { requiresAlert: false, requiresSAR: false, alerts, riskFactors };

      const now = Date.now();
      const dayKey = `${this.REDIS_PREFIX}${tenantId}:${userId}:daily:${Math.floor(now / 86400000)}`;
      const weekKey = `${this.REDIS_PREFIX}${tenantId}:${userId}:weekly:${Math.floor(now / (86400000 * 7))}`;
      // monthKey extracted but not used in this function
      `${this.REDIS_PREFIX}${tenantId}:${userId}:monthly:${Math.floor(now / (86400000 * 30))}`;

      // Update and check daily total
      const dailyTotalStr = await redis.get(dayKey);
      const dailyTotal = dailyTotalStr ? parseFloat(dailyTotalStr) : 0;
      const newDailyTotal = dailyTotal + currentAmount;
      await redis.set(dayKey, newDailyTotal.toString(), 'EX', 86400 * 2); // 2 days

      if (newDailyTotal >= this.SAR_THRESHOLD * 2) {
        alerts.push({
          alertId: `daily-threshold-${userId}-${Date.now()}`,
          type: 'THRESHOLD_EXCEEDED',
          severity: 'HIGH',
          userId,
          tenantId,
          description: `Daily cumulative threshold exceeded: $${newDailyTotal}`,
          details: {
            period: 'daily',
            total: newDailyTotal,
            threshold: this.SAR_THRESHOLD * 2
          },
          timestamp: new Date(),
          requiresReporting: true,
          autoFileSAR: false
        });
        requiresSAR = true;
        riskFactors.push('daily_threshold_exceeded');
      }

      // Update and check weekly total
      const weeklyTotalStr = await redis.get(weekKey);
      const weeklyTotal = weeklyTotalStr ? parseFloat(weeklyTotalStr) : 0;
      const newWeeklyTotal = weeklyTotal + currentAmount;
      await redis.set(weekKey, newWeeklyTotal.toString(), 'EX', 86400 * 8); // 8 days

      if (newWeeklyTotal >= this.SAR_THRESHOLD * 5) {
        alerts.push({
          alertId: `weekly-threshold-${userId}-${Date.now()}`,
          type: 'THRESHOLD_EXCEEDED',
          severity: 'MEDIUM',
          userId,
          tenantId,
          description: `Weekly cumulative threshold exceeded: $${newWeeklyTotal}`,
          details: {
            period: 'weekly',
            total: newWeeklyTotal,
            threshold: this.SAR_THRESHOLD * 5
          },
          timestamp: new Date(),
          requiresReporting: true,
          autoFileSAR: false
        });
        riskFactors.push('weekly_threshold_exceeded');
      }

      return {
        requiresAlert: alerts.length > 0,
        requiresSAR,
        alerts,
                riskFactors
      };
    } catch (error) {
      LoggerService.warn('Cumulative threshold check failed', { error });
      return { requiresAlert: false, requiresSAR: false, alerts, riskFactors };
    }
  }

  /**
   * Generate SAR (Suspicious Activity Report)
   */
  private static async generateSARReport(
    userId: string,
    tenantId: string,
    amount: number,
    alerts: ComplianceAlert[]
  ): Promise<void> {
    try {
      // Get user information
      const kycStatus = await KYCService.getKYCStatus(userId);
      const hasPEP = kycStatus.pepChecks && kycStatus.pepChecks.length > 0 && 
                     kycStatus.pepChecks.some((check: any) => check.status === 'MATCH' || check.status === 'POTENTIAL_MATCH');

      const sarData = {
        userId,
        tenantId,
        amount,
        alerts,
        kycLevel: kycStatus.kycLevel,
        isPEP: hasPEP,
        timestamp: new Date().toISOString(),
        reportType: 'SAR',
        status: 'PENDING_REVIEW'
      };

      // Store SAR data (compliance microservices will handle actual reporting)
      // Emit event for compliance microservices to process
      await EventStreamingService.emitSystemEvent(
        'presale.compliance.sar_generated',
        'presale_compliance',
        'error',
        sarData,
        { userId, tenantId }
      );

      // Emit SAR event
      await EventStreamingService.emitSystemEvent(
        'presale.compliance.sar_generated',
        'presale_compliance',
        'error',
        sarData,
        { userId, tenantId }
      );

      LoggerService.info('SAR report generated', {
        userId,
        tenantId,
        amount,
        alertCount: alerts.length
      });
    } catch (error) {
      LoggerService.error('Failed to generate SAR report', error);
    }
  }

  /**
   * Track transaction for compliance monitoring
   */
  public static async trackTransaction(
    userId: string,
    tenantId: string,
    amount: number,
    country?: string
  ): Promise<void> {
    try {
      const redis = RedisService.getClient();
      if (!redis) return;

      const now = Date.now();
      const key = `${this.REDIS_PREFIX}${tenantId}:${userId}:tx_history`;
      const txData = {
        amount,
        country,
        timestamp: now
      };

      // Add to list (keep last 1000 transactions)
      await redis.lpush(key, JSON.stringify(txData));
      await redis.ltrim(key, 0, 999);
      await redis.expire(key, 86400 * 90); // 90 days
    } catch (error) {
      LoggerService.warn('Failed to track transaction for compliance', { error });
    }
  }
}
