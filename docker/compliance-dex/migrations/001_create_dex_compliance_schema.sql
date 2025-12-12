-- DEX Compliance Service Database Schema
-- Migration: 001_create_dex_compliance_schema
-- Description: Creates the initial schema for DEX compliance data

-- Create schema
CREATE SCHEMA IF NOT EXISTS dex_compliance;

-- ==================== WALLET SCREENING TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.wallet_screenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    screening_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    flags TEXT[] NOT NULL DEFAULT '{}',
    sanctions_match BOOLEAN NOT NULL DEFAULT FALSE,
    mixer_interaction BOOLEAN NOT NULL DEFAULT FALSE,
    darknet_interaction BOOLEAN NOT NULL DEFAULT FALSE,
    scam_interaction BOOLEAN NOT NULL DEFAULT FALSE,
    high_risk_exchange_interaction BOOLEAN NOT NULL DEFAULT FALSE,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    total_volume_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    first_transaction_date TIMESTAMP WITH TIME ZONE,
    last_transaction_date TIMESTAMP WITH TIME ZONE,
    associated_addresses TEXT[] NOT NULL DEFAULT '{}',
    screening_provider VARCHAR(100) NOT NULL,
    raw_response JSONB,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for wallet screenings
CREATE INDEX idx_wallet_screenings_wallet_chain ON dex_compliance.wallet_screenings(wallet_address, chain_id);
CREATE INDEX idx_wallet_screenings_tenant ON dex_compliance.wallet_screenings(tenant_id);
CREATE INDEX idx_wallet_screenings_risk_level ON dex_compliance.wallet_screenings(risk_level);
CREATE INDEX idx_wallet_screenings_sanctions ON dex_compliance.wallet_screenings(sanctions_match) WHERE sanctions_match = TRUE;
CREATE INDEX idx_wallet_screenings_date ON dex_compliance.wallet_screenings(screening_date DESC);

-- ==================== DEX SWAPS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.dex_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    chain_id INTEGER NOT NULL,
    protocol VARCHAR(100) NOT NULL,
    pool_address VARCHAR(66) NOT NULL,
    token_in_address VARCHAR(66) NOT NULL,
    token_in_symbol VARCHAR(20) NOT NULL,
    token_in_amount DECIMAL(78, 0) NOT NULL,
    token_in_decimals INTEGER NOT NULL,
    token_out_address VARCHAR(66) NOT NULL,
    token_out_symbol VARCHAR(20) NOT NULL,
    token_out_amount DECIMAL(78, 0) NOT NULL,
    token_out_decimals INTEGER NOT NULL,
    amount_in_usd DECIMAL(30, 8) NOT NULL,
    amount_out_usd DECIMAL(30, 8) NOT NULL,
    price_impact DECIMAL(10, 6) NOT NULL DEFAULT 0,
    slippage DECIMAL(10, 6) NOT NULL DEFAULT 0,
    gas_used DECIMAL(30, 0) NOT NULL,
    gas_price DECIMAL(30, 0) NOT NULL,
    gas_cost_usd DECIMAL(30, 8) NOT NULL,
    wallet_address VARCHAR(66) NOT NULL,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_hash, chain_id)
);

-- Indexes for DEX swaps
CREATE INDEX idx_dex_swaps_wallet ON dex_compliance.dex_swaps(wallet_address);
CREATE INDEX idx_dex_swaps_chain ON dex_compliance.dex_swaps(chain_id);
CREATE INDEX idx_dex_swaps_protocol ON dex_compliance.dex_swaps(protocol);
CREATE INDEX idx_dex_swaps_timestamp ON dex_compliance.dex_swaps(timestamp DESC);
CREATE INDEX idx_dex_swaps_tenant ON dex_compliance.dex_swaps(tenant_id);
CREATE INDEX idx_dex_swaps_risk ON dex_compliance.dex_swaps(risk_level) WHERE risk_level IN ('high', 'critical');

