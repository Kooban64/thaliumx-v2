/**
 * Token CARF Service
 * OECD Crypto-Asset Reporting Framework compliance for tokens
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import type { TokenCARFData } from '../../types/compliance';
import type { TokenCARFTable, TokenCARFTransactionTable, TokenCARFHoldingTable } from '../../types/database';

const logger = createComponentLogger('token-carf-service');

/**
 * CARF report generation input
 */
export interface CARFReportInput {
  walletAddress: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  fiscalYear?: string;
}

/**
 * Token CARF Service
 */
export class TokenCARFService {
  constructor() {
    // Config values can be accessed directly when needed
  }

  /**
   * Generate a CARF report
   */
  async generateReport(input: CARFReportInput): Promise<TokenCARFData> {
    logger.info('Generating CARF report', {
      walletAddress: input.walletAddress,
      periodStart: input.reportingPeriodStart,
      periodEnd: input.reportingPeriodEnd,
    });

    const reportId = `CARF-TOKEN-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Get token holdings
    const holdings = await this.getHoldings(
      input.walletAddress,
      input.tenantId,
      input.reportingPeriodEnd
    );

    // Get transactions
    const transactions = await this.getTransactions(
      input.walletAddress,
      input.tenantId,
      input.reportingPeriodStart,
      input.reportingPeriodEnd
    );

    // Calculate totals
    let totalTransferInUSD = 0;
    let totalTransferOutUSD = 0;
    let totalSwapVolumeUSD = 0;
    let totalStakingRewardsUSD = 0;
    let netGainLossUSD = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amountUSD);
      switch (tx.type) {
        case 'transfer_in':
          totalTransferInUSD += amount;
          break;
        case 'transfer_out':
          totalTransferOutUSD += amount;
          break;
        case 'swap':
          totalSwapVolumeUSD += amount;
          break;
        case 'claim':
          totalStakingRewardsUSD += amount;
          break;
      }
      if (tx.gainLoss) {
        netGainLossUSD += parseFloat(tx.gainLoss);
      }
    }

    // Create report
    const report: TokenCARFData = {
      id: uuidv4(),
      reportId,
      walletAddress: input.walletAddress.toLowerCase(),
      userId: input.userId,
      tenantId: input.tenantId,
      reportingPeriod: {
        startDate: input.reportingPeriodStart,
        endDate: input.reportingPeriodEnd,
        fiscalYear: input.fiscalYear,
      },
      holdings,
      transactions,
      totalTransferInUSD: totalTransferInUSD.toFixed(2),
      totalTransferOutUSD: totalTransferOutUSD.toFixed(2),
      totalSwapVolumeUSD: totalSwapVolumeUSD.toFixed(2),
      totalStakingRewardsUSD: totalStakingRewardsUSD.toFixed(2),
      netGainLossUSD: netGainLossUSD.toFixed(2),
      transactionCount: transactions.length,
      status: 'draft',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await this.saveReport(report);

    // Publish event
    const producer = getEventProducer();
    await producer.publishCARFReportGenerated(
      report.id,
      report.reportId,
      report.walletAddress,
      report.reportingPeriod.startDate,
      report.reportingPeriod.endDate,
      report.totalTransferInUSD,
      report.totalTransferOutUSD,
      report.netGainLossUSD,
      report.transactionCount,
      report.version,
      report.tenantId,
      input.brokerId,
      report.userId
    );

    logger.logCARFEvent('generated', report.id, report.reportId, 'draft');

    return report;
  }

  /**
   * Get token holdings for a wallet
   */
  private async getHoldings(
    walletAddress: string,
    tenantId: string,
    asOfDate: Date
  ): Promise<TokenCARFData['holdings']> {
    const db = getDatabaseService();

    const rows = await db.queryAll<{
      contract_address: string;
      token_symbol: string;
      chain_id: number;
      balance: string;
      balance_usd: string;
    }>(`
      SELECT contract_address, token_symbol, chain_id, balance, balance_usd
      FROM token_holders
      WHERE holder_address = $1
        AND tenant_id = $2
        AND last_transaction_date <= $3
        AND CAST(balance AS DECIMAL) > 0
    `, [walletAddress.toLowerCase(), tenantId, asOfDate]);

    return rows.map((row) => ({
      contractAddress: row.contract_address,
      tokenSymbol: row.token_symbol,
      chainId: row.chain_id,
      balance: row.balance,
      balanceUSD: row.balance_usd,
      costBasis: '0', // Would need to calculate from transaction history
      unrealizedGainLoss: '0', // Would need current price vs cost basis
    }));
  }

  /**
   * Get transactions for a wallet
   */
  private async getTransactions(
    walletAddress: string,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TokenCARFData['transactions']> {
    const db = getDatabaseService();
    const normalizedAddress = walletAddress.toLowerCase();

    const rows = await db.queryAll<{
      id: string;
      transfer_type: string;
      timestamp: Date;
      contract_address: string;
      token_symbol: string;
      amount: string;
      amount_usd: string;
      transaction_hash: string;
      chain_id: number;
      from_address: string;
      to_address: string;
    }>(`
      SELECT id, transfer_type, timestamp, contract_address, token_symbol,
             amount, amount_usd, transaction_hash, chain_id, from_address, to_address
      FROM token_transfers
      WHERE (from_address = $1 OR to_address = $1)
        AND tenant_id = $2
        AND timestamp >= $3
        AND timestamp <= $4
      ORDER BY timestamp ASC
    `, [normalizedAddress, tenantId, startDate, endDate]);

    return rows.map((row) => {
      let type: TokenCARFData['transactions'][0]['type'];
      let counterparty: string;

      if (row.from_address === normalizedAddress) {
        type = 'transfer_out';
        counterparty = row.to_address;
      } else {
        type = 'transfer_in';
        counterparty = row.from_address;
      }

      // Map transfer types
      if (row.transfer_type === 'mint') {
        type = 'transfer_in';
      } else if (row.transfer_type === 'burn') {
        type = 'transfer_out';
      }

      return {
        type,
        date: row.timestamp,
        contractAddress: row.contract_address,
        tokenSymbol: row.token_symbol,
        amount: row.amount,
        amountUSD: row.amount_usd,
        transactionHash: row.transaction_hash,
        chainId: row.chain_id,
        counterparty,
      };
    });
  }

  /**
   * Save report to database
   */
  private async saveReport(report: TokenCARFData): Promise<void> {
    const db = getDatabaseService();

    await db.transaction(async (client) => {
      // Save main report
      await client.query(`
        INSERT INTO token_carf_reports (
          id, report_id, wallet_address, user_id, tenant_id, broker_id,
          reporting_period_start_date, reporting_period_end_date,
          reporting_period_fiscal_year, total_transfer_in_usd,
          total_transfer_out_usd, total_swap_volume_usd,
          total_staking_rewards_usd, net_gain_loss_usd,
          transaction_count, status, version, created_at, updated_at
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
        null, // brokerId
        report.reportingPeriod.startDate,
        report.reportingPeriod.endDate,
        report.reportingPeriod.fiscalYear,
        report.totalTransferInUSD,
        report.totalTransferOutUSD,
        report.totalSwapVolumeUSD,
        report.totalStakingRewardsUSD,
        report.netGainLossUSD,
        report.transactionCount,
        report.status,
        report.version,
      ]);

