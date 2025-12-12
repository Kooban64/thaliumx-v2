-- Token Compliance Service Database Schema
-- Migration: 001_create_token_compliance_schema.sql
-- Description: Creates all tables for the Token Compliance Service

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TOKEN CONTRACTS ====================

CREATE TABLE IF NOT EXISTS token_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    total_supply VARCHAR(78) NOT NULL,
    standard VARCHAR(20) NOT NULL CHECK (standard IN ('ERC20', 'ERC777', 'BEP20', 'TRC20')),
    deployer_address VARCHAR(42) NOT NULL,
    deployment_block BIGINT NOT NULL,
    deployment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    is_proxy BOOLEAN NOT NULL DEFAULT false,
    implementation_address VARCHAR(42),
    risk_score INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_address, chain_id, tenant_id)
);

CREATE INDEX idx_token_contracts_address ON token_contracts(contract_address);
CREATE INDEX idx_token_contracts_chain ON token_contracts(chain_id);
CREATE INDEX idx_token_contracts_tenant ON token_contracts(tenant_id);
CREATE INDEX idx_token_contracts_deployer ON token_contracts(deployer_address);
CREATE INDEX idx_token_contracts_risk ON token_contracts(risk_level);

-- ==================== TOKEN HOLDERS ====================

CREATE TABLE IF NOT EXISTS token_holders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    holder_address VARCHAR(42) NOT NULL,
    balance VARCHAR(78) NOT NULL,
    balance_usd VARCHAR(50) NOT NULL,
    percentage_of_supply DECIMAL(10, 6) NOT NULL,
    first_acquisition_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    is_contract BOOLEAN NOT NULL DEFAULT false,
    is_exchange BOOLEAN NOT NULL DEFAULT false,
    is_whale BOOLEAN NOT NULL DEFAULT false,
    risk_score INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_address, chain_id, holder_address, tenant_id)
);

CREATE INDEX idx_token_holders_address ON token_holders(holder_address);
CREATE INDEX idx_token_holders_contract ON token_holders(contract_address);
CREATE INDEX idx_token_holders_chain ON token_holders(chain_id);
CREATE INDEX idx_token_holders_tenant ON token_holders(tenant_id);
CREATE INDEX idx_token_holders_user ON token_holders(user_id);
CREATE INDEX idx_token_holders_whale ON token_holders(is_whale);

-- ==================== TOKEN TRANSFERS ====================

CREATE TABLE IF NOT EXISTS token_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    chain_id INTEGER NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_decimals INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    transfer_type VARCHAR(20) NOT NULL CHECK (transfer_type IN ('transfer', 'mint', 'burn', 'approval')),
    gas_used VARCHAR(50) NOT NULL,
    gas_price VARCHAR(50) NOT NULL,
    gas_cost_usd VARCHAR(50) NOT NULL,
    risk_score INTEGER,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash, chain_id, tenant_id)
);

CREATE INDEX idx_token_transfers_hash ON token_transfers(transaction_hash);
CREATE INDEX idx_token_transfers_from ON token_transfers(from_address);
CREATE INDEX idx_token_transfers_to ON token_transfers(to_address);
CREATE INDEX idx_token_transfers_contract ON token_transfers(contract_address);
CREATE INDEX idx_token_transfers_chain ON token_transfers(chain_id);
CREATE INDEX idx_token_transfers_tenant ON token_transfers(tenant_id);
CREATE INDEX idx_token_transfers_timestamp ON token_transfers(timestamp);
CREATE INDEX idx_token_transfers_type ON token_transfers(transfer_type);
CREATE INDEX idx_token_transfers_user ON token_transfers(user_id);

-- ==================== TOKEN APPROVALS ====================

CREATE TABLE IF NOT EXISTS token_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    chain_id INTEGER NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    spender_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    is_unlimited BOOLEAN NOT NULL DEFAULT false,
    spender_type VARCHAR(20) NOT NULL CHECK (spender_type IN ('dex', 'bridge', 'lending', 'unknown')),
    risk_score INTEGER,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash, chain_id, tenant_id)
);