-- ==================== DEX LIQUIDITY TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.dex_liquidity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    chain_id INTEGER NOT NULL,
    protocol VARCHAR(100) NOT NULL,
    pool_address VARCHAR(66) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('add', 'remove')),
    token0_address VARCHAR(66) NOT NULL,
    token0_symbol VARCHAR(20) NOT NULL,
    token0_amount DECIMAL(78, 0) NOT NULL,
    token0_decimals INTEGER NOT NULL,
    token1_address VARCHAR(66) NOT NULL,
    token1_symbol VARCHAR(20) NOT NULL,
    token1_amount DECIMAL(78, 0) NOT NULL,
    token1_decimals INTEGER NOT NULL,
    lp_token_amount DECIMAL(78, 0) NOT NULL,
    total_value_usd DECIMAL(30, 8) NOT NULL,
    wallet_address VARCHAR(66) NOT NULL,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_hash, chain_id)
);

-- Indexes for DEX liquidity
CREATE INDEX idx_dex_liquidity_wallet ON dex_compliance.dex_liquidity(wallet_address);
CREATE INDEX idx_dex_liquidity_chain ON dex_compliance.dex_liquidity(chain_id);
CREATE INDEX idx_dex_liquidity_protocol ON dex_compliance.dex_liquidity(protocol);
CREATE INDEX idx_dex_liquidity_timestamp ON dex_compliance.dex_liquidity(timestamp DESC);
CREATE INDEX idx_dex_liquidity_tenant ON dex_compliance.dex_liquidity(tenant_id);

-- ==================== BRIDGE TRANSACTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.bridge_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_chain_id INTEGER NOT NULL,
    destination_chain_id INTEGER NOT NULL,
    bridge_protocol VARCHAR(100) NOT NULL,
    source_transaction_hash VARCHAR(66) NOT NULL,
    destination_transaction_hash VARCHAR(66),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    token_address VARCHAR(66) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_amount DECIMAL(78, 0) NOT NULL,
    token_decimals INTEGER NOT NULL,
    amount_usd DECIMAL(30, 8) NOT NULL,
    source_wallet VARCHAR(66) NOT NULL,
    destination_wallet VARCHAR(66) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    bridge_fee_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_flags TEXT[],
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(source_transaction_hash, source_chain_id)
);

-- Indexes for bridge transactions
CREATE INDEX idx_bridge_source_wallet ON dex_compliance.bridge_transactions(source_wallet);
CREATE INDEX idx_bridge_dest_wallet ON dex_compliance.bridge_transactions(destination_wallet);
CREATE INDEX idx_bridge_status ON dex_compliance.bridge_transactions(status);
CREATE INDEX idx_bridge_timestamp ON dex_compliance.bridge_transactions(timestamp DESC);
CREATE INDEX idx_bridge_tenant ON dex_compliance.bridge_transactions(tenant_id);
CREATE INDEX idx_bridge_risk ON dex_compliance.bridge_transactions(risk_level) WHERE risk_level IN ('high', 'critical');

-- ==================== PROTOCOL RISK TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.protocol_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(100) NOT NULL,
    chain_id INTEGER NOT NULL,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    factor_audit_status INTEGER NOT NULL DEFAULT 0,
    factor_tvl_risk INTEGER NOT NULL DEFAULT 0,
    factor_age_risk INTEGER NOT NULL DEFAULT 0,
    factor_governance_risk INTEGER NOT NULL DEFAULT 0,
    factor_oracle_risk INTEGER NOT NULL DEFAULT 0,
    factor_upgradeability_risk INTEGER NOT NULL DEFAULT 0,
    factor_concentration_risk INTEGER NOT NULL DEFAULT 0,
    factor_regulatory_risk INTEGER NOT NULL DEFAULT 0,
    audits JSONB NOT NULL DEFAULT '[]',
    tvl_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    launch_date DATE,
    is_upgradeable BOOLEAN NOT NULL DEFAULT FALSE,
    has_timelock BOOLEAN NOT NULL DEFAULT FALSE,
    governance_type VARCHAR(20) NOT NULL CHECK (governance_type IN ('multisig', 'dao', 'centralized', 'none')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(protocol, chain_id)
);

-- Indexes for protocol risks
CREATE INDEX idx_protocol_risks_protocol ON dex_compliance.protocol_risks(protocol);
CREATE INDEX idx_protocol_risks_chain ON dex_compliance.protocol_risks(chain_id);
CREATE INDEX idx_protocol_risks_level ON dex_compliance.protocol_risks(risk_level);

