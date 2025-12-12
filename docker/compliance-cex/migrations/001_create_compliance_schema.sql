-- Migration: 001_create_compliance_schema
-- Description: Create compliance schema and base tables for CEX Compliance Service
-- Author: ThaliumX
-- Date: 2024-01-01

-- Create compliance schema
CREATE SCHEMA IF NOT EXISTS compliance;

-- Set search path
SET search_path TO compliance, public;

-- ==================== VASP REGISTRY TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.vasp_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    lei VARCHAR(20),
    registration_number VARCHAR(100) NOT NULL UNIQUE,
    address_street VARCHAR(255) NOT NULL,
    address_city VARCHAR(100) NOT NULL,
    address_country CHAR(2) NOT NULL,
    address_postal_code VARCHAR(20) NOT NULL,
    jurisdiction CHAR(2) NOT NULL,
    website VARCHAR(255),
    compliance_contact_name VARCHAR(255) NOT NULL,
    compliance_contact_email VARCHAR(255) NOT NULL,
    compliance_contact_phone VARCHAR(50),
    did VARCHAR(255),
    public_key TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for VASP registry
CREATE INDEX IF NOT EXISTS idx_vasp_registry_jurisdiction ON compliance.vasp_registry(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_vasp_registry_status ON compliance.vasp_registry(status);
CREATE INDEX IF NOT EXISTS idx_vasp_registry_created_at ON compliance.vasp_registry(created_at);
CREATE INDEX IF NOT EXISTS idx_vasp_registry_lei ON compliance.vasp_registry(lei) WHERE lei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vasp_registry_did ON compliance.vasp_registry(did) WHERE did IS NOT NULL;

-- ==================== TRAVEL RULE MESSAGES TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.travel_rule_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Originator information
    originator_name VARCHAR(255) NOT NULL,
    originator_account_number VARCHAR(100) NOT NULL,
    originator_address TEXT NOT NULL,
    originator_date_of_birth VARCHAR(10),
    originator_national_id VARCHAR(100),
    originator_country CHAR(2) NOT NULL,
    originator_broker_id VARCHAR(100) NOT NULL,
    originator_customer_id VARCHAR(100) NOT NULL,
    originator_customer_type VARCHAR(20) NOT NULL CHECK (originator_customer_type IN ('individual', 'business', 'trust')),
    originator_tax_id VARCHAR(100),
    originator_occupation VARCHAR(100),
    originator_source_of_funds TEXT,
    
    -- Beneficiary information
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_account_number VARCHAR(100) NOT NULL,
    beneficiary_address TEXT NOT NULL,
    beneficiary_date_of_birth VARCHAR(10),
    beneficiary_national_id VARCHAR(100),
    beneficiary_country CHAR(2) NOT NULL,
    beneficiary_broker_id VARCHAR(100),
    beneficiary_customer_id VARCHAR(100),
    beneficiary_customer_type VARCHAR(20) CHECK (beneficiary_customer_type IN ('individual', 'business', 'trust')),
    
    -- Transaction information
    transaction_amount VARCHAR(50) NOT NULL,
    transaction_currency VARCHAR(10) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    transaction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_purpose TEXT NOT NULL,
    transaction_reference VARCHAR(255),
    transaction_exchange_rate VARCHAR(50),
    transaction_fee VARCHAR(50),
    
    -- Originator VASP information
    originator_vasp_name VARCHAR(255) NOT NULL,
    originator_vasp_country CHAR(2) NOT NULL,
    originator_vasp_registration_number VARCHAR(100) NOT NULL,
    originator_vasp_address TEXT NOT NULL,
    originator_vasp_lei VARCHAR(20),
    originator_vasp_did VARCHAR(255),
    
    -- Beneficiary VASP information
    beneficiary_vasp_name VARCHAR(255),
    beneficiary_vasp_country CHAR(2),
    beneficiary_vasp_registration_number VARCHAR(100),
    beneficiary_vasp_address TEXT,
    beneficiary_vasp_lei VARCHAR(20),
    beneficiary_vasp_did VARCHAR(255),
    
    -- Status and tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received', 'acknowledged', 'failed')),
    message_id VARCHAR(100) NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    response_timestamp TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Multi-tenancy
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Travel Rule messages
CREATE INDEX IF NOT EXISTS idx_travel_rule_tenant_id ON compliance.travel_rule_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_travel_rule_broker_id ON compliance.travel_rule_messages(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_travel_rule_user_id ON compliance.travel_rule_messages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_travel_rule_status ON compliance.travel_rule_messages(status);
CREATE INDEX IF NOT EXISTS idx_travel_rule_timestamp ON compliance.travel_rule_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_travel_rule_transaction_id ON compliance.travel_rule_messages(transaction_id);
CREATE INDEX IF NOT EXISTS idx_travel_rule_originator_country ON compliance.travel_rule_messages(originator_country);
CREATE INDEX IF NOT EXISTS idx_travel_rule_beneficiary_country ON compliance.travel_rule_messages(beneficiary_country);
CREATE INDEX IF NOT EXISTS idx_travel_rule_currency ON compliance.travel_rule_messages(transaction_currency);
CREATE INDEX IF NOT EXISTS idx_travel_rule_created_at ON compliance.travel_rule_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_travel_rule_pending_retry ON compliance.travel_rule_messages(status, retry_count, next_retry_at) 
    WHERE status IN ('pending', 'failed') AND retry_count < max_retries;

-- ==================== CARF REPORTS TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.carf_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reporting entity information
    reporting_entity_name VARCHAR(255) NOT NULL,
    reporting_entity_country CHAR(2) NOT NULL,
    reporting_entity_registration_number VARCHAR(100) NOT NULL,
    reporting_entity_address TEXT NOT NULL,
    reporting_entity_tax_id VARCHAR(100),
    reporting_entity_lei VARCHAR(20),
    
    -- Reportable person information
    reportable_person_name VARCHAR(255) NOT NULL,
    reportable_person_address TEXT NOT NULL,
    reportable_person_date_of_birth VARCHAR(10),
    reportable_person_national_id VARCHAR(100),
    reportable_person_country CHAR(2) NOT NULL,
    reportable_person_tax_id VARCHAR(100),
    reportable_person_occupation VARCHAR(100),
    reportable_person_customer_type VARCHAR(20) NOT NULL CHECK (reportable_person_customer_type IN ('individual', 'business', 'trust')),
    
    -- Crypto asset information
    crypto_asset_type VARCHAR(20) NOT NULL,
    crypto_asset_amount VARCHAR(50) NOT NULL,
    crypto_asset_value VARCHAR(50) NOT NULL,
    crypto_asset_currency VARCHAR(10) NOT NULL,
    crypto_asset_exchange_rate VARCHAR(50) NOT NULL,
    crypto_asset_market_value VARCHAR(50),
    
    -- Transaction information
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('exchange', 'transfer', 'disposal', 'acquisition', 'mining', 'staking')),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_counterparty VARCHAR(255),
    transaction_platform VARCHAR(100),
    transaction_fees VARCHAR(50) NOT NULL,
    transaction_description TEXT,
    transaction_hash VARCHAR(255),
    transaction_wallet_address VARCHAR(255),
    
    -- Reporting period
    reporting_period_start_date DATE NOT NULL,
    reporting_period_end_date DATE NOT NULL,
    reporting_period_fiscal_year VARCHAR(10),
    
    -- Status and tracking
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'submitted', 'acknowledged', 'rejected')),
    report_id VARCHAR(100) NOT NULL UNIQUE,
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    
    -- Multi-tenancy
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for CARF reports
CREATE INDEX IF NOT EXISTS idx_carf_tenant_id ON compliance.carf_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carf_broker_id ON compliance.carf_reports(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carf_user_id ON compliance.carf_reports(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carf_status ON compliance.carf_reports(status);
CREATE INDEX IF NOT EXISTS idx_carf_country ON compliance.carf_reports(reportable_person_country);
CREATE INDEX IF NOT EXISTS idx_carf_asset_type ON compliance.carf_reports(crypto_asset_type);
CREATE INDEX IF NOT EXISTS idx_carf_transaction_date ON compliance.carf_reports(transaction_date);
CREATE INDEX IF NOT EXISTS idx_carf_reporting_period ON compliance.carf_reports(reporting_period_start_date, reporting_period_end_date);
CREATE INDEX IF NOT EXISTS idx_carf_created_at ON compliance.carf_reports(created_at);

-- ==================== RISK ASSESSMENTS TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    
    -- Risk scoring
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Risk factors (0-100 each)
    factor_amount INTEGER NOT NULL CHECK (factor_amount >= 0 AND factor_amount <= 100),
    factor_frequency INTEGER NOT NULL CHECK (factor_frequency >= 0 AND factor_frequency <= 100),
    factor_geography INTEGER NOT NULL CHECK (factor_geography >= 0 AND factor_geography <= 100),
    factor_counterparty INTEGER NOT NULL CHECK (factor_counterparty >= 0 AND factor_counterparty <= 100),
    factor_pattern INTEGER NOT NULL CHECK (factor_pattern >= 0 AND factor_pattern <= 100),
    factor_velocity INTEGER NOT NULL CHECK (factor_velocity >= 0 AND factor_velocity <= 100),
    factor_concentration INTEGER NOT NULL CHECK (factor_concentration >= 0 AND factor_concentration <= 100),
    factor_source_of_funds INTEGER NOT NULL CHECK (factor_source_of_funds >= 0 AND factor_source_of_funds <= 100),
    
    -- Flags and recommendations (stored as JSONB arrays)
    flags JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',
    
    -- Assessment metadata
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    assessor VARCHAR(100) NOT NULL DEFAULT 'automated',
    review_required BOOLEAN NOT NULL DEFAULT false,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    override_reason TEXT,
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Risk Assessments
CREATE INDEX IF NOT EXISTS idx_risk_tenant_id ON compliance.risk_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_broker_id ON compliance.risk_assessments(broker_id);
CREATE INDEX IF NOT EXISTS idx_risk_user_id ON compliance.risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_transaction_id ON compliance.risk_assessments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_risk_level ON compliance.risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessment_date ON compliance.risk_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_risk_review_required ON compliance.risk_assessments(review_required, reviewed_at) WHERE review_required = true;
CREATE INDEX IF NOT EXISTS idx_risk_created_at ON compliance.risk_assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_flags ON compliance.risk_assessments USING GIN (flags);

-- ==================== COMPLIANCE EVENTS TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('cex', 'dex', 'nft', 'token')),
    entity_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('transaction', 'user', 'wallet', 'asset')),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    metadata_version VARCHAR(20) NOT NULL,
    metadata_correlation_id VARCHAR(100) NOT NULL,
    metadata_causation_id VARCHAR(100),
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Compliance Events
CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON compliance.compliance_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_broker_id ON compliance.compliance_events(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_user_id ON compliance.compliance_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_type ON compliance.compliance_events(type);
CREATE INDEX IF NOT EXISTS idx_events_source ON compliance.compliance_events(source);
CREATE INDEX IF NOT EXISTS idx_events_entity_type ON compliance.compliance_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON compliance.compliance_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_processed ON compliance.compliance_events(processed, created_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON compliance.compliance_events(metadata_correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON compliance.compliance_events(created_at);

-- ==================== AUDIT LOG TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('compliance', 'security', 'system', 'user')),
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    correlation_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON compliance.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_level ON compliance.audit_log(level);
CREATE INDEX IF NOT EXISTS idx_audit_category ON compliance.audit_log(category);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON compliance.audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_correlation_id ON compliance.audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON compliance.audit_log(created_at);

-- ==================== USER COMPLIANCE PROFILES TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.user_compliance_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL UNIQUE,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    
    -- KYC information
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected', 'expired')),
    kyc_provider VARCHAR(100),
    kyc_reference VARCHAR(255),
    kyc_expiry TIMESTAMP WITH TIME ZONE,
    
    -- Risk information
    risk_rating VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
    risk_factors JSONB NOT NULL DEFAULT '{}',
    last_risk_assessment TIMESTAMP WITH TIME ZONE,
    
    -- Jurisdiction and compliance
    jurisdiction CHAR(2),
    tax_residency JSONB DEFAULT '[]',
    politically_exposed BOOLEAN NOT NULL DEFAULT false,
    sanctions_check VARCHAR(20) NOT NULL DEFAULT 'not_checked' CHECK (sanctions_check IN ('passed', 'failed', 'pending', 'not_checked')),
    sanctions_check_date TIMESTAMP WITH TIME ZONE,
    
    -- Compliance settings
    travel_rule_threshold DECIMAL(20, 8),
    carf_reporting_required BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for User Compliance Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON compliance.user_compliance_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_broker_id ON compliance.user_compliance_profiles(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_kyc_status ON compliance.user_compliance_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_risk_rating ON compliance.user_compliance_profiles(risk_rating);
CREATE INDEX IF NOT EXISTS idx_user_profiles_jurisdiction ON compliance.user_compliance_profiles(jurisdiction) WHERE jurisdiction IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_sanctions_check ON compliance.user_compliance_profiles(sanctions_check);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON compliance.user_compliance_profiles(created_at);

-- ==================== MIGRATIONS TABLE ====================

CREATE TABLE IF NOT EXISTS compliance.migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    checksum VARCHAR(64) NOT NULL
);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION compliance.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_vasp_registry_updated_at
    BEFORE UPDATE ON compliance.vasp_registry
    FOR EACH ROW EXECUTE FUNCTION compliance.update_updated_at_column();

CREATE TRIGGER update_travel_rule_messages_updated_at
    BEFORE UPDATE ON compliance.travel_rule_messages
    FOR EACH ROW EXECUTE FUNCTION compliance.update_updated_at_column();

CREATE TRIGGER update_carf_reports_updated_at
    BEFORE UPDATE ON compliance.carf_reports
    FOR EACH ROW EXECUTE FUNCTION compliance.update_updated_at_column();

CREATE TRIGGER update_risk_assessments_updated_at
    BEFORE UPDATE ON compliance.risk_assessments
    FOR EACH ROW EXECUTE FUNCTION compliance.update_updated_at_column();

CREATE TRIGGER update_user_compliance_profiles_updated_at
    BEFORE UPDATE ON compliance.user_compliance_profiles
    FOR EACH ROW EXECUTE FUNCTION compliance.update_updated_at_column();

-- ==================== RECORD MIGRATION ====================

INSERT INTO compliance.migrations (name, success, checksum)
VALUES ('001_create_compliance_schema', true, 'initial_schema_v1')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions (adjust as needed for your environment)
-- GRANT USAGE ON SCHEMA compliance TO compliance_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compliance TO compliance_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA compliance TO compliance_user;