CREATE INDEX idx_token_approvals_owner ON token_approvals(owner_address);
CREATE INDEX idx_token_approvals_spender ON token_approvals(spender_address);
CREATE INDEX idx_token_approvals_contract ON token_approvals(contract_address);
CREATE INDEX idx_token_approvals_chain ON token_approvals(chain_id);
CREATE INDEX idx_token_approvals_tenant ON token_approvals(tenant_id);
CREATE INDEX idx_token_approvals_unlimited ON token_approvals(is_unlimited);

-- ==================== TOKEN PRESALES ====================

CREATE TABLE IF NOT EXISTS token_presales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    presale_address VARCHAR(42) NOT NULL,
    token_price VARCHAR(50) NOT NULL,
    token_price_usd VARCHAR(50) NOT NULL,
    soft_cap VARCHAR(78) NOT NULL,
    hard_cap VARCHAR(78) NOT NULL,
    min_contribution VARCHAR(78) NOT NULL,
    max_contribution VARCHAR(78) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    cliff_duration INTEGER,
    vesting_duration INTEGER,
    tge_percentage DECIMAL(5, 2),
    vesting_percentage DECIMAL(5, 2),
    vesting_interval INTEGER,
    status VARCHAR(20) NOT NULL CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled', 'failed')),
    total_raised VARCHAR(78) NOT NULL DEFAULT '0',
    participant_count INTEGER NOT NULL DEFAULT 0,
    kyc_required BOOLEAN NOT NULL DEFAULT false,
    whitelist_required BOOLEAN NOT NULL DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(presale_address, chain_id, tenant_id)
);

CREATE INDEX idx_token_presales_contract ON token_presales(contract_address);
CREATE INDEX idx_token_presales_chain ON token_presales(chain_id);
CREATE INDEX idx_token_presales_tenant ON token_presales(tenant_id);
CREATE INDEX idx_token_presales_status ON token_presales(status);
CREATE INDEX idx_token_presales_time ON token_presales(start_time, end_time);

-- ==================== PRESALE CONTRIBUTIONS ====================

CREATE TABLE IF NOT EXISTS presale_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presale_id UUID NOT NULL REFERENCES token_presales(id),
    contributor_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    token_amount VARCHAR(78) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_amount VARCHAR(78) NOT NULL DEFAULT '0',
    unclaimed_amount VARCHAR(78) NOT NULL,
    next_claim_date TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_presale_contributions_presale ON presale_contributions(presale_id);
CREATE INDEX idx_presale_contributions_contributor ON presale_contributions(contributor_address);
CREATE INDEX idx_presale_contributions_tenant ON presale_contributions(tenant_id);
CREATE INDEX idx_presale_contributions_user ON presale_contributions(user_id);

-- ==================== WALLET SCREENINGS ====================

CREATE TABLE IF NOT EXISTS wallet_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    screening_date TIMESTAMP WITH TIME ZONE NOT NULL,
    provider VARCHAR(100) NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    flags TEXT[] NOT NULL DEFAULT '{}',
    sanctions_match BOOLEAN NOT NULL DEFAULT false,
    sanctions_details JSONB,
    mixer_exposure DECIMAL(5, 2) NOT NULL DEFAULT 0,
    darknet_exposure DECIMAL(5, 2) NOT NULL DEFAULT 0,
    gambling_exposure DECIMAL(5, 2) NOT NULL DEFAULT 0,
    scam_exposure DECIMAL(5, 2) NOT NULL DEFAULT 0,
    stolen_funds_exposure DECIMAL(5, 2) NOT NULL DEFAULT 0,
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_screenings_address ON wallet_screenings(wallet_address);
CREATE INDEX idx_wallet_screenings_chain ON wallet_screenings(chain_id);
CREATE INDEX idx_wallet_screenings_tenant ON wallet_screenings(tenant_id);
CREATE INDEX idx_wallet_screenings_date ON wallet_screenings(screening_date);
CREATE INDEX idx_wallet_screenings_risk ON wallet_screenings(risk_level);
CREATE INDEX idx_wallet_screenings_sanctions ON wallet_screenings(sanctions_match);