-- ==================== DEX RISK ASSESSMENTS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    wallet_address VARCHAR(66) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    factor_wallet_risk INTEGER NOT NULL DEFAULT 0,
    factor_protocol_risk INTEGER NOT NULL DEFAULT 0,
    factor_transaction_risk INTEGER NOT NULL DEFAULT 0,
    factor_geography_risk INTEGER NOT NULL DEFAULT 0,
    factor_pattern_risk INTEGER NOT NULL DEFAULT 0,
    factor_velocity_risk INTEGER NOT NULL DEFAULT 0,
    factor_concentration_risk INTEGER NOT NULL DEFAULT 0,
    factor_counterparty_risk INTEGER NOT NULL DEFAULT 0,
    flags TEXT[] NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    assessor VARCHAR(100) NOT NULL,
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    override_reason TEXT,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for risk assessments
CREATE INDEX idx_dex_risk_transaction ON dex_compliance.risk_assessments(transaction_id);
CREATE INDEX idx_dex_risk_wallet ON dex_compliance.risk_assessments(wallet_address);
CREATE INDEX idx_dex_risk_tenant ON dex_compliance.risk_assessments(tenant_id);
CREATE INDEX idx_dex_risk_level ON dex_compliance.risk_assessments(risk_level);
CREATE INDEX idx_dex_risk_review ON dex_compliance.risk_assessments(review_required) WHERE review_required = TRUE;
CREATE INDEX idx_dex_risk_date ON dex_compliance.risk_assessments(assessment_date DESC);

-- ==================== DEX TRAVEL RULE TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.travel_rule_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bridge_transaction_id UUID NOT NULL REFERENCES dex_compliance.bridge_transactions(id),
    source_chain_id INTEGER NOT NULL,
    destination_chain_id INTEGER NOT NULL,
    source_wallet VARCHAR(66) NOT NULL,
    destination_wallet VARCHAR(66) NOT NULL,
    amount DECIMAL(78, 0) NOT NULL,
    amount_usd DECIMAL(30, 8) NOT NULL,
    token VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'received', 'acknowledged', 'failed')),
    message_id VARCHAR(100) NOT NULL UNIQUE,
    originator_name VARCHAR(255),
    originator_address TEXT,
    originator_country VARCHAR(3),
    originator_account_number VARCHAR(100),
    beneficiary_name VARCHAR(255),
    beneficiary_address TEXT,
    beneficiary_country VARCHAR(3),
    beneficiary_account_number VARCHAR(100),
    originator_vasp VARCHAR(255),
    beneficiary_vasp VARCHAR(255),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for travel rule messages
CREATE INDEX idx_dex_travel_rule_bridge ON dex_compliance.travel_rule_messages(bridge_transaction_id);
CREATE INDEX idx_dex_travel_rule_status ON dex_compliance.travel_rule_messages(status);
CREATE INDEX idx_dex_travel_rule_tenant ON dex_compliance.travel_rule_messages(tenant_id);
CREATE INDEX idx_dex_travel_rule_retry ON dex_compliance.travel_rule_messages(next_retry_at) 
    WHERE status IN ('pending', 'failed') AND retry_count < max_retries;

-- ==================== DEX CARF REPORTS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.carf_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(100) NOT NULL UNIQUE,
    wallet_address VARCHAR(66) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date DATE NOT NULL,
    reporting_period_end_date DATE NOT NULL,
    reporting_period_fiscal_year VARCHAR(10),
    total_swap_volume_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    total_liquidity_provided_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    total_bridge_volume_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    total_fees_usd DECIMAL(30, 8) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending', 'submitted', 'acknowledged', 'rejected')),
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for CARF reports
CREATE INDEX idx_dex_carf_wallet ON dex_compliance.carf_reports(wallet_address);
CREATE INDEX idx_dex_carf_tenant ON dex_compliance.carf_reports(tenant_id);
CREATE INDEX idx_dex_carf_status ON dex_compliance.carf_reports(status);
CREATE INDEX idx_dex_carf_period ON dex_compliance.carf_reports(reporting_period_start_date, reporting_period_end_date);

