/**
 * Event Types for CEX Compliance Service
 * Event-driven architecture for real-time compliance processing
 */

import { z } from 'zod';

// ==================== EVENT TYPES ====================

/**
 * Base Event Interface
 */
export interface BaseEvent {
  id: string;
  type: string;
  source: 'cex' | 'dex' | 'nft' | 'token';
  version: string;
  timestamp: Date;
  correlationId: string;
  causationId?: string;
  tenantId: string;
  metadata: Record<string, unknown>;
}

/**
 * Transaction Events
 */
export interface TransactionCreatedEvent extends BaseEvent {
  type: 'transaction.created';
  data: {
    transactionId: string;
    userId: string;
    brokerId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    amount: string;
    price?: string;
    stopPrice?: string;
    fee: string;
    platform: string;
    counterparty?: string;
    walletAddress?: string;
    transactionHash?: string;
  };
}

export interface TransactionCompletedEvent extends BaseEvent {
  type: 'transaction.completed';
  data: {
    transactionId: string;
    userId: string;
    brokerId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    fee: string;
    filledAmount: string;
    averagePrice: string;
    status: 'filled' | 'partially_filled' | 'cancelled';
    platform: string;
    counterparty?: string;
    walletAddress?: string;
    transactionHash?: string;
  };
}

export interface TransactionFailedEvent extends BaseEvent {
  type: 'transaction.failed';
  data: {
    transactionId: string;
    userId: string;
    brokerId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    amount: string;
    error: string;
    errorCode: string;
    platform: string;
  };
}

/**
 * User Events
 */
export interface UserRegisteredEvent extends BaseEvent {
  type: 'user.registered';
  data: {
    userId: string;
    brokerId?: string;
    email: string;
    country: string;
    dateOfBirth?: string;
    kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
    registrationMethod: string;
    ipAddress: string;
    userAgent: string;
  };
}

export interface UserKYCUpdatedEvent extends BaseEvent {
  type: 'user.kyc.updated';
  data: {
    userId: string;
    brokerId?: string;
    previousStatus: string;
    newStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'expired';
    kycProvider?: string;
    kycReference?: string;
    expiryDate?: string;
    riskRating?: 'low' | 'medium' | 'high' | 'critical';
    jurisdiction?: string;
    politicallyExposed?: boolean;
  };
}

export interface UserProfileUpdatedEvent extends BaseEvent {
  type: 'user.profile.updated';
  data: {
    userId: string;
    brokerId?: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy: string;
    ipAddress: string;
  };
}

/**
 * Wallet Events
 */
export interface WalletDepositEvent extends BaseEvent {
  type: 'wallet.deposit';
  data: {
    userId: string;
    brokerId?: string;
    walletId: string;
    asset: string;
    amount: string;
    transactionHash: string;
    fromAddress: string;
    toAddress: string;
    confirmations: number;
    fee: string;
    platform: string;
  };
}

export interface WalletWithdrawalEvent extends BaseEvent {
  type: 'wallet.withdrawal';
  data: {
    userId: string;
    brokerId?: string;
    walletId: string;
    asset: string;
    amount: string;
    transactionHash: string;
    fromAddress: string;
    toAddress: string;
    fee: string;
    platform: string;
    destination: string;
  };
}

export interface WalletTransferEvent extends BaseEvent {
  type: 'wallet.transfer';
  data: {
    fromUserId: string;
    toUserId: string;
    fromBrokerId?: string;
    toBrokerId?: string;
    asset: string;
    amount: string;
    transactionHash: string;
    memo?: string;
    platform: string;
  };
}

/**
 * Compliance Events
 */
export interface RiskAssessmentCompletedEvent extends BaseEvent {
  type: 'compliance.risk_assessment.completed';
  data: {
    assessmentId: string;
    transactionId?: string;
    userId: string;
    brokerId?: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    recommendations: string[];
    assessmentDate: string;
    assessor: string;
  };
}

export interface TravelRuleGeneratedEvent extends BaseEvent {
  type: 'compliance.travel_rule.generated';
  data: {
    travelRuleId: string;
    transactionId: string;
    userId: string;
    brokerId?: string;
    messageId: string;
    originatorVASP: string;
    beneficiaryVASP?: string;
    amount: string;
    currency: string;
    status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  };
}

export interface TravelRuleSentEvent extends BaseEvent {
  type: 'compliance.travel_rule.sent';
  data: {
    travelRuleId: string;
    messageId: string;
    recipientVASP: string;
    status: 'sent' | 'acknowledged' | 'failed';
    responseTime?: number;
    errorMessage?: string;
  };
}

export interface CARFReportGeneratedEvent extends BaseEvent {
  type: 'compliance.carf.generated';
  data: {
    reportId: string;
    userId: string;
    brokerId?: string;
    reportId_external: string;
    cryptoAsset: string;
    amount: string;
    value: string;
    currency: string;
    transactionType: string;
    status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  };
}

export interface CARFReportSubmittedEvent extends BaseEvent {
  type: 'compliance.carf.submitted';
  data: {
    reportId: string;
    reportId_external: string;
    jurisdiction: string;
    submissionEndpoint: string;
    status: 'submitted' | 'acknowledged' | 'rejected';
    submissionDate: string;
    responseTime?: number;
  };
}

