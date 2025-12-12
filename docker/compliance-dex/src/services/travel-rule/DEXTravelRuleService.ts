/**
 * DEX Travel Rule Service
 * FATF Travel Rule compliance for cross-chain bridge transfers
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { DEXTravelRuleData, BridgeTransaction } from '../../types/compliance';
import { databaseService } from '../database';
import { eventProducer } from '../events';
import { DEXTravelRuleGeneratedEvent, DEXTravelRuleSentEvent } from '../../types/events';

// ==================== TRAVEL RULE THRESHOLDS ====================

const TRAVEL_RULE_THRESHOLDS: Record<string, number> = {
  US: 3000,
  EU: 1000,
  UK: 1000,
  CA: 3000,
  AU: 10000,
  JP: 100000, // JPY equivalent
  SG: 1500,
  DEFAULT: 3000,
};

// ==================== DEX TRAVEL RULE SERVICE ====================

/**
 * Service for managing Travel Rule compliance for DEX bridge transfers
 */
export class DEXTravelRuleService {
  private static instance: DEXTravelRuleService;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DEXTravelRuleService {
    if (!DEXTravelRuleService.instance) {
      DEXTravelRuleService.instance = new DEXTravelRuleService();
    }
    return DEXTravelRuleService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    logger.info('DEX Travel Rule Service initialized', {
      enabled: config.travelRule.enabled,
      threshold: config.travelRule.thresholdAmount,
    });
  }

  /**
   * Check if Travel Rule applies to a bridge transaction
   */
  public requiresTravelRule(
    amountUSD: number,
    jurisdiction?: string
  ): boolean {
    if (!config.travelRule.enabled) {
      return false;
    }

    const threshold = jurisdiction
      ? TRAVEL_RULE_THRESHOLDS[jurisdiction] ?? TRAVEL_RULE_THRESHOLDS['DEFAULT']
      : config.travelRule.thresholdAmount;

    return amountUSD >= (threshold ?? config.travelRule.thresholdAmount);
  }

  /**
   * Generate Travel Rule message for a bridge transaction
   */
  public async generateTravelRuleMessage(
    bridge: BridgeTransaction,
    originatorInfo?: {
      name?: string;
      address?: string;
      country?: string;
      accountNumber?: string;
    },
    beneficiaryInfo?: {
      name?: string;
      address?: string;
      country?: string;
      accountNumber?: string;
    }
  ): Promise<DEXTravelRuleData> {
    const travelRuleId = uuidv4();
    const messageId = `TR-DEX-${Date.now()}-${travelRuleId.substring(0, 8)}`;

    const travelRuleData: DEXTravelRuleData = {
      id: travelRuleId,
      bridgeTransactionId: bridge.id,
      sourceChainId: bridge.sourceChainId,
      destinationChainId: bridge.destinationChainId,
      sourceWallet: bridge.sourceWallet,
      destinationWallet: bridge.destinationWallet,
      amount: bridge.token.amount,
      amountUSD: bridge.amountUSD,
      token: bridge.token.symbol,
      timestamp: new Date(),
      status: 'pending',
      messageId,
      tenantId: bridge.tenantId,
    };

    // Add optional originator info
    if (originatorInfo) {
      travelRuleData.originatorInfo = {};
      if (originatorInfo.name) travelRuleData.originatorInfo.name = originatorInfo.name;
      if (originatorInfo.address) travelRuleData.originatorInfo.address = originatorInfo.address;
      if (originatorInfo.country) travelRuleData.originatorInfo.country = originatorInfo.country;
      if (originatorInfo.accountNumber) travelRuleData.originatorInfo.accountNumber = originatorInfo.accountNumber;
    }

    // Add optional beneficiary info
    if (beneficiaryInfo) {
      travelRuleData.beneficiaryInfo = {};
      if (beneficiaryInfo.name) travelRuleData.beneficiaryInfo.name = beneficiaryInfo.name;
      if (beneficiaryInfo.address) travelRuleData.beneficiaryInfo.address = beneficiaryInfo.address;
      if (beneficiaryInfo.country) travelRuleData.beneficiaryInfo.country = beneficiaryInfo.country;
      if (beneficiaryInfo.accountNumber) travelRuleData.beneficiaryInfo.accountNumber = beneficiaryInfo.accountNumber;
    }

    // Add optional user/broker info
    if (bridge.userId) {
      travelRuleData.userId = bridge.userId;
    }

    // Store in database
    await this.storeTravelRuleMessage(travelRuleData);

    // Publish event
    await this.publishTravelRuleGeneratedEvent(travelRuleData);

    logger.logCompliance('travel_rule_message_generated', travelRuleId, {
      bridgeTransactionId: bridge.id,
      messageId,
      amountUSD: bridge.amountUSD,
    });

    // Auto-send if configured
    if (config.travelRule.autoSend) {
      await this.sendTravelRuleMessage(travelRuleId);
    }

    return travelRuleData;
  }

