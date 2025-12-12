/**
 * Wash Trading Detection Service for NFT Compliance
 * Detects wash trading patterns in NFT transactions
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import {
  WashTradingResult,
  WashTradingIndicator,
} from '../../types/compliance';
import {
  WashTradingTable,
  NFTSaleTable,
} from '../../types/database';

const logger = createComponentLogger('wash-trading-service');

/**
 * Wash trading detection configuration
 */
interface WashTradingConfig {
  lookbackDays: number;
  minConfidence: number;
  selfTradingThreshold: number;
  circularTradingDepth: number;
  rapidFlippingHours: number;
  rapidFlippingCount: number;
  priceManipulationThreshold: number;
  volumeInflationThreshold: number;
  newWalletAgeDays: number;
}


/**
 * Wash Trading Detection Service
 */
export class WashTradingService {
  private config: WashTradingConfig;

  constructor() {
    const appConfig = getConfig();
    this.config = {
      lookbackDays: appConfig.washTradingDetection.lookbackDays,
      minConfidence: appConfig.washTradingDetection.minConfidence,
      selfTradingThreshold: 1, // Any self-trading is suspicious
      circularTradingDepth: 5, // Check up to 5 hops
      rapidFlippingHours: 24, // Within 24 hours
      rapidFlippingCount: 3, // 3+ sales is suspicious
      priceManipulationThreshold: 50, // 50% price change
      volumeInflationThreshold: 200, // 200% above average
      newWalletAgeDays: 7, // Wallets less than 7 days old
    };
  }

