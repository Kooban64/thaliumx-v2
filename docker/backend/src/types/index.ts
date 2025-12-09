/**
 * Type Definitions
 * 
 * Centralized TypeScript type definitions for the entire application.
 * 
 * Type Categories:
 * - Core Types: User, Address, KYC status and levels, User roles, Permissions
 * - Authentication Types: AuthRequest, AuthResponse, JWTPayload, RefreshTokenRequest
 * - Financial Types: Transaction, TransactionType, TransactionStatus, Wallet, WalletType
 * - Tenant Types: Tenant, TenantSettings
 * - API Types: ApiResponse, PaginatedResponse, ApiError
 * - Configuration Types: DatabaseConfig, RedisConfig, JWTConfig, SMTPConfig, AppConfig
 * - Exchange Types: Order, Trade, TradingPair, MarketData, Balance
 * - Utility Types: DeepPartial, Optional, RequiredFields, etc.
 * 
 * Usage:
 * - Imported throughout the application
 * - Provides type safety and IntelliSense
 * - Ensures consistent data structures
 * - Used for API request/response validation
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: Address;
  kycStatus: KycStatus;
  kycLevel: KycLevel;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaSecretTemp?: string;
  mfaMethod?: 'authenticator' | 'email' | 'sms';
  mfaVerifiedAt?: Date;
  mfaBackupCodes?: string[];
  mfaEmailCode?: string;
  mfaEmailCodeExpiresAt?: Date;
  role: UserRole;
  permissions: Permission[];
  tenantId: string;
  passwordHash?: string; // Internal field for authentication
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export enum KycStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export enum KycLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  ENTERPRISE = 'enterprise'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  BROKER = 'broker',
  COMPLIANCE = 'compliance',
  FINANCE = 'finance',
  SUPPORT = 'support',
  SUPER_ADMIN = 'super_admin',
  // Platform roles
  PLATFORM_ADMIN = 'platform-admin',
  PLATFORM_COMPLIANCE = 'platform-compliance',
  PLATFORM_FINANCE = 'platform-finance',
  PLATFORM_OPERATIONS = 'platform-operations',
  PLATFORM_SECURITY = 'platform-security',
  // Broker roles
  BROKER_ADMIN = 'broker-admin',
  BROKER_COMPLIANCE = 'broker-compliance',
  BROKER_FINANCE = 'broker-finance',
  BROKER_OPERATIONS = 'broker-operations',
  BROKER_TRADING = 'broker-trading',
  BROKER_SUPPORT = 'broker-support'
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

export interface AuthRequest {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken?: string; // Optional when using httpOnly cookies
  refreshToken?: string; // Optional when using httpOnly cookies
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  roles?: UserRole[]; // Support multiple roles
  tenantId: string;
  brokerId?: string; // Broker context for broker-scoped operations
  permissions: Permission[];
  iat: number;
  exp: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// =============================================================================
// FINANCIAL TYPES
// =============================================================================

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  fromAddress?: string;
  toAddress?: string;
  hash?: string;
  blockNumber?: number;
  gasUsed?: number;
  gasPrice?: number;
  fee?: number;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  TRADE = 'trade',
  FEE = 'fee',
  REWARD = 'reward',
  REFUND = 'refund'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PROCESSING = 'processing'
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  type: WalletType;
  isActive: boolean;
  balance: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export enum WalletType {
  HOT = 'hot',
  COLD = 'cold',
  MULTI_SIG = 'multi_sig',
  HARDWARE = 'hardware'
}

// =============================================================================
// TENANT TYPES
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive: boolean;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  allowRegistration: boolean;
  requireKyc: boolean;
  minKycLevel: KycLevel;
  supportedCurrencies: string[];
  supportedCountries: string[];
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
    idle: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface AppConfig {
  port: number;
  env: 'development' | 'staging' | 'production';
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  encryption: {
    algorithm: string;
    key: string;
  };
  smtp: SMTPConfig;
  external: {
    stripe: {
      secretKey: string;
      webhookSecret: string;
    };
    twilio: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
    sendgrid: {
      apiKey: string;
      fromEmail: string;
    };
  };
  kafka: {
    brokers: string[];
    ssl?: boolean;
    sasl?: {
      mechanism: string;
      username: string;
      password: string;
    };
  };
    keycloak: {
      baseUrl: string;
      realm: string;
      clientId: string;
      clientSecret: string;
      adminUsername: string;
      adminPassword: string;
      timeout: number;
      retryAttempts: number;
    };
    blockchain: {
      rpcUrl: string;
      privateKey: string;
      networkId: number;
      gasLimit: number;
      gasPrice: string;
      confirmations: number;
      timeout: number;
    };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type NonNullable<T> = T extends null | undefined ? never : T;

export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

export type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

export type DateKeys<T> = {
  [K in keyof T]: T[K] extends Date ? K : never;
}[keyof T];

// =============================================================================
// EXCHANGE TYPES
// =============================================================================

export interface Order {
  id: string;
  userId: string;
  tenantId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  symbol: string;
  quantity: number;
  price: number;
  buyerId: string;
  sellerId: string;
  buyerTenantId: string;
  sellerTenantId: string;
  timestamp: Date;
  fee: number;
  feeCurrency: string;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'active' | 'inactive' | 'suspended';
  minQuantity: number;
  maxQuantity: number;
  tickSize: number;
  stepSize: number;
  makerFee: number;
  takerFee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: Date;
}

export interface Balance {
  id?: string;
  userId: string;
  tenantId: string;
  asset: string;
  available: number;
  locked: number;
  total: number;
  updatedAt: Date;
}
