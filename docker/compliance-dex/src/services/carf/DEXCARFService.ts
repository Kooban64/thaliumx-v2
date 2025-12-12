/**
 * DEX CARF Reporting Service
 * OECD Crypto-Asset Reporting Framework compliance for DEX transactions
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { DEXCARFData } from '../../types/compliance';
import { databaseService } from '../database';
import { eventProducer } from '../events';
import { DEXCARFReportGeneratedEvent, DEXCARFReportSubmittedEvent } from '../../types/events';

// ==================== DEX CARF SERVICE ====================

/**
 * Service for generating CARF reports for DEX transactions
 */
export class DEXCARFService {
  private static instance: DEXCARFService;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DEXCARFService {
    if (!DEXCARFService.instance) {
      DEXCARFService.instance = new DEXCARFService();
    }
    return DEXCARFService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    logger.info('DEX CARF Service initialized', {
      enabled: config.carf.enabled,
      autoGenerate: config.carf.autoGenerate,
    });
  }

  /**
   * Generate CARF report for a wallet
   */
  public async generateReport(
    walletAddress: string,
    tenantId: string,
    options?: {
      userId?: string;
      brokerId?: string;
      startDate?: Date;
      endDate?: Date;
      fiscalYear?: string;
    }
  ): Promise<DEXCARFData> {
    const reportId = uuidv4();
    const externalReportId = `CARF-DEX-${Date.now()}-${reportId.substring(0, 8)}`;

    // Calculate reporting period
    const endDate = options?.endDate || new Date();
    const startDate = options?.startDate || new Date(
      endDate.getTime() - config.carf.reportingPeriodDays * 24 * 60 * 60 * 1000
    );

    try {
      // Fetch all DEX transactions for the wallet in the period
      const transactions = await this.fetchWalletTransactions(
        walletAddress,
        startDate,
        endDate
      );

      // Calculate totals
      const totals = this.calculateTotals(transactions);

      const carfData: DEXCARFData = {
        id: reportId,
        reportId: externalReportId,
        walletAddress,
        tenantId,
        reportingPeriod: {
          startDate,
          endDate,
        },
        transactions,
        totalSwapVolumeUSD: totals.swapVolume.toFixed(2),
        totalLiquidityProvidedUSD: totals.liquidityVolume.toFixed(2),
        totalBridgeVolumeUSD: totals.bridgeVolume.toFixed(2),
        totalFeesUSD: totals.fees.toFixed(2),
        status: 'draft',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add optional fields
      if (options?.userId) {
        carfData.userId = options.userId;
      }
      if (options?.fiscalYear) {
        carfData.reportingPeriod.fiscalYear = options.fiscalYear;
      }

      // Store report
      await this.storeReport(carfData);

      // Store transactions
      await this.storeReportTransactions(reportId, transactions);

      // Publish event
      await this.publishReportGeneratedEvent(carfData, options);

      logger.logCompliance('carf_report_generated', reportId, {
        walletAddress,
        transactionCount: transactions.length,
        totalVolume: totals.swapVolume + totals.liquidityVolume + totals.bridgeVolume,
      });

      return carfData;
    } catch (error) {
      logger.error('CARF report generation failed', {
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch wallet transactions for reporting period
   */
  private async fetchWalletTransactions(
    walletAddress: string,
    startDate: Date,
    endDate: Date
  ): Promise<DEXCARFData['transactions']> {
    const transactions: DEXCARFData['transactions'] = [];

    // Fetch swaps
    const swapsQuery = `
      SELECT 
        'swap' as type,
        timestamp as date,
        token_in_symbol as token_in,
        token_out_symbol as token_out,
        token_in_amount as amount_in,
        token_out_amount as amount_out,
        amount_in_usd as value_usd,
        transaction_hash,
        chain_id,
        protocol
      FROM dex_compliance.dex_swaps
      WHERE wallet_address = $1
        AND timestamp >= $2
        AND timestamp <= $3
      ORDER BY timestamp ASC
    `;

    const swapsResult = await databaseService.query(swapsQuery, [
      walletAddress.toLowerCase(),
      startDate,
      endDate,
    ]);

    for (const row of swapsResult.rows) {
      transactions.push({
        type: 'swap',
        date: new Date(row['timestamp'] as string),
        tokenIn: row['token_in'] as string,
        tokenOut: row['token_out'] as string,
        amountIn: row['amount_in'] as string,
        amountOut: row['amount_out'] as string,
        valueUSD: row['value_usd'] as string,
        transactionHash: row['transaction_hash'] as string,
        chainId: row['chain_id'] as number,
        protocol: row['protocol'] as string,
      });
    }

    // Fetch liquidity events
    const liquidityQuery = `
      SELECT 
        action,
        timestamp as date,
        token0_symbol,
        token1_symbol,
        token0_amount,
        token1_amount,
        total_value_usd as value_usd,
        transaction_hash,
        chain_id,
        protocol
      FROM dex_compliance.dex_liquidity
      WHERE wallet_address = $1
        AND timestamp >= $2
        AND timestamp <= $3
      ORDER BY timestamp ASC
    `;

    const liquidityResult = await databaseService.query(liquidityQuery, [
      walletAddress.toLowerCase(),
      startDate,
      endDate,
    ]);

    for (const row of liquidityResult.rows) {
      const action = row['action'] as string;
      transactions.push({
        type: action === 'add' ? 'liquidity_add' : 'liquidity_remove',
        date: new Date(row['date'] as string),
        tokenIn: row['token0_symbol'] as string,
        tokenOut: row['token1_symbol'] as string,
        amountIn: row['token0_amount'] as string,
        amountOut: row['token1_amount'] as string,
        valueUSD: row['value_usd'] as string,
        transactionHash: row['transaction_hash'] as string,
        chainId: row['chain_id'] as number,
        protocol: row['protocol'] as string,
      });
    }

    // Fetch bridge transactions
    const bridgeQuery = `
      SELECT 
        timestamp as date,
        token_symbol,
        token_amount,
        amount_usd as value_usd,
        source_transaction_hash as transaction_hash,
        source_chain_id as chain_id,
        bridge_protocol as protocol
      FROM dex_compliance.bridge_transactions
      WHERE source_wallet = $1
        AND timestamp >= $2
        AND timestamp <= $3
      ORDER BY timestamp ASC
    `;

    const bridgeResult = await databaseService.query(bridgeQuery, [
      walletAddress.toLowerCase(),
      startDate,
      endDate,
    ]);

    for (const row of bridgeResult.rows) {
      transactions.push({
        type: 'bridge',
        date: new Date(row['date'] as string),
        tokenIn: row['token_symbol'] as string,
        tokenOut: row['token_symbol'] as string,
        amountIn: row['token_amount'] as string,
        amountOut: row['token_amount'] as string,
        valueUSD: row['value_usd'] as string,
        transactionHash: row['transaction_hash'] as string,
        chainId: row['chain_id'] as number,
        protocol: row['protocol'] as string,
      });
    }

    // Sort all transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return transactions;
  }

  /**
   * Calculate totals from transactions
   */
  private calculateTotals(transactions: DEXCARFData['transactions']): {
    swapVolume: number;
    liquidityVolume: number;
    bridgeVolume: number;
    fees: number;
  } {
    let swapVolume = 0;
    let liquidityVolume = 0;
    let bridgeVolume = 0;
    let fees = 0;

    for (const tx of transactions) {
      const value = parseFloat(tx.valueUSD);

      switch (tx.type) {
        case 'swap':
          swapVolume += value;
          fees += value * 0.003; // Estimate 0.3% fee
          break;
        case 'liquidity_add':
        case 'liquidity_remove':
          liquidityVolume += value;
          break;
        case 'bridge':
          bridgeVolume += value;
          fees += value * 0.001; // Estimate 0.1% bridge fee
          break;
        case 'stake':
        case 'unstake':
          // No volume for staking
          break;
      }
    }

    return { swapVolume, liquidityVolume, bridgeVolume, fees };
  }

  /**
   * Store CARF report in database
   */
  private async storeReport(report: DEXCARFData): Promise<void> {
    const query = `
      INSERT INTO dex_compliance.carf_reports (
        id, report_id, wallet_address, user_id, tenant_id, broker_id,
        reporting_period_start_date, reporting_period_end_date,
        reporting_period_fiscal_year, total_swap_volume_usd,
        total_liquidity_provided_usd, total_bridge_volume_usd,
        total_fees_usd, transaction_count, status, version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
    `;

    await databaseService.query(query, [
      report.id,
      report.reportId,
      report.walletAddress,
      report.userId || null,
      report.tenantId,
      null, // brokerId not in DEXCARFData
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      report.reportingPeriod.fiscalYear || null,
      report.totalSwapVolumeUSD,
      report.totalLiquidityProvidedUSD,
      report.totalBridgeVolumeUSD,
      report.totalFeesUSD,
      report.transactions.length,
      report.status,
      report.version,
    ]);
  }

  /**
   * Store report transactions
   */
  private async storeReportTransactions(
    reportId: string,
    transactions: DEXCARFData['transactions']
  ): Promise<void> {
    if (transactions.length === 0) return;

    const query = `
      INSERT INTO dex_compliance.carf_transactions (
        id, carf_report_id, transaction_type, transaction_date,
        token_in, token_out, amount_in, amount_out, value_usd,
        transaction_hash, chain_id, protocol
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    for (const tx of transactions) {
      await databaseService.query(query, [
        uuidv4(),
        reportId,
        tx.type,
        tx.date,
        tx.tokenIn,
        tx.tokenOut,
        tx.amountIn,
        tx.amountOut,
        tx.valueUSD,
        tx.transactionHash,
        tx.chainId,
        tx.protocol,
      ]);
    }
  }

  /**
   * Submit CARF report to regulatory authority
   */
  public async submitReport(
    reportId: string,
    jurisdiction: string
  ): Promise<void> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`CARF report not found: ${reportId}`);
    }

    if (report.status !== 'draft' && report.status !== 'pending') {
      throw new Error(`CARF report cannot be submitted: ${report.status}`);
    }

    const startTime = Date.now();

    try {
      // Update status to pending
      await this.updateReportStatus(reportId, 'pending');

      // In production, this would:
      // 1. Format report according to jurisdiction requirements
      // 2. Submit to regulatory API
      // 3. Handle response

      // Simulate submission
      await this.simulateSubmission(report, jurisdiction);

      // Update status to submitted
      await this.updateReportStatus(reportId, 'submitted', new Date());

      const duration = Date.now() - startTime;

      // Publish event
      await this.publishReportSubmittedEvent(report, jurisdiction, 'submitted', duration);

      logger.logCompliance('carf_report_submitted', reportId, {
        jurisdiction,
        duration,
      });
    } catch (error) {
      // Update status back to draft
      await this.updateReportStatus(reportId, 'draft');

      const duration = Date.now() - startTime;
      await this.publishReportSubmittedEvent(
        report,
        jurisdiction,
        'rejected',
        duration,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Simulate report submission (for development/testing)
   */
  private async simulateSubmission(
    _report: DEXCARFData,
    _jurisdiction: string
  ): Promise<void> {
    // Simulate network delay
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => resolve(), 100);
      // Ensure the timeout is cleared if needed
      void timeoutId;
    });

    // In production, this would integrate with:
    // - IRS (US)
    // - CRA (Canada)
    // - HMRC (UK)
    // - Various EU tax authorities
  }

  /**
   * Update report status
   */
  private async updateReportStatus(
    reportId: string,
    status: DEXCARFData['status'],
    submissionDate?: Date
  ): Promise<void> {
    const query = `
      UPDATE dex_compliance.carf_reports
      SET status = $1, submission_date = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await databaseService.query(query, [status, submissionDate || null, reportId]);
  }

  /**
   * Get CARF report by ID
   */
  public async getReport(reportId: string): Promise<DEXCARFData | null> {
    const query = `
      SELECT * FROM dex_compliance.carf_reports
      WHERE id = $1
    `;

    const result = await databaseService.query(query, [reportId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const report = this.mapRowToReport(row as Record<string, unknown>);

    // Fetch transactions
    const txQuery = `
      SELECT * FROM dex_compliance.carf_transactions
      WHERE carf_report_id = $1
      ORDER BY transaction_date ASC
    `;

    const txResult = await databaseService.query(txQuery, [reportId]);
    report.transactions = txResult.rows.map(this.mapRowToTransaction);

    return report;
  }

  /**
   * Get reports for a wallet
   */
  public async getWalletReports(
    walletAddress: string,
    limit = 10
  ): Promise<DEXCARFData[]> {
    const query = `
      SELECT * FROM dex_compliance.carf_reports
      WHERE wallet_address = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await databaseService.query(query, [walletAddress.toLowerCase(), limit]);
    return result.rows.map((row: Record<string, unknown>) => {
      const report = this.mapRowToReport(row);
      report.transactions = []; // Don't fetch transactions for list view
      return report;
    });
  }

  /**
   * Map database row to DEXCARFData
   */
  private mapRowToReport(row: Record<string, unknown>): DEXCARFData {
    const report: DEXCARFData = {
      id: row['id'] as string,
      reportId: row['report_id'] as string,
      walletAddress: row['wallet_address'] as string,
      tenantId: row['tenant_id'] as string,
      reportingPeriod: {
        startDate: new Date(row['reporting_period_start_date'] as string),
        endDate: new Date(row['reporting_period_end_date'] as string),
      },
      transactions: [],
      totalSwapVolumeUSD: row['total_swap_volume_usd'] as string,
      totalLiquidityProvidedUSD: row['total_liquidity_provided_usd'] as string,
      totalBridgeVolumeUSD: row['total_bridge_volume_usd'] as string,
      totalFeesUSD: row['total_fees_usd'] as string,
      status: row['status'] as DEXCARFData['status'],
      version: row['version'] as string,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };

    // Add optional fields
    if (row['user_id']) {
      report.userId = row['user_id'] as string;
    }
    if (row['reporting_period_fiscal_year']) {
      report.reportingPeriod.fiscalYear = row['reporting_period_fiscal_year'] as string;
    }
    if (row['submission_date']) {
      report.submissionDate = new Date(row['submission_date'] as string);
    }
    if (row['acknowledgment_date']) {
      report.acknowledgmentDate = new Date(row['acknowledgment_date'] as string);
    }
    if (row['rejection_reason']) {
      report.rejectionReason = row['rejection_reason'] as string;
    }

    return report;
  }

  /**
   * Map database row to transaction
   */
  private mapRowToTransaction(row: Record<string, unknown>): DEXCARFData['transactions'][0] {
    return {
      type: row['transaction_type'] as DEXCARFData['transactions'][0]['type'],
      date: new Date(row['transaction_date'] as string),
      tokenIn: row['token_in'] as string,
      tokenOut: row['token_out'] as string,
      amountIn: row['amount_in'] as string,
      amountOut: row['amount_out'] as string,
      valueUSD: row['value_usd'] as string,
      transactionHash: row['transaction_hash'] as string,
      chainId: row['chain_id'] as number,
      protocol: row['protocol'] as string,
    };
  }

  /**
   * Publish report generated event
   */
  private async publishReportGeneratedEvent(
    report: DEXCARFData,
    options?: {
      userId?: string;
      brokerId?: string;
    }
  ): Promise<void> {
    const eventData: DEXCARFReportGeneratedEvent['data'] = {
      reportId: report.id,
      walletAddress: report.walletAddress,
      reportId_external: report.reportId,
      totalSwapVolumeUSD: report.totalSwapVolumeUSD,
      totalLiquidityProvidedUSD: report.totalLiquidityProvidedUSD,
      totalBridgeVolumeUSD: report.totalBridgeVolumeUSD,
      transactionCount: report.transactions.length,
      status: report.status,
    };

    // Add optional fields
    if (options?.userId) {
      eventData.userId = options.userId;
    }
    if (options?.brokerId) {
      eventData.brokerId = options.brokerId;
    }

    const event: DEXCARFReportGeneratedEvent = {
      id: uuidv4(),
      type: 'compliance.dex.carf.generated',
      source: config.serviceName,
      tenantId: report.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publish('dex.compliance.carf.generated', event);
  }

  /**
   * Publish report submitted event
   */
  private async publishReportSubmittedEvent(
    report: DEXCARFData,
    jurisdiction: string,
    status: 'submitted' | 'acknowledged' | 'rejected',
    responseTime: number,
    errorMessage?: string
  ): Promise<void> {
    const eventData: DEXCARFReportSubmittedEvent['data'] = {
      reportId: report.id,
      reportId_external: report.reportId,
      jurisdiction,
      submissionEndpoint: config.regulatory.submissionEndpoints[jurisdiction] || 'unknown',
      status,
      submissionDate: new Date().toISOString(),
    };

    // Add optional fields
    if (responseTime > 0) {
      eventData.responseTime = responseTime;
    }
    if (errorMessage) {
      eventData.errorMessage = errorMessage;
    }

    const event: DEXCARFReportSubmittedEvent = {
      id: uuidv4(),
      type: 'compliance.dex.carf.submitted',
      source: config.serviceName,
      tenantId: report.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publish('dex.compliance.carf.submitted', event);
  }

  /**
   * Close service
   */
  public async close(): Promise<void> {
    logger.info('DEX CARF Service closed');
  }
}

// ==================== EXPORT ====================

export const dexCARFService = DEXCARFService.getInstance();
