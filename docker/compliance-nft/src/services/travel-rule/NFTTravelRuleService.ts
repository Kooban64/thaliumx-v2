/**
 * NFT Travel Rule Service
 * Implements FATF Travel Rule for high-value NFT transfers
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import { NFTTravelRuleData } from '../../types/compliance';
import { NFTTravelRuleTable } from '../../types/database';

const logger = createComponentLogger('nft-travel-rule-service');

/**
 * Travel Rule message input
 */
export interface TravelRuleInput {
  saleId: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  sellerAddress: string;
  buyerAddress: string;
  price: string;
  priceUSD: string;
  currency: string;
  timestamp: Date;
  tenantId: string;
  brokerId?: string;
  userId?: string;
  originatorInfo?: {
    name?: string;
    address?: string;
    country?: string;
    accountNumber?: string;
  };
  beneficiaryInfo?: {
    name?: string;
    address?: string;
    country?: string;
    accountNumber?: string;
  };
}

/**
 * NFT Travel Rule Service
 */
export class NFTTravelRuleService {
  private config: {
    enabled: boolean;
    thresholdAmount: number;
    autoSend: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };

  constructor() {
    const appConfig = getConfig();
    this.config = {
      enabled: appConfig.travelRule.enabled,
      thresholdAmount: appConfig.travelRule.thresholdAmount,
      autoSend: appConfig.travelRule.autoSend,
      maxRetries: appConfig.travelRule.maxRetries,
      retryDelayMs: appConfig.travelRule.retryDelayMs,
    };
  }

  /**
   * Check if Travel Rule applies to a transaction
   */
  isTravelRuleRequired(priceUSD: number): boolean {
    return this.config.enabled && priceUSD >= this.config.thresholdAmount;
  }

