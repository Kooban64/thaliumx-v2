/**
 * Enterprise Log Retention Policy Service
 * 
 * Enforces retention policies for audit logs based on compliance requirements.
 * 
 * Features:
 * - SOX compliance: 7-year retention for financial audit logs
 * - GDPR compliance: Support for right to erasure (anonymization)
 * - PCI-DSS compliance: Retention policies
 * - FINRA compliance: Trading activity retention
 * - Automatic cleanup of expired logs
 * - Retention policy enforcement
 */

import { DatabaseService } from './database';
import { LoggerService } from './logger';

interface RetentionPolicy {
  complianceFlag: string;
  retentionYears: number;
  anonymizeOnExpiry?: boolean; // For GDPR
}

class LogRetentionService {
  private static policies: Map<string, RetentionPolicy> = new Map();
  private static initialized = false;

  /**
   * Initialize retention policies
   */
  public static initialize(): void {
    // SOX: 7 years for financial audit logs
    this.policies.set('SOX', {
      complianceFlag: 'SOX',
      retentionYears: 7,
    });

    // GDPR: 1 year, anonymize on expiry (not delete)
    this.policies.set('GDPR', {
      complianceFlag: 'GDPR',
      retentionYears: 1,
      anonymizeOnExpiry: true,
    });

    // PCI-DSS: 1 year
    this.policies.set('PCI-DSS', {
      complianceFlag: 'PCI-DSS',
      retentionYears: 1,
    });

    // FINRA: 7 years for trading activities
    this.policies.set('FINRA', {
      complianceFlag: 'FINRA',
      retentionYears: 7,
    });

    this.initialized = true;
  }

  /**
   * Enforce retention policies
   */
  public static async enforceRetentionPolicies(): Promise<void> {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const Model: any = DatabaseService.getModel && DatabaseService.getModel('AuditLog');
      if (!Model) {
        LoggerService.warn('AuditLog model not available for retention enforcement');
        return;
      }

      const now = new Date();
      
      const policiesArray = Array.from(this.policies.entries());
      for (const [name, policy] of policiesArray) {
        const expiryDate = new Date(now);
        expiryDate.setFullYear(expiryDate.getFullYear() - policy.retentionYears);

        // Find logs that should be processed
        const expiredLogs = await Model.findAll({
          where: {
            createdAt: {
              $lt: expiryDate,
            },
            // Only process logs with this compliance flag
            // Note: This assumes complianceFlags is stored as JSONB array
          },
          limit: 1000, // Process in batches
        });

        for (const log of expiredLogs) {
          const logData = log.toJSON();
          const flags: string[] = (logData.complianceFlags as string[]) || [];
          
          if (flags.includes(policy.complianceFlag)) {
            if (policy.anonymizeOnExpiry) {
              // Anonymize instead of delete (GDPR)
              await Model.update(
                {
                  userId: null,
                  details: { anonymized: true, originalAction: logData.action },
                  action: '[ANONYMIZED]',
                },
                {
                  where: { id: logData.id },
                }
              );
            } else {
              // Delete expired logs (SOX, PCI-DSS, FINRA after retention period)
              await Model.destroy({
                where: { id: logData.id },
              });
            }
          }
        }

        LoggerService.info(`Retention policy enforced for ${name}`, {
          policy: name,
          retentionYears: policy.retentionYears,
          processedCount: expiredLogs.length,
        });
      }
    } catch (error) {
      LoggerService.error('Failed to enforce retention policies', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get retention policy for a compliance flag
   */
  public static getRetentionPolicy(complianceFlag: string): RetentionPolicy | undefined {
    if (!this.initialized) {
      this.initialize();
    }
    return this.policies.get(complianceFlag);
  }

  /**
   * Schedule retention enforcement (run daily)
   */
  public static scheduleRetentionEnforcement(): void {
    // Run daily at 2 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    
    const msUntil2AM = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      void this.enforceRetentionPolicies();
      // Schedule next run (24 hours)
      setInterval(() => {
        void this.enforceRetentionPolicies();
      }, 24 * 60 * 60 * 1000);
    }, msUntil2AM);
  }
}

export { LogRetentionService };
