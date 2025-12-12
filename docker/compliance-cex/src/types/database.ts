/**
 * Database Types and Schemas for CEX Compliance Service
 * Enterprise PostgreSQL with strict typing and constraints
 */

import { z } from 'zod';

// ==================== DATABASE TABLE TYPES ====================

/**
 * VASP Registry Table
 */
export interface VASPTable {
  id: string; // UUID PRIMARY KEY
  name: string; // NOT NULL
  lei: string | null;
  registration_number: string; // NOT NULL
  address_street: string; // NOT NULL
  address_city: string; // NOT NULL
  address_country: string; // NOT NULL (ISO 3166-1 alpha-2)
  address_postal_code: string; // NOT NULL
  jurisdiction: string; // NOT NULL (ISO 3166-1 alpha-2)
  website: string | null;
  compliance_contact_name: string; // NOT NULL
  compliance_contact_email: string; // NOT NULL
  compliance_contact_phone: string | null;
  did: string | null;
  public_key: string | null;
  status: 'active' | 'suspended' | 'inactive'; // NOT NULL
  created_at: Date; // NOT NULL DEFAULT NOW()
  updated_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * Travel Rule Messages Table
 */
export interface TravelRuleTable {
  id: string; // UUID PRIMARY KEY
  originator_name: string; // NOT NULL
  originator_account_number: string; // NOT NULL
  originator_address: string; // NOT NULL
  originator_date_of_birth: string | null;
  originator_national_id: string | null;
  originator_country: string; // NOT NULL
  originator_broker_id: string; // NOT NULL
  originator_customer_id: string; // NOT NULL
  originator_customer_type: 'individual' | 'business' | 'trust'; // NOT NULL
  originator_tax_id: string | null;
  originator_occupation: string | null;
  originator_source_of_funds: string | null;

  beneficiary_name: string; // NOT NULL
  beneficiary_account_number: string; // NOT NULL
  beneficiary_address: string; // NOT NULL
  beneficiary_date_of_birth: string | null;
  beneficiary_national_id: string | null;
  beneficiary_country: string; // NOT NULL
  beneficiary_broker_id: string | null;
  beneficiary_customer_id: string | null;
  beneficiary_customer_type: 'individual' | 'business' | 'trust' | null;

  transaction_amount: string; // NOT NULL
  transaction_currency: string; // NOT NULL
  transaction_id: string; // NOT NULL
  transaction_timestamp: Date; // NOT NULL
  transaction_purpose: string; // NOT NULL
  transaction_reference: string | null;
  transaction_exchange_rate: string | null;
  transaction_fee: string | null;

  originator_vasp_name: string; // NOT NULL
  originator_vasp_country: string; // NOT NULL
  originator_vasp_registration_number: string; // NOT NULL
  originator_vasp_address: string; // NOT NULL
  originator_vasp_lei: string | null;
  originator_vasp_did: string | null;

  beneficiary_vasp_name: string | null;
  beneficiary_vasp_country: string | null;
  beneficiary_vasp_registration_number: string | null;
  beneficiary_vasp_address: string | null;
  beneficiary_vasp_lei: string | null;
  beneficiary_vasp_did: string | null;

  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed'; // NOT NULL
  message_id: string; // NOT NULL UNIQUE
  timestamp: Date; // NOT NULL
  response_timestamp: Date | null;
  error_message: string | null;
  retry_count: number; // NOT NULL DEFAULT 0
  max_retries: number; // NOT NULL DEFAULT 3
  next_retry_at: Date | null;

  tenant_id: string; // NOT NULL
  broker_id: string | null;
  user_id: string | null;
  created_at: Date; // NOT NULL DEFAULT NOW()
  updated_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * CARF Reports Table
 */
export interface CARFReportsTable {
  id: string; // UUID PRIMARY KEY
  reporting_entity_name: string; // NOT NULL
  reporting_entity_country: string; // NOT NULL
  reporting_entity_registration_number: string; // NOT NULL
  reporting_entity_address: string; // NOT NULL
  reporting_entity_tax_id: string | null;
  reporting_entity_lei: string | null;

