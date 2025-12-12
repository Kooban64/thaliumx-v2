/**
 * Travel Rule Service for CEX Compliance Service
 * Implements FATF Recommendation 16 - Travel Rule compliance
 */

// uuid import removed - using repository-generated IDs
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { travelRuleRepository, CreateTravelRuleDTO } from '../../repositories';
import { vaspRepository } from '../../repositories';
import { eventProducer } from '../events';
import {
  TravelRuleData,
  TravelRuleOriginator,
  TravelRuleBeneficiary,
  TravelRuleTransaction,
  TravelRuleVASP,
  VASP,
} from '../../types/compliance';
import { TravelRuleTable } from '../../types/database';
import { TravelRuleGeneratedEvent, TravelRuleSentEvent } from '../../types/events';

// ==================== INTERFACES ====================

/**
 * Travel Rule check result
 */
export interface TravelRuleCheckResult {
  required: boolean;
  reason: string;
  threshold: number;
  transactionAmount: number;
  currency: string;
}

/**
 * Travel Rule message send result
 */
export interface TravelRuleSendResult {
  success: boolean;
  messageId: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  responseTime?: number;
}

/**
 * Travel Rule generation request
 */
export interface GenerateTravelRuleRequest {
  transactionId: string;
  originator: TravelRuleOriginator;
  beneficiary: TravelRuleBeneficiary;
  transaction: TravelRuleTransaction;
  tenantId: string;
  brokerId?: string;
  userId?: string;
}

// ==================== TRAVEL RULE SERVICE ====================

/**
 * Travel Rule Service - Manages Travel Rule compliance
 */
export class TravelRuleService {
  private readonly thresholdAmount: number;
  private readonly autoSend: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor() {
    this.thresholdAmount = config.travelRule.thresholdAmount;
    this.autoSend = config.travelRule.autoSend;
    this.maxRetries = config.travelRule.maxRetries;
    this.retryDelayMs = config.travelRule.retryDelayMs;
  }

  /**
   * Check if Travel Rule applies to a transaction
   */
  checkTravelRuleRequired(
    amount: number,
    currency: string,
    originatorCountry: string,
    beneficiaryCountry: string
  ): TravelRuleCheckResult {
    // Get jurisdiction-specific threshold
    const threshold = this.getThresholdForJurisdiction(originatorCountry, beneficiaryCountry);

    // Convert amount to USD equivalent if needed
    const amountUSD = this.convertToUSD(amount, currency);

    const required = amountUSD >= threshold;

    return {
      required,
      reason: required
        ? `Transaction amount ${amountUSD} USD exceeds threshold ${threshold} USD`
        : `Transaction amount ${amountUSD} USD below threshold ${threshold} USD`,
      threshold,
      transactionAmount: amountUSD,
      currency: 'USD',
    };
  }

  /**
   * Generate Travel Rule message for a transaction
   */
  async generateTravelRuleMessage(
    request: GenerateTravelRuleRequest
  ): Promise<TravelRuleData> {
    logger.info('Generating Travel Rule message', {
      transactionId: request.transactionId,
      tenantId: request.tenantId,
    });

    // Get originator VASP information
    const originatorVASP = await this.getOriginatorVASP(request.tenantId);
    if (!originatorVASP) {
      throw new Error('Originator VASP not configured');
    }

    // Try to identify beneficiary VASP
    const beneficiaryVASP = await this.identifyBeneficiaryVASP(
      request.beneficiary.accountNumber,
      request.beneficiary.country
    );

    // Build VASP information
    const originatorVASPInfo: TravelRuleVASP['originatorVASP'] = {
      name: originatorVASP.name,
      country: originatorVASP.address.country,
      registrationNumber: originatorVASP.registrationNumber,
      address: `${originatorVASP.address.street}, ${originatorVASP.address.city}, ${originatorVASP.address.postalCode}`,
    };
    if (originatorVASP.lei) originatorVASPInfo.lei = originatorVASP.lei;
    if (originatorVASP.did) originatorVASPInfo.did = originatorVASP.did;

    const vaspInfo: TravelRuleVASP = {
      originatorVASP: originatorVASPInfo,
    };

    if (beneficiaryVASP) {
      const beneficiaryVASPInfo: NonNullable<TravelRuleVASP['beneficiaryVASP']> = {
        name: beneficiaryVASP.name,
        country: beneficiaryVASP.address.country,
        registrationNumber: beneficiaryVASP.registrationNumber,
        address: `${beneficiaryVASP.address.street}, ${beneficiaryVASP.address.city}, ${beneficiaryVASP.address.postalCode}`,
      };
      if (beneficiaryVASP.lei) beneficiaryVASPInfo.lei = beneficiaryVASP.lei;
      if (beneficiaryVASP.did) beneficiaryVASPInfo.did = beneficiaryVASP.did;
      vaspInfo.beneficiaryVASP = beneficiaryVASPInfo;
    }

    // Create Travel Rule record
    const createDTO: CreateTravelRuleDTO = {
      originator: request.originator,
      beneficiary: request.beneficiary,
      transaction: request.transaction,
      vasp: vaspInfo,
      tenantId: request.tenantId,
      maxRetries: this.maxRetries,
    };
    if (request.brokerId) createDTO.brokerId = request.brokerId;
    if (request.userId) createDTO.userId = request.userId;

    const travelRuleRecord = await travelRuleRepository.create(createDTO);
    const travelRuleData = travelRuleRepository.tableToTravelRuleData(travelRuleRecord);

    // Publish event
    await this.publishTravelRuleGeneratedEvent(travelRuleData, request.tenantId);

    logger.info('Travel Rule message generated', {
      id: travelRuleData.id,
      messageId: travelRuleData.messageId,
      transactionId: request.transactionId,
    });

    // Auto-send if configured
    if (this.autoSend && beneficiaryVASP) {
      await this.sendTravelRuleMessage(travelRuleData.id);
    }

    return travelRuleData;
  }

