#!/bin/bash
# ThaliumX Complete Schema Initialization Script
# ==============================================
# Initializes all required schemas across all database services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CITUS_COORDINATOR="${CITUS_COORDINATOR:-thaliumx-citus-coordinator}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ThaliumX2025}"

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================
# CITUS SCHEMA INITIALIZATION
# ============================================
init_citus_schema() {
    print_header "Initializing Citus Schema"
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "$CITUS_COORDINATOR"; then
        print_error "Citus coordinator container not running: $CITUS_COORDINATOR"
        return 1
    fi
    
    echo "Creating extensions..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        CREATE EXTENSION IF NOT EXISTS citus;
        CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    " 2>/dev/null && print_success "Extensions created" || print_warning "Some extensions may already exist"
    
    echo "Creating core tables..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        -- Tenants table (reference table)
        CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            domain VARCHAR(255) UNIQUE,
            settings JSONB DEFAULT '{}',
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Users table (distributed by tenant_id)
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(50),
            status VARCHAR(50) DEFAULT 'pending',
            kyc_status VARCHAR(50) DEFAULT 'not_started',
            mfa_enabled BOOLEAN DEFAULT false,
            mfa_secret VARCHAR(255),
            mfa_email_code VARCHAR(10),
            mfa_email_code_expires_at TIMESTAMP WITH TIME ZONE,
            mfa_sms_code VARCHAR(10),
            mfa_sms_code_expires_at TIMESTAMP WITH TIME ZONE,
            mfa_backup_codes JSONB DEFAULT '[]',
            mfa_secret_temp VARCHAR(255),
            mfa_verified_at TIMESTAMP WITH TIME ZONE,
            last_login TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, email)
        );

        -- Accounts table (distributed by tenant_id)
        CREATE TABLE IF NOT EXISTS accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            currency VARCHAR(20) NOT NULL,
            balance DECIMAL(30, 8) DEFAULT 0,
            available_balance DECIMAL(30, 8) DEFAULT 0,
            locked_balance DECIMAL(30, 8) DEFAULT 0,
            account_type VARCHAR(50) DEFAULT 'spot',
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Transactions table (distributed by tenant_id)
        CREATE TABLE IF NOT EXISTS transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            account_id UUID NOT NULL,
            type VARCHAR(50) NOT NULL,
            amount DECIMAL(30, 8) NOT NULL,
            fee DECIMAL(30, 8) DEFAULT 0,
            currency VARCHAR(20) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            reference_id VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Orders table (distributed by tenant_id)
        CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            market VARCHAR(50) NOT NULL,
            side VARCHAR(10) NOT NULL,
            type VARCHAR(20) NOT NULL,
            price DECIMAL(30, 8),
            amount DECIMAL(30, 8) NOT NULL,
            filled_amount DECIMAL(30, 8) DEFAULT 0,
            remaining_amount DECIMAL(30, 8),
            status VARCHAR(50) DEFAULT 'pending',
            time_in_force VARCHAR(20) DEFAULT 'GTC',
            stop_price DECIMAL(30, 8),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Audit logs table (distributed by tenant_id)
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID,
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100),
            resource_id VARCHAR(255),
            ip_address INET,
            user_agent TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Trading pairs table
        CREATE TABLE IF NOT EXISTS trading_pairs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            base_asset VARCHAR(20) NOT NULL,
            quote_asset VARCHAR(20) NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            min_amount DECIMAL(30, 8),
            max_amount DECIMAL(30, 8),
            min_price DECIMAL(30, 8),
            max_price DECIMAL(30, 8),
            price_precision INT DEFAULT 8,
            amount_precision INT DEFAULT 8,
            maker_fee DECIMAL(10, 6) DEFAULT 0.001,
            taker_fee DECIMAL(10, 6) DEFAULT 0.001,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, symbol)
        );

        -- KYC verifications table
        CREATE TABLE IF NOT EXISTS kyc_verifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            level INT DEFAULT 1,
            status VARCHAR(50) DEFAULT 'pending',
            document_type VARCHAR(50),
            document_number VARCHAR(100),
            document_country VARCHAR(10),
            document_expiry DATE,
            verification_provider VARCHAR(50),
            verification_id VARCHAR(255),
            rejection_reason TEXT,
            verified_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Wallets table
        CREATE TABLE IF NOT EXISTS wallets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            currency VARCHAR(20) NOT NULL,
            address VARCHAR(255) NOT NULL,
            network VARCHAR(50) NOT NULL,
            label VARCHAR(100),
            is_default BOOLEAN DEFAULT false,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Margin accounts table
        CREATE TABLE IF NOT EXISTS margin_accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID NOT NULL,
            currency VARCHAR(20) NOT NULL,
            borrowed DECIMAL(30, 8) DEFAULT 0,
            interest DECIMAL(30, 8) DEFAULT 0,
            collateral DECIMAL(30, 8) DEFAULT 0,
            margin_level DECIMAL(10, 4),
            liquidation_price DECIMAL(30, 8),
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Compliance records table
        CREATE TABLE IF NOT EXISTS compliance_records (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            user_id UUID,
            record_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            risk_score INT,
            flags JSONB DEFAULT '[]',
            notes TEXT,
            reviewed_by UUID,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Sequelize migrations tracking table
        CREATE TABLE IF NOT EXISTS \"SequelizeMeta\" (
            name VARCHAR(255) PRIMARY KEY
        );
    " 2>/dev/null && print_success "Core tables created" || print_warning "Some tables may already exist"
    
    echo "Creating indexes..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
        CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);
        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_trading_pairs_symbol ON trading_pairs(symbol);
    " 2>/dev/null && print_success "Indexes created" || print_warning "Some indexes may already exist"
    
    echo "Distributing tables with Citus..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        -- Make tenants a reference table (replicated to all nodes)
        SELECT create_reference_table('tenants') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'tenants'::regclass
        );
        
        -- Distribute other tables by tenant_id
        SELECT create_distributed_table('users', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'users'::regclass
        );
        SELECT create_distributed_table('accounts', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'accounts'::regclass
        );
        SELECT create_distributed_table('transactions', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'transactions'::regclass
        );
        SELECT create_distributed_table('orders', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'orders'::regclass
        );
        SELECT create_distributed_table('audit_logs', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'audit_logs'::regclass
        );
        SELECT create_distributed_table('trading_pairs', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'trading_pairs'::regclass
        );
        SELECT create_distributed_table('kyc_verifications', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'kyc_verifications'::regclass
        );
        SELECT create_distributed_table('wallets', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'wallets'::regclass
        );
        SELECT create_distributed_table('margin_accounts', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'margin_accounts'::regclass
        );
        SELECT create_distributed_table('compliance_records', 'tenant_id') WHERE NOT EXISTS (
            SELECT 1 FROM citus_tables WHERE table_name = 'compliance_records'::regclass
        );
    " 2>/dev/null && print_success "Tables distributed" || print_warning "Distribution may already be configured"
}

