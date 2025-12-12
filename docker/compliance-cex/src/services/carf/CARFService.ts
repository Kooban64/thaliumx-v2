/**
 * CARF Service for CEX Compliance Service
 * Implements OECD Crypto-Asset Reporting Framework compliance
 */

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { carfRepository, CreateCARFReportDTO } from '../../repositories';
import { eventProducer } from '../events';
import {
  CARFReportingData,
  CARFReportingEntity,
  CARFReportablePerson,
  CARFTransaction,
  CARFReportingPeriod,
} from '../../types/compliance';
import { CARFReportGeneratedEvent, CARFReportSubmittedEvent } from '../../types/events';

// ==================== INTERFACES ====================

/**
 * CARF report generation request
 */
export interface GenerateCARFReportRequest {
  userId: string;
  tenantId: string;
  brokerId?: string;
  reportingPeriod: CARFReportingPeriod;
  transactions: Array<{
    type: CARFTransaction['type'];
    date: Date;
    cryptoAsset: string;
    amount: string;
    value: string;
    currency: string;
    exchangeRate: string;
    fees: string;
    counterparty?: string;
    platform?: string;
    description?: string;
    transactionHash?: string;
    walletAddress?: string;
  }>;
  reportablePerson: CARFReportablePerson;
  reportingEntity: CARFReportingEntity;
}

/**
 * CARF submission result
 */
export interface CARFSubmissionResult {
  success: boolean;
  reportId: string;
  status: 'submitted' | 'acknowledged' | 'rejected';
  submissionDate: Date;
  responseTime?: number;
  errorMessage?: string;
}

/**
 * CARF annual summary
 */
export interface CARFAnnualSummary {
  userId: string;
  year: number;
  totalReports: number;
  totalTransactions: number;
  totalValue: string;
  byAssetType: Record<string, { count: number; value: string }>;
  byTransactionType: Record<string, { count: number; value: string }>;
  status: {
    draft: number;
    pending: number;
    submitted: number;
    acknowledged: number;
    rejected: number;
  };
}

// ==================== CARF SERVICE ====================

/**
 * CARF Service - Manages CARF reporting compliance
 */
export class CARFService {
  // Configuration values stored for potential future use
  private readonly _autoGenerate: boolean;
  private readonly _reportingPeriodDays: number;
  private readonly _retentionYears: number;

  constructor() {
    this._autoGenerate = config.carf.autoGenerate;
    this._reportingPeriodDays = config.carf.reportingPeriodDays;
    this._retentionYears = config.carf.retentionYears;
  }

  // Getters for configuration values
  get autoGenerate(): boolean { return this._autoGenerate; }
  get reportingPeriodDays(): number { return this._reportingPeriodDays; }
  get retentionYears(): number { return this._retentionYears; }

  /**
   * Generate CARF report for a user
   */
  async generateReport(request: GenerateCARFReportRequest): Promise<CARFReportingData[]> {
    logger.info('Generating CARF report', {
      userId: request.userId,
      tenantId: request.tenantId,
      transactionCount: request.transactions.length,
    });

    const reports: CARFReportingData[] = [];

    for (const transaction of request.transactions) {
      const txData: CARFTransaction = {
        type: transaction.type,
        date: transaction.date,
        fees: transaction.fees,
      };
      if (transaction.counterparty) txData.counterparty = transaction.counterparty;
      if (transaction.platform) txData.platform = transaction.platform;
      if (transaction.description) txData.description = transaction.description;
      if (transaction.transactionHash) txData.transactionHash = transaction.transactionHash;
      if (transaction.walletAddress) txData.walletAddress = transaction.walletAddress;

      const createDTO: CreateCARFReportDTO = {
        reportingEntity: request.reportingEntity,
        reportablePerson: request.reportablePerson,
        cryptoAsset: {
          type: transaction.cryptoAsset,
          amount: transaction.amount,
          value: transaction.value,
          currency: transaction.currency,
          exchangeRate: transaction.exchangeRate,
          marketValue: transaction.value,
        },
        transaction: txData,
        reportingPeriod: request.reportingPeriod,
        tenantId: request.tenantId,
        userId: request.userId,
      };
      if (request.brokerId) createDTO.brokerId = request.brokerId;

      const report = await carfRepository.create(createDTO);
      const reportData = carfRepository.tableToCARFReportingData(report);
      reports.push(reportData);

      // Publish event
      await this.publishCARFGeneratedEvent(reportData);
    }

    logger.info('CARF reports generated', {
      userId: request.userId,
      count: reports.length,
    });

    return reports;
  }

