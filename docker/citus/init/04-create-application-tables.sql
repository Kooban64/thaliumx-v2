-- ThaliumX Application Tables
-- Comprehensive database schema for production

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- USERS AND AUTHENTICATION
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keycloak_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'banned', 'deleted')),
    kyc_status VARCHAR(50) DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected', 'expired')),
    kyc_level INTEGER DEFAULT 0,
    risk_score DECIMAL(5,2) DEFAULT 0,
    country_code VARCHAR(3),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    mfa_backup_codes TEXT[],
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    privacy_accepted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_keycloak_id ON users(keycloak_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255),
    device_fingerprint VARCHAR(255),
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- TENANTS AND BROKERS
-- ============================================

-- Tenants (Brokers)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    type VARCHAR(50) DEFAULT 'broker' CHECK (type IN ('platform', 'broker', 'partner', 'enterprise')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'terminated')),
    keycloak_realm VARCHAR(100),
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address JSONB,
    settings JSONB DEFAULT '{}',
    fee_structure JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    api_key_hash VARCHAR(255),
    webhook_url TEXT,
    webhook_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_type ON tenants(type);

-- Tenant users (broker staff)
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'support', 'viewer')),
    permissions JSONB DEFAULT '[]',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);

-- ============================================
-- WALLETS AND BALANCES
-- ============================================

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id),
    currency VARCHAR(20) NOT NULL,
    type VARCHAR(50) DEFAULT 'spot' CHECK (type IN ('spot', 'margin', 'futures', 'staking', 'savings')),
    address VARCHAR(255),
    network VARCHAR(50),
    balance DECIMAL(36,18) DEFAULT 0,
    available_balance DECIMAL(36,18) DEFAULT 0,
    locked_balance DECIMAL(36,18) DEFAULT 0,
    pending_balance DECIMAL(36,18) DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended', 'closed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, currency, type, tenant_id)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_tenant ON wallets(tenant_id);
CREATE INDEX idx_wallets_currency ON wallets(currency);
CREATE INDEX idx_wallets_type ON wallets(type);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'trade', 'fee', 'reward', 'staking', 'unstaking', 'interest', 'adjustment')),
    amount DECIMAL(36,18) NOT NULL,
    fee DECIMAL(36,18) DEFAULT 0,
    currency VARCHAR(20) NOT NULL,
    balance_before DECIMAL(36,18) NOT NULL,
    balance_after DECIMAL(36,18) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    tx_hash VARCHAR(255),
    network VARCHAR(50),
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at);
CREATE INDEX idx_wallet_tx_hash ON wallet_transactions(tx_hash);

-- ============================================
-- TRADING
-- ============================================

-- Trading pairs
CREATE TABLE IF NOT EXISTS trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) UNIQUE NOT NULL,
    base_currency VARCHAR(20) NOT NULL,
    quote_currency VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'delisted')),
    min_order_size DECIMAL(36,18) DEFAULT 0,
    max_order_size DECIMAL(36,18),
    min_price DECIMAL(36,18) DEFAULT 0,
    max_price DECIMAL(36,18),
    price_precision INTEGER DEFAULT 8,
    quantity_precision INTEGER DEFAULT 8,
    maker_fee DECIMAL(10,6) DEFAULT 0.001,
    taker_fee DECIMAL(10,6) DEFAULT 0.001,
    is_margin_enabled BOOLEAN DEFAULT FALSE,
    max_leverage DECIMAL(5,2) DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trading_pairs_symbol ON trading_pairs(symbol);
CREATE INDEX idx_trading_pairs_status ON trading_pairs(status);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id),
    symbol VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('market', 'limit', 'stop_loss', 'stop_limit', 'take_profit', 'trailing_stop')),
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    price DECIMAL(36,18),
    stop_price DECIMAL(36,18),
    quantity DECIMAL(36,18) NOT NULL,
    filled_quantity DECIMAL(36,18) DEFAULT 0,
    remaining_quantity DECIMAL(36,18),
    average_price DECIMAL(36,18),
    total_value DECIMAL(36,18),
    fee DECIMAL(36,18) DEFAULT 0,
    fee_currency VARCHAR(20),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired')),
    time_in_force VARCHAR(20) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTD')),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_margin BOOLEAN DEFAULT FALSE,
    leverage DECIMAL(5,2) DEFAULT 1,
    client_order_id VARCHAR(100),
    exchange_order_id VARCHAR(100),
    exchange VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_client_id ON orders(client_order_id);