export interface ComplianceAlertEvent extends BaseEvent {
  type: 'compliance.alert';
  data: {
    alertId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'risk' | 'travel_rule' | 'carf' | 'sanctions' | 'kyc';
    title: string;
    description: string;
    entityId: string;
    entityType: 'user' | 'transaction' | 'wallet';
    userId?: string;
    brokerId?: string;
    recommendedActions: string[];
    autoEscalated: boolean;
  };
}

export interface ManualReviewRequiredEvent extends BaseEvent {
  type: 'compliance.manual_review.required';
  data: {
    reviewId: string;
    entityId: string;
    entityType: 'user' | 'transaction' | 'wallet';
    userId?: string;
    brokerId?: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;
    dueDate?: string;
    requiredDocuments?: string[];
  };
}

/**
 * System Events
 */
export interface SystemHealthEvent extends BaseEvent {
  type: 'system.health';
  data: {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: { status: string; latency: number };
      redis: { status: string; latency: number };
      kafka: { status: string; topics: string[] };
      external: { status: string; latency: number };
    };
    metrics: {
      uptime: number;
      memory: { used: number; total: number };
      cpu: number;
      activeConnections: number;
    };
  };
}

export interface SystemConfigUpdatedEvent extends BaseEvent {
  type: 'system.config.updated';
  data: {
    configType: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy: string;
    reason: string;
    effectiveAt: string;
  };
}

// ==================== UNION TYPES ====================

/**
 * All possible compliance events
 */
export type ComplianceEvent =
  | TransactionCreatedEvent
  | TransactionCompletedEvent
  | TransactionFailedEvent
  | UserRegisteredEvent
  | UserKYCUpdatedEvent
  | UserProfileUpdatedEvent
  | WalletDepositEvent
  | WalletWithdrawalEvent
  | WalletTransferEvent
  | RiskAssessmentCompletedEvent
  | TravelRuleGeneratedEvent
  | TravelRuleSentEvent
  | CARFReportGeneratedEvent
  | CARFReportSubmittedEvent
  | ComplianceAlertEvent
  | ManualReviewRequiredEvent
  | SystemHealthEvent
  | SystemConfigUpdatedEvent;

// ==================== EVENT HANDLER TYPES ====================

/**
 * Event Handler Function Type
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void>;

/**
 * Event Handler Registry
 */
export interface EventHandlerRegistry {
  [eventType: string]: EventHandler[];
}

/**
 * Event Processing Context
 */
export interface EventProcessingContext {
  event: BaseEvent;
  correlationId: string;
  startTime: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: Error;
}

// ==================== EVENT VALIDATION SCHEMAS ====================

/**
 * Zod schemas for event validation
 */
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  source: z.enum(['cex', 'dex', 'nft', 'token']),
  version: z.string().min(1),
  timestamp: z.date(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  tenantId: z.string().min(1),
  metadata: z.record(z.unknown()),
});

export const TransactionCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('transaction.created'),
  data: z.object({
    transactionId: z.string().min(1),
    userId: z.string().min(1),
    brokerId: z.string().optional(),
    symbol: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit', 'stop', 'stop_limit']),
    amount: z.string().min(1),
    price: z.string().optional(),
    stopPrice: z.string().optional(),
    fee: z.string(),
    platform: z.string().min(1),
    counterparty: z.string().optional(),
    walletAddress: z.string().optional(),
    transactionHash: z.string().optional(),
  }),
});

export const RiskAssessmentCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('compliance.risk_assessment.completed'),
  data: z.object({
    assessmentId: z.string().uuid(),
    transactionId: z.string().optional(),
    userId: z.string().min(1),
    brokerId: z.string().optional(),
    riskScore: z.number().min(0).max(100),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    flags: z.array(z.string()),
    recommendations: z.array(z.string()),
    assessmentDate: z.string().datetime(),
    assessor: z.string().min(1),
  }),
});

// ==================== EVENT PROCESSING CONFIG ====================

/**
 * Event Processing Configuration
 */
export interface EventProcessingConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  maxBackoffMs: number;
  deadLetterQueue: {
    enabled: boolean;
    topic: string;
    maxAgeHours: number;
  };
  batchProcessing: {
    enabled: boolean;
    batchSize: number;
    maxWaitMs: number;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

/**
 * Event Consumer Configuration
 */
export interface EventConsumerConfig {
  groupId: string;
  topics: string[];
  fromBeginning: boolean;
  autoCommit: boolean;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxPollRecords: number;
  maxPollInterval: number;
}

/**
 * Event Producer Configuration
 */
export interface EventProducerConfig {
  topic: string;
  keySerializer?: (key: string) => Buffer;
  valueSerializer?: (value: unknown) => Buffer;
  compression: 'none' | 'gzip' | 'snappy' | 'lz4';
  acks: number;
  retries: number;
  batchSize: number;
  lingerMs: number;
}

// ==================== EVENT METRICS ====================

/**
 * Event Processing Metrics
 */
export interface EventMetrics {
  eventsProcessed: number;
  eventsFailed: number;
  eventsRetried: number;
  eventsDeadLettered: number;
  processingLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    eventsPerSecond: number;
    bytesPerSecond: number;
  };
  consumerLag: {
    [topic: string]: {
      [partition: number]: number;
    };
  };
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}