  reportable_person_name: string; // NOT NULL
  reportable_person_address: string; // NOT NULL
  reportable_person_date_of_birth: string | null;
  reportable_person_national_id: string | null;
  reportable_person_country: string; // NOT NULL
  reportable_person_tax_id: string | null;
  reportable_person_occupation: string | null;
  reportable_person_customer_type: 'individual' | 'business' | 'trust'; // NOT NULL

  crypto_asset_type: string; // NOT NULL
  crypto_asset_amount: string; // NOT NULL
  crypto_asset_value: string; // NOT NULL
  crypto_asset_currency: string; // NOT NULL
  crypto_asset_exchange_rate: string; // NOT NULL
  crypto_asset_market_value: string | null;

  transaction_type: 'exchange' | 'transfer' | 'disposal' | 'acquisition' | 'mining' | 'staking'; // NOT NULL
  transaction_date: Date; // NOT NULL
  transaction_counterparty: string | null;
  transaction_platform: string | null;
  transaction_fees: string; // NOT NULL
  transaction_description: string | null;
  transaction_hash: string | null;
  transaction_wallet_address: string | null;

  reporting_period_start_date: Date; // NOT NULL
  reporting_period_end_date: Date; // NOT NULL
  reporting_period_fiscal_year: string | null;

  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected'; // NOT NULL
  report_id: string; // NOT NULL UNIQUE
  submission_date: Date | null;
  acknowledgment_date: Date | null;
  rejection_reason: string | null;
  version: string; // NOT NULL DEFAULT '1.0'

  tenant_id: string; // NOT NULL
  broker_id: string | null;
  user_id: string | null;
  created_at: Date; // NOT NULL DEFAULT NOW()
  updated_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * Risk Assessments Table
 */
export interface RiskAssessmentsTable {
  id: string; // UUID PRIMARY KEY
  transaction_id: string; // NOT NULL
  user_id: string; // NOT NULL
  broker_id: string; // NOT NULL
  tenant_id: string; // NOT NULL

  risk_score: number; // NOT NULL (0-100)
  risk_level: 'low' | 'medium' | 'high' | 'critical'; // NOT NULL

  factor_amount: number; // NOT NULL (0-100)
  factor_frequency: number; // NOT NULL (0-100)
  factor_geography: number; // NOT NULL (0-100)
  factor_counterparty: number; // NOT NULL (0-100)
  factor_pattern: number; // NOT NULL (0-100)
  factor_velocity: number; // NOT NULL (0-100)
  factor_concentration: number; // NOT NULL (0-100)
  factor_source_of_funds: number; // NOT NULL (0-100)

  flags: string[]; // JSONB array of RiskFlag
  recommendations: string[]; // JSONB array of RiskRecommendation

  assessment_date: Date; // NOT NULL
  assessor: string; // NOT NULL ('automated' or user ID)
  review_required: boolean; // NOT NULL DEFAULT false
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  override_reason: string | null;
  valid_until: Date | null;

  created_at: Date; // NOT NULL DEFAULT NOW()
  updated_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * Compliance Events Table
 */
export interface ComplianceEventsTable {
  id: string; // UUID PRIMARY KEY
  type: string; // NOT NULL (ComplianceEventType)
  source: 'cex' | 'dex' | 'nft' | 'token'; // NOT NULL
  entity_id: string; // NOT NULL
  entity_type: 'transaction' | 'user' | 'wallet' | 'asset'; // NOT NULL
  tenant_id: string; // NOT NULL
  broker_id: string | null;
  user_id: string | null;
  timestamp: Date; // NOT NULL
  data: Record<string, unknown>; // JSONB
  metadata_version: string; // NOT NULL
  metadata_correlation_id: string; // NOT NULL
  metadata_causation_id: string | null;
  processed: boolean; // NOT NULL DEFAULT false
  processed_at: Date | null;
  created_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * Audit Log Table
 */
export interface AuditLogTable {
  id: string; // UUID PRIMARY KEY
  timestamp: Date; // NOT NULL DEFAULT NOW()
  level: 'info' | 'warn' | 'error'; // NOT NULL
  category: 'compliance' | 'security' | 'system' | 'user'; // NOT NULL
  action: string; // NOT NULL
  actor: string; // NOT NULL
  resource: string; // NOT NULL
  details: Record<string, unknown>; // JSONB
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string; // NOT NULL
  created_at: Date; // NOT NULL DEFAULT NOW()
}

/**
 * User Compliance Profiles Table
 */
export interface UserComplianceProfilesTable {
  id: string; // UUID PRIMARY KEY
  user_id: string; // NOT NULL UNIQUE
  tenant_id: string; // NOT NULL
  broker_id: string | null;