  /**
   * Send Travel Rule message to counterparty VASP
   */
  public async sendTravelRuleMessage(travelRuleId: string): Promise<void> {
    const travelRule = await this.getTravelRuleMessage(travelRuleId);
    if (!travelRule) {
      throw new Error(`Travel Rule message not found: ${travelRuleId}`);
    }

    if (travelRule.status !== 'pending') {
      throw new Error(`Travel Rule message already processed: ${travelRule.status}`);
    }

    const startTime = Date.now();

    try {
      // In production, this would:
      // 1. Look up beneficiary VASP from wallet address
      // 2. Send message via Travel Rule protocol (TRISA, OpenVASP, etc.)
      // 3. Wait for acknowledgment

      // Simulate sending
      await this.simulateTravelRuleSend(travelRule);

      // Update status
      await this.updateTravelRuleStatus(travelRuleId, 'sent');

      const duration = Date.now() - startTime;

      // Publish sent event
      await this.publishTravelRuleSentEvent(travelRule, 'sent', duration);

      logger.logCompliance('travel_rule_message_sent', travelRuleId, {
        messageId: travelRule.messageId,
        duration,
      });
    } catch (error) {
      // Update status to failed
      await this.updateTravelRuleStatus(
        travelRuleId,
        'failed',
        error instanceof Error ? error.message : String(error)
      );

      // Schedule retry if within limits
      const retryCount = await this.getRetryCount(travelRuleId);
      if (retryCount < config.travelRule.maxRetries) {
        await this.scheduleRetry(travelRuleId, retryCount + 1);
      }

      const duration = Date.now() - startTime;
      await this.publishTravelRuleSentEvent(
        travelRule,
        'failed',
        duration,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Simulate Travel Rule message send (for development/testing)
   */
  private async simulateTravelRuleSend(_travelRule: DEXTravelRuleData): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In production, this would integrate with:
    // - TRISA (Travel Rule Information Sharing Architecture)
    // - OpenVASP
    // - Notabene
    // - Sygna Bridge
    // - Other Travel Rule protocols
  }

  /**
   * Store Travel Rule message in database
   */
  private async storeTravelRuleMessage(travelRule: DEXTravelRuleData): Promise<void> {
    const query = `
      INSERT INTO dex_compliance.travel_rule_messages (
        id, bridge_transaction_id, source_chain_id, destination_chain_id,
        source_wallet, destination_wallet, amount, amount_usd, token,
        timestamp, status, message_id, originator_name, originator_address,
        originator_country, originator_account_number, beneficiary_name,
        beneficiary_address, beneficiary_country, beneficiary_account_number,
        originator_vasp, beneficiary_vasp, tenant_id, broker_id, user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
    `;

    await databaseService.query(query, [
      travelRule.id,
      travelRule.bridgeTransactionId,
      travelRule.sourceChainId,
      travelRule.destinationChainId,
      travelRule.sourceWallet,
      travelRule.destinationWallet,
      travelRule.amount,
      travelRule.amountUSD,
      travelRule.token,
      travelRule.timestamp,
      travelRule.status,
      travelRule.messageId,
      travelRule.originatorInfo?.name || null,
      travelRule.originatorInfo?.address || null,
      travelRule.originatorInfo?.country || null,
      travelRule.originatorInfo?.accountNumber || null,
      travelRule.beneficiaryInfo?.name || null,
      travelRule.beneficiaryInfo?.address || null,
      travelRule.beneficiaryInfo?.country || null,
      travelRule.beneficiaryInfo?.accountNumber || null,
      travelRule.vaspInfo?.originatorVASP || null,
      travelRule.vaspInfo?.beneficiaryVASP || null,
      travelRule.tenantId,
      travelRule.brokerId || null,
      travelRule.userId || null,
    ]);
  }

  /**
   * Update Travel Rule message status
   */
  private async updateTravelRuleStatus(
    travelRuleId: string,
    status: DEXTravelRuleData['status'],
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE dex_compliance.travel_rule_messages
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await databaseService.query(query, [status, errorMessage || null, travelRuleId]);
  }

  /**
   * Get retry count for a Travel Rule message
   */
  private async getRetryCount(travelRuleId: string): Promise<number> {
    const query = `
      SELECT retry_count FROM dex_compliance.travel_rule_messages
      WHERE id = $1
    `;

    const result = await databaseService.query(query, [travelRuleId]);
    return result.rows[0]?.['retry_count'] ?? 0;
  }

  /**
   * Schedule retry for failed Travel Rule message
   */
  private async scheduleRetry(travelRuleId: string, retryCount: number): Promise<void> {
    const nextRetryAt = new Date(Date.now() + config.travelRule.retryDelayMs);

    const query = `
      UPDATE dex_compliance.travel_rule_messages
      SET retry_count = $1, next_retry_at = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await databaseService.query(query, [retryCount, nextRetryAt, travelRuleId]);

    logger.info('Travel Rule retry scheduled', {
      travelRuleId,
      retryCount,
      nextRetryAt,
    });
  }

  /**
   * Get Travel Rule message by ID
   */
  public async getTravelRuleMessage(travelRuleId: string): Promise<DEXTravelRuleData | null> {
    const query = `
      SELECT * FROM dex_compliance.travel_rule_messages
      WHERE id = $1
    `;

    const result = await databaseService.query(query, [travelRuleId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapRowToTravelRule(row as Record<string, unknown>);
  }

  /**
   * Get Travel Rule messages for a bridge transaction
   */
  public async getTravelRulesByBridge(bridgeTransactionId: string): Promise<DEXTravelRuleData[]> {
    const query = `
      SELECT * FROM dex_compliance.travel_rule_messages
      WHERE bridge_transaction_id = $1
      ORDER BY timestamp DESC
    `;

    const result = await databaseService.query(query, [bridgeTransactionId]);
    return result.rows.map(this.mapRowToTravelRule);
  }

  /**
   * Get pending Travel Rule messages for retry
   */
  public async getPendingRetries(): Promise<DEXTravelRuleData[]> {
    const query = `
      SELECT * FROM dex_compliance.travel_rule_messages
      WHERE status IN ('pending', 'failed')
        AND retry_count < max_retries
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY timestamp ASC
      LIMIT 100
    `;

    const result = await databaseService.query(query, []);
    return result.rows.map(this.mapRowToTravelRule);
  }

  /**
   * Process pending retries
   */
  public async processPendingRetries(): Promise<void> {
    const pendingRetries = await this.getPendingRetries();

    for (const travelRule of pendingRetries) {
      try {
        await this.sendTravelRuleMessage(travelRule.id);
      } catch (error) {
        logger.error('Travel Rule retry failed', {
          travelRuleId: travelRule.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Map database row to DEXTravelRuleData
   */
  private mapRowToTravelRule(row: Record<string, unknown>): DEXTravelRuleData {
    const travelRule: DEXTravelRuleData = {
      id: row['id'] as string,
      bridgeTransactionId: row['bridge_transaction_id'] as string,
      sourceChainId: row['source_chain_id'] as number,
      destinationChainId: row['destination_chain_id'] as number,
      sourceWallet: row['source_wallet'] as string,
      destinationWallet: row['destination_wallet'] as string,
      amount: row['amount'] as string,
      amountUSD: row['amount_usd'] as string,
      token: row['token'] as string,
      timestamp: new Date(row['timestamp'] as string),
      status: row['status'] as DEXTravelRuleData['status'],
      messageId: row['message_id'] as string,
      tenantId: row['tenant_id'] as string,
    };

    // Add optional originator info
    if (row['originator_name'] || row['originator_address'] || row['originator_country'] || row['originator_account_number']) {
      travelRule.originatorInfo = {};
      if (row['originator_name']) travelRule.originatorInfo.name = row['originator_name'] as string;
      if (row['originator_address']) travelRule.originatorInfo.address = row['originator_address'] as string;
      if (row['originator_country']) travelRule.originatorInfo.country = row['originator_country'] as string;
      if (row['originator_account_number']) travelRule.originatorInfo.accountNumber = row['originator_account_number'] as string;
    }

    // Add optional beneficiary info
    if (row['beneficiary_name'] || row['beneficiary_address'] || row['beneficiary_country'] || row['beneficiary_account_number']) {
      travelRule.beneficiaryInfo = {};
      if (row['beneficiary_name']) travelRule.beneficiaryInfo.name = row['beneficiary_name'] as string;
      if (row['beneficiary_address']) travelRule.beneficiaryInfo.address = row['beneficiary_address'] as string;
      if (row['beneficiary_country']) travelRule.beneficiaryInfo.country = row['beneficiary_country'] as string;
      if (row['beneficiary_account_number']) travelRule.beneficiaryInfo.accountNumber = row['beneficiary_account_number'] as string;
    }

    // Add optional VASP info
    if (row['originator_vasp'] || row['beneficiary_vasp']) {
      travelRule.vaspInfo = {};
      if (row['originator_vasp']) travelRule.vaspInfo.originatorVASP = row['originator_vasp'] as string;
      if (row['beneficiary_vasp']) travelRule.vaspInfo.beneficiaryVASP = row['beneficiary_vasp'] as string;
    }

    // Add optional fields
    if (row['broker_id']) {
      travelRule.brokerId = row['broker_id'] as string;
    }
    if (row['user_id']) {
      travelRule.userId = row['user_id'] as string;
    }

    return travelRule;
  }

  /**
   * Publish Travel Rule generated event
   */
  private async publishTravelRuleGeneratedEvent(travelRule: DEXTravelRuleData): Promise<void> {
    const eventData: DEXTravelRuleGeneratedEvent['data'] = {
      travelRuleId: travelRule.id,
      bridgeTransactionId: travelRule.bridgeTransactionId,
      sourceChainId: travelRule.sourceChainId,
      destinationChainId: travelRule.destinationChainId,
      messageId: travelRule.messageId,
      sourceWallet: travelRule.sourceWallet,
      destinationWallet: travelRule.destinationWallet,
      amount: travelRule.amount,
      amountUSD: travelRule.amountUSD,
      token: travelRule.token,
      status: travelRule.status,
    };

    // Add optional fields
    if (travelRule.userId) {
      eventData.userId = travelRule.userId;
    }
    if (travelRule.brokerId) {
      eventData.brokerId = travelRule.brokerId;
    }

    const event: DEXTravelRuleGeneratedEvent = {
      id: uuidv4(),
      type: 'compliance.dex.travel_rule.generated',
      source: config.serviceName,
      tenantId: travelRule.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publish('dex.compliance.travel_rule.generated', event);
  }

  /**
   * Publish Travel Rule sent event
   */
  private async publishTravelRuleSentEvent(
    travelRule: DEXTravelRuleData,
    status: 'sent' | 'acknowledged' | 'failed',
    responseTime: number,
    errorMessage?: string
  ): Promise<void> {
    const eventData: DEXTravelRuleSentEvent['data'] = {
      travelRuleId: travelRule.id,
      messageId: travelRule.messageId,
      status,
    };

    // Add optional fields
    if (responseTime > 0) {
      eventData.responseTime = responseTime;
    }
    if (errorMessage) {
      eventData.errorMessage = errorMessage;
    }

    const event: DEXTravelRuleSentEvent = {
      id: uuidv4(),
      type: 'compliance.dex.travel_rule.sent',
      source: config.serviceName,
      tenantId: travelRule.tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publish('dex.compliance.travel_rule.sent', event);
  }

  /**
   * Close service
   */
  public async close(): Promise<void> {
    logger.info('DEX Travel Rule Service closed');
  }
}

// ==================== EXPORT ====================

export const dexTravelRuleService = DEXTravelRuleService.getInstance();
