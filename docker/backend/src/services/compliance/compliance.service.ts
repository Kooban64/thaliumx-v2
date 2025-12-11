import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { User } from '../../entities/user.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { KycSubmission } from '../../entities/kyc-submission.entity';
import { AmlCheck } from '../../entities/aml-check.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { MessagingService } from '../messaging/messaging.service';
import { StorageService } from '../storage/storage.service';

export interface ComplianceReport {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  data: any;
  status: 'generating' | 'completed' | 'failed';
}

export interface SuspiciousActivityReport {
  userId: string;
  activities: Array<{
    type: string;
    timestamp: Date;
    details: any;
    riskScore: number;
  }>;
  totalRiskScore: number;
  recommendedActions: string[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WalletTransaction)
    private transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(KycSubmission)
    private kycRepository: Repository<KycSubmission>,
    @InjectRepository(AmlCheck)
    private amlRepository: Repository<AmlCheck>,
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
    private messagingService: MessagingService,
    private storageService: StorageService,
  ) {}

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceReport> {
    const reportId = `compliance-${reportType}-${Date.now()}`;

    try {
      this.logger.log(`Generating ${reportType} compliance report: ${reportId}`);

      const report: ComplianceReport = {
        reportId,
        reportType,
        period: { startDate, endDate },
        generatedAt: new Date(),
        status: 'generating',
        data: {},
      };

      // Generate all compliance data sections
      report.data = await this.generateReportData(startDate, endDate);
      report.status = 'completed';

      // Store report
      await this.storageService.storeReport(report);

      // Send notifications
      await this.notifyComplianceTeam(report);

      this.logger.log(`Compliance report ${reportId} completed successfully`);
      return report;

    } catch (error) {
      this.logger.error(`Failed to generate compliance report ${reportId}`, error);
      throw error;
    }
  }

  /**
   * Generate all report data sections
   */
  private async generateReportData(startDate: Date, endDate: Date): Promise<any> {
    const [
      userStats,
      transactionStats,
      kycStats,
      amlStats,
      suspiciousActivities,
      regulatoryFilings,
    ] = await Promise.all([
      this.generateUserStatistics(startDate, endDate),
      this.generateTransactionStatistics(startDate, endDate),
      this.generateKycStatistics(startDate, endDate),
      this.generateAmlStatistics(startDate, endDate),
      this.detectSuspiciousActivities(startDate, endDate),
      this.generateRegulatoryFilings(startDate, endDate),
    ]);

    return {
      userStatistics: userStats,
      transactionStatistics: transactionStats,
      kycStatistics: kycStats,
      amlStatistics: amlStats,
      suspiciousActivities,
      regulatoryFilings,
      complianceScore: this.calculateComplianceScore({
        userStats,
        transactionStats,
        kycStats,
        amlStats,
        suspiciousActivities,
      }),
      recommendations: this.generateComplianceRecommendations({
        userStats,
        transactionStats,
        kycStats,
        amlStats,
        suspiciousActivities,
      }),
    };
  }

  /**
   * Generate user statistics for compliance
   */
  private async generateUserStatistics(startDate: Date, endDate: Date) {
    const [
      totalUsers,
      newUsers,
      activeUsers,
      kycApprovedUsers,
      kycPendingUsers,
      kycRejectedUsers,
      usersByCountry,
      highRiskUsers,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),
      this.userRepository.count({
        where: {
          lastLoginAt: MoreThan(startDate),
        },
      }),
      this.userRepository.count({
        where: { kycStatus: 'approved' },
      }),
      this.userRepository.count({
        where: { kycStatus: 'pending' },
      }),
      this.userRepository.count({
        where: { kycStatus: 'rejected' },
      }),
      this.userRepository
        .createQueryBuilder('user')
        .select('country_code', 'count')
        .addSelect('COUNT(*)', 'count')
        .groupBy('country_code')
        .getRawMany(),
      this.userRepository.count({
        where: { riskScore: MoreThan(7) },
      }),
    ]);

    return {
      totalUsers,
      newUsers,
      activeUsers,
      kycApprovedUsers,
      kycPendingUsers,
      kycRejectedUsers,
      usersByCountry,
      highRiskUsers,
      kycCompletionRate: (kycApprovedUsers / totalUsers) * 100,
    };
  }

  /**
   * Generate transaction statistics
   */
  private async generateTransactionStatistics(startDate: Date, endDate: Date) {
    const [
      totalTransactions,
      totalVolume,
      largeTransactions,
      transactionsByCurrency,
      failedTransactions,
      chargebacks,
    ] = await Promise.all([
      this.transactionRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(amount)', 'totalVolume')
        .where('created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),
      this.transactionRepository.count({
        where: {
          amount: MoreThan(10000), // Large transaction threshold
          createdAt: Between(startDate, endDate),
        },
      }),
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('currency', 'count')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(amount)', 'volume')
        .where('created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('currency')
        .getRawMany(),
      this.transactionRepository.count({
        where: {
          status: 'failed',
          createdAt: Between(startDate, endDate),
        },
      }),
      this.transactionRepository.count({
        where: {
          type: 'chargeback',
          createdAt: Between(startDate, endDate),
        },
      }),
    ]);

    return {
      totalTransactions,
      totalVolume: totalVolume?.totalVolume || 0,
      largeTransactions,
      transactionsByCurrency,
      failedTransactions,
      chargebacks,
      successRate: ((totalTransactions - failedTransactions) / totalTransactions) * 100,
    };
  }

  /**
   * Generate KYC statistics
   */
  private async generateKycStatistics(startDate: Date, endDate: Date) {
    const [
      totalSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingSubmissions,
      averageProcessingTime,
    ] = await Promise.all([
      this.kycRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.kycRepository.count({
        where: {
          status: 'approved',
          createdAt: Between(startDate, endDate),
        },
      }),
      this.kycRepository.count({
        where: {
          status: 'rejected',
          createdAt: Between(startDate, endDate),
        },
      }),
      this.kycRepository.count({
        where: { status: 'pending' },
      }),
      this.kycRepository
        .createQueryBuilder('kyc')
        .select('AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)))', 'avgTime')
        .where('status IN (:...statuses)', { statuses: ['approved', 'rejected'] })
        .andWhere('created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),
    ]);

    return {
      totalSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingSubmissions,
      approvalRate: (approvedSubmissions / totalSubmissions) * 100,
      averageProcessingTime: averageProcessingTime?.avgTime || 0,
    };
  }

  /**
   * Generate AML statistics
   */
  private async generateAmlStatistics(startDate: Date, endDate: Date) {
    const [
      totalChecks,
      passedChecks,
      failedChecks,
      pendingChecks,
      highRiskAlerts,
    ] = await Promise.all([
      this.amlRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.amlRepository.count({
        where: {
          status: 'clear',
          createdAt: Between(startDate, endDate),
        },
      }),
      this.amlRepository.count({
        where: {
          status: 'match',
          createdAt: Between(startDate, endDate),
        },
      }),
      this.amlRepository.count({
        where: { status: 'pending' },
      }),
      this.amlRepository.count({
        where: {
          riskLevel: 'high',
          createdAt: Between(startDate, endDate),
        },
      }),
    ]);

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      pendingChecks,
      highRiskAlerts,
      passRate: (passedChecks / totalChecks) * 100,
    };
  }

  /**
   * Detect suspicious activities
   */
  private async detectSuspiciousActivities(
    startDate: Date,
    endDate: Date,
  ): Promise<SuspiciousActivityReport[]> {
    // Complex logic to detect suspicious patterns
    const suspiciousUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.walletTransactions', 'transaction')
      .addSelect('COUNT(transaction.id)', 'transactionCount')
      .addSelect('SUM(transaction.amount)', 'totalVolume')
      .where('transaction.created_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('user.id')
      .having('COUNT(transaction.id) > 100') // High frequency trading
      .orHaving('SUM(transaction.amount) > 100000') // Large volume
      .getRawAndEntities();

    const reports: SuspiciousActivityReport[] = [];

    for (const user of suspiciousUsers) {
      const activities = await this.auditRepository.find({
        where: {
          userId: user.id,
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      const riskScore = this.calculateUserRiskScore(user, activities);

      if (riskScore > 6) {
        reports.push({
          userId: user.id,
          activities: activities.map(activity => ({
            type: activity.action,
            timestamp: activity.createdAt,
            details: activity.oldValues || activity.newValues,
            riskScore: this.calculateActivityRisk(activity),
          })),
          totalRiskScore: riskScore,
          recommendedActions: this.generateRecommendedActions(riskScore, activities),
        });
      }
    }

    return reports;
  }

  /**
   * Calculate user risk score
   */
  private calculateUserRiskScore(user: User, activities: AuditLog[]): number {
    let score = 0;

    // Risk factors
    if (user.kycStatus !== 'approved') score += 2;
    if (user.riskScore > 5) score += 2;
    if (activities.length > 50) score += 1; // High activity
    if (user.countryCode === 'HIGH_RISK_COUNTRY') score += 3;

    // Recent failed activities
    const recentFailures = activities.filter(
      a => a.status === 'failure' && a.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    score += Math.min(recentFailures, 3);

    return Math.min(score, 10);
  }

  /**
   * Calculate activity risk score
   */
  private calculateActivityRisk(activity: AuditLog): number {
    const riskMap: Record<string, number> = {
      'user.login.failed': 1,
      'wallet.withdrawal.large': 2,
      'kyc.submission.rejected': 1,
      'user.password.change': 0.5,
      'trading.order.cancel': 0.5,
    };

    return riskMap[activity.action] || 0;
  }

  /**
   * Generate recommended actions for suspicious users
   */
  private generateRecommendedActions(riskScore: number, activities: AuditLog[]): string[] {
    const actions: string[] = [];

    if (riskScore > 8) {
      actions.push('Immediate account suspension');
      actions.push('Enhanced due diligence required');
      actions.push('Report to financial authorities');
    } else if (riskScore > 6) {
      actions.push('Additional KYC verification');
      actions.push('Transaction monitoring enhancement');
      actions.push('Manual review required');
    } else if (riskScore > 4) {
      actions.push('Enhanced monitoring');
      actions.push('Additional verification requests');
    }

    return actions;
  }

  /**
   * Generate regulatory filings data
   */
  private async generateRegulatoryFilings(startDate: Date, endDate: Date) {
    // Generate data for regulatory reports (SAR, CTR, etc.)
    const largeTransactions = await this.transactionRepository.find({
      where: {
        amount: MoreThan(10000), // Reportable transaction threshold
        createdAt: Between(startDate, endDate),
      },
      relations: ['user'],
    });

    const suspiciousActivities = await this.amlRepository.find({
      where: {
        status: 'match',
        createdAt: Between(startDate, endDate),
      },
      relations: ['user'],
    });

    return {
      largeTransactions: largeTransactions.map(tx => ({
        transactionId: tx.id,
        userId: tx.userId,
        amount: tx.amount,
        currency: tx.currency,
        timestamp: tx.createdAt,
        userInfo: {
          name: `${tx.user.firstName} ${tx.user.lastName}`,
          country: tx.user.countryCode,
        },
      })),
      suspiciousActivities: suspiciousActivities.map(activity => ({
        activityId: activity.id,
        userId: activity.userId,
        type: activity.checkType,
        riskLevel: activity.riskLevel,
        matches: activity.matches,
        timestamp: activity.createdAt,
      })),
    };
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(data: any): number {
    let score = 100;

    // Deduct points for issues
    if (data.kycStats.kycCompletionRate < 80) score -= 10;
    if (data.amlStats.passRate < 95) score -= 10;
    if (data.transactionStats.successRate < 99) score -= 5;
    if (data.suspiciousActivities.length > 10) score -= 15;

    return Math.max(score, 0);
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (data.kycStats.kycCompletionRate < 80) {
      recommendations.push('Improve KYC completion rate through better user onboarding');
    }

    if (data.amlStats.passRate < 95) {
      recommendations.push('Enhance AML screening processes and provider integration');
    }

    if (data.transactionStats.successRate < 99) {
      recommendations.push('Investigate and resolve transaction failure causes');
    }

    if (data.suspiciousActivities.length > 10) {
      recommendations.push('Implement additional monitoring for high-risk users');
    }

    if (data.userStats.highRiskUsers > 100) {
      recommendations.push('Review risk assessment algorithms and thresholds');
    }

    return recommendations;
  }

  /**
   * Notify compliance team
   */
  private async notifyComplianceTeam(report: ComplianceReport): Promise<void> {
    const message = {
      type: 'compliance_report_generated',
      reportId: report.reportId,
      reportType: report.reportType,
      complianceScore: report.data.complianceScore,
      highRiskAlerts: report.data.suspiciousActivities.length,
      recommendations: report.data.recommendations,
    };

    await this.messagingService.publish('compliance.notifications', message);
  }

  /**
   * Schedule automated compliance reporting
   */
  async scheduleComplianceReports(): Promise<void> {
    // Schedule daily, weekly, monthly reports
    // This would integrate with a job scheduler like Bull or Agenda
    this.logger.log('Compliance reporting scheduler initialized');
  }
}