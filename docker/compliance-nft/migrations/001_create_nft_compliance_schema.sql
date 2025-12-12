-- NFT Compliance Service Database Schema
-- Migration: 001_create_nft_compliance_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== NFT COLLECTIONS ====================

CREATE TABLE IF NOT EXISTS nft_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    description TEXT,
    image_url TEXT,
    banner_url TEXT,
    external_url TEXT,
    creator_address VARCHAR(42) NOT NULL,
    creator_fee DECIMAL(5, 2) NOT NULL DEFAULT 0,
    total_supply INTEGER NOT NULL DEFAULT 0,
    floor_price VARCHAR(78),
    total_volume VARCHAR(78),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score INTEGER,
    risk_level VARCHAR(20),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_address, chain_id, tenant_id)
);

CREATE INDEX idx_nft_collections_contract ON nft_collections(contract_address, chain_id);
CREATE INDEX idx_nft_collections_tenant ON nft_collections(tenant_id);
CREATE INDEX idx_nft_collections_creator ON nft_collections(creator_address);
CREATE INDEX idx_nft_collections_risk ON nft_collections(risk_level);

-- ==================== NFT TOKENS ====================

CREATE TABLE IF NOT EXISTS nft_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id VARCHAR(78) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    owner_address VARCHAR(42) NOT NULL,
    creator_address VARCHAR(42) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    token_uri TEXT NOT NULL,
    token_standard VARCHAR(20) NOT NULL,
    supply INTEGER,
    last_sale_price VARCHAR(78),
    last_sale_currency VARCHAR(20),
    last_sale_date TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER,
    risk_level VARCHAR(20),
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    flag_reason TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_address, token_id, chain_id, tenant_id)
);

CREATE INDEX idx_nft_tokens_contract ON nft_tokens(contract_address, chain_id);
CREATE INDEX idx_nft_tokens_collection ON nft_tokens(collection_id);
CREATE INDEX idx_nft_tokens_owner ON nft_tokens(owner_address);
CREATE INDEX idx_nft_tokens_tenant ON nft_tokens(tenant_id);
CREATE INDEX idx_nft_tokens_flagged ON nft_tokens(flagged) WHERE flagged = TRUE;

-- ==================== NFT SALES ====================

CREATE TABLE IF NOT EXISTS nft_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    chain_id INTEGER NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    seller_address VARCHAR(42) NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    price VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    price_usd VARCHAR(78) NOT NULL,
    marketplace VARCHAR(100) NOT NULL,
    sale_type VARCHAR(20) NOT NULL,
    royalty_amount VARCHAR(78),
    royalty_recipient VARCHAR(42),
    platform_fee VARCHAR(78),
    gas_used VARCHAR(78) NOT NULL,
    gas_price VARCHAR(78) NOT NULL,
    gas_cost_usd VARCHAR(78) NOT NULL,
    risk_score INTEGER,
    risk_level VARCHAR(20),
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash, tenant_id)
);

CREATE INDEX idx_nft_sales_contract ON nft_sales(contract_address, token_id, chain_id);
CREATE INDEX idx_nft_sales_seller ON nft_sales(seller_address);
CREATE INDEX idx_nft_sales_buyer ON nft_sales(buyer_address);
CREATE INDEX idx_nft_sales_timestamp ON nft_sales(timestamp);
CREATE INDEX idx_nft_sales_tenant ON nft_sales(tenant_id);
CREATE INDEX idx_nft_sales_marketplace ON nft_sales(marketplace);

-- ==================== NFT LISTINGS ====================

CREATE TABLE IF NOT EXISTS nft_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    chain_id INTEGER NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    seller_address VARCHAR(42) NOT NULL,
    price VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    price_usd VARCHAR(78) NOT NULL,
    marketplace VARCHAR(100) NOT NULL,
    listing_type VARCHAR(20) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_listings_contract ON nft_listings(contract_address, token_id, chain_id);
CREATE INDEX idx_nft_listings_seller ON nft_listings(seller_address);
CREATE INDEX idx_nft_listings_status ON nft_listings(status);
CREATE INDEX idx_nft_listings_tenant ON nft_listings(tenant_id);

-- ==================== NFT BIDS ====================