  /**
   * Generate annual CARF report for a user
   */
  async generateAnnualReport(
    userId: string,
    year: number,
    tenantId: string
  ): Promise<CARFReportingData[]> {
    logger.info('Generating annual CARF report', {
      userId,
      year,
      tenantId,
    });

    const reports = await carfRepository.generateAnnualReport(userId, year, tenantId);
    return reports.map((r) => carfRepository.tableToCARFReportingData(r));
  }

  /**
   * Submit CARF report to regulatory authority
   */
  async submitReport(reportId: string): Promise<CARFSubmissionResult> {
    const report = await carfRepository.findById(reportId);
    if (!report) {
      throw new Error(`CARF report not found: ${reportId}`);
    }

    logger.info('Submitting CARF report', {
      id: reportId,
      reportId: report.report_id,
    });

    const startTime = Date.now();

    try {
      // Update status to pending
      await carfRepository.updateStatus(reportId, 'pending');

      // In production, this would call the actual regulatory submission API
      const result = await this.submitToRegulator(report);

      const responseTime = Date.now() - startTime;

      if (result.success) {
        await carfRepository.updateStatus(reportId, 'submitted');

        // Publish submitted event
        await this.publishCARFSubmittedEvent(
          reportId,
          report.report_id,
          report.reportable_person_country,
          'submitted',
          responseTime
        );

        logger.info('CARF report submitted successfully', {
          id: reportId,
          reportId: report.report_id,
          responseTime,
        });

        return {
          success: true,
          reportId: report.report_id,
          status: 'submitted',
          submissionDate: new Date(),
          responseTime,
        };
      } else {
        throw new Error(result.errorMessage ?? 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const responseTime = Date.now() - startTime;

      await carfRepository.updateStatus(reportId, 'rejected', errorMessage);

      logger.error('Failed to submit CARF report', {
        id: reportId,
        reportId: report.report_id,
        error: errorMessage,
      });

      return {
        success: false,
        reportId: report.report_id,
        status: 'rejected',
        submissionDate: new Date(),
        responseTime,
        errorMessage,
      };
    }
  }

  /**
   * Submit pending reports in batch
   */
  async submitPendingReports(): Promise<{
    total: number;
    submitted: number;
    failed: number;
  }> {
    const pendingReports = await carfRepository.findPendingSubmission();
    let submitted = 0;
    let failed = 0;

    for (const report of pendingReports) {
      try {
        const result = await this.submitReport(report.id);
        if (result.success) {
          submitted++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to submit pending report', {
          id: report.id,
          error: errorMessage,
        });
      }
    }

    logger.info('Processed pending CARF reports', {
      total: pendingReports.length,
      submitted,
      failed,
    });

    return {
      total: pendingReports.length,
      submitted,
      failed,
    };
  }

  /**
   * Get CARF report by ID
   */
  async getReportById(id: string): Promise<CARFReportingData | null> {
    const record = await carfRepository.findById(id);
    return record ? carfRepository.tableToCARFReportingData(record) : null;
  }

  /**
   * Get CARF report by report ID
   */
  async getReportByReportId(reportId: string): Promise<CARFReportingData | null> {
    const record = await carfRepository.findByReportId(reportId);
    return record ? carfRepository.tableToCARFReportingData(record) : null;
  }

  /**
   * Get user's CARF reports
   */
  async getUserReports(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string[];
    }
  ): Promise<{
    data: CARFReportingData[];
    total: number;
    hasMore: boolean;
  }> {
    const queryOptions: import('../../repositories').QueryOptions = {
      pagination: {
        limit: options?.limit ?? 100,
        offset: options?.offset ?? 0,
      },
    };
    if (options?.status && options.status.length > 0) {
      queryOptions.filters = options.status.map((s) => ({
        field: 'status',
        operator: '=' as const,
        value: s,
      }));
    }
    const result = await carfRepository.findByUser(userId, queryOptions);

    return {
      data: result.data.map((r) => carfRepository.tableToCARFReportingData(r)),
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * Get annual summary for a user
   */
  async getAnnualSummary(
    userId: string,
    year: number,
    tenantId: string
  ): Promise<CARFAnnualSummary> {
    const reports = await carfRepository.generateAnnualReport(userId, year, tenantId);

    const byAssetType: Record<string, { count: number; value: string }> = {};
    const byTransactionType: Record<string, { count: number; value: string }> = {};
    const status = {
      draft: 0,
      pending: 0,
      submitted: 0,
      acknowledged: 0,
      rejected: 0,
    };

    let totalValue = 0;

    for (const report of reports) {
      // By asset type
      const assetType = report.crypto_asset_type;
      if (!byAssetType[assetType]) {
        byAssetType[assetType] = { count: 0, value: '0' };
      }
      byAssetType[assetType].count++;
      byAssetType[assetType].value = (
        parseFloat(byAssetType[assetType].value) + parseFloat(report.crypto_asset_value)
      ).toString();

      // By transaction type
      const txType = report.transaction_type;
      if (!byTransactionType[txType]) {
        byTransactionType[txType] = { count: 0, value: '0' };
      }
      byTransactionType[txType].count++;
      byTransactionType[txType].value = (
        parseFloat(byTransactionType[txType].value) + parseFloat(report.crypto_asset_value)
      ).toString();

      // Status count
      status[report.status]++;

      // Total value
      totalValue += parseFloat(report.crypto_asset_value);
    }

    return {
      userId,
      year,
      totalReports: reports.length,
      totalTransactions: reports.length,
      totalValue: totalValue.toString(),
      byAssetType,
      byTransactionType,
      status,
    };
  }

  /**
   * Get user's crypto holdings
   */
  async getUserHoldings(
    userId: string,
    tenantId: string,
    asOfDate?: Date
  ): Promise<Record<string, { amount: string; value: string }>> {
    return carfRepository.getUserHoldings(
      userId,
      tenantId,
      asOfDate ?? new Date()
    );
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    id: string,
    status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected',
    rejectionReason?: string
  ): Promise<CARFReportingData | null> {
    const record = await carfRepository.updateStatus(id, status, rejectionReason);
    return record ? carfRepository.tableToCARFReportingData(record) : null;
  }

  /**
   * Get CARF statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    submitted: number;
    acknowledged: number;
    rejected: number;
    byAssetType: Record<string, number>;
    byTransactionType: Record<string, number>;
    totalValue: string;
  }> {
    return carfRepository.getStatistics(tenantId);
  }

  /**
   * Generate downloadable report (PDF format data)
   */
  async generateDownloadableReport(
    userId: string,
    year: number,
    tenantId: string
  ): Promise<{
    filename: string;
    contentType: string;
    data: string; // Base64 encoded
  }> {
    const summary = await this.getAnnualSummary(userId, year, tenantId);
    const reports = await this.generateAnnualReport(userId, year, tenantId);

    // In production, this would generate an actual PDF
    // For now, return JSON data as base64
    const reportData = {
      summary,
      reports,
      generatedAt: new Date().toISOString(),
      version: '1.0',
    };

    const jsonString = JSON.stringify(reportData, null, 2);
    const base64Data = Buffer.from(jsonString).toString('base64');

    return {
      filename: `carf-report-${userId}-${year}.json`,
      contentType: 'application/json',
      data: base64Data,
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Submit report to regulator (mock implementation)
   */
  private async submitToRegulator(
    _report: Awaited<ReturnType<typeof carfRepository.findById>>
  ): Promise<{ success: boolean; errorMessage?: string }> {
    // In production, implement actual regulatory submission API
    // This is a mock implementation
    // The _report parameter will be used for actual API submission

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return { success: true };
    } else {
      return { success: false, errorMessage: 'Regulatory API timeout' };
    }
  }

  /**
   * Publish CARF report generated event
   */
  private async publishCARFGeneratedEvent(report: CARFReportingData): Promise<void> {
    const event = eventProducer.createEvent<CARFReportGeneratedEvent>(
      'compliance.carf.generated',
      'cex',
      'system',
      {
        reportId: report.id,
        userId: '', // Will be set from context
        reportId_external: report.reportId,
        cryptoAsset: report.cryptoAsset.type,
        amount: report.cryptoAsset.amount,
        value: report.cryptoAsset.value,
        currency: report.cryptoAsset.currency,
        transactionType: report.transaction.type,
        status: report.status,
      },
      report.id
    );

    await eventProducer.publish(event, 'compliance.carf');
  }

  /**
   * Publish CARF report submitted event
   */
  private async publishCARFSubmittedEvent(
    reportId: string,
    reportIdExternal: string,
    jurisdiction: string,
    status: 'submitted' | 'acknowledged' | 'rejected',
    responseTime?: number
  ): Promise<void> {
    const eventData: CARFReportSubmittedEvent['data'] = {
      reportId,
      reportId_external: reportIdExternal,
      jurisdiction,
      submissionEndpoint: 'regulatory-api',
      status,
      submissionDate: new Date().toISOString(),
    };
    if (responseTime !== undefined) eventData.responseTime = responseTime;

    const event = eventProducer.createEvent<CARFReportSubmittedEvent>(
      'compliance.carf.submitted',
      'cex',
      'system',
      eventData,
      reportId
    );

    await eventProducer.publish(event, 'compliance.carf');
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton CARF service instance
 */
export const carfService = new CARFService();
