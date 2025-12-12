/**
 * Wallet Screening Service for DEX Compliance
 * On-chain wallet risk assessment and sanctions screening
 */

import { ethers } from 'ethers';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { WalletScreeningResult, WalletRiskFlag } from '../../types/compliance';
import { databaseService } from '../database';
import { eventProducer } from '../events';
import { WalletScreeningCompletedEvent } from '../../types/events';
import { v4 as uuidv4 } from 'uuid';

// ==================== KNOWN HIGH-RISK ADDRESSES ====================

/**
 * Known sanctioned/high-risk addresses (Tornado Cash contracts, etc.)
 */
const KNOWN_HIGH_RISK_ADDRESSES: Set<string> = new Set([
  // Tornado Cash contracts (OFAC sanctioned)
  '0x8589427373D6D84E98730D7795D8f6f8731FDA16'.toLowerCase(),
  '0x722122dF12D4e14e13Ac3b6895a86e84145b6967'.toLowerCase(),
  '0xDD4c48C0B24039969fC16D1cdF626eaB821d3384'.toLowerCase(),
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b'.toLowerCase(),
  '0xd96f2B1c14Db8458374d9Aca76E26c3D18364307'.toLowerCase(),
  '0x4736dCf1b7A3d580672CcE6E7c65cd5cc9cFBa9D'.toLowerCase(),
  '0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3'.toLowerCase(),
  '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF'.toLowerCase(),
  '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291'.toLowerCase(),
  '0xFD8610d20aA15b7B2E3Be39B396a1bC3516c7144'.toLowerCase(),
  '0xF60dD140cFf0706bAE9Cd734Ac3ae76AD9eBC32A'.toLowerCase(),
  '0x22aaA7720ddd5388A3c0A3333430953C68f1849b'.toLowerCase(),
  '0xBA214C1c1928a32Bffe790263E38B4Af9bFCD659'.toLowerCase(),
  '0xb1C8094B234DcE6e03f10a5b673c1d8C69739A00'.toLowerCase(),
  '0x527653eA119F3E6a1F5BD18fbF4714081D7B31ce'.toLowerCase(),
  '0x58E8dCC13BE9780fC42E8723D8EaD4CF46943dF2'.toLowerCase(),
  '0xD691F27f38B395864Ea86CfC7253969B409c362d'.toLowerCase(),
  '0xaEaaC358560e11f52454D997AAFF2c5731B6f8a6'.toLowerCase(),
  '0x1356c899D8C9467C7f71C195612F8A395aBf2f0a'.toLowerCase(),
  '0xA60C772958a3eD56c1F15dD055bA37AC8e523a0D'.toLowerCase(),
  '0x169AD27A470D064DEDE56a2D3ff727986b15D52B'.toLowerCase(),
  '0x0836222F2B2B24A3F36f98668Ed8F0B38D1a872f'.toLowerCase(),
  '0xF67721A2D8F736E75a49FdD7FAd2e31D8676542a'.toLowerCase(),
  '0x9AD122c22B14202B4490eDAf288FDb3C7cb3ff5E'.toLowerCase(),
  '0x905b63Fff465B9fFBF41DeA908CEb12478ec7601'.toLowerCase(),
  '0x07687e702b410Fa43f4cB4Af7FA097918ffD2730'.toLowerCase(),
  '0x94A1B5CdB22c43faab4AbEb5c74999895464Ddaf'.toLowerCase(),
  '0xb541fc07bC7619fD4062A54d96268525cBC6FfEF'.toLowerCase(),
  '0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc'.toLowerCase(),
  '0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936'.toLowerCase(),
  '0x23773E65ed146A459791799d01336DB287f25334'.toLowerCase(),
  '0xD21be7248e0197Ee08E0c20D4a96DEBdaC3D20Af'.toLowerCase(),
  '0x610B717796ad172B316836AC95a2ffad065CeaB4'.toLowerCase(),
  '0x178169B423a011fff22B9e3F3abeA13414dDD0F1'.toLowerCase(),
  '0xbB93e510BbCD0B7beb5A853875f9eC60275CF498'.toLowerCase(),
  '0x2717c5e28cf931547B621a5dddb772Ab6A35B701'.toLowerCase(),
  '0x03893a7c7463AE47D46bc7f091665f1893656003'.toLowerCase(),
  '0xCa0840578f57fE71599D29375e16783424023357'.toLowerCase(),
]);

