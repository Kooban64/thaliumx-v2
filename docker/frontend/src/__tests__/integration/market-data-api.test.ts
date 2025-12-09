/**
 * Integration Tests for Market Data API
 *
 * Tests the market data API endpoints to ensure they work correctly
 * with real API calls (mocked for testing)
 */

import { marketDataService } from '../../lib/api/market-data';

// Mock fetch for testing
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Market Data API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Price API', () => {
    it('should fetch BTC price successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          symbol: 'BTC',
          price: 45000,
          change24h: 2.5,
          changePercent24h: 2.5,
          volume24h: 1000000000,
          marketCap: 850000000000,
          lastUpdated: new Date(),
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await marketDataService.getPrice('BTC');

      expect(mockFetch).toHaveBeenCalledWith('/api/market/prices/BTC');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } }),
      } as Response);

      const result = await marketDataService.getPrice('BTC');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await marketDataService.getPrice('BTC');

      expect(result).toBeNull();
    });
  });

  describe('Historical Data API', () => {
    it('should fetch historical BTC data', async () => {
      const mockHistoricalData = [
        { timestamp: 1640995200, price: 45000, volume: 1000000 },
        { timestamp: 1641081600, price: 46000, volume: 1100000 },
      ];

      const mockResponse = {
        success: true,
        data: {
          symbol: 'BTC',
          days: 7,
          prices: mockHistoricalData,
          count: 2,
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await marketDataService.getHistoricalPrices('BTC', 7);

      expect(mockFetch).toHaveBeenCalledWith('/api/market/historical/BTC?days=7');
      expect(result).toEqual(mockHistoricalData);
    });
  });

  describe('Market Stats API', () => {
    it('should fetch market statistics', async () => {
      const mockStats = {
        totalMarketCap: 2000000000000,
        totalVolume24h: 100000000000,
        btcDominance: 45.2,
        ethDominance: 18.5,
        activeCryptocurrencies: 5000,
      };

      const mockResponse = {
        success: true,
        data: mockStats,
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await marketDataService.getMarketStats();

      expect(mockFetch).toHaveBeenCalledWith('/api/market/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('Multiple Prices API', () => {
    it('should fetch multiple prices at once', async () => {
      const mockPrices = {
        BTC: {
          symbol: 'BTC',
          price: 45000,
          change24h: 2.5,
          changePercent24h: 2.5,
          volume24h: 1000000000,
          marketCap: 850000000000,
          lastUpdated: new Date(),
        },
        ETH: {
          symbol: 'ETH',
          price: 3000,
          change24h: -1.2,
          changePercent24h: -1.2,
          volume24h: 500000000,
          marketCap: 350000000000,
          lastUpdated: new Date(),
        },
      };

      const mockResponse = {
        success: true,
        data: {
          prices: mockPrices,
          count: 2,
          requested: 2,
          found: 2,
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await marketDataService.getPrices(['BTC', 'ETH']);

      expect(mockFetch).toHaveBeenCalledWith('/api/market/prices?symbols=BTC,ETH');
      expect(result.size).toBe(2);
      expect(result.get('BTC')).toEqual(mockPrices.BTC);
      expect(result.get('ETH')).toEqual(mockPrices.ETH);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
          },
        }),
      } as Response);

      const result = await marketDataService.getPrice('BTC');

      expect(result).toBeNull();
    });

    it('should handle invalid symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 'NOT_FOUND',
            message: 'Symbol not found',
          },
        }),
      } as Response);

      const result = await marketDataService.getPrice('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('Caching Behavior', () => {
    it('should cache successful responses', async () => {
      const mockResponse = {
        success: true,
        data: {
          symbol: 'BTC',
          price: 45000,
          change24h: 2.5,
          changePercent24h: 2.5,
          volume24h: 1000000000,
          marketCap: 850000000000,
          lastUpdated: new Date(),
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // First call
      await marketDataService.getPrice('BTC');

      // Second call should use cache (fetch called only once)
      await marketDataService.getPrice('BTC');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});