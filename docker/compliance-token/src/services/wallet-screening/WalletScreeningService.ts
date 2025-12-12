/**
 * Wallet Screening Service for Token Compliance
 * Screens wallets for sanctions, mixer usage, and other risk factors
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import type {
  WalletScreeningResult,
  WalletFlag,
  SanctionsMatch,
} from '../../types/compliance';
import type { WalletScreeningTable } from '../../types/database';

const logger = createComponentLogger('wallet-screening-service');

/**
 * Known high-risk addresses (simplified - in production would use external APIs)
 */
const KNOWN_MIXERS = new Set([
  '0x8589427373d6d84e98730d7795d8f6f8731fda16', // Tornado Cash Router
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', // Tornado Cash
  '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
]);

const KNOWN_SANCTIONED = new Set([
  // OFAC sanctioned addresses (examples)
  '0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c',
  '0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b',
]);

/**
 * Wallet Screening Service
 */
export class WalletScreeningService {
  private cacheExpiry: number;

  constructor() {
    const config = getConfig();
    this.cacheExpiry = config.walletScreening.cacheExpiry;
  }

  /**
   * Screen a wallet address
   */
  async screenWallet(
    walletAddress: string,
    chainId: number,
    tenantId: string,
    forceRefresh = false
  ): Promise<WalletScreeningResult> {
    const normalizedAddress = walletAddress.toLowerCase();
    const startTime = Date.now();

    logger.info('Screening wallet', {
      walletAddress: normalizedAddress,
      chainId,
      forceRefresh,
    });

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.getCachedScreening(normalizedAddress, chainId, tenantId);
      if (cached) {
        logger.debug('Using cached screening result', {
          walletAddress: normalizedAddress,
          screeningId: cached.id,
        });
        return cached;
      }
    }

