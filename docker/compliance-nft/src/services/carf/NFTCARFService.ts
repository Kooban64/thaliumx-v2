/**
 * NFT CARF Service
 * Implements OECD CARF reporting for NFT transactions
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import { NFTCARFData } from '../../types/compliance';
import { NFTCARFTable, NFTSaleTable } from '../../types/database';

const logger = createComponentLogger('nft-carf-service');

/**
 * CARF report generation options
 */
export interface CARFReportOptions {
  walletAddress: string;
  startDate: Date;
  endDate: Date;
  fiscalYear?: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
}

/**
 * NFT CARF Service
 */
export class NFTCARFService {
  private config: {
    enabled: boolean;
    autoGenerate: boolean;
    reportingPeriodDays: number;
    retentionYears: number;
  };

  constructor() {
    const appConfig = getConfig();
    this.config = {
      enabled: appConfig.carf.enabled,
      autoGenerate: appConfig.carf.autoGenerate,
      reportingPeriodDays: appConfig.carf.reportingPeriodDays,
      retentionYears: appConfig.carf.retentionYears,
    };
  }

  /**
   * Generate CARF report for a wallet
   */
  async generateReport(options: CARFReportOptions): Promise<NFTCARFData> {
    const startTime = Date.now();
    logger.info('Generating NFT CARF report', {
      walletAddress: options.walletAddress,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    if (!this.config.enabled) {
      throw new Error('CARF reporting is disabled');
    }

    try {
      const db = getDatabaseService();

      // Get all sales where wallet is seller
      const sales = await db.queryAll<NFTSaleTable>(`
        SELECT * FROM nft_sales
        WHERE seller_address = $1
          AND tenant_id = $2
          AND timestamp >= $3
          AND timestamp <= $4
        ORDER BY timestamp ASC
      `, [options.walletAddress, options.tenantId, options.startDate, options.endDate]);

      // Get all purchases where wallet is buyer
      const purchases = await db.queryAll<NFTSaleTable>(`
        SELECT * FROM nft_sales
        WHERE buyer_address = $1
          AND tenant_id = $2
          AND timestamp >= $3
          AND timestamp <= $4
        ORDER BY timestamp ASC
      `, [options.walletAddress, options.tenantId, options.startDate, options.endDate]);

      // Calculate totals
      let totalSalesVolumeUSD = 0;
      let totalPurchasesVolumeUSD = 0;
      let totalRoyaltiesReceivedUSD = 0;
      let totalRoyaltiesPaidUSD = 0;

      // Build transaction list
      const transactions: NFTCARFData['transactions'] = [];

      // Process sales
      for (const sale of sales) {
        const priceUSD = parseFloat(sale.price_usd);
        totalSalesVolumeUSD += priceUSD;

        // Get collection name
        const collection = await db.queryOne<{ name: string }>(`
          SELECT name FROM nft_collections WHERE id = $1
        `, [sale.collection_id]);

        transactions.push({
          type: 'sale',
          date: sale.timestamp,
          contractAddress: sale.contract_address,
          tokenId: sale.token_id,
          collectionName: collection?.name || 'Unknown',
          price: sale.price,
          currency: sale.currency,
          priceUSD: sale.price_usd,
          transactionHash: sale.transaction_hash,
          chainId: sale.chain_id,
          marketplace: sale.marketplace,
          counterparty: sale.buyer_address,
        });
      }

      // Process purchases
      for (const purchase of purchases) {
        const priceUSD = parseFloat(purchase.price_usd);
        totalPurchasesVolumeUSD += priceUSD;

        if (purchase.royalty_amount) {
          totalRoyaltiesPaidUSD += parseFloat(purchase.royalty_amount);
        }

        // Get collection name
        const collection = await db.queryOne<{ name: string }>(`
          SELECT name FROM nft_collections WHERE id = $1
        `, [purchase.collection_id]);

        transactions.push({
          type: 'purchase',
          date: purchase.timestamp,
          contractAddress: purchase.contract_address,
          tokenId: purchase.token_id,
          collectionName: collection?.name || 'Unknown',
          price: purchase.price,
          currency: purchase.currency,
          priceUSD: purchase.price_usd,
          transactionHash: purchase.transaction_hash,
          chainId: purchase.chain_id,
          marketplace: purchase.marketplace,
          counterparty: purchase.seller_address,
        });
      }

      // Sort transactions by date
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate net gain/loss (simplified - in production would track cost basis)
      const netGainLossUSD = totalSalesVolumeUSD - totalPurchasesVolumeUSD;

      // Create report
      const reportId = `CARF-NFT-${options.walletAddress.substring(0, 8)}-${Date.now()}`;
      const report: NFTCARFData = {
        id: uuidv4(),
        reportId,
        walletAddress: options.walletAddress,
        userId: options.userId,
        tenantId: options.tenantId,
        reportingPeriod: {
          startDate: options.startDate,
          endDate: options.endDate,
          fiscalYear: options.fiscalYear,
        },
        transactions,
        totalSalesVolumeUSD: totalSalesVolumeUSD.toFixed(2),
        totalPurchasesVolumeUSD: totalPurchasesVolumeUSD.toFixed(2),
        totalRoyaltiesReceivedUSD: totalRoyaltiesReceivedUSD.toFixed(2),
        totalRoyaltiesPaidUSD: totalRoyaltiesPaidUSD.toFixed(2),
        netGainLossUSD: netGainLossUSD.toFixed(2),
        transactionCount: transactions.length,
        status: 'draft',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save report to database
      await this.saveReport(report, options.brokerId);

      // Publish event
      await this.publishReportGenerated(report, options.brokerId);

      const duration = Date.now() - startTime;
      logger.logCARFEvent(
        'generated',
        report.id,
        reportId,
        'draft',
        { durationMs: duration, transactionCount: transactions.length }
      );

      return report;
    } catch (error) {
      logger.error('Failed to generate CARF report', {
        walletAddress: options.walletAddress,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Save report to database
   */
  private async saveReport(report: NFTCARFData, brokerId?: string): Promise<void> {
    const db = getDatabaseService();

    // Save main report
    await db.query(`
      INSERT INTO nft_carf_reports (
        id, report_id, wallet_address, user_id, tenant_id, broker_id,
        reporting_period_start_date, reporting_period_end_date, reporting_period_fiscal_year,
        total_sales_volume_usd, total_purchases_volume_usd,
        total_royalties_received_usd, total_royalties_paid_usd,
        net_gain_loss_usd, transaction_count, status, version,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      report.id,
      report.reportId,
      report.walletAddress,
      report.userId,
      report.tenantId,
      brokerId,
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      report.reportingPeriod.fiscalYear,
      report.totalSalesVolumeUSD,
      report.totalPurchasesVolumeUSD,
      report.totalRoyaltiesReceivedUSD,
      report.totalRoyaltiesPaidUSD,
      report.netGainLossUSD,
      report.transactionCount,
      report.status,
      report.version,
    ]);

    // Save transactions
    for (const tx of report.transactions) {
      await db.query(`
        INSERT INTO nft_carf_transactions (
          id, carf_report_id, transaction_type, transaction_date,
          contract_address, token_id, collection_name, price, currency,
          price_usd, transaction_hash, chain_id, marketplace, counterparty,
          gain_loss, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          CURRENT_TIMESTAMP
        )
      `, [
        uuidv4(),
        report.id,
        tx.type,
        tx.date,
        tx.contractAddress,
        tx.tokenId,
        tx.collectionName,
        tx.price,
        tx.currency,
        tx.priceUSD,
        tx.transactionHash,
        tx.chainId,
        tx.marketplace,
        tx.counterparty,
        tx.gainLoss,
      ]);
    }
  }

  /**
   * Publish report generated event
   */
  private async publishReportGenerated(report: NFTCARFData, brokerId?: string): Promise<void> {
    const producer = getEventProducer();

    await producer.publishCARFReportGenerated(
      report.id,
      report.reportId,
      report.walletAddress,
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      report.totalSalesVolumeUSD,
      report.totalPurchasesVolumeUSD,
      report.netGainLossUSD,
      report.transactionCount,
      report.version,
      report.tenantId,
      brokerId,
      report.userId
    );
  }

  /**
   * Submit CARF report
   */
  async submitReport(
    reportId: string,
    submittedTo: string
  ): Promise<NFTCARFData> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    logger.info('Submitting CARF report', { reportId, submittedTo });

    // Update status
    await db.query(`
      UPDATE nft_carf_reports
      SET status = 'submitted',
          submission_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [reportId]);

    // Get updated report
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Publish event
    await producer.publishCARFReportSubmitted(
      report.id,
      report.reportId,
      submittedTo,
      report.tenantId
    );

    logger.logCARFEvent(
      'submitted',
      report.id,
      report.reportId,
      'submitted',
      { submittedTo }
    );

    return report;
  }

  /**
   * Acknowledge CARF report
   */
  async acknowledgeReport(
    reportId: string,
    acknowledgmentReference?: string
  ): Promise<NFTCARFData> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    logger.info('Acknowledging CARF report', { reportId });

    // Update status
    await db.query(`
      UPDATE nft_carf_reports
      SET status = 'acknowledged',
          acknowledgment_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [reportId]);

    // Get updated report
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Publish event
    await producer.send('nft.compliance.carf', {
      eventId: uuidv4(),
      eventType: 'nft.carf.report_acknowledged',
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId: report.tenantId,
      payload: {
        carfId: report.id,
        reportId: report.reportId,
        acknowledgedAt: new Date(),
        acknowledgmentReference,
      },
    });

    logger.logCARFEvent(
      'acknowledged',
      report.id,
      report.reportId,
      'acknowledged'
    );

    return report;
  }

  /**
   * Reject CARF report
   */
  async rejectReport(
    reportId: string,
    rejectionReason: string
  ): Promise<NFTCARFData> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    logger.info('Rejecting CARF report', { reportId, rejectionReason });

    // Update status
    await db.query(`
      UPDATE nft_carf_reports
      SET status = 'rejected',
          rejection_reason = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [rejectionReason, reportId]);

    // Get updated report
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Publish event
    await producer.send('nft.compliance.carf', {
      eventId: uuidv4(),
      eventType: 'nft.carf.report_rejected',
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId: report.tenantId,
      payload: {
        carfId: report.id,
        reportId: report.reportId,
        rejectedAt: new Date(),
        rejectionReason,
        correctionRequired: true,
      },
    });

    logger.logCARFEvent(
      'rejected',
      report.id,
      report.reportId,
      'rejected',
      { rejectionReason }
    );

    return report;
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<NFTCARFData | null> {
    const db = getDatabaseService();

    const row = await db.queryOne<NFTCARFTable>(`
      SELECT * FROM nft_carf_reports WHERE id = $1
    `, [reportId]);

    if (!row) {
      return null;
    }

    // Get transactions
    const transactions = await db.queryAll<{
      transaction_type: string;
      transaction_date: Date;
      contract_address: string;
      token_id: string;
      collection_name: string;
      price: string;
      currency: string;
      price_usd: string;
      transaction_hash: string;
      chain_id: number;
      marketplace: string;
      counterparty: string;
      gain_loss: string | null;
    }>(`
      SELECT * FROM nft_carf_transactions WHERE carf_report_id = $1
      ORDER BY transaction_date ASC
    `, [reportId]);

    return this.mapTableToData(row, transactions);
  }

  /**
   * Get reports for a wallet
   */
  async getWalletReports(
    walletAddress: string,
    tenantId: string
  ): Promise<NFTCARFData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NFTCARFTable>(`
      SELECT * FROM nft_carf_reports
      WHERE wallet_address = $1 AND tenant_id = $2
      ORDER BY created_at DESC
    `, [walletAddress, tenantId]);

    const reports: NFTCARFData[] = [];
    for (const row of rows) {
      const transactions = await db.queryAll<{
        transaction_type: string;
        transaction_date: Date;
        contract_address: string;
        token_id: string;
        collection_name: string;
        price: string;
        currency: string;
        price_usd: string;
        transaction_hash: string;
        chain_id: number;
        marketplace: string;
        counterparty: string;
        gain_loss: string | null;
      }>(`
        SELECT * FROM nft_carf_transactions WHERE carf_report_id = $1
        ORDER BY transaction_date ASC
      `, [row.id]);

      reports.push(this.mapTableToData(row, transactions));
    }

    return reports;
  }

  /**
   * Get pending reports
   */
  async getPendingReports(tenantId: string, limit = 100): Promise<NFTCARFData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NFTCARFTable>(`
      SELECT * FROM nft_carf_reports
      WHERE tenant_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
    `, [tenantId, limit]);

    const reports: NFTCARFData[] = [];
    for (const row of rows) {
      const transactions = await db.queryAll<{
        transaction_type: string;
        transaction_date: Date;
        contract_address: string;
        token_id: string;
        collection_name: string;
        price: string;
        currency: string;
        price_usd: string;
        transaction_hash: string;
        chain_id: number;
        marketplace: string;
        counterparty: string;
        gain_loss: string | null;
      }>(`
        SELECT * FROM nft_carf_transactions WHERE carf_report_id = $1
        ORDER BY transaction_date ASC
      `, [row.id]);

      reports.push(this.mapTableToData(row, transactions));
    }

    return reports;
  }

  /**
   * Map database table to data type
   */
  private mapTableToData(
    row: NFTCARFTable,
    transactions: Array<{
      transaction_type: string;
      transaction_date: Date;
      contract_address: string;
      token_id: string;
      collection_name: string;
      price: string;
      currency: string;
      price_usd: string;
      transaction_hash: string;
      chain_id: number;
      marketplace: string;
      counterparty: string;
      gain_loss: string | null;
    }>
  ): NFTCARFData {
    return {
      id: row.id,
      reportId: row.report_id,
      walletAddress: row.wallet_address,
      userId: row.user_id ?? undefined,
      tenantId: row.tenant_id,
      reportingPeriod: {
        startDate: row.reporting_period_start_date,
        endDate: row.reporting_period_end_date,
        fiscalYear: row.reporting_period_fiscal_year ?? undefined,
      },
      transactions: transactions.map((tx) => ({
        type: tx.transaction_type as 'sale' | 'purchase' | 'mint' | 'transfer' | 'burn',
        date: tx.transaction_date,
        contractAddress: tx.contract_address,
        tokenId: tx.token_id,
        collectionName: tx.collection_name,
        price: tx.price,
        currency: tx.currency,
        priceUSD: tx.price_usd,
        transactionHash: tx.transaction_hash,
        chainId: tx.chain_id,
        marketplace: tx.marketplace,
        counterparty: tx.counterparty,
        gainLoss: tx.gain_loss ?? undefined,
      })),
      totalSalesVolumeUSD: row.total_sales_volume_usd,
      totalPurchasesVolumeUSD: row.total_purchases_volume_usd,
      totalRoyaltiesReceivedUSD: row.total_royalties_received_usd,
      totalRoyaltiesPaidUSD: row.total_royalties_paid_usd,
      netGainLossUSD: row.net_gain_loss_usd,
      transactionCount: row.transaction_count,
      status: row.status,
      submissionDate: row.submission_date ?? undefined,
      acknowledgmentDate: row.acknowledgment_date ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Singleton NFT CARF service instance
 */
let nftCARFServiceInstance: NFTCARFService | null = null;

/**
 * Get NFT CARF service instance
 */
export function getNFTCARFService(): NFTCARFService {
  if (!nftCARFServiceInstance) {
    nftCARFServiceInstance = new NFTCARFService();
  }
  return nftCARFServiceInstance;
}

export default getNFTCARFService;