  /**
   * Send Travel Rule message to beneficiary VASP
   */
  async sendTravelRuleMessage(travelRuleId: string): Promise<TravelRuleSendResult> {
    const travelRule = await travelRuleRepository.findById(travelRuleId);
    if (!travelRule) {
      throw new Error(`Travel Rule message not found: ${travelRuleId}`);
    }

    logger.info('Sending Travel Rule message', {
      id: travelRuleId,
      messageId: travelRule.message_id,
    });

    const startTime = Date.now();

    try {
      // In production, this would call the actual VASP messaging protocol
      // (e.g., TRISA, OpenVASP, Sygna Bridge, etc.)
      const result = await this.sendToVASP(travelRule);

      const responseTime = Date.now() - startTime;

      if (result.success) {
        await travelRuleRepository.updateStatus(travelRuleId, 'sent');
        
        // Publish sent event
        await this.publishTravelRuleSentEvent(
          travelRuleId,
          travelRule.message_id,
          travelRule.beneficiary_vasp_name ?? 'unknown',
          'sent',
          responseTime
        );

        logger.info('Travel Rule message sent successfully', {
          id: travelRuleId,
          messageId: travelRule.message_id,
          responseTime,
        });

        return {
          success: true,
          messageId: travelRule.message_id,
          status: 'sent',
          responseTime,
        };
      } else {
        throw new Error(result.errorMessage ?? 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const responseTime = Date.now() - startTime;

      // Update status and increment retry
      await travelRuleRepository.updateStatus(travelRuleId, 'failed', errorMessage);
      await travelRuleRepository.incrementRetry(travelRuleId, this.retryDelayMs);

      // Publish failed event
      await this.publishTravelRuleSentEvent(
        travelRuleId,
        travelRule.message_id,
        travelRule.beneficiary_vasp_name ?? 'unknown',
        'failed',
        responseTime,
        errorMessage
      );

      logger.error('Failed to send Travel Rule message', {
        id: travelRuleId,
        messageId: travelRule.message_id,
        error: errorMessage,
      });

      return {
        success: false,
        messageId: travelRule.message_id,
        status: 'failed',
        errorMessage,
        responseTime,
      };
    }
  }

  /**
   * Process pending Travel Rule retries
   */
  async processPendingRetries(): Promise<number> {
    const pendingMessages = await travelRuleRepository.findPendingRetries();
    let processedCount = 0;

    for (const message of pendingMessages) {
      try {
        await this.sendTravelRuleMessage(message.id);
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to process retry', {
          id: message.id,
          error: errorMessage,
        });
      }
    }

    logger.info('Processed pending Travel Rule retries', {
      total: pendingMessages.length,
      processed: processedCount,
    });

    return processedCount;
  }

  /**
   * Acknowledge received Travel Rule message
   */
  async acknowledgeMessage(messageId: string): Promise<void> {
    const travelRule = await travelRuleRepository.findByMessageId(messageId);
    if (!travelRule) {
      throw new Error(`Travel Rule message not found: ${messageId}`);
    }

    await travelRuleRepository.updateStatus(travelRule.id, 'acknowledged');

    logger.info('Travel Rule message acknowledged', {
      id: travelRule.id,
      messageId,
    });
  }

  /**
   * Get Travel Rule message by ID
   */
  async getTravelRuleById(id: string): Promise<TravelRuleData | null> {
    const record = await travelRuleRepository.findById(id);
    return record ? travelRuleRepository.tableToTravelRuleData(record) : null;
  }

  /**
   * Get Travel Rule message by message ID
   */
  async getTravelRuleByMessageId(messageId: string): Promise<TravelRuleData | null> {
    const record = await travelRuleRepository.findByMessageId(messageId);
    return record ? travelRuleRepository.tableToTravelRuleData(record) : null;
  }

  /**
   * Get Travel Rule messages for a transaction
   */
  async getTravelRulesForTransaction(transactionId: string): Promise<TravelRuleData[]> {
    const records = await travelRuleRepository.findByTransactionId(transactionId);
    return records.map((r) => travelRuleRepository.tableToTravelRuleData(r));
  }