// ==================== WALLET SCREENING SERVICE ====================

/**
 * Service for screening wallet addresses for compliance risks
 */
export class WalletScreeningService {
  private static instance: WalletScreeningService;
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private screeningCache: Map<string, { result: WalletScreeningResult; timestamp: number }> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WalletScreeningService {
    if (!WalletScreeningService.instance) {
      WalletScreeningService.instance = new WalletScreeningService();
    }
    return WalletScreeningService.instance;
  }

  /**
   * Initialize blockchain providers
   */
  public async initialize(): Promise<void> {
    for (const providerConfig of config.blockchain.providers) {
      try {
        const provider = new ethers.JsonRpcProvider(providerConfig.rpcUrl);
        await provider.getBlockNumber(); // Test connection
        this.providers.set(providerConfig.chainId, provider);
        logger.info('Blockchain provider initialized', {
          chainId: providerConfig.chainId,
          name: providerConfig.name,
        });
      } catch (error) {
        logger.error('Failed to initialize blockchain provider', {
          chainId: providerConfig.chainId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No blockchain providers initialized');
    }

    logger.info('Wallet screening service initialized', {
      providerCount: this.providers.size,
    });
  }

  /**
   * Screen a wallet address
   */
  public async screenWallet(
    walletAddress: string,
    chainId: number,
    tenantId: string,
    options?: {
      userId?: string;
      brokerId?: string;
      reason?: 'connection' | 'transaction' | 'periodic' | 'manual';
      skipCache?: boolean;
    }
  ): Promise<WalletScreeningResult> {
    const normalizedAddress = walletAddress.toLowerCase();
    const cacheKey = `${normalizedAddress}:${chainId}`;

    // Check cache
    if (!options?.skipCache) {
      const cached = this.screeningCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < config.walletScreening.cacheTimeout) {
        logger.debug('Returning cached screening result', { walletAddress, chainId });
        return cached.result;
      }
    }

    const startTime = Date.now();
    const screeningId = uuidv4();

    try {
      // Perform screening
      const result = await this.performScreening(
        screeningId,
        normalizedAddress,
        chainId,
        tenantId,
        options
      );

      // Cache result
      this.screeningCache.set(cacheKey, { result, timestamp: Date.now() });

      // Store in database
      await this.storeScreeningResult(result);

      // Publish event
      await this.publishScreeningEvent(result, options);

      const duration = Date.now() - startTime;
      logger.logCompliance('wallet_screening_completed', screeningId, {
        walletAddress,
        chainId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        duration,
      });

      return result;
    } catch (error) {
      logger.error('Wallet screening failed', {
        walletAddress,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Perform the actual screening
   */
  private async performScreening(
    screeningId: string,
    walletAddress: string,
    chainId: number,
    _tenantId: string,
    _options?: {
      userId?: string;
      brokerId?: string;
    }
  ): Promise<WalletScreeningResult> {
    const flags: WalletRiskFlag[] = [];
    let riskScore = 0;

    // Check against known high-risk addresses
    const sanctionsMatch = KNOWN_HIGH_RISK_ADDRESSES.has(walletAddress);
    if (sanctionsMatch) {
      flags.push('sanctions_match');
      riskScore += 100;
    }

    // Get on-chain data
    const provider = this.providers.get(chainId);
    let totalTransactions = 0;
    let totalVolumeUSD = '0';
    let firstTransactionDate: Date | undefined;
    let lastTransactionDate: Date | undefined;

    if (provider) {
      try {
        const [balance, transactionCount, code] = await Promise.all([
          provider.getBalance(walletAddress),
          provider.getTransactionCount(walletAddress),
          provider.getCode(walletAddress),
        ]);

        totalTransactions = transactionCount;

        // Check if it's a contract
        if (code !== '0x') {
          flags.push('contract_interaction_risk');
          riskScore += 10;
        }

        // Check for newly created wallet (low transaction count)
        if (transactionCount < 5) {
          flags.push('newly_created');
          riskScore += 15;
        }

        // Estimate volume (simplified - in production, use indexer data)
        const balanceEth = parseFloat(ethers.formatEther(balance));
        totalVolumeUSD = (balanceEth * 2000).toFixed(2); // Simplified ETH price

        // Get first/last transaction dates (simplified)
        if (transactionCount > 0) {
          lastTransactionDate = new Date();
          // In production, query actual transaction history
        }
      } catch (error) {
        logger.warn('Failed to get on-chain data', {
          walletAddress,
          chainId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Check for mixer interaction (simplified - in production, use chain analysis)
    const mixerInteraction = await this.checkMixerInteraction(walletAddress, chainId);
    if (mixerInteraction) {
      flags.push('mixer_interaction');
      riskScore += 50;
    }

    // Check for darknet interaction (simplified)
    const darknetInteraction = false; // Would use external API
    if (darknetInteraction) {
      flags.push('darknet_interaction');
      riskScore += 70;
    }

    // Check for scam interaction (simplified)
    const scamInteraction = false; // Would use external API
    if (scamInteraction) {
      flags.push('scam_interaction');
      riskScore += 40;
    }

    // Check for high-risk exchange interaction (simplified)
    const highRiskExchangeInteraction = false; // Would use external API
    if (highRiskExchangeInteraction) {
      flags.push('high_risk_exchange');
      riskScore += 30;
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(riskScore);

    const result: WalletScreeningResult = {
      id: screeningId,
      walletAddress,
      chainId,
      screeningDate: new Date(),
      riskScore,
      riskLevel,
      flags,
      sanctionsMatch,
      mixerInteraction,
      darknetInteraction,
      scamInteraction,
      highRiskExchangeInteraction,
      totalTransactions,
      totalVolumeUSD,
      associatedAddresses: [],
      screeningProvider: config.walletScreening.provider,
    };

    // Add optional fields only if they have values
    if (firstTransactionDate !== undefined) {
      result.firstTransactionDate = firstTransactionDate;
    }
    if (lastTransactionDate !== undefined) {
      result.lastTransactionDate = lastTransactionDate;
    }

    return result;
  }

  /**
   * Check for mixer interaction
   */
  private async checkMixerInteraction(
    _walletAddress: string,
    _chainId: number
  ): Promise<boolean> {
    // In production, this would:
    // 1. Query transaction history from an indexer
    // 2. Check for interactions with known mixer contracts
    // 3. Use chain analysis APIs (Chainalysis, Elliptic, etc.)
    return false;
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= config.riskThresholds.high) return 'critical';
    if (score >= config.riskThresholds.medium) return 'high';
    if (score >= config.riskThresholds.low) return 'medium';
    return 'low';
  }

  /**
   * Store screening result in database
   */
  private async storeScreeningResult(
    result: WalletScreeningResult,
    _tenantId: string = 'default'
  ): Promise<void> {
    const query = `
      INSERT INTO dex_compliance.wallet_screenings (
        id, wallet_address, chain_id, screening_date, risk_score, risk_level,
        flags, sanctions_match, mixer_interaction, darknet_interaction,
        scam_interaction, high_risk_exchange_interaction, total_transactions,
        total_volume_usd, first_transaction_date, last_transaction_date,
        associated_addresses, screening_provider, raw_response, tenant_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (wallet_address, chain_id) 
      DO UPDATE SET
        screening_date = EXCLUDED.screening_date,
        risk_score = EXCLUDED.risk_score,
        risk_level = EXCLUDED.risk_level,
        flags = EXCLUDED.flags,
        sanctions_match = EXCLUDED.sanctions_match,
        mixer_interaction = EXCLUDED.mixer_interaction,
        darknet_interaction = EXCLUDED.darknet_interaction,
        scam_interaction = EXCLUDED.scam_interaction,
        high_risk_exchange_interaction = EXCLUDED.high_risk_exchange_interaction,
        total_transactions = EXCLUDED.total_transactions,
        total_volume_usd = EXCLUDED.total_volume_usd,
        first_transaction_date = EXCLUDED.first_transaction_date,
        last_transaction_date = EXCLUDED.last_transaction_date,
        associated_addresses = EXCLUDED.associated_addresses,
        updated_at = NOW()
    `;

    await databaseService.query(query, [
      result.id,
      result.walletAddress,
      result.chainId,
      result.screeningDate,
      result.riskScore,
      result.riskLevel,
      result.flags,
      result.sanctionsMatch,
      result.mixerInteraction,
      result.darknetInteraction,
      result.scamInteraction,
      result.highRiskExchangeInteraction,
      result.totalTransactions,
      result.totalVolumeUSD,
      result.firstTransactionDate || null,
      result.lastTransactionDate || null,
      result.associatedAddresses,
      result.screeningProvider,
      result.rawResponse || null,
      _tenantId,
    ]);
  }

  /**
   * Publish screening completed event
   */
  private async publishScreeningEvent(
    result: WalletScreeningResult,
    options?: {
      userId?: string;
      brokerId?: string;
    }
  ): Promise<void> {
    const eventData: WalletScreeningCompletedEvent['data'] = {
      screeningId: result.id,
      walletAddress: result.walletAddress,
      chainId: result.chainId,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      flags: result.flags as string[],
      sanctionsMatch: result.sanctionsMatch,
      screeningProvider: result.screeningProvider,
    };

    // Add optional fields only if they have values
    if (options?.userId) {
      eventData.userId = options.userId;
    }
    if (options?.brokerId) {
      eventData.brokerId = options.brokerId;
    }

    const event: WalletScreeningCompletedEvent = {
      id: uuidv4(),
      type: 'wallet.screening.completed',
      source: config.serviceName,
      tenantId: 'default', // Would come from context
      timestamp: new Date(),
      data: eventData,
    };

    await eventProducer.publishWalletScreeningCompleted(event);
  }

  /**
   * Batch screen multiple wallets
   */
  public async batchScreenWallets(
    wallets: Array<{ address: string; chainId: number }>,
    tenantId: string,
    options?: {
      userId?: string;
      brokerId?: string;
    }
  ): Promise<WalletScreeningResult[]> {
    const results: WalletScreeningResult[] = [];

    for (const wallet of wallets) {
      try {
        const result = await this.screenWallet(
          wallet.address,
          wallet.chainId,
          tenantId,
          options
        );
        results.push(result);
      } catch (error) {
        logger.error('Batch screening failed for wallet', {
          address: wallet.address,
          chainId: wallet.chainId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Get screening history for a wallet
   */
  public async getScreeningHistory(
    walletAddress: string,
    chainId: number,
    limit = 10
  ): Promise<WalletScreeningResult[]> {
    const query = `
      SELECT * FROM dex_compliance.wallet_screenings
      WHERE wallet_address = $1 AND chain_id = $2
      ORDER BY screening_date DESC
      LIMIT $3
    `;

    const result = await databaseService.query(query, [
      walletAddress.toLowerCase(),
      chainId,
      limit,
    ]);

    return result.rows.map(this.mapRowToResult);
  }

  /**
   * Map database row to WalletScreeningResult
   */
  private mapRowToResult(row: Record<string, unknown>): WalletScreeningResult {
    const result: WalletScreeningResult = {
      id: row['id'] as string,
      walletAddress: row['wallet_address'] as string,
      chainId: row['chain_id'] as number,
      screeningDate: new Date(row['screening_date'] as string),
      riskScore: row['risk_score'] as number,
      riskLevel: row['risk_level'] as 'low' | 'medium' | 'high' | 'critical',
      flags: row['flags'] as WalletRiskFlag[],
      sanctionsMatch: row['sanctions_match'] as boolean,
      mixerInteraction: row['mixer_interaction'] as boolean,
      darknetInteraction: row['darknet_interaction'] as boolean,
      scamInteraction: row['scam_interaction'] as boolean,
      highRiskExchangeInteraction: row['high_risk_exchange_interaction'] as boolean,
      totalTransactions: row['total_transactions'] as number,
      totalVolumeUSD: row['total_volume_usd'] as string,
      associatedAddresses: row['associated_addresses'] as string[],
      screeningProvider: row['screening_provider'] as string,
    };

    // Add optional fields only if they have values
    if (row['first_transaction_date']) {
      result.firstTransactionDate = new Date(row['first_transaction_date'] as string);
    }
    if (row['last_transaction_date']) {
      result.lastTransactionDate = new Date(row['last_transaction_date'] as string);
    }
    if (row['raw_response']) {
      result.rawResponse = row['raw_response'] as Record<string, unknown>;
    }

    return result;
  }

  /**
   * Clear screening cache
   */
  public clearCache(): void {
    this.screeningCache.clear();
    logger.info('Wallet screening cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.screeningCache.size,
      hitRate: 0, // Would track hits/misses in production
    };
  }

  /**
   * Close service
   */
  public async close(): Promise<void> {
    this.providers.clear();
    this.screeningCache.clear();
    logger.info('Wallet screening service closed');
  }
}

// ==================== EXPORT ====================

export const walletScreeningService = WalletScreeningService.getInstance();