-- Trades (order fills)
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL,
    price DECIMAL(36,18) NOT NULL,
    quantity DECIMAL(36,18) NOT NULL,
    value DECIMAL(36,18) NOT NULL,
    fee DECIMAL(36,18) DEFAULT 0,
    fee_currency VARCHAR(20),
    is_maker BOOLEAN DEFAULT FALSE,
    exchange VARCHAR(50),
    exchange_trade_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trades_order ON trades(order_id);
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_executed ON trades(executed_at);

-- ============================================
-- MARGIN TRADING
-- ============================================

-- Margin accounts
CREATE TABLE IF NOT EXISTS margin_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    type VARCHAR(50) DEFAULT 'cross' CHECK (type IN ('cross', 'isolated')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'liquidating', 'liquidated', 'suspended')),
    total_collateral DECIMAL(36,18) DEFAULT 0,
    total_borrowed DECIMAL(36,18) DEFAULT 0,
    total_interest DECIMAL(36,18) DEFAULT 0,
    margin_level DECIMAL(10,4) DEFAULT 0,
    maintenance_margin DECIMAL(10,4) DEFAULT 0.05,
    initial_margin DECIMAL(10,4) DEFAULT 0.1,
    max_leverage DECIMAL(5,2) DEFAULT 10,
    current_leverage DECIMAL(5,2) DEFAULT 1,
    liquidation_price DECIMAL(36,18),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type, tenant_id)
);

CREATE INDEX idx_margin_accounts_user ON margin_accounts(user_id);
CREATE INDEX idx_margin_accounts_status ON margin_accounts(status);

-- Margin positions
CREATE TABLE IF NOT EXISTS margin_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    margin_account_id UUID NOT NULL REFERENCES margin_accounts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
    entry_price DECIMAL(36,18) NOT NULL,
    current_price DECIMAL(36,18),
    quantity DECIMAL(36,18) NOT NULL,
    leverage DECIMAL(5,2) NOT NULL,
    collateral DECIMAL(36,18) NOT NULL,
    borrowed DECIMAL(36,18) DEFAULT 0,
    unrealized_pnl DECIMAL(36,18) DEFAULT 0,
    realized_pnl DECIMAL(36,18) DEFAULT 0,
    liquidation_price DECIMAL(36,18),
    take_profit_price DECIMAL(36,18),
    stop_loss_price DECIMAL(36,18),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed', 'liquidated')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_margin_positions_account ON margin_positions(margin_account_id);
CREATE INDEX idx_margin_positions_user ON margin_positions(user_id);
CREATE INDEX idx_margin_positions_symbol ON margin_positions(symbol);
CREATE INDEX idx_margin_positions_status ON margin_positions(status);

-- ============================================
-- KYC AND COMPLIANCE
-- ============================================

-- KYC submissions
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    level INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
    provider VARCHAR(50),
    provider_reference VARCHAR(255),
    document_type VARCHAR(50),
    document_number VARCHAR(100),
    document_country VARCHAR(3),
    document_expiry DATE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    nationality VARCHAR(3),
    address JSONB,
    verification_data JSONB,
    risk_score DECIMAL(5,2),
    risk_factors JSONB DEFAULT '[]',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kyc_user ON kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(status);
CREATE INDEX idx_kyc_level ON kyc_submissions(level);

-- KYC documents
CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES kyc_submissions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('passport', 'id_card', 'drivers_license', 'proof_of_address', 'selfie', 'video', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kyc_docs_submission ON kyc_documents(submission_id);
CREATE INDEX idx_kyc_docs_user ON kyc_documents(user_id);

-- AML checks
CREATE TABLE IF NOT EXISTS aml_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('pep', 'sanctions', 'adverse_media', 'transaction_monitoring')),
    provider VARCHAR(50),
    provider_reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'clear', 'match', 'review_required', 'failed')),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    matches JSONB DEFAULT '[]',
    result_data JSONB,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aml_user ON aml_checks(user_id);
