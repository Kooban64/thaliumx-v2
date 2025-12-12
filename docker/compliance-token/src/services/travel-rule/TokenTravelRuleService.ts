/**
 * Token Travel Rule Service
 * FATF Travel Rule compliance for token transfers
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import type { TokenTravelRuleData } from '../../types/compliance';
import type { TokenTravelRuleTable } from '../../types/database';

const logger = createComponentLogger('token-travel-rule-service');

/**
 * Travel Rule message input
 */
export interface TravelRuleInput {
  transferId: string;
  transactionHash: string;
  contractAddress: string;
  tokenSymbol: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  timestamp: Date;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
  originatorInfo?: {
    name?: string | undefined;
    address?: string | undefined;
    country?: string | undefined;
    accountNumber?: string | undefined;
    dateOfBirth?: string | undefined;
    placeOfBirth?: string | undefined;
    nationalId?: string | undefined;
  } | undefined;
  beneficiaryInfo?: {
    name?: string | undefined;
    address?: string | undefined;
    country?: string | undefined;
    accountNumber?: string | undefined;
  } | undefined;
}

/**
 * Token Travel Rule Service
 */
export class TokenTravelRuleService {
  private thresholdAmount: number;
  private autoSend: boolean;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor() {
    const config = getConfig();
    this.thresholdAmount = config.travelRule.thresholdAmount;
    this.autoSend = config.travelRule.autoSend;
    this.maxRetries = config.travelRule.maxRetries;
    this.retryDelayMs = config.travelRule.retryDelayMs;
  }

  /**
   * Check if Travel Rule is required for a transfer
   */
  isTravelRuleRequired(amountUSD: number): boolean {
    return amountUSD >= this.thresholdAmount;
  }

  /**
   * Create a Travel Rule message
   */
  async createTravelRuleMessage(input: TravelRuleInput): Promise<TokenTravelRuleData> {
    logger.info('Creating Travel Rule message', {
      transferId: input.transferId,
      amountUSD: input.amountUSD,
    });

    const messageId = `TR-${uuidv4()}`;

    const travelRuleData: TokenTravelRuleData = {
      id: uuidv4(),
      transferId: input.transferId,
      transactionHash: input.transactionHash,
      contractAddress: input.contractAddress,
      tokenSymbol: input.tokenSymbol,
      chainId: input.chainId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amount: input.amount,
      amountUSD: input.amountUSD,
      timestamp: input.timestamp,
      status: 'pending',
      messageId,
      originatorInfo: input.originatorInfo ? {
        name: input.originatorInfo.name,
        address: input.originatorInfo.address,
        country: input.originatorInfo.country,
        accountNumber: input.originatorInfo.accountNumber,
        dateOfBirth: input.originatorInfo.dateOfBirth,
        placeOfBirth: input.originatorInfo.placeOfBirth,
        nationalId: input.originatorInfo.nationalId,
      } : undefined,
      beneficiaryInfo: input.beneficiaryInfo ? {
        name: input.beneficiaryInfo.name,
        address: input.beneficiaryInfo.address,
        country: input.beneficiaryInfo.country,
        accountNumber: input.beneficiaryInfo.accountNumber,
      } : undefined,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      userId: input.userId,
    };

    // Save to database
    await this.saveTravelRuleMessage(travelRuleData);

    // Publish event
    const producer = getEventProducer();
    await producer.publishTravelRuleCreated(
      travelRuleData.id,
      travelRuleData.transferId,
      travelRuleData.transactionHash,
      travelRuleData.contractAddress,
      travelRuleData.tokenSymbol,
      travelRuleData.chainId,
      travelRuleData.fromAddress,
      travelRuleData.toAddress,
      travelRuleData.amountUSD,
      travelRuleData.messageId,
      travelRuleData.tenantId,
      travelRuleData.brokerId,
      travelRuleData.vaspInfo?.originatorVASP,
      travelRuleData.vaspInfo?.beneficiaryVASP
    );

    logger.logTravelRuleEvent(
      'created',
      travelRuleData.id,
      travelRuleData.transferId,
      'pending'
    );

    // Auto-send if configured
    if (this.autoSend) {
      await this.sendTravelRuleMessage(travelRuleData.id);
    }

    return travelRuleData;
  }

