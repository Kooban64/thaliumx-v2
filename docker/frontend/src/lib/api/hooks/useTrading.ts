import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useTradingStore } from '@/stores/tradingStore';
import type { Order, OrderRequest, OrderBook, MarketData } from '@/types/trading';

/**
 * useOrders - Get orders for current user
 */
export function useOrders(exchange?: 'cex' | 'omni' | 'dex', status?: string) {
  const { selectedExchange } = useTradingStore();
  const activeExchange = exchange || selectedExchange;

  return useQuery<Order[]>({
    queryKey: ['trading', 'orders', activeExchange, status],
    queryFn: async () => {
      let endpoint = '';
      switch (activeExchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders';
          break;
        case 'dex':
          endpoint = '/api/dex/trades';
          break;
        default:
          endpoint = '/api/native-cex/orders';
      }

      if (status) {
        endpoint += `?status=${status}`;
      }

      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        const data = response.data as any;
        return Array.isArray(data) ? data : (data.orders || []);
      }
      throw new Error(response.error || 'Failed to fetch orders');
    },
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
  });
}

/**
 * useOpenOrders - Get open orders
 */
export function useOpenOrders(exchange?: 'cex' | 'omni' | 'dex') {
  return useOrders(exchange, 'open');
}

/**
 * useOrderHistory - Get order history
 */
export function useOrderHistory(exchange?: 'cex' | 'omni' | 'dex') {
  return useOrders(exchange, 'closed');
}

/**
 * useOrderBook - Get order book for symbol
 */
export function useOrderBook(symbol: string, exchange?: 'cex' | 'omni' | 'dex') {
  const { selectedExchange } = useTradingStore();
  const activeExchange = exchange || selectedExchange;

  return useQuery<OrderBook>({
    queryKey: ['trading', 'orderbook', activeExchange, symbol],
    queryFn: async () => {
      let endpoint = '';
      const symbolFormatted = symbol.replace('/', '');
      
      switch (activeExchange) {
        case 'cex':
          endpoint = `/api/native-cex/orderbook/${symbolFormatted}`;
          break;
        case 'omni':
          endpoint = `/api/omni-exchange/orderbook/${symbolFormatted}`;
          break;
        case 'dex':
          // DEX might not have traditional order book
          return { bids: [], asks: [], timestamp: Date.now() };
        default:
          endpoint = `/api/native-cex/orderbook/${symbolFormatted}`;
      }

      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        const data = response.data as any;
        const orderBook = data.orderBook || data;
        return {
          bids: orderBook.bids || [],
          asks: orderBook.asks || [],
          timestamp: orderBook.timestamp || Date.now(),
          exchange: orderBook.exchange,
        };
      }
      throw new Error(response.error || 'Failed to fetch order book');
    },
    staleTime: 2 * 1000, // 2 seconds
    refetchInterval: 2 * 1000, // Refetch every 2 seconds
  });
}

/**
 * useMarketData - Get market data for symbol
 */
export function useMarketData(symbol: string) {
  return useQuery<MarketData>({
    queryKey: ['trading', 'market-data', symbol],
    queryFn: async () => {
      const symbolFormatted = symbol.replace('/', '');
      const response = await apiClient.get(`/api/market/prices/${symbolFormatted}`);
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        const data = responseData.data || responseData;
        return {
          symbol,
          price: data.price || 0,
          change24h: data.change24h || 0,
          changePercent24h: data.changePercent24h || 0,
          high24h: data.high24h || 0,
          low24h: data.low24h || 0,
          volume24h: data.volume24h || 0,
          timestamp: Date.now(),
        };
      }
      throw new Error(response.error || 'Failed to fetch market data');
    },
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 5 * 1000, // Refetch every 5 seconds
  });
}

/**
 * usePlaceOrder - Place a trading order
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const { selectedExchange, addOrder } = useTradingStore();

  return useMutation({
    mutationFn: async (orderRequest: OrderRequest) => {
      let endpoint = '';
      const exchange = orderRequest.exchange || selectedExchange;

      switch (exchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders';
          break;
        case 'dex':
          endpoint = '/api/dex/swap';
          break;
        default:
          endpoint = '/api/native-cex/orders';
      }

      const response = await apiClient.post(endpoint, orderRequest);
      if (response.success && response.data) {
        const data = response.data as any;
        const order = data.order || data;
        addOrder(order);
        return order;
      }
      throw new Error(response.error || 'Failed to place order');
    },
    onSuccess: () => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ['trading', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['trading', 'open-orders'] });
    },
  });
}

/**
 * useCancelOrder - Cancel an order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { selectedExchange, removeOrder } = useTradingStore();

  return useMutation({
    mutationFn: async (orderId: string) => {
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = `/api/native-cex/orders/${orderId}`;
          break;
        case 'omni':
          endpoint = `/api/omni-exchange/orders/${orderId}`;
          break;
        case 'dex':
          throw new Error('DEX orders cannot be cancelled');
        default:
          endpoint = `/api/native-cex/orders/${orderId}`;
      }

      const response = await apiClient.delete(endpoint);
      if (response.success) {
        removeOrder(orderId);
        return true;
      }
      throw new Error(response.error || 'Failed to cancel order');
    },
    onSuccess: () => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ['trading', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['trading', 'open-orders'] });
    },
  });
}

/**
 * useTradingBalance - Get trading balance for exchange
 */
export function useTradingBalance(exchange?: 'cex' | 'omni' | 'dex', currency?: string) {
  const { selectedExchange } = useTradingStore();
  const activeExchange = exchange || selectedExchange;

  return useQuery<{ available: number; locked: number; total: number; currency: string }>({
    queryKey: ['trading', 'balance', activeExchange, currency],
    queryFn: async () => {
      let endpoint = '';
      
      switch (activeExchange) {
        case 'cex':
          endpoint = '/api/native-cex/balance';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/balance';
          break;
        case 'dex':
          // DEX uses Web3 wallets, not traditional balances
          return { available: 0, locked: 0, total: 0, currency: currency || 'USDT' };
        default:
          endpoint = '/api/native-cex/balance';
      }

      if (currency) {
        endpoint += `?currency=${currency}`;
      }

      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        const responseData = response.data as any;
        const data = responseData.data || responseData;
        return {
          available: data.available || 0,
          locked: data.locked || 0,
          total: data.total || 0,
          currency: data.currency || currency || 'USDT',
        };
      }
      throw new Error(response.error || 'Failed to fetch balance');
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

/**
 * useExchangeHealth - Get exchange health status (for Omni-Exchange)
 */
export function useExchangeHealth() {
  return useQuery<Array<{
    name: string;
    status: 'online' | 'offline' | 'maintenance';
    responseTime: number;
    uptime: number;
    lastCheck: string;
  }>>({
    queryKey: ['trading', 'exchange-health'],
    queryFn: async () => {
      const response = await apiClient.get('/api/omni-exchange/exchanges/health');
      if (response.success && response.data) {
        const data = response.data as any;
        return data.data || data.health || [];
      }
      throw new Error(response.error || 'Failed to fetch exchange health');
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}
