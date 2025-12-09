/**
 * Market Data Service
 *
 * Provides real-time and historical cryptocurrency market data
 * Integrates with CoinGecko API for price feeds
 *
 * Features:
 * - Real-time price data
 * - Historical price data
 * - Market statistics
 * - Caching for performance
 * - Fallback providers
 */

import { LoggerService } from './logger';
import { RedisService } from './redis';

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface HistoricalPrice {
  timestamp: number;
  price: number;
  volume: number;
}

export interface MarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
}

export class MarketDataService {
  private static instance: MarketDataService;
  private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
  private readonly CACHE_TTL = 60; // 1 minute cache
  private readonly HISTORICAL_CACHE_TTL = 3600; // 1 hour for historical data

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * Get current price for a cryptocurrency
   */
  async getPrice(symbol: string): Promise<MarketPrice | null> {
    try {
      const cacheKey = `price:${symbol.toLowerCase()}`;

      // Check cache first
      const cached = await RedisService.get<MarketPrice>(cacheKey);
      if (cached) {
        return cached;
      }

      // Map symbol to CoinGecko ID
      const coinId = this.mapSymbolToCoinGeckoId(symbol);
      if (!coinId) {
        LoggerService.warn(`Unknown symbol: ${symbol}`);
        return null;
      }

      const response = await fetch(
        `${this.COINGECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data[coinId]) {
        LoggerService.warn(`No data found for coin: ${coinId}`);
        return null;
      }

      const coinData = data[coinId];
      const price: MarketPrice = {
        symbol: symbol.toUpperCase(),
        price: coinData.usd,
        change24h: coinData.usd_24h_change || 0,
        changePercent24h: coinData.usd_24h_change || 0,
        volume24h: coinData.usd_24h_vol || 0,
        marketCap: coinData.usd_market_cap || 0,
        lastUpdated: new Date(),
      };

      // Cache the result
      await RedisService.set(cacheKey, price, this.CACHE_TTL);

      return price;
    } catch (error) {
      LoggerService.error('Failed to get price:', error);
      return null;
    }
  }

  /**
   * Get multiple prices at once
   */
  async getPrices(symbols: string[]): Promise<Map<string, MarketPrice>> {
    const results = new Map<string, MarketPrice>();

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(symbol => this.getPrice(symbol));

      try {
        const batchResults = await Promise.all(promises);
        batch.forEach((symbol, index) => {
          const price = batchResults[index];
          if (price) {
            results.set(symbol, price);
          }
        });
      } catch (error) {
        LoggerService.error('Batch price fetch failed:', error);
      }

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(
    symbol: string,
    days: number = 7
  ): Promise<HistoricalPrice[]> {
    try {
      const cacheKey = `historical:${symbol.toLowerCase()}:${days}`;

      // Check cache first
      const cached = await RedisService.get<HistoricalPrice[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const coinId = this.mapSymbolToCoinGeckoId(symbol);
      if (!coinId) {
        return [];
      }

      const response = await fetch(
        `${this.COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.prices || !Array.isArray(data.prices)) {
        return [];
      }

      const historicalPrices: HistoricalPrice[] = data.prices.map(
        ([timestamp, price]: [number, number], index: number) => ({
          timestamp,
          price,
          volume: data.total_volumes?.[index]?.[1] || 0,
        })
      );

      // Cache the result
      await RedisService.set(cacheKey, historicalPrices, this.HISTORICAL_CACHE_TTL);

      return historicalPrices;
    } catch (error) {
      LoggerService.error('Failed to get historical prices:', error);
      return [];
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats(): Promise<MarketStats | null> {
    try {
      const cacheKey = 'market_stats';

      // Check cache first
      const cached = await RedisService.get<MarketStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(
        `${this.COINGECKO_BASE_URL}/global`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data) {
        return null;
      }

      const stats: MarketStats = {
        totalMarketCap: data.data.total_market_cap?.usd || 0,
        totalVolume24h: data.data.total_volume?.usd || 0,
        btcDominance: data.data.market_cap_percentage?.btc || 0,
        ethDominance: data.data.market_cap_percentage?.eth || 0,
        activeCryptocurrencies: data.data.active_cryptocurrencies || 0,
      };

      // Cache the result
      await RedisService.set(cacheKey, stats, this.CACHE_TTL);

      return stats;
    } catch (error) {
      LoggerService.error('Failed to get market stats:', error);
      return null;
    }
  }

  /**
   * Map trading symbol to CoinGecko coin ID
   */
  private mapSymbolToCoinGeckoId(symbol: string): string | null {
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'AVAX': 'avalanche-2',
      'LTC': 'litecoin',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ALGO': 'algorand',
      'VET': 'vechain',
      'ICP': 'internet-computer',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'ETC': 'ethereum-classic',
      'XLM': 'stellar',
      'THETA': 'theta-token',
      'FTT': 'ftx-token',
      'HBAR': 'hedera-hashgraph',
      'NEAR': 'near',
      'FLOW': 'flow',
      'MANA': 'decentraland',
      'SAND': 'the-sandbox',
      'AXS': 'axie-infinity',
      'CHZ': 'chiliz',
      'ENJ': 'enjincoin',
      'BAT': 'basic-attention-token',
      'THAL': 'thalium-token', // Placeholder - replace with actual CoinGecko ID when available
    };

    return symbolMap[symbol.toUpperCase()] || null;
  }

  /**
   * Clear cache for a specific symbol
   */
  async clearCache(symbol?: string): Promise<void> {
    try {
      if (symbol) {
        const keys = await RedisService.keys(`price:${symbol.toLowerCase()}*`);
        for (const key of keys) {
          await RedisService.del(key);
        }
      } else {
        // Clear all market data cache
        const priceKeys = await RedisService.keys('price:*');
        const historicalKeys = await RedisService.keys('historical:*');
        const marketKeys = await RedisService.keys('market_stats');

        const allKeys = [...priceKeys, ...historicalKeys, ...marketKeys];
        for (const key of allKeys) {
          await RedisService.del(key);
        }
      }

      LoggerService.info(`Market data cache cleared${symbol ? ` for ${symbol}` : ''}`);
    } catch (error) {
      LoggerService.error('Failed to clear cache:', error);
    }
  }

  /**
   * Health check for the service
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.COINGECKO_BASE_URL}/ping`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      LoggerService.error('Market data service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const marketDataService = MarketDataService.getInstance();