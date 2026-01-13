/**
 * Trading Types
 * Type definitions for trading system
 */

export type ExchangeType = 'cex' | 'omni' | 'dex';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';

export interface TradingPair {
  symbol: string;
  base: string;
  quote: string;
  baseDecimals: number;
  quoteDecimals: number;
  minOrderSize: number;
  maxOrderSize: number;
  tickSize: number;
  pricePrecision: number;
  amountPrecision: number;
}

export interface Order {
  id: string;
  userId: string;
  exchange: ExchangeType;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: number | null; // null for market orders
  amount: number;
  filledAmount: number;
  remainingAmount: number;
  averagePrice: number | null;
  total: number | null; // price * amount for limit orders
  fee: number;
  feeCurrency: string;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  cancelledAt: string | null;
  exchangeOrderId?: string; // Order ID from exchange
  exchangeName?: string; // For Omni-Exchange
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  amount: number;
  price?: number; // Required for limit orders
  stopPrice?: number; // Required for stop orders
  exchange?: ExchangeType; // Optional, uses selected exchange if not provided
  exchangeName?: string; // For Omni-Exchange routing
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
  exchange?: string; // For Omni-Exchange
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface ExchangeInfo {
  id: string;
  name: string;
  type: ExchangeType;
  status: 'online' | 'offline' | 'maintenance';
  health: {
    responseTime: number;
    uptime: number;
    lastCheck: string;
  };
  features: string[];
  limits: {
    minOrderSize: number;
    maxOrderSize: number;
    minPrice: number;
    maxPrice: number;
  };
}

export interface TradingAnalytics {
  totalTrades: number;
  totalVolume: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  period: {
    start: string;
    end: string;
  };
}