CREATE INDEX idx_aml_status ON aml_checks(status);
CREATE INDEX idx_aml_type ON aml_checks(check_type);

-- ============================================
-- TOKEN SALE AND PRESALE
-- ============================================

-- Token sales
CREATE TABLE IF NOT EXISTS token_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_address VARCHAR(255),
    network VARCHAR(50),
    type VARCHAR(50) DEFAULT 'public' CHECK (type IN ('private', 'presale', 'public', 'ido', 'ieo')),
    status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'paused', 'completed', 'cancelled')),
    total_supply DECIMAL(36,18) NOT NULL,
    tokens_for_sale DECIMAL(36,18) NOT NULL,
    tokens_sold DECIMAL(36,18) DEFAULT 0,
    price_usd DECIMAL(36,18) NOT NULL,
    min_purchase DECIMAL(36,18) DEFAULT 0,
    max_purchase DECIMAL(36,18),
    hard_cap DECIMAL(36,18),
    soft_cap DECIMAL(36,18),
    raised_amount DECIMAL(36,18) DEFAULT 0,
    accepted_currencies JSONB DEFAULT '["USDT", "USDC", "BNB", "ETH"]',
    vesting_schedule JSONB,
    whitelist_enabled BOOLEAN DEFAULT FALSE,
    kyc_required BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_token_sales_status ON token_sales(status);
CREATE INDEX idx_token_sales_type ON token_sales(type);

-- Token sale investments
CREATE TABLE IF NOT EXISTS token_sale_investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES token_sales(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    amount_invested DECIMAL(36,18) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    amount_usd DECIMAL(36,18) NOT NULL,
    tokens_purchased DECIMAL(36,18) NOT NULL,
    tokens_claimed DECIMAL(36,18) DEFAULT 0,
    bonus_tokens DECIMAL(36,18) DEFAULT 0,
    tx_hash VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    vesting_start_date TIMESTAMP WITH TIME ZONE,
    next_claim_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_investments_sale ON token_sale_investments(sale_id);
CREATE INDEX idx_investments_user ON token_sale_investments(user_id);
CREATE INDEX idx_investments_status ON token_sale_investments(status);

-- ============================================
-- AUDIT AND LOGGING
-- ============================================

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    request_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Security events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    location JSONB,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created ON security_events(created_at);

-- ============================================
-- NOTIFICATIONS
-- ============================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    channels JSONB DEFAULT '["in_app"]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trading_pairs_updated_at BEFORE UPDATE ON trading_pairs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_margin_accounts_updated_at BEFORE UPDATE ON margin_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_submissions_updated_at BEFORE UPDATE ON kyc_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_token_sales_updated_at BEFORE UPDATE ON token_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_wallets AFTER INSERT OR UPDATE OR DELETE ON wallets FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_wallet_transactions AFTER INSERT OR UPDATE OR DELETE ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO thaliumx;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO thaliumx;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO thaliumx;

-- Insert default data
INSERT INTO trading_pairs (symbol, base_currency, quote_currency, status, maker_fee, taker_fee, is_margin_enabled, max_leverage)
VALUES 
    ('BTC/USDT', 'BTC', 'USDT', 'active', 0.001, 0.001, true, 20),
    ('ETH/USDT', 'ETH', 'USDT', 'active', 0.001, 0.001, true, 20),
    ('BNB/USDT', 'BNB', 'USDT', 'active', 0.001, 0.001, true, 10),
    ('THAL/USDT', 'THAL', 'USDT', 'active', 0.0005, 0.0005, false, 1),
    ('THAL/BTC', 'THAL', 'BTC', 'active', 0.0005, 0.0005, false, 1),
    ('THAL/ETH', 'THAL', 'ETH', 'active', 0.0005, 0.0005, false, 1)
ON CONFLICT (symbol) DO NOTHING;

-- Create platform tenant
INSERT INTO tenants (name, slug, type, status, settings)
VALUES ('ThaliumX Platform', 'thaliumx', 'platform', 'active', '{"is_platform": true}')
ON CONFLICT (slug) DO NOTHING;

COMMIT;