CREATE TABLE IF NOT EXISTS nft_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    chain_id INTEGER NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    bidder_address VARCHAR(42) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    amount_usd VARCHAR(78) NOT NULL,
    marketplace VARCHAR(100) NOT NULL,
    bid_type VARCHAR(20) NOT NULL,
    expiration_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_bids_contract ON nft_bids(contract_address, token_id, chain_id);
CREATE INDEX idx_nft_bids_bidder ON nft_bids(bidder_address);
CREATE INDEX idx_nft_bids_status ON nft_bids(status);
CREATE INDEX idx_nft_bids_tenant ON nft_bids(tenant_id);

-- ==================== WASH TRADING DETECTIONS ====================

CREATE TABLE IF NOT EXISTS wash_trading_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    chain_id INTEGER NOT NULL,
    detection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_wash_trading BOOLEAN NOT NULL,
    confidence INTEGER NOT NULL,
    indicators TEXT[] NOT NULL DEFAULT '{}',
    related_transactions TEXT[] NOT NULL DEFAULT '{}',
    related_addresses TEXT[] NOT NULL DEFAULT '{}',
    volume_inflation VARCHAR(78),
    price_manipulation BOOLEAN,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wash_trading_contract ON wash_trading_detections(contract_address, token_id, chain_id);
CREATE INDEX idx_wash_trading_detected ON wash_trading_detections(is_wash_trading) WHERE is_wash_trading = TRUE;
CREATE INDEX idx_wash_trading_tenant ON wash_trading_detections(tenant_id);
CREATE INDEX idx_wash_trading_date ON wash_trading_detections(detection_date);

-- ==================== CONTENT SCREENINGS ====================

CREATE TABLE IF NOT EXISTS content_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    chain_id INTEGER NOT NULL,
    screening_date TIMESTAMP WITH TIME ZONE NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    content_url TEXT NOT NULL,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    flag_reasons TEXT[] NOT NULL DEFAULT '{}',
    moderation_score INTEGER NOT NULL DEFAULT 0,
    categories TEXT[] NOT NULL DEFAULT '{}',
    manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_screenings_contract ON content_screenings(contract_address, token_id, chain_id);
CREATE INDEX idx_content_screenings_flagged ON content_screenings(is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX idx_content_screenings_review ON content_screenings(manual_review_required) WHERE manual_review_required = TRUE;
CREATE INDEX idx_content_screenings_tenant ON content_screenings(tenant_id);

-- ==================== ROYALTY COMPLIANCE ====================

CREATE TABLE IF NOT EXISTS royalty_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    collection_id UUID REFERENCES nft_collections(id),
    royalty_percentage DECIMAL(5, 2) NOT NULL,
    royalty_recipient VARCHAR(42) NOT NULL,
    enforcement_type VARCHAR(20) NOT NULL,
    is_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    total_royalties_paid VARCHAR(78) NOT NULL DEFAULT '0',
    total_royalties_owed VARCHAR(78) NOT NULL DEFAULT '0',
    unpaid_royalties VARCHAR(78) NOT NULL DEFAULT '0',
    last_checked TIMESTAMP WITH TIME ZONE NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_address, chain_id, tenant_id)
);

CREATE INDEX idx_royalty_compliance_contract ON royalty_compliance(contract_address, chain_id);
CREATE INDEX idx_royalty_compliance_compliant ON royalty_compliance(is_compliant) WHERE is_compliant = FALSE;
CREATE INDEX idx_royalty_compliance_tenant ON royalty_compliance(tenant_id);

-- ==================== NFT RISK ASSESSMENTS ====================

CREATE TABLE IF NOT EXISTS nft_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    factor_seller_risk INTEGER NOT NULL,
    factor_buyer_risk INTEGER NOT NULL,
    factor_collection_risk INTEGER NOT NULL,
    factor_price_risk INTEGER NOT NULL,
    factor_content_risk INTEGER NOT NULL,
    factor_wash_trading_risk INTEGER NOT NULL,
    factor_marketplace_risk INTEGER NOT NULL,
    factor_geography_risk INTEGER NOT NULL,
    flags TEXT[] NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    assessor VARCHAR(100) NOT NULL,
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    override_reason TEXT,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_risk_transaction ON nft_risk_assessments(transaction_id);
CREATE INDEX idx_nft_risk_contract ON nft_risk_assessments(contract_address, token_id);
CREATE INDEX idx_nft_risk_level ON nft_risk_assessments(risk_level);
CREATE INDEX idx_nft_risk_review ON nft_risk_assessments(review_required) WHERE review_required = TRUE;
CREATE INDEX idx_nft_risk_tenant ON nft_risk_assessments(tenant_id);
CREATE INDEX idx_nft_risk_date ON nft_risk_assessments(assessment_date);