-- ==================== TOKEN RISK ASSESSMENTS ====================

CREATE TABLE IF NOT EXISTS token_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    factor_sender_risk INTEGER NOT NULL,
    factor_recipient_risk INTEGER NOT NULL,
    factor_token_risk INTEGER NOT NULL,
    factor_amount_risk INTEGER NOT NULL,
    factor_velocity_risk INTEGER NOT NULL,
    factor_pattern_risk INTEGER NOT NULL,
    factor_geography_risk INTEGER NOT NULL,
    factor_contract_risk INTEGER NOT NULL,
    flags TEXT[] NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    assessor VARCHAR(100) NOT NULL,
    review_required BOOLEAN NOT NULL DEFAULT false,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_risk_assessments_transfer ON token_risk_assessments(transfer_id);
CREATE INDEX idx_token_risk_assessments_hash ON token_risk_assessments(transaction_hash);
CREATE INDEX idx_token_risk_assessments_from ON token_risk_assessments(from_address);
CREATE INDEX idx_token_risk_assessments_to ON token_risk_assessments(to_address);
CREATE INDEX idx_token_risk_assessments_tenant ON token_risk_assessments(tenant_id);
CREATE INDEX idx_token_risk_assessments_risk ON token_risk_assessments(risk_level);
CREATE INDEX idx_token_risk_assessments_review ON token_risk_assessments(review_required, reviewed_at);
CREATE INDEX idx_token_risk_assessments_date ON token_risk_assessments(assessment_date);

-- ==================== TOKEN TRAVEL RULE MESSAGES ====================

CREATE TABLE IF NOT EXISTS token_travel_rule_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    chain_id INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'received', 'acknowledged', 'failed')),
    message_id VARCHAR(100) NOT NULL,
    originator_name VARCHAR(255),
    originator_address TEXT,
    originator_country VARCHAR(3),
    originator_account_number VARCHAR(100),
    originator_date_of_birth VARCHAR(20),
    originator_place_of_birth VARCHAR(255),
    originator_national_id VARCHAR(100),
    beneficiary_name VARCHAR(255),
    beneficiary_address TEXT,
    beneficiary_country VARCHAR(3),
    beneficiary_account_number VARCHAR(100),
    originator_vasp VARCHAR(255),
    beneficiary_vasp VARCHAR(255),
    originator_vasp_lei VARCHAR(20),
    beneficiary_vasp_lei VARCHAR(20),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_travel_rule_transfer ON token_travel_rule_messages(transfer_id);
CREATE INDEX idx_token_travel_rule_hash ON token_travel_rule_messages(transaction_hash);
CREATE INDEX idx_token_travel_rule_from ON token_travel_rule_messages(from_address);
CREATE INDEX idx_token_travel_rule_to ON token_travel_rule_messages(to_address);
CREATE INDEX idx_token_travel_rule_tenant ON token_travel_rule_messages(tenant_id);
CREATE INDEX idx_token_travel_rule_status ON token_travel_rule_messages(status);
CREATE INDEX idx_token_travel_rule_message ON token_travel_rule_messages(message_id);
CREATE INDEX idx_token_travel_rule_retry ON token_travel_rule_messages(next_retry_at) WHERE status = 'pending';

-- ==================== TOKEN CARF REPORTS ====================

CREATE TABLE IF NOT EXISTS token_carf_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(50) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_fiscal_year VARCHAR(10),
    total_transfer_in_usd VARCHAR(50) NOT NULL,
    total_transfer_out_usd VARCHAR(50) NOT NULL,
    total_swap_volume_usd VARCHAR(50) NOT NULL,
    total_staking_rewards_usd VARCHAR(50) NOT NULL,
    net_gain_loss_usd VARCHAR(50) NOT NULL,
    transaction_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending', 'submitted', 'acknowledged', 'rejected')),
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_carf_reports_wallet ON token_carf_reports(wallet_address);
CREATE INDEX idx_token_carf_reports_tenant ON token_carf_reports(tenant_id);
CREATE INDEX idx_token_carf_reports_user ON token_carf_reports(user_id);
CREATE INDEX idx_token_carf_reports_status ON token_carf_reports(status);
CREATE INDEX idx_token_carf_reports_period ON token_carf_reports(reporting_period_start_date, reporting_period_end_date);

