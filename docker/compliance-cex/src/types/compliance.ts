/**
 * Core Compliance Types for ThaliumX CEX Compliance Service
 * Implements FATF Travel Rule, CARF Reporting, and Risk Assessment
 */

import { z } from 'zod';

// ==================== TRAVEL RULE TYPES ====================

/**
 * VASP (Virtual Asset Service Provider) Information
 * FATF Recommendation 16 - Travel Rule
 */
export interface VASP {
  id: string;
  name: string;
  lei?: string; // Legal Entity Identifier
  registrationNumber: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  jurisdiction: string;
  website?: string;
  complianceContact: {
    name: string;
    email: string;
    phone?: string;
  };
  did?: string; // Decentralized Identifier for VASP
  publicKey?: string;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Travel Rule Originator Information
 */
export interface TravelRuleOriginator {
  name: string;
  accountNumber: string;
  address: string;
  dateOfBirth?: string;
  nationalId?: string;
  country: string;
  brokerId: string;
  customerId: string;
  customerType: 'individual' | 'business' | 'trust';
  taxId?: string;
  occupation?: string;
  sourceOfFunds?: string;
}

/**
 * Travel Rule Beneficiary Information
 */
export interface TravelRuleBeneficiary {
  name: string;
  accountNumber: string;
  address: string;
  dateOfBirth?: string;
  nationalId?: string;
  country: string;
  brokerId?: string;
  customerId?: string;
  customerType?: 'individual' | 'business' | 'trust';
}

/**
 * Travel Rule Transaction Information
 */
export interface TravelRuleTransaction {
  amount: string;
  currency: string;
  transactionId: string;
  timestamp: Date;
  purpose: string;
  reference?: string;
  exchangeRate?: string;
  fee?: string;
}

/**
 * VASP Information for Travel Rule
 */
export interface TravelRuleVASP {
  originatorVASP: {
    name: string;
    country: string;
    registrationNumber: string;
    address: string;
    lei?: string;
    did?: string;
  };
  beneficiaryVASP?: {
    name: string;
    country: string;
    registrationNumber: string;
    address: string;
    lei?: string;
    did?: string;
  };
}

/**
 * Complete Travel Rule Data Structure
 */
export interface TravelRuleData {
  id: string;
  originator: TravelRuleOriginator;
  beneficiary: TravelRuleBeneficiary;
  transaction: TravelRuleTransaction;
  vasp: TravelRuleVASP;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  timestamp: Date;
  responseTimestamp?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

// ==================== CARF REPORTING TYPES ====================

/**
 * CARF (Crypto-Asset Reporting Framework) Reporting Entity
 */
export interface CARFReportingEntity {
  name: string;
  country: string;
  registrationNumber: string;
  address: string;
  taxId?: string;
  lei?: string;
}

/**
 * CARF Reportable Person
 */
export interface CARFReportablePerson {
  name: string;
  address: string;
  dateOfBirth?: string;
  nationalId?: string;
  country: string;
  taxId?: string;
  occupation?: string;
  customerType: 'individual' | 'business' | 'trust';
}

/**
 * CARF Crypto Asset Information
 */
export interface CARFCryptoAsset {
  type: string; // BTC, ETH, USDT, etc.
  amount: string;
  value: string; // Fiat value
  currency: string; // USD, EUR, etc.
  exchangeRate: string;
  marketValue?: string;
}

/**
 * CARF Transaction Details
 */
export interface CARFTransaction {
  type: 'exchange' | 'transfer' | 'disposal' | 'acquisition' | 'mining' | 'staking';
  date: Date;
  counterparty?: string;
  platform?: string;
  fees: string;
  description?: string;
  transactionHash?: string;
  walletAddress?: string;
}

/**
 * CARF Reporting Period
 */
export interface CARFReportingPeriod {
  startDate: Date;
  endDate: Date;
  fiscalYear?: string;
}

/**
 * Complete CARF Report Data Structure
 */
export interface CARFReportingData {
  id: string;
  reportingEntity: CARFReportingEntity;
  reportablePerson: CARFReportablePerson;
  cryptoAsset: CARFCryptoAsset;
  transaction: CARFTransaction;
  reportingPeriod: CARFReportingPeriod;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  reportId: string;
  submissionDate?: Date;
  acknowledgmentDate?: Date;
  rejectionReason?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== RISK ASSESSMENT TYPES ====================

/**
 * Risk Assessment Factors
 */
export interface RiskFactors {
  amount: number; // 0-100
  frequency: number; // 0-100
  geography: number; // 0-100
  counterparty: number; // 0-100
  pattern: number; // 0-100
  velocity: number; // 0-100
  concentration: number; // 0-100
  sourceOfFunds: number; // 0-100
}

/**
 * Risk Assessment Flags
 */
export type RiskFlag =
  | 'high_amount'
  | 'frequent_transactions'
  | 'high_risk_jurisdiction'
  | 'unknown_counterparty'
  | 'suspicious_pattern'
  | 'rapid_velocity'
  | 'concentration_risk'
  | 'peps_exposure'
  | 'sanctions_match'
  | 'unusual_timing';

/**
 * Risk Assessment Recommendations
 */
export type RiskRecommendation =
  | 'enhanced_due_diligence'
  | 'transaction_monitoring'
  | 'manual_review'
  | 'hold_transaction'
  | 'reject_transaction'
  | 'report_to_authorities'
  | 'customer_interview'
  | 'source_of_funds_verification';

/**
 * Risk Assessment Result
 */
export interface RiskAssessmentData {
  id: string;
  transactionId: string;
  userId: string;
  brokerId: string;
  tenantId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  flags: RiskFlag[];
  recommendations: RiskRecommendation[];
  assessmentDate: Date;
  assessor: string; // 'automated' or user ID
  reviewRequired: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  overrideReason?: string;
  validUntil?: Date;
}

// ==================== COMPLIANCE EVENT TYPES ====================

/**
 * Compliance Event Types
 */
export type ComplianceEventType =
  | 'transaction_created'
  | 'transaction_completed'
  | 'user_registered'
  | 'user_kyc_updated'
  | 'risk_assessment_completed'
  | 'travel_rule_generated'
  | 'travel_rule_sent'
  | 'carf_report_generated'
  | 'carf_report_submitted'
  | 'compliance_alert'
  | 'manual_review_required';

/**
 * Base Compliance Event
 */
export interface ComplianceEvent {
  id: string;
  type: ComplianceEventType;
  source: 'cex' | 'dex' | 'nft' | 'token';
  entityId: string; // transaction ID, user ID, etc.
  entityType: 'transaction' | 'user' | 'wallet' | 'asset';
  tenantId: string;
  brokerId?: string;
  userId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata: {
    version: string;
    correlationId: string;
    causationId?: string;
  };
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Zod schemas for runtime validation
 */
export const VASPSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  lei: z.string().optional(),
  registrationNumber: z.string().min(1),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    country: z.string().length(2), // ISO 3166-1 alpha-2
    postalCode: z.string().min(1),
  }),
  jurisdiction: z.string().length(2),
  website: z.string().url().optional(),
  complianceContact: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  did: z.string().optional(),
  publicKey: z.string().optional(),
  status: z.enum(['active', 'suspended', 'inactive']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TravelRuleDataSchema = z.object({
  id: z.string().uuid(),
  originator: z.object({
    name: z.string().min(1),
    accountNumber: z.string().min(1),
    address: z.string().min(1),
    dateOfBirth: z.string().optional(),
    nationalId: z.string().optional(),
    country: z.string().length(2),
    brokerId: z.string().min(1),
    customerId: z.string().min(1),
    customerType: z.enum(['individual', 'business', 'trust']),
    taxId: z.string().optional(),
    occupation: z.string().optional(),
    sourceOfFunds: z.string().optional(),
  }),
  beneficiary: z.object({
    name: z.string().min(1),
    accountNumber: z.string().min(1),
    address: z.string().min(1),
    dateOfBirth: z.string().optional(),
    nationalId: z.string().optional(),
    country: z.string().length(2),
    brokerId: z.string().optional(),
    customerId: z.string().optional(),
    customerType: z.enum(['individual', 'business', 'trust']).optional(),
  }),
  transaction: z.object({
    amount: z.string().min(1),
    currency: z.string().min(1),
    transactionId: z.string().min(1),
    timestamp: z.date(),
    purpose: z.string().min(1),
    reference: z.string().optional(),
    exchangeRate: z.string().optional(),
    fee: z.string().optional(),
  }),
  vasp: z.object({
    originatorVASP: z.object({
      name: z.string().min(1),
      country: z.string().length(2),
      registrationNumber: z.string().min(1),
      address: z.string().min(1),
      lei: z.string().optional(),
      did: z.string().optional(),
    }),
    beneficiaryVASP: z.object({
      name: z.string().min(1),
      country: z.string().length(2),
      registrationNumber: z.string().min(1),
      address: z.string().min(1),
      lei: z.string().optional(),
      did: z.string().optional(),
    }).optional(),
  }),
  status: z.enum(['pending', 'sent', 'received', 'acknowledged', 'failed']),
  messageId: z.string().min(1),
  timestamp: z.date(),
  responseTimestamp: z.date().optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(1),
  nextRetryAt: z.date().optional(),
});

// ==================== UTILITY TYPES ====================

/**
 * Compliance Service Configuration
 */
export interface ComplianceConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  port: number;
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    ssl?: boolean;
    sslCa?: string;
    saslMechanism?: string;
    saslUsername?: string;
    saslPassword?: string;
  };
  keycloak: {
    url: string;
    realm: string;
    clientId: string;
    clientSecret: string;
  };
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  travelRule: {
    enabled: boolean;
    thresholdAmount: number; // Amount above which Travel Rule applies
    autoSend: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };
  carf: {
    enabled: boolean;
    autoGenerate: boolean;
    reportingPeriodDays: number;
    retentionYears: number;
  };
  regulatory: {
    jurisdictions: string[]; // ISO country codes
    autoSubmit: boolean;
    submissionEndpoints: Record<string, string>;
  };
}

/**
 * Service Health Status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    latency: number;
  };
  redis: {
    status: 'connected' | 'disconnected' | 'error';
    latency: number;
  };
  kafka: {
    status: 'connected' | 'disconnected' | 'error';
    topics: string[];
  };
  compliance: {
    pendingTravelRule: number;
    pendingCARF: number;
    highRiskAlerts: number;
  };
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  category: 'compliance' | 'security' | 'system' | 'user';
  action: string;
  actor: string; // user ID or 'system'
  resource: string; // what was acted upon
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}