-- ==================== NFT TRAVEL RULE MESSAGES ====================

CREATE TABLE IF NOT EXISTS nft_travel_rule_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id VARCHAR(100) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    chain_id INTEGER NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    price VARCHAR(78) NOT NULL,
    price_usd VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    message_id VARCHAR(100) NOT NULL,
    originator_name VARCHAR(255),
    originator_address TEXT,
    originator_country VARCHAR(3),
    originator_account_number VARCHAR(100),
    beneficiary_name VARCHAR(255),
    beneficiary_address TEXT,
    beneficiary_country VARCHAR(3),
    beneficiary_account_number VARCHAR(100),
    originator_vasp VARCHAR(100),
    beneficiary_vasp VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_travel_rule_sale ON nft_travel_rule_messages(sale_id);
CREATE INDEX idx_nft_travel_rule_status ON nft_travel_rule_messages(status);
CREATE INDEX idx_nft_travel_rule_tenant ON nft_travel_rule_messages(tenant_id);
CREATE INDEX idx_nft_travel_rule_retry ON nft_travel_rule_messages(next_retry_at) WHERE status = 'pending';

-- ==================== NFT CARF REPORTS ====================

CREATE TABLE IF NOT EXISTS nft_carf_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(100) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date DATE NOT NULL,
    reporting_period_end_date DATE NOT NULL,
    reporting_period_fiscal_year VARCHAR(10),
    total_sales_volume_usd VARCHAR(78) NOT NULL,
    total_purchases_volume_usd VARCHAR(78) NOT NULL,
    total_royalties_received_usd VARCHAR(78) NOT NULL,
    total_royalties_paid_usd VARCHAR(78) NOT NULL,
    net_gain_loss_usd VARCHAR(78) NOT NULL,
    transaction_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_carf_wallet ON nft_carf_reports(wallet_address);
CREATE INDEX idx_nft_carf_status ON nft_carf_reports(status);
CREATE INDEX idx_nft_carf_tenant ON nft_carf_reports(tenant_id);
CREATE INDEX idx_nft_carf_period ON nft_carf_reports(reporting_period_start_date, reporting_period_end_date);

-- ==================== NFT CARF TRANSACTIONS ====================

CREATE TABLE IF NOT EXISTS nft_carf_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carf_report_id UUID NOT NULL REFERENCES nft_carf_reports(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    collection_name VARCHAR(255) NOT NULL,
    price VARCHAR(78) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    price_usd VARCHAR(78) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    chain_id INTEGER NOT NULL,
    marketplace VARCHAR(100) NOT NULL,
    counterparty VARCHAR(42) NOT NULL,
    gain_loss VARCHAR(78),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_carf_tx_report ON nft_carf_transactions(carf_report_id);
CREATE INDEX idx_nft_carf_tx_date ON nft_carf_transactions(transaction_date);

-- ==================== COMPLIANCE EVENTS LOG ====================

CREATE TABLE IF NOT EXISTS nft_compliance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_compliance_events_type ON nft_compliance_events(event_type);
CREATE INDEX idx_nft_compliance_events_entity ON nft_compliance_events(entity_type, entity_id);
CREATE INDEX idx_nft_compliance_events_tenant ON nft_compliance_events(tenant_id);
CREATE INDEX idx_nft_compliance_events_date ON nft_compliance_events(created_at);

-- ==================== AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS nft_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_audit_resource ON nft_audit_log(resource_type, resource_id);
CREATE INDEX idx_nft_audit_actor ON nft_audit_log(actor_id);
CREATE INDEX idx_nft_audit_tenant ON nft_audit_log(tenant_id);
CREATE INDEX idx_nft_audit_date ON nft_audit_log(created_at);

-- ==================== MIGRATIONS TRACKING ====================

CREATE TABLE IF NOT EXISTS nft_compliance_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO nft_compliance_migrations (name) VALUES ('001_create_nft_compliance_schema.sql')
ON CONFLICT (name) DO NOTHING;