  /**
   * Send a Travel Rule message
   */
  async sendTravelRuleMessage(travelRuleId: string): Promise<void> {
    const message = await this.getTravelRuleMessage(travelRuleId);
    if (!message) {
      throw new Error(`Travel Rule message not found: ${travelRuleId}`);
    }

    logger.info('Sending Travel Rule message', {
      travelRuleId,
      messageId: message.messageId,
    });

    try {
      // In production, this would send to VASP network (e.g., TRISA, OpenVASP)
      // For now, simulate successful send
      await this.updateMessageStatus(travelRuleId, 'sent');

      const producer = getEventProducer();
      await producer.publishTravelRuleSent(
        travelRuleId,
        message.transferId,
        message.messageId,
        message.vaspInfo?.beneficiaryVASP ?? 'unknown',
        message.tenantId,
        message.brokerId
      );

      logger.logTravelRuleEvent('sent', travelRuleId, message.transferId, 'sent');
    } catch (error) {
      logger.error('Failed to send Travel Rule message', {
        travelRuleId,
        error: (error as Error).message,
      });

      await this.handleSendFailure(travelRuleId, (error as Error).message);
      throw error;
    }
  }

  /**
   * Handle send failure
   */
  private async handleSendFailure(travelRuleId: string, errorMessage: string): Promise<void> {
    const db = getDatabaseService();

    const result = await db.queryOne<{ retry_count: number }>(`
      SELECT retry_count FROM token_travel_rule_messages WHERE id = $1
    `, [travelRuleId]);

    const retryCount = (result?.retry_count ?? 0) + 1;

    if (retryCount < this.maxRetries) {
      const nextRetryAt = new Date(Date.now() + this.retryDelayMs);
      await db.query(`
        UPDATE token_travel_rule_messages
        SET retry_count = $1,
            next_retry_at = $2,
            error_message = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [retryCount, nextRetryAt, errorMessage, travelRuleId]);
    } else {
      await db.query(`
        UPDATE token_travel_rule_messages
        SET status = 'failed',
            retry_count = $1,
            error_message = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [retryCount, errorMessage, travelRuleId]);
    }
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(
    travelRuleId: string,
    status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed'
  ): Promise<void> {
    const db = getDatabaseService();
    await db.query(`
      UPDATE token_travel_rule_messages
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [status, travelRuleId]);
  }

  /**
   * Save Travel Rule message to database
   */
  private async saveTravelRuleMessage(data: TokenTravelRuleData): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO token_travel_rule_messages (
        id, transfer_id, transaction_hash, contract_address, token_symbol,
        chain_id, from_address, to_address, amount, amount_usd, timestamp,
        status, message_id, originator_name, originator_address,
        originator_country, originator_account_number, originator_date_of_birth,
        originator_place_of_birth, originator_national_id,
        beneficiary_name, beneficiary_address, beneficiary_country,
        beneficiary_account_number, originator_vasp, beneficiary_vasp,
        originator_vasp_lei, beneficiary_vasp_lei,
        retry_count, max_retries, tenant_id, broker_id, user_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        0, $29, $30, $31, $32, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      data.id,
      data.transferId,
      data.transactionHash,
      data.contractAddress,
      data.tokenSymbol,
      data.chainId,
      data.fromAddress,
      data.toAddress,
      data.amount,
      data.amountUSD,
      data.timestamp,
      data.status,
      data.messageId,
      data.originatorInfo?.name,
      data.originatorInfo?.address,
      data.originatorInfo?.country,
      data.originatorInfo?.accountNumber,
      data.originatorInfo?.dateOfBirth,
      data.originatorInfo?.placeOfBirth,
      data.originatorInfo?.nationalId,
      data.beneficiaryInfo?.name,
      data.beneficiaryInfo?.address,
      data.beneficiaryInfo?.country,
      data.beneficiaryInfo?.accountNumber,
      data.vaspInfo?.originatorVASP,
      data.vaspInfo?.beneficiaryVASP,
      data.vaspInfo?.originatorVASPLEI,
      data.vaspInfo?.beneficiaryVASPLEI,
      this.maxRetries,
      data.tenantId,
      data.brokerId,
      data.userId,
    ]);
  }

  /**
   * Get Travel Rule message by ID
   */
  async getTravelRuleMessage(travelRuleId: string): Promise<TokenTravelRuleData | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<TokenTravelRuleTable>(`
      SELECT * FROM token_travel_rule_messages WHERE id = $1
    `, [travelRuleId]);

    if (!row) return null;
    return this.mapTableToData(row);
  }

  /**
   * Get pending messages
   */
  async getPendingMessages(tenantId: string, limit = 100): Promise<TokenTravelRuleData[]> {
    const db = getDatabaseService();
    const rows = await db.queryAll<TokenTravelRuleTable>(`
      SELECT * FROM token_travel_rule_messages
      WHERE tenant_id = $1
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Map database table to data type
   */
  private mapTableToData(row: TokenTravelRuleTable): TokenTravelRuleData {
    return {
      id: row.id,
      transferId: row.transfer_id,
      transactionHash: row.transaction_hash,
      contractAddress: row.contract_address,
      tokenSymbol: row.token_symbol,
      chainId: row.chain_id,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: row.amount,
      amountUSD: row.amount_usd,
      timestamp: row.timestamp,
      status: row.status,
      messageId: row.message_id,
      originatorInfo: row.originator_name ? {
        name: row.originator_name ?? undefined,
        address: row.originator_address ?? undefined,
        country: row.originator_country ?? undefined,
        accountNumber: row.originator_account_number ?? undefined,
        dateOfBirth: row.originator_date_of_birth ?? undefined,
        placeOfBirth: row.originator_place_of_birth ?? undefined,
        nationalId: row.originator_national_id ?? undefined,
      } : undefined,
      beneficiaryInfo: row.beneficiary_name ? {
        name: row.beneficiary_name ?? undefined,
        address: row.beneficiary_address ?? undefined,
        country: row.beneficiary_country ?? undefined,
        accountNumber: row.beneficiary_account_number ?? undefined,
      } : undefined,
      vaspInfo: row.originator_vasp || row.beneficiary_vasp ? {
        originatorVASP: row.originator_vasp ?? undefined,
        beneficiaryVASP: row.beneficiary_vasp ?? undefined,
        originatorVASPLEI: row.originator_vasp_lei ?? undefined,
        beneficiaryVASPLEI: row.beneficiary_vasp_lei ?? undefined,
      } : undefined,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      userId: row.user_id ?? undefined,
    };
  }

  /**
   * Process a token transfer for Travel Rule compliance
   */
  async processTransfer(transfer: {
    id: string;
    transactionHash: string;
    contractAddress: string;
    tokenSymbol: string;
    chainId: number;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    timestamp?: Date | undefined;
    tenantId: string;
    brokerId?: string | undefined;
    userId?: string | undefined;
  }): Promise<TokenTravelRuleData | null> {
    const amountUSD = parseFloat(transfer.amountUSD);

    // Check if Travel Rule is required
    if (!this.isTravelRuleRequired(amountUSD)) {
      logger.info('Travel Rule not required for transfer', {
        transferId: transfer.id,
        amountUSD,
        threshold: this.thresholdAmount,
      });
      return null;
    }

    // Create Travel Rule message
    return await this.createTravelRuleMessage({
      transferId: transfer.id,
      transactionHash: transfer.transactionHash,
      contractAddress: transfer.contractAddress,
      tokenSymbol: transfer.tokenSymbol,
      chainId: transfer.chainId,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      amount: transfer.amount,
      amountUSD: transfer.amountUSD,
      timestamp: transfer.timestamp ?? new Date(),
      tenantId: transfer.tenantId,
      brokerId: transfer.brokerId,
      userId: transfer.userId,
    });
  }

  /**
   * Get Travel Rule data by ID (alias for getTravelRuleMessage)
   */
  async getTravelRuleData(id: string): Promise<TokenTravelRuleData | null> {
    return await this.getTravelRuleMessage(id);
  }

  /**
   * Get Travel Rule data for a wallet
   */
  async getWalletTravelRuleData(
    walletAddress: string,
    tenantId: string,
    limit = 100
  ): Promise<TokenTravelRuleData[]> {
    const db = getDatabaseService();
    const normalizedAddress = walletAddress.toLowerCase();

    const rows = await db.queryAll<TokenTravelRuleTable>(`
      SELECT * FROM token_travel_rule_messages
      WHERE (from_address = $1 OR to_address = $1)
        AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [normalizedAddress, tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Retry a failed Travel Rule message
   */
  async retryFailedMessage(travelRuleId: string): Promise<TokenTravelRuleData | null> {
    const message = await this.getTravelRuleMessage(travelRuleId);
    if (!message) {
      return null;
    }

    if (message.status !== 'failed') {
      logger.warn('Cannot retry non-failed message', {
        travelRuleId,
        status: message.status,
      });
      return null;
    }

    // Reset status to pending
    const db = getDatabaseService();
    await db.query(`
      UPDATE token_travel_rule_messages
      SET status = 'pending',
          retry_count = 0,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [travelRuleId]);

    // Attempt to send again
    await this.sendTravelRuleMessage(travelRuleId);

    return await this.getTravelRuleMessage(travelRuleId);
  }
}

/**
 * Singleton instance
 */
let tokenTravelRuleServiceInstance: TokenTravelRuleService | null = null;

export function getTokenTravelRuleService(): TokenTravelRuleService {
  if (!tokenTravelRuleServiceInstance) {
    tokenTravelRuleServiceInstance = new TokenTravelRuleService();
  }
  return tokenTravelRuleServiceInstance;
}

export default getTokenTravelRuleService;
