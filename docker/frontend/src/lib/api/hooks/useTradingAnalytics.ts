import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import type { TradingAnalytics } from '@/types/trading';

interface TradingAnalyticsParams {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  exchange?: 'cex' | 'omni' | 'dex';
}

/**
 * useTradingAnalytics - Get trading analytics and performance metrics
 */
export function useTradingAnalytics(params?: TradingAnalyticsParams) {
  return useQuery<TradingAnalytics>({
    queryKey: ['trading', 'analytics', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.symbol) queryParams.append('symbol', params.symbol);
      if (params?.exchange) queryParams.append('exchange', params.exchange);

      const endpoint = `/api/trading/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(endpoint);

      if (response.success && response.data) {
        const responseData = response.data as any;
        const data = responseData.data || responseData;
        return {
          totalTrades: data.totalTrades || 0,
          totalVolume: data.totalVolume || 0,
          totalProfit: data.totalProfit || 0,
          totalLoss: data.totalLoss || 0,
          winRate: data.winRate || 0,
          averageProfit: data.averageProfit || 0,
          averageLoss: data.averageLoss || 0,
          profitFactor: data.profitFactor || 0,
          sharpeRatio: data.sharpeRatio || 0,
          maxDrawdown: data.maxDrawdown || 0,
          period: {
            start: data.period?.start || new Date().toISOString(),
            end: data.period?.end || new Date().toISOString(),
          },
        };
      }
      throw new Error(response.error || 'Failed to fetch trading analytics');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * useTradingPerformance - Get trading performance over time
 */
export function useTradingPerformance(period: 'day' | 'week' | 'month' | 'year' = 'month') {
  return useQuery<Array<{ date: string; pnl: number; trades: number; volume: number }>>({
    queryKey: ['trading', 'performance', period],
    queryFn: async () => {
      const response = await apiClient.get(`/api/trading/performance?period=${period}`);
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.performance || [];
      }
      throw new Error(response.error || 'Failed to fetch trading performance');
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