    try {
      // Perform screening
      const flags: WalletFlag[] = [];
      let sanctionsMatch = false;
      const sanctionsDetails: SanctionsMatch[] = [];
      let mixerExposure = 0;
      let darknetExposure = 0;
      let gamblingExposure = 0;
      let scamExposure = 0;
      let stolenFundsExposure = 0;

      // Check sanctions lists
      const sanctionsResult = await this.checkSanctions(normalizedAddress);
      if (sanctionsResult.isMatch) {
        sanctionsMatch = true;
        sanctionsDetails.push(...sanctionsResult.matches);
        flags.push('ofac_sanctions');
      }

      // Check mixer usage
      const mixerResult = await this.checkMixerUsage(normalizedAddress, chainId);
      if (mixerResult.hasExposure) {
        mixerExposure = mixerResult.exposurePercentage;
        if (mixerExposure > 10) {
          flags.push('mixer_usage');
        }
        if (mixerResult.hasTornadoCash) {
          flags.push('tornado_cash');
        }
      }

      // Check darknet exposure
      const darknetResult = await this.checkDarknetExposure(normalizedAddress, chainId);
      if (darknetResult.hasExposure) {
        darknetExposure = darknetResult.exposurePercentage;
        flags.push('darknet_market');
      }

      // Check gambling exposure
      const gamblingResult = await this.checkGamblingExposure(normalizedAddress, chainId);
      if (gamblingResult.hasExposure) {
        gamblingExposure = gamblingResult.exposurePercentage;
        flags.push('gambling');
      }

      // Check scam exposure
      const scamResult = await this.checkScamExposure(normalizedAddress, chainId);
      if (scamResult.hasExposure) {
        scamExposure = scamResult.exposurePercentage;
        flags.push('scam');
      }

      // Check stolen funds exposure
      const stolenResult = await this.checkStolenFundsExposure(normalizedAddress, chainId);
      if (stolenResult.hasExposure) {
        stolenFundsExposure = stolenResult.exposurePercentage;
        flags.push('stolen_funds');
      }

      // Check if unhosted wallet
      const isContract = await this.isContractAddress(normalizedAddress, chainId);
      if (!isContract) {
        flags.push('unhosted_wallet');
      } else {
        // Check smart contract risk
        const contractRisk = await this.checkContractRisk(normalizedAddress, chainId);
        if (contractRisk.isRisky) {
          flags.push('smart_contract_risk');
        }
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(
        sanctionsMatch,
        mixerExposure,
        darknetExposure,
        gamblingExposure,
        scamExposure,
        stolenFundsExposure,
        flags
      );

      const riskLevel = this.getRiskLevel(riskScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        riskScore,
        riskLevel,
        flags,
        sanctionsMatch
      );

      // Create result
      const result: WalletScreeningResult = {
        id: uuidv4(),
        walletAddress: normalizedAddress,
        chainId,
        screeningDate: new Date(),
        provider: 'internal',
        riskScore,
        riskLevel,
        flags,
        sanctionsMatch,
        sanctionsDetails: sanctionsDetails.length > 0 ? sanctionsDetails : undefined,
        mixerExposure,
        darknetExposure,
        gamblingExposure,
        scamExposure,
        stolenFundsExposure,
        recommendations,
        tenantId,
      };

      // Save to database
      await this.saveScreeningResult(result);

      // Publish events
      await this.publishScreeningEvents(result);

      const duration = Date.now() - startTime;
      logger.logWalletScreeningEvent(
        'completed',
        result.id,
        normalizedAddress,
        riskScore,
        riskLevel,
        { durationMs: duration, flagCount: flags.length }
      );

      return result;
    } catch (error) {
      logger.error('Failed to screen wallet', {
        walletAddress: normalizedAddress,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get cached screening result
   */
  private async getCachedScreening(
    walletAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<WalletScreeningResult | null> {
    const db = getDatabaseService();
    const expiryDate = new Date(Date.now() - this.cacheExpiry * 1000);

    const row = await db.queryOne<WalletScreeningTable>(`
      SELECT * FROM wallet_screenings
      WHERE wallet_address = $1
        AND chain_id = $2
        AND tenant_id = $3
        AND screening_date > $4
      ORDER BY screening_date DESC
      LIMIT 1
    `, [walletAddress, chainId, tenantId, expiryDate]);

    if (!row) {
      return null;
    }

    return this.mapTableToResult(row);
  }

  /**
   * Check sanctions lists
   */
  private async checkSanctions(
    walletAddress: string
  ): Promise<{ isMatch: boolean; matches: SanctionsMatch[] }> {
    // In production, this would call external sanctions APIs
    // For now, check against known sanctioned addresses
    if (KNOWN_SANCTIONED.has(walletAddress)) {
      return {
        isMatch: true,
        matches: [
          {
            listName: 'OFAC SDN',
            entityName: 'Unknown Entity',
            matchScore: 100,
            matchType: 'exact',
            listingDate: new Date('2022-08-08'),
            listingReason: 'Sanctions evasion',
          },
        ],
      };
    }

    return { isMatch: false, matches: [] };
  }

  /**
   * Check mixer usage
   */
  private async checkMixerUsage(
    walletAddress: string,
    _chainId: number
  ): Promise<{ hasExposure: boolean; exposurePercentage: number; hasTornadoCash: boolean }> {
    // In production, this would analyze on-chain transactions
    // For now, check if address is a known mixer
    if (KNOWN_MIXERS.has(walletAddress)) {
      return {
        hasExposure: true,
        exposurePercentage: 100,
        hasTornadoCash: true,
      };
    }

    return { hasExposure: false, exposurePercentage: 0, hasTornadoCash: false };
  }

  /**
   * Check darknet exposure
   */
  private async checkDarknetExposure(
    _walletAddress: string,
    _chainId: number
  ): Promise<{ hasExposure: boolean; exposurePercentage: number }> {
    // In production, this would analyze on-chain transactions
    return { hasExposure: false, exposurePercentage: 0 };
  }

  /**
   * Check gambling exposure
   */
  private async checkGamblingExposure(
    _walletAddress: string,
    _chainId: number
  ): Promise<{ hasExposure: boolean; exposurePercentage: number }> {
    // In production, this would analyze on-chain transactions
    return { hasExposure: false, exposurePercentage: 0 };
  }

  /**
   * Check scam exposure
   */
  private async checkScamExposure(
    _walletAddress: string,
    _chainId: number
  ): Promise<{ hasExposure: boolean; exposurePercentage: number }> {
    // In production, this would analyze on-chain transactions
    return { hasExposure: false, exposurePercentage: 0 };
  }

  /**
   * Check stolen funds exposure
   */
  private async checkStolenFundsExposure(
    _walletAddress: string,
    _chainId: number
  ): Promise<{ hasExposure: boolean; exposurePercentage: number }> {
    // In production, this would analyze on-chain transactions
    return { hasExposure: false, exposurePercentage: 0 };
  }

  /**
   * Check if address is a contract
   */
  private async isContractAddress(
    _walletAddress: string,
    _chainId: number
  ): Promise<boolean> {
    // In production, this would check on-chain
    return false;
  }

  /**
   * Check smart contract risk
   */
  private async checkContractRisk(
    _walletAddress: string,
    _chainId: number
  ): Promise<{ isRisky: boolean; riskFactors: string[] }> {
    // In production, this would analyze contract code
    return { isRisky: false, riskFactors: [] };
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    sanctionsMatch: boolean,
    mixerExposure: number,
    darknetExposure: number,
    gamblingExposure: number,
    scamExposure: number,
    stolenFundsExposure: number,
    flags: WalletFlag[]
  ): number {
    let score = 0;

    // Sanctions match is critical
    if (sanctionsMatch) {
      score += 100;
    }

    // Exposure scores
    score += mixerExposure * 0.8;
    score += darknetExposure * 0.9;
    score += gamblingExposure * 0.3;
    score += scamExposure * 0.7;
    score += stolenFundsExposure * 0.9;

    // Flag-based scoring
    const flagScores: Record<WalletFlag, number> = {
      ofac_sanctions: 50,
      eu_sanctions: 50,
      un_sanctions: 50,
      mixer_usage: 30,
      tornado_cash: 40,
      darknet_market: 40,
      ransomware: 50,
      scam: 35,
      phishing: 35,
      stolen_funds: 45,
      gambling: 15,
      high_risk_exchange: 20,
      unhosted_wallet: 5,
      smart_contract_risk: 25,
    };

    for (const flag of flags) {
      score += flagScores[flag] ?? 0;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    const config = getConfig();
    if (score >= config.riskThresholds.critical) {
      return 'critical';
    }
    if (score >= config.riskThresholds.high) {
      return 'high';
    }
    if (score >= config.riskThresholds.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    _riskScore: number,
    riskLevel: string,
    flags: WalletFlag[],
    sanctionsMatch: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (sanctionsMatch) {
      recommendations.push('Block all transactions immediately');
      recommendations.push('Report to compliance officer');
      recommendations.push('File SAR if applicable');
    }

    if (flags.includes('tornado_cash') || flags.includes('mixer_usage')) {
      recommendations.push('Enhanced due diligence required');
      recommendations.push('Verify source of funds');
    }

    if (flags.includes('stolen_funds')) {
      recommendations.push('Block incoming transfers');
      recommendations.push('Contact law enforcement if applicable');
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Manual review required');
      recommendations.push('Consider transaction limits');
    }

    if (riskLevel === 'medium') {
      recommendations.push('Enhanced monitoring recommended');
    }

    if (recommendations.length === 0) {
      recommendations.push('Standard monitoring');
    }

    return recommendations;
  }

  /**
   * Save screening result to database
   */
  private async saveScreeningResult(result: WalletScreeningResult): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO wallet_screenings (
        id, wallet_address, chain_id, screening_date, provider,
        risk_score, risk_level, flags, sanctions_match, sanctions_details,
        mixer_exposure, darknet_exposure, gambling_exposure, scam_exposure,
        stolen_funds_exposure, recommendations, tenant_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      result.id,
      result.walletAddress,
      result.chainId,
      result.screeningDate,
      result.provider,
      result.riskScore,
      result.riskLevel,
      result.flags,
      result.sanctionsMatch,
      result.sanctionsDetails ? JSON.stringify(result.sanctionsDetails) : null,
      result.mixerExposure,
      result.darknetExposure,
      result.gamblingExposure,
      result.scamExposure,
      result.stolenFundsExposure,
      result.recommendations,
      result.tenantId,
    ]);
  }

  /**
   * Publish screening events
   */
  private async publishScreeningEvents(result: WalletScreeningResult): Promise<void> {
    const producer = getEventProducer();

    // Publish wallet screened event
    await producer.publishWalletScreened(
      result.id,
      result.walletAddress,
      result.chainId,
      result.provider,
      result.riskScore,
      result.riskLevel,
      result.flags,
      result.sanctionsMatch,
      result.mixerExposure,
      result.darknetExposure,
      result.tenantId
    );

    // Publish sanctions match alert if applicable
    if (result.sanctionsMatch && result.sanctionsDetails && result.sanctionsDetails.length > 0) {
      const firstMatch = result.sanctionsDetails[0];
      if (firstMatch) {
        await producer.publishSanctionsMatchDetected(
          result.id,
          result.walletAddress,
          result.chainId,
          result.sanctionsDetails.map((m) => m.listName),
          firstMatch.matchScore,
          firstMatch.entityName,
          result.recommendations,
          result.tenantId
        );

        logger.logSanctionsMatch(
          result.walletAddress,
          result.sanctionsDetails.map((m) => m.listName),
          firstMatch.matchScore
        );
      }
    }
  }

  /**
   * Get screening result by wallet address (most recent)
   */
  async getScreeningResult(
    walletAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<WalletScreeningResult | null> {
    return await this.getCachedScreening(walletAddress.toLowerCase(), chainId, tenantId);
  }

  /**
   * Get screening history for a wallet
   */
  async getScreeningHistory(
    walletAddress: string,
    chainId: number,
    tenantId: string,
    limit = 10
  ): Promise<WalletScreeningResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<WalletScreeningTable>(`
      SELECT * FROM wallet_screenings
      WHERE wallet_address = $1
        AND chain_id = $2
        AND tenant_id = $3
      ORDER BY screening_date DESC
      LIMIT $4
    `, [walletAddress.toLowerCase(), chainId, tenantId, limit]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Map database table to result type
   */
  private mapTableToResult(row: WalletScreeningTable): WalletScreeningResult {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      chainId: row.chain_id,
      screeningDate: row.screening_date,
      provider: row.provider,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      flags: row.flags as WalletFlag[],
      sanctionsMatch: row.sanctions_match,
      sanctionsDetails: row.sanctions_details ? (row.sanctions_details as unknown as SanctionsMatch[]) : undefined,
      mixerExposure: row.mixer_exposure,
      darknetExposure: row.darknet_exposure,
      gamblingExposure: row.gambling_exposure,
      scamExposure: row.scam_exposure,
      stolenFundsExposure: row.stolen_funds_exposure,
      recommendations: row.recommendations,
      tenantId: row.tenant_id,
    };
  }
}

/**
 * Singleton wallet screening service instance
 */
let walletScreeningServiceInstance: WalletScreeningService | null = null;

/**
 * Get wallet screening service instance
 */
export function getWalletScreeningService(): WalletScreeningService {
  if (!walletScreeningServiceInstance) {
    walletScreeningServiceInstance = new WalletScreeningService();
  }
  return walletScreeningServiceInstance;
}

export default getWalletScreeningService;
