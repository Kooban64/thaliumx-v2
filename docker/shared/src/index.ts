/**
 * ThaliumX Shared Types and Utilities
 *
 * This package contains shared types, interfaces, and utilities
 * used across the frontend and backend applications.
 */

// Re-export all types from the types module
export * from './types';

// Common Types
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  tenantId?: string;
  brokerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Trading Types
export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: string;
  price?: string;
  stopPrice?: string;
  status: OrderStatus;
  filledQuantity: string;
  averagePrice?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface Trade {
  id: string;
  orderId: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fee: string;
  feeCurrency: string;
  timestamp: Date;
}

export interface MarketData {
  symbol: string;
  bid: string;
  ask: string;
  last: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  change24h: string;
  changePercent24h: string;
  timestamp: Date;
}

// Wallet Types
export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  availableBalance: string;
  lockedBalance: string;
  type: 'spot' | 'margin' | 'futures';
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'trade' | 'fee';
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reference?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// KYC Types
export interface KYCStatus {
  userId: string;
  level: 0 | 1 | 2 | 3;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  documents: KYCDocument[];
  riskScore?: number;
  lastVerifiedAt?: Date;
  expiresAt?: Date;
}

export interface KYCDocument {
  id: string;
  type: 'passport' | 'id_card' | 'drivers_license' | 'proof_of_address' | 'selfie';
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
  verifiedAt?: Date;
  rejectionReason?: string;
}

// Utility Functions
export function formatCurrency(amount: string | number, currency: string, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatNumber(value: string | number, decimals = 8): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Constants
export const SUPPORTED_CURRENCIES = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'DOT',
  'THAL', 'USD', 'EUR', 'GBP'
] as const;

export const ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit'] as const;
export const ORDER_SIDES = ['buy', 'sell'] as const;
export const WALLET_TYPES = ['spot', 'margin', 'futures'] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];
export type OrderType = typeof ORDER_TYPES[number];
export type OrderSide = typeof ORDER_SIDES[number];
export type WalletType = typeof WALLET_TYPES[number];