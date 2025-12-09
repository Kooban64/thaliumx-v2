-- ThaliumX Citus PostgreSQL Initialization Script
-- ================================================
-- This script runs on first container startup
-- Sets up Citus extension and multi-tenant schema

-- Enable Citus extension
CREATE EXTENSION IF NOT EXISTS citus;

-- Create application user (credentials should be set via environment variables)
-- In production, use Vault or similar secret management
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'thaliumx') THEN
        -- Use environment variable or default (change default in production!)
        CREATE USER thaliumx WITH PASSWORD COALESCE(current_setting('CUSTOM_THALIUMX_PASSWORD', true), 'CHANGE_THIS_IN_PRODUCTION');
    END IF;
END
$$;

-- Grant privileges
ALTER USER thaliumx CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE thaliumx TO thaliumx;

-- Enable other useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Grant schema privileges to application user
GRANT ALL ON SCHEMA public TO thaliumx;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO thaliumx;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO thaliumx;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO thaliumx;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO thaliumx;

-- ===================
-- MULTI-TENANT SCHEMA
-- ===================

-- Create tenants table (reference table - replicated to all nodes)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table (distributed by tenant_id)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    roles JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

-- Create accounts table (distributed by tenant_id)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    balance DECIMAL(20, 8) DEFAULT 0,
    available_balance DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

-- Create transactions table (distributed by tenant_id)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    reference VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

-- Create orders table (distributed by tenant_id)
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    average_price DECIMAL(20, 8),
    status VARCHAR(50) DEFAULT 'pending',
    time_in_force VARCHAR(10) DEFAULT 'GTC',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

-- Create audit_logs table (distributed by tenant_id)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id)
);

-- Grant privileges on new tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO thaliumx;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO thaliumx;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'ThaliumX Citus database initialization complete';
    RAISE NOTICE 'Citus version: %', (SELECT extversion FROM pg_extension WHERE extname = 'citus');
END $$;