-- ==================== TOKEN CARF HOLDINGS ====================

CREATE TABLE IF NOT EXISTS token_carf_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carf_report_id UUID NOT NULL REFERENCES token_carf_reports(id) ON DELETE CASCADE,
    contract_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    chain_id INTEGER NOT NULL,
    balance VARCHAR(78) NOT NULL,
    balance_usd VARCHAR(50) NOT NULL,
    cost_basis VARCHAR(50) NOT NULL,
    unrealized_gain_loss VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_carf_holdings_report ON token_carf_holdings(carf_report_id);
CREATE INDEX idx_token_carf_holdings_contract ON token_carf_holdings(contract_address);

-- ==================== TOKEN CARF TRANSACTIONS ====================

CREATE TABLE IF NOT EXISTS token_carf_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carf_report_id UUID NOT NULL REFERENCES token_carf_reports(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('transfer_in', 'transfer_out', 'swap', 'stake', 'unstake', 'claim')),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    counterparty VARCHAR(42) NOT NULL,
    gain_loss VARCHAR(50),
    cost_basis VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_carf_transactions_report ON token_carf_transactions(carf_report_id);
CREATE INDEX idx_token_carf_transactions_date ON token_carf_transactions(transaction_date);
CREATE INDEX idx_token_carf_transactions_type ON token_carf_transactions(transaction_type);

-- ==================== AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS token_compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(100),
    actor_type VARCHAR(50) NOT NULL,
    changes JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_audit_log_entity ON token_compliance_audit_log(entity_type, entity_id);
CREATE INDEX idx_token_audit_log_actor ON token_compliance_audit_log(actor_id);
CREATE INDEX idx_token_audit_log_tenant ON token_compliance_audit_log(tenant_id);
CREATE INDEX idx_token_audit_log_created ON token_compliance_audit_log(created_at);
CREATE INDEX idx_token_audit_log_action ON token_compliance_audit_log(action);

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_token_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_token_contracts_updated_at
    BEFORE UPDATE ON token_contracts
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_holders_updated_at
    BEFORE UPDATE ON token_holders
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_approvals_updated_at
    BEFORE UPDATE ON token_approvals
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_presales_updated_at
    BEFORE UPDATE ON token_presales
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_wallet_screenings_updated_at
    BEFORE UPDATE ON wallet_screenings
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_risk_assessments_updated_at
    BEFORE UPDATE ON token_risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_travel_rule_updated_at
    BEFORE UPDATE ON token_travel_rule_messages
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

CREATE TRIGGER update_token_carf_reports_updated_at
    BEFORE UPDATE ON token_carf_reports
    FOR EACH ROW EXECUTE FUNCTION update_token_compliance_updated_at();

-- ==================== COMMENTS ====================

COMMENT ON TABLE token_contracts IS 'Token contract metadata and risk information';
COMMENT ON TABLE token_holders IS 'Token holder balances and risk profiles';
COMMENT ON TABLE token_transfers IS 'Token transfer history for compliance tracking';
COMMENT ON TABLE token_approvals IS 'Token approval tracking for risk monitoring';
COMMENT ON TABLE token_presales IS 'Token presale information and compliance data';
COMMENT ON TABLE presale_contributions IS 'Individual presale contributions';
COMMENT ON TABLE wallet_screenings IS 'Wallet screening results for sanctions and risk';
COMMENT ON TABLE token_risk_assessments IS 'Risk assessment results for token transfers';
COMMENT ON TABLE token_travel_rule_messages IS 'FATF Travel Rule compliance messages';
COMMENT ON TABLE token_carf_reports IS 'OECD CARF tax reporting data';
COMMENT ON TABLE token_carf_holdings IS 'Token holdings for CARF reports';
COMMENT ON TABLE token_carf_transactions IS 'Token transactions for CARF reports';
COMMENT ON TABLE token_compliance_audit_log IS 'Audit trail for compliance actions';
