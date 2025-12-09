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
  SUPER_ADMIN = 'super_admin'
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
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
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
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Note: NonNullable is already defined in TypeScript's standard library
// Use the built-in NonNullable<T> instead

export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

export type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

export type DateKeys<T> = {
  [K in keyof T]: T[K] extends Date ? K : never;
}[keyof T];