      // Save holdings
      for (const holding of report.holdings) {
        await client.query(`
          INSERT INTO token_carf_holdings (
            id, carf_report_id, contract_address, token_symbol, chain_id,
            balance, balance_usd, cost_basis, unrealized_gain_loss, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `, [
          uuidv4(),
          report.id,
          holding.contractAddress,
          holding.tokenSymbol,
          holding.chainId,
          holding.balance,
          holding.balanceUSD,
          holding.costBasis,
          holding.unrealizedGainLoss,
        ]);
      }

      // Save transactions
      for (const tx of report.transactions) {
        await client.query(`
          INSERT INTO token_carf_transactions (
            id, carf_report_id, transaction_type, transaction_date,
            contract_address, token_symbol, amount, amount_usd,
            transaction_hash, chain_id, counterparty, gain_loss, cost_basis, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        `, [
          uuidv4(),
          report.id,
          tx.type,
          tx.date,
          tx.contractAddress,
          tx.tokenSymbol,
          tx.amount,
          tx.amountUSD,
          tx.transactionHash,
          tx.chainId,
          tx.counterparty,
          tx.gainLoss,
          tx.costBasis,
        ]);
      }
    });
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<TokenCARFData | null> {
    const db = getDatabaseService();

    const row = await db.queryOne<TokenCARFTable>(`
      SELECT * FROM token_carf_reports WHERE id = $1 OR report_id = $1
    `, [reportId]);

    if (!row) return null;

    // Get holdings
    const holdingRows = await db.queryAll<TokenCARFHoldingTable>(`
      SELECT * FROM token_carf_holdings WHERE carf_report_id = $1
    `, [row.id]);

    // Get transactions
    const txRows = await db.queryAll<TokenCARFTransactionTable>(`
      SELECT * FROM token_carf_transactions WHERE carf_report_id = $1 ORDER BY transaction_date
    `, [row.id]);

    return this.mapTableToData(row, holdingRows, txRows);
  }

  /**
   * Get reports for a wallet
   */
  async getWalletReports(walletAddress: string, tenantId: string): Promise<TokenCARFData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<TokenCARFTable>(`
      SELECT * FROM token_carf_reports
      WHERE wallet_address = $1 AND tenant_id = $2
      ORDER BY created_at DESC
    `, [walletAddress.toLowerCase(), tenantId]);

    const reports: TokenCARFData[] = [];
    for (const row of rows) {
      const holdingRows = await db.queryAll<TokenCARFHoldingTable>(`
        SELECT * FROM token_carf_holdings WHERE carf_report_id = $1
      `, [row.id]);

      const txRows = await db.queryAll<TokenCARFTransactionTable>(`
        SELECT * FROM token_carf_transactions WHERE carf_report_id = $1 ORDER BY transaction_date
      `, [row.id]);

      reports.push(this.mapTableToData(row, holdingRows, txRows));
    }

    return reports;
  }

  /**
   * Submit report
   */
  async submitReport(reportId: string, _submittedTo: string): Promise<TokenCARFData | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE token_carf_reports
      SET status = 'submitted',
          submission_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 OR report_id = $1
    `, [reportId]);

    return await this.getReport(reportId);
  }

  /**
   * Map database tables to data type
   */
  private mapTableToData(
    row: TokenCARFTable,
    holdingRows: TokenCARFHoldingTable[],
    txRows: TokenCARFTransactionTable[]
  ): TokenCARFData {
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
      holdings: holdingRows.map((h) => ({
        contractAddress: h.contract_address,
        tokenSymbol: h.token_symbol,
        chainId: h.chain_id,
        balance: h.balance,
        balanceUSD: h.balance_usd,
        costBasis: h.cost_basis,
        unrealizedGainLoss: h.unrealized_gain_loss,
      })),
      transactions: txRows.map((t) => ({
        type: t.transaction_type,
        date: t.transaction_date,
        contractAddress: t.contract_address,
        tokenSymbol: t.token_symbol,
        amount: t.amount,
        amountUSD: t.amount_usd,
        transactionHash: t.transaction_hash,
        chainId: t.chain_id,
        counterparty: t.counterparty,
        gainLoss: t.gain_loss ?? undefined,
        costBasis: t.cost_basis ?? undefined,
      })),
      totalTransferInUSD: row.total_transfer_in_usd,
      totalTransferOutUSD: row.total_transfer_out_usd,
      totalSwapVolumeUSD: row.total_swap_volume_usd,
      totalStakingRewardsUSD: row.total_staking_rewards_usd,
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
 * Singleton instance
 */
let tokenCARFServiceInstance: TokenCARFService | null = null;

export function getTokenCARFService(): TokenCARFService {
  if (!tokenCARFServiceInstance) {
    tokenCARFServiceInstance = new TokenCARFService();
  }
  return tokenCARFServiceInstance;
}

export default getTokenCARFService;