  /**
   * Get Travel Rule statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    received: number;
    acknowledged: number;
    failed: number;
    byCountry: Record<string, number>;
    byCurrency: Record<string, number>;
  }> {
    return travelRuleRepository.getStatistics(tenantId);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Get threshold for jurisdiction
   */
  private getThresholdForJurisdiction(
    originatorCountry: string,
    beneficiaryCountry: string
  ): number {
    // EU has lower threshold (1000 EUR ~ 1100 USD)
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    
    if (euCountries.includes(originatorCountry) || euCountries.includes(beneficiaryCountry)) {
      return 1000; // EUR threshold
    }

    // Canada has 1000 CAD threshold
    if (originatorCountry === 'CA' || beneficiaryCountry === 'CA') {
      return 1000;
    }

    // Default to US threshold
    return this.thresholdAmount;
  }

  /**
   * Convert amount to USD
   */
  private convertToUSD(amount: number, currency: string): number {
    // In production, use real-time exchange rates
    const exchangeRates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.27,
      CAD: 0.74,
      AUD: 0.65,
      JPY: 0.0067,
      BTC: 43000,
      ETH: 2300,
      USDT: 1,
      USDC: 1,
    };

    const rate = exchangeRates[currency] ?? 1;
    return amount * rate;
  }

  /**
   * Get originator VASP information
   */
  private async getOriginatorVASP(_tenantId: string): Promise<VASP | null> {
    // In production, this would look up the VASP based on tenant configuration
    // For now, return a default VASP (tenantId will be used for lookup)
    const vaspRecord = await vaspRepository.findByField('status', 'active');
    if (vaspRecord.length > 0 && vaspRecord[0]) {
      return vaspRepository.tableToVASP(vaspRecord[0]);
    }
    return null;
  }

  /**
   * Identify beneficiary VASP
   */
  private async identifyBeneficiaryVASP(
    _accountNumber: string,
    country: string
  ): Promise<VASP | null> {
    // In production, this would use VASP directory services
    // to identify the beneficiary VASP based on the account/address
    // accountNumber will be used for VASP lookup in production
    const vaspRecords = await vaspRepository.findByJurisdiction(country);
    if (vaspRecords.data.length > 0 && vaspRecords.data[0]) {
      return vaspRepository.tableToVASP(vaspRecords.data[0]);
    }
    return null;
  }

  /**
   * Send message to VASP (mock implementation)
   */
  private async sendToVASP(
    _travelRule: TravelRuleTable
  ): Promise<{ success: boolean; errorMessage?: string }> {
    // In production, implement actual VASP messaging protocol
    // This is a mock implementation
    // The _travelRule parameter will be used for actual VASP communication
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return { success: true };
    } else {
      return { success: false, errorMessage: 'VASP communication timeout' };
    }
  }

  /**
   * Publish Travel Rule generated event
   */
  private async publishTravelRuleGeneratedEvent(
    travelRule: TravelRuleData,
    tenantId: string
  ): Promise<void> {
    const eventData: TravelRuleGeneratedEvent['data'] = {
      travelRuleId: travelRule.id,
      transactionId: travelRule.transaction.transactionId,
      userId: travelRule.originator.customerId,
      messageId: travelRule.messageId,
      originatorVASP: travelRule.vasp.originatorVASP.name,
      amount: travelRule.transaction.amount,
      currency: travelRule.transaction.currency,
      status: travelRule.status,
    };
    if (travelRule.originator.brokerId) eventData.brokerId = travelRule.originator.brokerId;
    if (travelRule.vasp.beneficiaryVASP?.name) eventData.beneficiaryVASP = travelRule.vasp.beneficiaryVASP.name;

    const event = eventProducer.createEvent<TravelRuleGeneratedEvent>(
      'compliance.travel_rule.generated',
      'cex',
      tenantId,
      eventData,
      travelRule.id
    );

    await eventProducer.publish(event, 'compliance.travel_rule');
  }

  /**
   * Publish Travel Rule sent event
   */
  private async publishTravelRuleSentEvent(
    travelRuleId: string,
    messageId: string,
    recipientVASP: string,
    status: 'sent' | 'acknowledged' | 'failed',
    responseTime?: number,
    errorMessage?: string
  ): Promise<void> {
    const eventData: TravelRuleSentEvent['data'] = {
      travelRuleId,
      messageId,
      recipientVASP,
      status,
    };
    if (responseTime !== undefined) eventData.responseTime = responseTime;
    if (errorMessage !== undefined) eventData.errorMessage = errorMessage;

    const event = eventProducer.createEvent<TravelRuleSentEvent>(
      'compliance.travel_rule.sent',
      'cex',
      'system',
      eventData,
      travelRuleId
    );

    await eventProducer.publish(event, 'compliance.travel_rule');
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton Travel Rule service instance
 */
export const travelRuleService = new TravelRuleService();