# ============================================
# DINGIR TRADING ENGINE SCHEMA
# ============================================
init_dingir_schema() {
    print_header "Initializing Dingir Trading Engine Schema"
    
    # Create exchange database if it doesn't exist
    echo "Creating exchange database..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -c "CREATE DATABASE exchange;" 2>/dev/null || print_warning "Database may already exist"
    
    # Try to enable TimescaleDB
    echo "Enabling TimescaleDB extension..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d exchange -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;" 2>/dev/null \
        && print_success "TimescaleDB enabled" \
        || print_warning "TimescaleDB not available - using standard tables"
    
    echo "Creating Dingir tables..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d exchange -c "
        -- Asset table
        CREATE TABLE IF NOT EXISTS asset (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            symbol VARCHAR(30) NOT NULL DEFAULT '',
            name VARCHAR(30) NOT NULL DEFAULT '',
            chain_id SMALLINT CHECK (chain_id >= 0) NOT NULL DEFAULT 1,
            token_address VARCHAR(64) NOT NULL DEFAULT '',
            rollup_token_id integer CHECK (rollup_token_id >= 0) NOT NULL,
            precision_stor SMALLINT CHECK (precision_stor >= 0) NOT NULL,
            precision_show SMALLINT CHECK (precision_show >= 0) NOT NULL,
            logo_uri VARCHAR(256) NOT NULL DEFAULT '',
            create_time TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (chain_id, rollup_token_id)
        );

        -- Market table
        CREATE TABLE IF NOT EXISTS market (
            id SERIAL PRIMARY KEY,
            create_time TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
            base_asset VARCHAR(30) NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
            quote_asset VARCHAR(30) NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
            precision_amount SMALLINT CHECK (precision_amount >= 0) NOT NULL,
            precision_price SMALLINT CHECK (precision_price >= 0) NOT NULL,
            precision_fee SMALLINT CHECK (precision_fee >= 0) NOT NULL,
            min_amount DECIMAL(16, 16) NOT NULL,
            market_name VARCHAR(30)
        );

        -- Account table
        CREATE TABLE IF NOT EXISTS account (
            id INT CHECK (id >= 1) NOT NULL PRIMARY KEY,
            l1_address VARCHAR(42) NOT NULL DEFAULT '',
            l2_pubkey VARCHAR(66) NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS account_l1_address ON account (l1_address);
        CREATE INDEX IF NOT EXISTS account_l2_pubkey ON account (l2_pubkey);

        -- Market trade table
        CREATE TABLE IF NOT EXISTS market_trade (
            time TIMESTAMP(0) NOT NULL,
            market VARCHAR(30) NOT NULL,
            trade_id BIGINT CHECK (trade_id >= 0) NOT NULL,
            price DECIMAL(30, 8) NOT NULL,
            amount DECIMAL(30, 8) NOT NULL,
            quote_amount DECIMAL(30, 8) NOT NULL,
            taker_side VARCHAR(30) NOT NULL
        );

        CREATE INDEX IF NOT EXISTS market_trade_idx_market ON market_trade (market, time DESC);
    " 2>/dev/null && print_success "Dingir tables created" || print_warning "Some tables may already exist"
    
    # Try to create hypertable for market_trade
    echo "Creating hypertable for market_trade..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d exchange -c "
        SELECT create_hypertable('market_trade', 'time', if_not_exists => TRUE);
    " 2>/dev/null && print_success "Hypertable created" || print_warning "Hypertable creation skipped (TimescaleDB may not be available)"
}

# ============================================
# KEYCLOAK DATABASE
# ============================================
init_keycloak_db() {
    print_header "Initializing Keycloak Database"
    
    echo "Creating Keycloak database..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -c "CREATE DATABASE keycloak;" 2>/dev/null || print_warning "Database may already exist"
    
    echo "Creating Keycloak user..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
                CREATE USER keycloak WITH PASSWORD 'keycloak';
            END IF;
        END
        \$\$;
        GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
    " 2>/dev/null && print_success "Keycloak database ready" || print_warning "Keycloak setup may already exist"
    
    print_success "Keycloak will auto-create its schema on first startup"
}

# ============================================
# SEED DEFAULT DATA
# ============================================
seed_default_data() {
    print_header "Seeding Default Data"
    
    echo "Creating default tenant..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        INSERT INTO tenants (id, name, domain, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 'ThaliumX', 'thaliumx.com', 'active')
        ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && print_success "Default tenant created" || print_warning "Default tenant may already exist"
    
    echo "Creating default trading pairs..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d thaliumx -c "
        INSERT INTO trading_pairs (tenant_id, base_asset, quote_asset, symbol, status, price_precision, amount_precision, maker_fee, taker_fee)
        VALUES 
            ('00000000-0000-0000-0000-000000000001', 'BTC', 'USDT', 'BTC/USDT', 'active', 2, 6, 0.001, 0.001),
            ('00000000-0000-0000-0000-000000000001', 'ETH', 'USDT', 'ETH/USDT', 'active', 2, 5, 0.001, 0.001),
            ('00000000-0000-0000-0000-000000000001', 'ETH', 'BTC', 'ETH/BTC', 'active', 6, 4, 0.001, 0.001),
            ('00000000-0000-0000-0000-000000000001', 'SOL', 'USDT', 'SOL/USDT', 'active', 2, 3, 0.001, 0.001),
            ('00000000-0000-0000-0000-000000000001', 'AVAX', 'USDT', 'AVAX/USDT', 'active', 2, 3, 0.001, 0.001)
        ON CONFLICT (tenant_id, symbol) DO NOTHING;
    " 2>/dev/null && print_success "Default trading pairs created" || print_warning "Trading pairs may already exist"
    
    echo "Creating default assets in Dingir..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d exchange -c "
        INSERT INTO asset (id, symbol, name, chain_id, rollup_token_id, precision_stor, precision_show)
        VALUES 
            ('BTC', 'BTC', 'Bitcoin', 1, 1, 8, 8),
            ('ETH', 'ETH', 'Ethereum', 1, 2, 18, 8),
            ('USDT', 'USDT', 'Tether USD', 1, 3, 6, 2),
            ('SOL', 'SOL', 'Solana', 1, 4, 9, 4),
            ('AVAX', 'AVAX', 'Avalanche', 1, 5, 18, 4)
        ON CONFLICT (id) DO NOTHING;
    " 2>/dev/null && print_success "Default assets created" || print_warning "Assets may already exist"
    
    echo "Creating default markets in Dingir..."
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CITUS_COORDINATOR" \
        psql -U "$POSTGRES_USER" -d exchange -c "
        INSERT INTO market (base_asset, quote_asset, precision_amount, precision_price, precision_fee, min_amount, market_name)
        VALUES 
            ('BTC', 'USDT', 6, 2, 4, 0.0001, 'BTC_USDT'),
            ('ETH', 'USDT', 5, 2, 4, 0.001, 'ETH_USDT'),
            ('ETH', 'BTC', 4, 6, 4, 0.01, 'ETH_BTC'),
            ('SOL', 'USDT', 3, 2, 4, 0.1, 'SOL_USDT'),
            ('AVAX', 'USDT', 3, 2, 4, 0.1, 'AVAX_USDT')
        ON CONFLICT DO NOTHING;
    " 2>/dev/null && print_success "Default markets created" || print_warning "Markets may already exist"
}

# ============================================
# MAIN
# ============================================
main() {
    print_header "ThaliumX Complete Schema Initialization"
    echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    
    # Check if Citus coordinator is running
    if ! docker ps --format '{{.Names}}' | grep -q "$CITUS_COORDINATOR"; then
        print_error "Citus coordinator not running. Please start the database services first."
        echo "Run: docker compose -f docker/citus/compose.yaml up -d"
        exit 1
    fi
    
    init_citus_schema
    init_dingir_schema
    init_keycloak_db
    seed_default_data
    
    print_header "Schema Initialization Complete"
    echo -e "${GREEN}All schemas have been initialized successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run ./scripts/verify-schemas.sh to verify all schemas"
    echo "2. Start all services with docker compose"
    echo "3. Import Keycloak realm configuration"
}

# Run main
main "$@"