  /**
   * Create Travel Rule message for NFT sale
   */
  async createTravelRuleMessage(input: TravelRuleInput): Promise<NFTTravelRuleData> {
    const startTime = Date.now();
    logger.info('Creating Travel Rule message for NFT sale', {
      saleId: input.saleId,
      contractAddress: input.contractAddress,
      tokenId: input.tokenId,
      priceUSD: input.priceUSD,
    });

    try {
      const messageId = uuidv4();

      // Create Travel Rule data
      const travelRuleData: NFTTravelRuleData = {
        id: uuidv4(),
        saleId: input.saleId,
        contractAddress: input.contractAddress,
        tokenId: input.tokenId,
        chainId: input.chainId,
        sellerAddress: input.sellerAddress,
        buyerAddress: input.buyerAddress,
        price: input.price,
        priceUSD: input.priceUSD,
        currency: input.currency,
        timestamp: input.timestamp,
        status: 'pending',
        messageId,
        originatorInfo: input.originatorInfo,
        beneficiaryInfo: input.beneficiaryInfo,
        tenantId: input.tenantId,
        brokerId: input.brokerId,
        userId: input.userId,
      };

      // Save to database
      await this.saveTravelRuleMessage(travelRuleData);

      // Publish event
      await this.publishTravelRuleCreated(travelRuleData);

      // Auto-send if configured
      if (this.config.autoSend) {
        await this.sendTravelRuleMessage(travelRuleData.id);
      }

      const duration = Date.now() - startTime;
      logger.logTravelRuleEvent(
        'created',
        travelRuleData.id,
        input.saleId,
        'pending',
        { durationMs: duration }
      );

      return travelRuleData;
    } catch (error) {
      logger.error('Failed to create Travel Rule message', {
        saleId: input.saleId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Send Travel Rule message
   */
  async sendTravelRuleMessage(travelRuleId: string): Promise<void> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    logger.info('Sending Travel Rule message', { travelRuleId });

    try {
      // Get Travel Rule data
      const row = await db.queryOne<NFTTravelRuleTable>(`
        SELECT * FROM nft_travel_rule_messages WHERE id = $1
      `, [travelRuleId]);

      if (!row) {
        throw new Error(`Travel Rule message not found: ${travelRuleId}`);
      }

      // In production, this would send to a VASP network (e.g., TRISA, OpenVASP)
      // For now, we'll simulate the send

      // Update status to sent
      await db.query(`
        UPDATE nft_travel_rule_messages
        SET status = 'sent',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [travelRuleId]);

      // Publish sent event
      await producer.publishTravelRuleSent(
        travelRuleId,
        row.sale_id,
        row.message_id,
        row.beneficiary_vasp || 'unknown',
        row.tenant_id,
        row.broker_id ?? undefined
      );

      logger.logTravelRuleEvent(
        'sent',
        travelRuleId,
        row.sale_id,
        'sent'
      );
    } catch (error) {
      logger.error('Failed to send Travel Rule message', {
        travelRuleId,
        error: (error as Error).message,
      });

      // Update retry count
      await this.handleSendFailure(travelRuleId, (error as Error).message);
      throw error;
    }
  }

  /**
   * Handle send failure
   */
  private async handleSendFailure(travelRuleId: string, errorMessage: string): Promise<void> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    // Get current retry count
    const row = await db.queryOne<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages WHERE id = $1
    `, [travelRuleId]);

    if (!row) return;

    const newRetryCount = row.retry_count + 1;
    const willRetry = newRetryCount < row.max_retries;

    // Update status
    await db.query(`
      UPDATE nft_travel_rule_messages
      SET status = $1,
          error_message = $2,
          retry_count = $3,
          next_retry_at = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [
      willRetry ? 'pending' : 'failed',
      errorMessage,
      newRetryCount,
      willRetry ? new Date(Date.now() + this.config.retryDelayMs) : null,
      travelRuleId,
    ]);

    // Publish failed event
    await producer.publishTravelRuleFailed(
      travelRuleId,
      row.sale_id,
      row.message_id,
      errorMessage,
      newRetryCount,
      willRetry,
      row.tenant_id,
      row.broker_id ?? undefined
    );
  }

  /**
   * Acknowledge Travel Rule message
   */
  async acknowledgeTravelRuleMessage(
    travelRuleId: string,
    acknowledgedBy: string
  ): Promise<void> {
    const db = getDatabaseService();
    const producer = getEventProducer();

    logger.info('Acknowledging Travel Rule message', { travelRuleId });

    // Update status
    await db.query(`
      UPDATE nft_travel_rule_messages
      SET status = 'acknowledged',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [travelRuleId]);

    // Get updated data
    const row = await db.queryOne<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages WHERE id = $1
    `, [travelRuleId]);

    if (!row) return;

    // Publish acknowledged event
    await producer.send('nft.compliance.travel_rule', {
      eventId: uuidv4(),
      eventType: 'nft.travel_rule.acknowledged',
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId: row.tenant_id,
      payload: {
        travelRuleId,
        saleId: row.sale_id,
        messageId: row.message_id,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });

    logger.logTravelRuleEvent(
      'acknowledged',
      travelRuleId,
      row.sale_id,
      'acknowledged'
    );
  }

  /**
   * Save Travel Rule message to database
   */
  private async saveTravelRuleMessage(data: NFTTravelRuleData): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO nft_travel_rule_messages (
        id, sale_id, contract_address, token_id, chain_id,
        seller_address, buyer_address, price, price_usd, currency,
        timestamp, status, message_id,
        originator_name, originator_address, originator_country, originator_account_number,
        beneficiary_name, beneficiary_address, beneficiary_country, beneficiary_account_number,
        originator_vasp, beneficiary_vasp,
        retry_count, max_retries,
        tenant_id, broker_id, user_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        0, $24, $25, $26, $27,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      data.id,
      data.saleId,
      data.contractAddress,
      data.tokenId,
      data.chainId,
      data.sellerAddress,
      data.buyerAddress,
      data.price,
      data.priceUSD,
      data.currency,
      data.timestamp,
      data.status,
      data.messageId,
      data.originatorInfo?.name,
      data.originatorInfo?.address,
      data.originatorInfo?.country,
      data.originatorInfo?.accountNumber,
      data.beneficiaryInfo?.name,
      data.beneficiaryInfo?.address,
      data.beneficiaryInfo?.country,
      data.beneficiaryInfo?.accountNumber,
      data.vaspInfo?.originatorVASP,
      data.vaspInfo?.beneficiaryVASP,
      this.config.maxRetries,
      data.tenantId,
      data.brokerId,
      data.userId,
    ]);
  }

  /**
   * Publish Travel Rule created event
   */
  private async publishTravelRuleCreated(data: NFTTravelRuleData): Promise<void> {
    const producer = getEventProducer();

    await producer.publishTravelRuleCreated(
      data.id,
      data.saleId,
      data.contractAddress,
      data.tokenId,
      data.chainId,
      data.sellerAddress,
      data.buyerAddress,
      data.priceUSD,
      data.messageId,
      data.tenantId,
      data.brokerId,
      data.vaspInfo?.originatorVASP,
      data.vaspInfo?.beneficiaryVASP
    );
  }

  /**
   * Get Travel Rule message by ID
   */
  async getTravelRuleMessage(travelRuleId: string): Promise<NFTTravelRuleData | null> {
    const db = getDatabaseService();

    const row = await db.queryOne<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages WHERE id = $1
    `, [travelRuleId]);

    if (!row) {
      return null;
    }

    return this.mapTableToData(row);
  }

  /**
   * Get Travel Rule messages for a sale
   */
  async getSaleTravelRuleMessages(
    saleId: string,
    tenantId: string
  ): Promise<NFTTravelRuleData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages
      WHERE sale_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
    `, [saleId, tenantId]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Get pending Travel Rule messages
   */
  async getPendingMessages(tenantId: string, limit = 100): Promise<NFTTravelRuleData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages
      WHERE tenant_id = $1
        AND status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
      ORDER BY created_at ASC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Get failed Travel Rule messages
   */
  async getFailedMessages(tenantId: string, limit = 100): Promise<NFTTravelRuleData[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages
      WHERE tenant_id = $1
        AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToData(row));
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(tenantId: string): Promise<number> {
    const db = getDatabaseService();

    // Get failed messages that can be retried
    const rows = await db.queryAll<NFTTravelRuleTable>(`
      SELECT * FROM nft_travel_rule_messages
      WHERE tenant_id = $1
        AND status = 'failed'
        AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT 100
    `, [tenantId]);

    let retried = 0;
    for (const row of rows) {
      try {
        // Reset status to pending
        await db.query(`
          UPDATE nft_travel_rule_messages
          SET status = 'pending',
              error_message = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [row.id]);

        // Attempt to send
        await this.sendTravelRuleMessage(row.id);
        retried++;
      } catch {
        // Error already handled in sendTravelRuleMessage
      }
    }

