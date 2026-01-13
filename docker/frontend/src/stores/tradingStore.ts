import { create } from 'zustand';
import type { Order, OrderRequest, TradingPair } from '@/types/trading';

export type ExchangeType = 'cex' | 'omni' | 'dex';

interface TradingState {
  // Exchange selection
  selectedExchange: ExchangeType;
  selectedSymbol: string;
  selectedPair: TradingPair | null;
  
  // Orders
  orders: Order[];
  openOrders: Order[];
  orderHistory: Order[];
  
  // Market data
  currentPrice: number | null;
  priceChange24h: number | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSelectedExchange: (exchange: ExchangeType) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedPair: (pair: TradingPair | null) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  removeOrder: (orderId: string) => void;
  setOpenOrders: (orders: Order[]) => void;
  setOrderHistory: (orders: Order[]) => void;
  setCurrentPrice: (price: number | null) => void;
  setPriceChange24h: (change: number | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Trading operations (to be implemented with API)
  placeOrder: (orderRequest: OrderRequest) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchOpenOrders: () => Promise<void>;
  fetchOrderHistory: () => Promise<void>;
  
  // Clear state
  clear: () => void;
}

const initialState = {
  selectedExchange: 'cex' as ExchangeType,
  selectedSymbol: 'BTC/USDT',
  selectedPair: null,
  orders: [],
  openOrders: [],
  orderHistory: [],
  currentPrice: null,
  priceChange24h: null,
  isLoading: false,
  error: null,
};

/**
 * Trading Store - Manages trading state and operations
 */
export const useTradingStore = create<TradingState>((set, get) => ({
  ...initialState,

  setSelectedExchange: (exchange) => {
    set({ selectedExchange: exchange });
    // Reset orders when switching exchanges
    set({ orders: [], openOrders: [], orderHistory: [] });
  },

  setSelectedSymbol: (symbol) => {
    set({ selectedSymbol: symbol });
  },

  setSelectedPair: (pair) => {
    set({ selectedPair: pair });
  },

  setOrders: (orders) => set({ orders }),

  addOrder: (order) => {
    set((state) => ({
      orders: [...state.orders, order],
      openOrders: order.status === 'open' || order.status === 'pending' 
        ? [...state.openOrders, order]
        : state.openOrders,
    }));
  },

  updateOrder: (orderId, updates) => {
    set((state) => {
      const updatedOrders = state.orders.map((order) =>
        order.id === orderId ? { ...order, ...updates } : order
      );
      const updatedOpenOrders = updatedOrders.filter(
        (order) => order.status === 'open' || order.status === 'pending'
      );
      return {
        orders: updatedOrders,
        openOrders: updatedOpenOrders,
      };
    });
  },

  removeOrder: (orderId) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId),
      openOrders: state.openOrders.filter((order) => order.id !== orderId),
    }));
  },

  setOpenOrders: (orders) => set({ openOrders: orders }),

  setOrderHistory: (orders) => set({ orderHistory: orders }),

  setCurrentPrice: (price) => set({ currentPrice: price }),

  setPriceChange24h: (change) => set({ priceChange24h: change }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  placeOrder: async (orderRequest) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Implement API call based on selected exchange
      const { selectedExchange } = get();
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders';
          break;
        case 'dex':
          endpoint = '/api/dex/swap';
          break;
      }
      
      // Placeholder - will be implemented with actual API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderRequest),
      });
      
      if (!response.ok) {
        throw new Error('Failed to place order');
      }
      
      const data = await response.json();
      const order = data.data || data;
      
      get().addOrder(order);
      set({ isLoading: false });
      
      return order;
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  cancelOrder: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const { selectedExchange } = get();
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = `/api/native-cex/orders/${orderId}`;
          break;
        case 'omni':
          endpoint = `/api/omni-exchange/orders/${orderId}`;
          break;
        case 'dex':
          // DEX orders typically can't be cancelled once submitted
          throw new Error('DEX orders cannot be cancelled');
      }
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }
      
      get().removeOrder(orderId);
      set({ isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel order';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedExchange } = get();
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders';
          break;
        case 'dex':
          endpoint = '/api/dex/trades';
          break;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      const orders = data.data || data.orders || [];
      
      set({ orders, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch orders';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchOpenOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedExchange } = get();
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders?status=open';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders?status=open';
          break;
        case 'dex':
          // DEX doesn't have open orders in the same way
          set({ openOrders: [], isLoading: false });
          return;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch open orders');
      }
      
      const data = await response.json();
      const openOrders = data.data || data.orders || [];
      
      set({ openOrders, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch open orders';
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchOrderHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedExchange } = get();
      let endpoint = '';
      
      switch (selectedExchange) {
        case 'cex':
          endpoint = '/api/native-cex/orders?status=closed';
          break;
        case 'omni':
          endpoint = '/api/omni-exchange/orders?status=closed';
          break;
        case 'dex':
          endpoint = '/api/dex/trades';
          break;
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch order history');
      }
      
      const data = await response.json();
      const orderHistory = data.data || data.orders || [];
      
      set({ orderHistory, isLoading: false });
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order history';
      set({ error: errorMessage, isLoading: false });
    }
  },

  clear: () => set(initialState),
}));