  /**
   * Analyze a sale for wash trading
   */
  async analyzeSale(
    saleId: string,
    contractAddress: string,
    tokenId: string,
    chainId: number,
    sellerAddress: string,
    buyerAddress: string,
    _price: string,
    priceUSD: string,
    tenantId: string
  ): Promise<WashTradingResult> {
    const startTime = Date.now();
    logger.info('Analyzing sale for wash trading', {
      saleId,
      contractAddress,
      tokenId,
      chainId,
    });

    const indicators: WashTradingIndicator[] = [];
    const relatedTransactions: string[] = [];
    const relatedAddresses: string[] = [];
    let volumeInflation: string | undefined;
    let priceManipulation = false;

    try {
      // Check for self-trading
      if (await this.checkSelfTrading(sellerAddress, buyerAddress)) {
        indicators.push('self_trading');
        relatedAddresses.push(sellerAddress);
      }

      // Check for circular trading
      const circularResult = await this.checkCircularTrading(
        contractAddress,
        tokenId,
        chainId,
        sellerAddress,
        buyerAddress,
        tenantId
      );
      if (circularResult.isCircular) {
        indicators.push('circular_trading');
        relatedTransactions.push(...circularResult.transactions);
        relatedAddresses.push(...circularResult.addresses);
      }

      // Check for rapid flipping
      const rapidFlipResult = await this.checkRapidFlipping(
        contractAddress,
        tokenId,
        chainId,
        tenantId
      );
      if (rapidFlipResult.isRapidFlipping) {
        indicators.push('rapid_flipping');
        relatedTransactions.push(...rapidFlipResult.transactions);
      }

      // Check for price manipulation
      const priceResult = await this.checkPriceManipulation(
        contractAddress,
        tokenId,
        chainId,
        parseFloat(priceUSD),
        tenantId
      );
      if (priceResult.isManipulated) {
        indicators.push('price_manipulation');
        priceManipulation = true;
      }

      // Check for volume inflation
      const volumeResult = await this.checkVolumeInflation(
        contractAddress,
        chainId,
        tenantId
      );
      if (volumeResult.isInflated) {
        indicators.push('volume_inflation');
        volumeInflation = volumeResult.inflationPercentage.toString();
      }

      // Check for related wallets (funding patterns)
      const fundingResult = await this.checkFundingPatterns(
        sellerAddress,
        buyerAddress,
        chainId
      );
      if (fundingResult.areRelated) {
        indicators.push('related_wallets');
        indicators.push('funding_pattern');
        relatedAddresses.push(...fundingResult.relatedAddresses);
      }

      // Check for timing patterns
      const timingResult = await this.checkTimingPatterns(
        contractAddress,
        tokenId,
        chainId,
        tenantId
      );
      if (timingResult.isSuspicious) {
        indicators.push('timing_pattern');
      }

      // Check for new wallet activity
      const newWalletResult = await this.checkNewWalletActivity(
        sellerAddress,
        buyerAddress,
        chainId
      );
      if (newWalletResult.hasNewWallet) {
        indicators.push('new_wallet_activity');
      }

      // Calculate confidence score
      const confidence = this.calculateConfidence(indicators);
      const isWashTrading = confidence >= this.config.minConfidence;

      // Create result
      const result: WashTradingResult = {
        id: uuidv4(),
        contractAddress,
        tokenId,
        chainId,
        detectionDate: new Date(),
        isWashTrading,
        confidence,
        indicators,
        relatedTransactions: [...new Set(relatedTransactions)],
        relatedAddresses: [...new Set(relatedAddresses)],
        volumeInflation,
        priceManipulation,
        tenantId,
      };

      // Save result to database
      await this.saveResult(result);

      // Publish event if wash trading detected
      if (isWashTrading) {
        await this.publishWashTradingDetected(result);
      }

      const duration = Date.now() - startTime;
      logger.logWashTradingEvent(
        isWashTrading ? 'detected' : 'cleared',
        result.id,
        contractAddress,
        tokenId,
        confidence,
        { durationMs: duration, indicatorCount: indicators.length }
      );

      return result;
    } catch (error) {
      logger.error('Failed to analyze sale for wash trading', {
        saleId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Check for self-trading (same address buying and selling)
   */
  private async checkSelfTrading(
    sellerAddress: string,
    buyerAddress: string
  ): Promise<boolean> {
    return sellerAddress.toLowerCase() === buyerAddress.toLowerCase();
  }

  /**
   * Check for circular trading patterns
   */
  private async checkCircularTrading(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    sellerAddress: string,
    buyerAddress: string,
    tenantId: string
  ): Promise<{ isCircular: boolean; transactions: string[]; addresses: string[] }> {
    const db = getDatabaseService();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // Get transaction history for this token
    const transactions = await db.queryAll<NFTSaleTable>(`
      SELECT * FROM nft_sales
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
        AND timestamp >= $5
      ORDER BY timestamp DESC
      LIMIT 50
    `, [contractAddress, tokenId, chainId, tenantId, lookbackDate]);

    if (transactions.length < 2) {
      return { isCircular: false, transactions: [], addresses: [] };
    }

    // Build address graph
    const addressGraph = new Map<string, Set<string>>();
    const transactionIds: string[] = [];

    for (const tx of transactions) {
      const seller = tx.seller_address.toLowerCase();
      const buyer = tx.buyer_address.toLowerCase();

      if (!addressGraph.has(seller)) {
        addressGraph.set(seller, new Set());
      }
      addressGraph.get(seller)!.add(buyer);
      transactionIds.push(tx.id);
    }

    // Check if buyer has sold back to seller (or through intermediaries)
    const visited = new Set<string>();
    const path: string[] = [];

    const hasCircle = this.findCircularPath(
      addressGraph,
      buyerAddress.toLowerCase(),
      sellerAddress.toLowerCase(),
      visited,
      path,
      this.config.circularTradingDepth
    );

    if (hasCircle) {
      return {
        isCircular: true,
        transactions: transactionIds,
        addresses: path,
      };
    }

    return { isCircular: false, transactions: [], addresses: [] };
  }

  /**
   * Find circular path in address graph using DFS
   */
  private findCircularPath(
    graph: Map<string, Set<string>>,
    current: string,
    target: string,
    visited: Set<string>,
    path: string[],
    maxDepth: number
  ): boolean {
    if (maxDepth === 0) return false;
    if (current === target && path.length > 0) return true;
    if (visited.has(current)) return false;

    visited.add(current);
    path.push(current);

    const neighbors = graph.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (this.findCircularPath(graph, neighbor, target, visited, path, maxDepth - 1)) {
          return true;
        }
      }
    }

    path.pop();
    return false;
  }

  /**
   * Check for rapid flipping (multiple sales in short time)
   */
  private async checkRapidFlipping(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    tenantId: string
  ): Promise<{ isRapidFlipping: boolean; transactions: string[] }> {
    const db = getDatabaseService();
    const lookbackDate = new Date();
    lookbackDate.setHours(lookbackDate.getHours() - this.config.rapidFlippingHours);

    const recentSales = await db.queryAll<NFTSaleTable>(`
      SELECT * FROM nft_sales
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
        AND timestamp >= $5
      ORDER BY timestamp DESC
    `, [contractAddress, tokenId, chainId, tenantId, lookbackDate]);

    if (recentSales.length >= this.config.rapidFlippingCount) {
      return {
        isRapidFlipping: true,
        transactions: recentSales.map((s) => s.id),
      };
    }

    return { isRapidFlipping: false, transactions: [] };
  }

  /**
   * Check for price manipulation
   */
  private async checkPriceManipulation(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    currentPriceUSD: number,
    tenantId: string
  ): Promise<{ isManipulated: boolean }> {
    const db = getDatabaseService();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // Get average price for this token
    const result = await db.queryOne<{ avg_price: string }>(`
      SELECT AVG(CAST(price_usd AS DECIMAL)) as avg_price
      FROM nft_sales
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
        AND timestamp >= $5
    `, [contractAddress, tokenId, chainId, tenantId, lookbackDate]);

    if (!result || !result.avg_price) {
      return { isManipulated: false };
    }

    const avgPrice = parseFloat(result.avg_price);
    if (avgPrice === 0) {
      return { isManipulated: false };
    }

    const priceChange = Math.abs((currentPriceUSD - avgPrice) / avgPrice) * 100;

    return {
      isManipulated: priceChange > this.config.priceManipulationThreshold,
    };
  }

  /**
   * Check for volume inflation
   */
  private async checkVolumeInflation(
    contractAddress: string,
    chainId: number,
    tenantId: string
  ): Promise<{ isInflated: boolean; inflationPercentage: number }> {
    const db = getDatabaseService();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // Get collection volume
    const collectionVolume = await db.queryOne<{ total_volume: string }>(`
      SELECT SUM(CAST(price_usd AS DECIMAL)) as total_volume
      FROM nft_sales
      WHERE contract_address = $1
        AND chain_id = $2
        AND tenant_id = $3
        AND timestamp >= $4
    `, [contractAddress, chainId, tenantId, lookbackDate]);

    // Get average collection volume across all collections
    const avgVolume = await db.queryOne<{ avg_volume: string }>(`
      SELECT AVG(collection_volume) as avg_volume
      FROM (
        SELECT SUM(CAST(price_usd AS DECIMAL)) as collection_volume
        FROM nft_sales
        WHERE chain_id = $1
          AND tenant_id = $2
          AND timestamp >= $3
        GROUP BY contract_address
      ) as volumes
    `, [chainId, tenantId, lookbackDate]);

    if (!collectionVolume?.total_volume || !avgVolume?.avg_volume) {
      return { isInflated: false, inflationPercentage: 0 };
    }

    const totalVolume = parseFloat(collectionVolume.total_volume);
    const averageVolume = parseFloat(avgVolume.avg_volume);

    if (averageVolume === 0) {
      return { isInflated: false, inflationPercentage: 0 };
    }

    const inflationPercentage = ((totalVolume - averageVolume) / averageVolume) * 100;

    return {
      isInflated: inflationPercentage > this.config.volumeInflationThreshold,
      inflationPercentage,
    };
  }

  /**
   * Check for funding patterns between addresses
   */
  private async checkFundingPatterns(
    sellerAddress: string,
    buyerAddress: string,
    _chainId: number
  ): Promise<{ areRelated: boolean; relatedAddresses: string[] }> {
    // This would typically involve blockchain analysis
    // For now, we'll implement a simplified version
    // In production, this would query blockchain data for:
    // - Common funding sources
    // - Direct transfers between addresses
    // - Shared contract interactions

    // Placeholder implementation
    const seller = sellerAddress.toLowerCase();
    const buyer = buyerAddress.toLowerCase();

    // Check if addresses share common prefix (potential vanity address pattern)
    if (seller.substring(0, 6) === buyer.substring(0, 6)) {
      return {
        areRelated: true,
        relatedAddresses: [seller, buyer],
      };
    }

    return { areRelated: false, relatedAddresses: [] };
  }

  /**
   * Check for suspicious timing patterns
   */
  private async checkTimingPatterns(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    tenantId: string
  ): Promise<{ isSuspicious: boolean }> {
    const db = getDatabaseService();
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // Check for sales at regular intervals (bot-like behavior)
    const sales = await db.queryAll<{ timestamp: Date }>(`
      SELECT timestamp
      FROM nft_sales
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
        AND timestamp >= $5
      ORDER BY timestamp ASC
    `, [contractAddress, tokenId, chainId, tenantId, lookbackDate]);

    if (sales.length < 3) {
      return { isSuspicious: false };
    }

    // Calculate intervals between sales
    const intervals: number[] = [];
    for (let i = 1; i < sales.length; i++) {
      const currentSale = sales[i];
      const previousSale = sales[i - 1];
      if (currentSale && previousSale) {
        const interval = new Date(currentSale.timestamp).getTime() - new Date(previousSale.timestamp).getTime();
        intervals.push(interval);
      }
    }

    // Check if intervals are suspiciously regular
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is very low relative to average, timing is suspicious
    const coefficientOfVariation = stdDev / avgInterval;

    return {
      isSuspicious: coefficientOfVariation < 0.1, // Less than 10% variation
    };
  }

  /**
   * Check for new wallet activity
   */
  private async checkNewWalletActivity(
    _sellerAddress: string,
    _buyerAddress: string,
    _chainId: number
  ): Promise<{ hasNewWallet: boolean }> {
    // This would typically involve blockchain analysis
    // For now, we'll implement a simplified version
    // In production, this would query blockchain data for wallet age

    // Placeholder - in production, check wallet creation date
    // For now, return false as we can't determine wallet age without blockchain data
    return { hasNewWallet: false };
  }

  /**
   * Calculate confidence score based on indicators
   */
  private calculateConfidence(indicators: WashTradingIndicator[]): number {
    const weights: Record<WashTradingIndicator, number> = {
      self_trading: 100,
      circular_trading: 80,
      rapid_flipping: 40,
      price_manipulation: 50,
      volume_inflation: 30,
      related_wallets: 60,
      funding_pattern: 70,
      timing_pattern: 30,
      gas_funding: 50,
      new_wallet_activity: 20,
    };

    if (indicators.length === 0) {
      return 0;
    }

    // Calculate weighted score
    let totalWeight = 0;
    for (const indicator of indicators) {
      totalWeight += weights[indicator] || 0;
    }

    // Normalize to 0-100 scale
    // Maximum possible score would be sum of all weights
    const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
    const normalizedScore = Math.min(100, (totalWeight / maxScore) * 100 * 2); // Scale up

    return Math.round(normalizedScore);
  }

  /**
   * Save wash trading result to database
   */
  private async saveResult(result: WashTradingResult): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO wash_trading_detections (
        id, contract_address, token_id, chain_id, detection_date,
        is_wash_trading, confidence, indicators, related_transactions,
        related_addresses, volume_inflation, price_manipulation, tenant_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      result.id,
      result.contractAddress,
      result.tokenId,
      result.chainId,
      result.detectionDate,
      result.isWashTrading,
      result.confidence,
      result.indicators,
      result.relatedTransactions,
      result.relatedAddresses,
      result.volumeInflation,
      result.priceManipulation,
      result.tenantId,
    ]);
  }