-- ==================== DEX CARF TRANSACTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.carf_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carf_report_id UUID NOT NULL REFERENCES dex_compliance.carf_reports(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('swap', 'liquidity_add', 'liquidity_remove', 'bridge', 'stake', 'unstake')),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    token_in VARCHAR(20) NOT NULL,
    token_out VARCHAR(20) NOT NULL,
    amount_in DECIMAL(78, 0) NOT NULL,
    amount_out DECIMAL(78, 0) NOT NULL,
    value_usd DECIMAL(30, 8) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    protocol VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for CARF transactions
CREATE INDEX idx_dex_carf_tx_report ON dex_compliance.carf_transactions(carf_report_id);
CREATE INDEX idx_dex_carf_tx_type ON dex_compliance.carf_transactions(transaction_type);
CREATE INDEX idx_dex_carf_tx_date ON dex_compliance.carf_transactions(transaction_date);

-- ==================== COMPLIANCE EVENTS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('wallet', 'swap', 'liquidity', 'bridge', 'protocol', 'assessment', 'travel_rule', 'carf')),
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for compliance events
CREATE INDEX idx_dex_events_type ON dex_compliance.compliance_events(event_type);
CREATE INDEX idx_dex_events_entity ON dex_compliance.compliance_events(entity_type, entity_id);
CREATE INDEX idx_dex_events_tenant ON dex_compliance.compliance_events(tenant_id);
CREATE INDEX idx_dex_events_date ON dex_compliance.compliance_events(created_at DESC);

-- ==================== AUDIT LOG TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'system', 'admin')),
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX idx_dex_audit_resource ON dex_compliance.audit_log(resource_type, resource_id);
CREATE INDEX idx_dex_audit_actor ON dex_compliance.audit_log(actor_id);
CREATE INDEX idx_dex_audit_tenant ON dex_compliance.audit_log(tenant_id);
CREATE INDEX idx_dex_audit_date ON dex_compliance.audit_log(created_at DESC);

-- ==================== MIGRATIONS TABLE ====================

CREATE TABLE IF NOT EXISTS dex_compliance.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO dex_compliance.migrations (name) VALUES ('001_create_dex_compliance_schema');

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION dex_compliance.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_wallet_screenings_updated_at
    BEFORE UPDATE ON dex_compliance.wallet_screenings
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_dex_swaps_updated_at
    BEFORE UPDATE ON dex_compliance.dex_swaps
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_dex_liquidity_updated_at
    BEFORE UPDATE ON dex_compliance.dex_liquidity
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_bridge_transactions_updated_at
    BEFORE UPDATE ON dex_compliance.bridge_transactions
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_protocol_risks_updated_at
    BEFORE UPDATE ON dex_compliance.protocol_risks
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_risk_assessments_updated_at
    BEFORE UPDATE ON dex_compliance.risk_assessments
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_travel_rule_messages_updated_at
    BEFORE UPDATE ON dex_compliance.travel_rule_messages
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

CREATE TRIGGER update_carf_reports_updated_at
    BEFORE UPDATE ON dex_compliance.carf_reports
    FOR EACH ROW EXECUTE FUNCTION dex_compliance.update_updated_at_column();

-- ==================== COMMENTS ====================

COMMENT ON SCHEMA dex_compliance IS 'DEX Compliance Service schema for decentralized exchange compliance data';
COMMENT ON TABLE dex_compliance.wallet_screenings IS 'Wallet risk screening results from on-chain analysis';
COMMENT ON TABLE dex_compliance.dex_swaps IS 'DEX swap transactions for compliance monitoring';
COMMENT ON TABLE dex_compliance.dex_liquidity IS 'DEX liquidity provision events';
COMMENT ON TABLE dex_compliance.bridge_transactions IS 'Cross-chain bridge transactions';
COMMENT ON TABLE dex_compliance.protocol_risks IS 'DeFi protocol risk assessments';
COMMENT ON TABLE dex_compliance.risk_assessments IS 'Transaction risk assessments';
COMMENT ON TABLE dex_compliance.travel_rule_messages IS 'Travel Rule messages for cross-chain transfers';
COMMENT ON TABLE dex_compliance.carf_reports IS 'CARF reporting data for DEX transactions';
COMMENT ON TABLE dex_compliance.carf_transactions IS 'Individual transactions included in CARF reports';
COMMENT ON TABLE dex_compliance.compliance_events IS 'Compliance event log';
COMMENT ON TABLE dex_compliance.audit_log IS 'Audit trail for all compliance operations';