  kyc_status: 'none' | 'pending' | 'approved' | 'rejected' | 'expired'; // NOT NULL
  kyc_provider: string | null;
  kyc_reference: string | null;
  kyc_expiry: Date | null;

  risk_rating: 'low' | 'medium' | 'high' | 'critical'; // NOT NULL DEFAULT 'medium'
  risk_factors: Record<string, unknown>; // JSONB
  last_risk_assessment: Date | null;

  jurisdiction: string | null; // ISO 3166-1 alpha-2
  tax_residency: string[] | null; // Array of ISO 3166-1 alpha-2
  politically_exposed: boolean; // NOT NULL DEFAULT false
  sanctions_check: 'passed' | 'failed' | 'pending' | 'not_checked'; // NOT NULL DEFAULT 'not_checked'
  sanctions_check_date: Date | null;

  travel_rule_threshold: number | null; // Custom threshold for this user
  carf_reporting_required: boolean; // NOT NULL DEFAULT true

  created_at: Date; // NOT NULL DEFAULT NOW()
  updated_at: Date; // NOT NULL DEFAULT NOW()
}

// ==================== DATABASE MIGRATION TYPES ====================

/**
 * Database Migration Record
 */
export interface MigrationTable {
  id: string; // UUID PRIMARY KEY
  name: string; // NOT NULL
  executed_at: Date; // NOT NULL DEFAULT NOW()
  success: boolean; // NOT NULL
  error_message: string | null;
  checksum: string; // NOT NULL
}

// ==================== QUERY TYPES ====================

/**
 * Paginated Query Parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Date Range Query Parameters
 */
export interface DateRangeParams {
  startDate: Date;
  endDate: Date;
}

/**
 * Compliance Report Query Parameters
 */
export interface ComplianceReportQuery {
  tenantId?: string;
  brokerId?: string;
  userId?: string;
  status?: string[];
  dateRange?: DateRangeParams;
  riskLevel?: string[];
  pagination: PaginationParams;
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Zod validation schemas for database operations
 */
export const VASPTableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  lei: z.string().nullable(),
  registration_number: z.string().min(1),
  address_street: z.string().min(1),
  address_city: z.string().min(1),
  address_country: z.string().length(2),
  address_postal_code: z.string().min(1),
  jurisdiction: z.string().length(2),
  website: z.string().url().nullable(),
  compliance_contact_name: z.string().min(1),
  compliance_contact_email: z.string().email(),
  compliance_contact_phone: z.string().nullable(),
  did: z.string().nullable(),
  public_key: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'inactive']),
  created_at: z.date(),
  updated_at: z.date(),
});

export const TravelRuleTableSchema = z.object({
  id: z.string().uuid(),
  originator_name: z.string().min(1),
  originator_account_number: z.string().min(1),
  originator_address: z.string().min(1),
  originator_date_of_birth: z.string().nullable(),
  originator_national_id: z.string().nullable(),
  originator_country: z.string().length(2),
  originator_broker_id: z.string().min(1),
  originator_customer_id: z.string().min(1),
  originator_customer_type: z.enum(['individual', 'business', 'trust']),
  originator_tax_id: z.string().nullable(),
  originator_occupation: z.string().nullable(),
  originator_source_of_funds: z.string().nullable(),
  beneficiary_name: z.string().min(1),
  beneficiary_account_number: z.string().min(1),
  beneficiary_address: z.string().min(1),
  beneficiary_date_of_birth: z.string().nullable(),
  beneficiary_national_id: z.string().nullable(),
  beneficiary_country: z.string().length(2),
  beneficiary_broker_id: z.string().nullable(),
  beneficiary_customer_id: z.string().nullable(),
  beneficiary_customer_type: z.enum(['individual', 'business', 'trust']).nullable(),
  transaction_amount: z.string().min(1),
  transaction_currency: z.string().min(1),
  transaction_id: z.string().min(1),
  transaction_timestamp: z.date(),
  transaction_purpose: z.string().min(1),
  transaction_reference: z.string().nullable(),
  transaction_exchange_rate: z.string().nullable(),
  transaction_fee: z.string().nullable(),
  originator_vasp_name: z.string().min(1),
  originator_vasp_country: z.string().length(2),
  originator_vasp_registration_number: z.string().min(1),
  originator_vasp_address: z.string().min(1),
  originator_vasp_lei: z.string().nullable(),
  originator_vasp_did: z.string().nullable(),
  beneficiary_vasp_name: z.string().nullable(),
  beneficiary_vasp_country: z.string().nullable(),
  beneficiary_vasp_registration_number: z.string().nullable(),
  beneficiary_vasp_address: z.string().nullable(),
  beneficiary_vasp_lei: z.string().nullable(),
  beneficiary_vasp_did: z.string().nullable(),
  status: z.enum(['pending', 'sent', 'received', 'acknowledged', 'failed']),
  message_id: z.string().min(1),
  timestamp: z.date(),
  response_timestamp: z.date().nullable(),
  error_message: z.string().nullable(),
  retry_count: z.number().int().min(0),
  max_retries: z.number().int().min(1),
  next_retry_at: z.date().nullable(),
  tenant_id: z.string().min(1),
  broker_id: z.string().nullable(),
  user_id: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// ==================== DATABASE CONSTRAINTS ====================

/**
 * Database constraints and indexes for performance and data integrity
 */
export const DATABASE_CONSTRAINTS = {
  tables: {
    vasp_registry: {
      primaryKey: 'id',
      unique: ['registration_number'],
      indexes: ['jurisdiction', 'status', 'created_at'],
      foreignKeys: [],
    },
    travel_rule_messages: {
      primaryKey: 'id',
      unique: ['message_id'],
      indexes: [
        'tenant_id',
        'broker_id',
        'user_id',
        'status',
        'timestamp',
        'originator_country',
        'beneficiary_country',
        'transaction_currency',
        'created_at'
      ],
      foreignKeys: [],
    },
    carf_reports: {
      primaryKey: 'id',
      unique: ['report_id'],
      indexes: [
        'tenant_id',
        'broker_id',
        'user_id',
        'status',
        'reportable_person_country',
        'crypto_asset_type',
        'transaction_date',
        'reporting_period_start_date',
        'reporting_period_end_date',
        'created_at'
      ],
      foreignKeys: [],
    },
    risk_assessments: {
      primaryKey: 'id',
      unique: [],
      indexes: [
        'tenant_id',
        'broker_id',
        'user_id',
        'transaction_id',
        'risk_level',
        'assessment_date',
        'created_at'
      ],
      foreignKeys: [],
    },
    compliance_events: {
      primaryKey: 'id',
      unique: [],
      indexes: [
        'tenant_id',
        'broker_id',
        'user_id',
        'type',
        'source',
        'entity_type',
        'timestamp',
        'processed',
        'created_at'
      ],
      foreignKeys: [],
    },
    audit_log: {
      primaryKey: 'id',
      unique: [],
      indexes: [
        'timestamp',
        'level',
        'category',
        'actor',
        'correlation_id',
        'created_at'
      ],
      foreignKeys: [],
    },
    user_compliance_profiles: {
      primaryKey: 'id',
      unique: ['user_id'],
      indexes: [
        'tenant_id',
        'broker_id',
        'kyc_status',
        'risk_rating',
        'jurisdiction',
        'sanctions_check',
        'created_at'
      ],
      foreignKeys: [],
    },
  },
} as const;