  /**
   * Publish wash trading detected event
   */
  private async publishWashTradingDetected(result: WashTradingResult): Promise<void> {
    const producer = getEventProducer();

    await producer.publishWashTradingDetected(
      result.id,
      result.contractAddress,
      result.tokenId,
      result.chainId,
      result.confidence,
      result.indicators,
      result.relatedTransactions,
      result.relatedAddresses,
      result.priceManipulation ?? false,
      result.tenantId,
      undefined,
      result.volumeInflation
    );
  }

  /**
   * Get wash trading history for a token
   */
  async getTokenHistory(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    tenantId: string
  ): Promise<WashTradingResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<WashTradingTable>(`
      SELECT * FROM wash_trading_detections
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
      ORDER BY detection_date DESC
    `, [contractAddress, tokenId, chainId, tenantId]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Get wash trading history for a collection
   */
  async getCollectionHistory(
    contractAddress: string,
    chainId: number,
    tenantId: string,
    limit = 100
  ): Promise<WashTradingResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<WashTradingTable>(`
      SELECT * FROM wash_trading_detections
      WHERE contract_address = $1
        AND chain_id = $2
        AND tenant_id = $3
      ORDER BY detection_date DESC
      LIMIT $4
    `, [contractAddress, chainId, tenantId, limit]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Map database table to result type
   */
  private mapTableToResult(row: WashTradingTable): WashTradingResult {
    return {
      id: row.id,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      chainId: row.chain_id,
      detectionDate: row.detection_date,
      isWashTrading: row.is_wash_trading,
      confidence: row.confidence,
      indicators: row.indicators as WashTradingIndicator[],
      relatedTransactions: row.related_transactions,
      relatedAddresses: row.related_addresses,
      volumeInflation: row.volume_inflation ?? undefined,
      priceManipulation: row.price_manipulation ?? undefined,
      tenantId: row.tenant_id,
    };
  }
}

/**
 * Singleton wash trading service instance
 */
let washTradingServiceInstance: WashTradingService | null = null;

/**
 * Get wash trading service instance
 */
export function getWashTradingService(): WashTradingService {
  if (!washTradingServiceInstance) {
    washTradingServiceInstance = new WashTradingService();
  }
  return washTradingServiceInstance;
}

export default getWashTradingService;
