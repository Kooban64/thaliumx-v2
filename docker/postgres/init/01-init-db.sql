-- Thaliumx PostgreSQL Initialization Script
-- ==========================================
-- This script runs on first container startup

-- Create application user (credentials stored in Vault)
CREATE USER thaliumx WITH PASSWORD 'ThaliumX2025';

-- Grant privileges
ALTER USER thaliumx CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE thaliumx TO thaliumx;

-- Connect to thaliumx database
\c thaliumx

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

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

-- Create schemas for different services
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS fintech;
CREATE SCHEMA IF NOT EXISTS audit;

GRANT ALL ON SCHEMA trading TO thaliumx;
GRANT ALL ON SCHEMA fintech TO thaliumx;
GRANT ALL ON SCHEMA audit TO thaliumx;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Thaliumx database initialization complete';
    RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
END $$;