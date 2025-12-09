/**
 * Market Data API Client
 *
 * Client-side API client for market data endpoints
 * Provides methods to fetch cryptocurrency prices and market data
 */

import { apiCall } from '../error-handling';

// Type definitions for market data
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
      const response = await apiCall<MarketPrice>(`/api/market/prices/${symbol}`);

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch price:', error);
      return null;
    }
  }

  /**
   * Get multiple prices at once
   */
  async getPrices(symbols: string[]): Promise<Map<string, MarketPrice>> {
    try {
      const symbolsParam = symbols.join(',');
      const response = await apiCall<{ prices: Record<string, MarketPrice> }>(
        `/api/market/prices?symbols=${symbolsParam}`
      );

      if (response.success && response.data?.prices) {
        return new Map(Object.entries(response.data.prices));
      }

      return new Map();
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      return new Map();
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(symbol: string, days: number = 7): Promise<HistoricalPrice[]> {
    try {
      const response = await apiCall<{ prices: HistoricalPrice[] }>(
        `/api/market/historical/${symbol}?days=${days}`
      );

      if (response.success && response.data?.prices) {
        return response.data.prices;
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch historical prices:', error);
      return [];
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats(): Promise<MarketStats | null> {
    try {
      const response = await apiCall<MarketStats>('/api/market/stats');

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch market stats:', error);
      return null;
    }
  }

  /**
   * Health check for market data service
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await apiCall<{ status: string }>(`/api/market/health`);
      return response.success && response.data?.status === 'healthy';
    } catch (error) {
      console.error('Market data health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const marketDataService = MarketDataService.getInstance();