    return retried;
  }

  /**
   * Map database table to data type
   */
  private mapTableToData(row: NFTTravelRuleTable): NFTTravelRuleData {
    return {
      id: row.id,
      saleId: row.sale_id,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      chainId: row.chain_id,
      sellerAddress: row.seller_address,
      buyerAddress: row.buyer_address,
      price: row.price,
      priceUSD: row.price_usd,
      currency: row.currency,
      timestamp: row.timestamp,
      status: row.status,
      messageId: row.message_id,
      originatorInfo: row.originator_name || row.originator_address || row.originator_country || row.originator_account_number
        ? {
            name: row.originator_name ?? undefined,
            address: row.originator_address ?? undefined,
            country: row.originator_country ?? undefined,
            accountNumber: row.originator_account_number ?? undefined,
          }
        : undefined,
      beneficiaryInfo: row.beneficiary_name || row.beneficiary_address || row.beneficiary_country || row.beneficiary_account_number
        ? {
            name: row.beneficiary_name ?? undefined,
            address: row.beneficiary_address ?? undefined,
            country: row.beneficiary_country ?? undefined,
            accountNumber: row.beneficiary_account_number ?? undefined,
          }
        : undefined,
      vaspInfo: row.originator_vasp || row.beneficiary_vasp
        ? {
            originatorVASP: row.originator_vasp ?? undefined,
            beneficiaryVASP: row.beneficiary_vasp ?? undefined,
          }
        : undefined,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      userId: row.user_id ?? undefined,
    };
  }
}

/**
 * Singleton NFT Travel Rule service instance
 */
let nftTravelRuleServiceInstance: NFTTravelRuleService | null = null;

/**
 * Get NFT Travel Rule service instance
 */
export function getNFTTravelRuleService(): NFTTravelRuleService {
  if (!nftTravelRuleServiceInstance) {
    nftTravelRuleServiceInstance = new NFTTravelRuleService();
  }
  return nftTravelRuleServiceInstance;
}

export default getNFTTravelRuleService;
