-- ThaliumX Database Initialization Script
-- ========================================
-- This script is idempotent - safe to run multiple times
-- It creates all required databases and users for ThaliumX services

-- Note: This script runs as the POSTGRES_USER defined in environment
-- The main database (POSTGRES_DB) is already created by Docker

-- ===========================================
-- Create additional databases
-- ===========================================

-- Keycloak database
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

-- Ballerine database
SELECT 'CREATE DATABASE ballerine'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ballerine')\gexec

-- Dingir/Exchange database
SELECT 'CREATE DATABASE exchange'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'exchange')\gexec

-- ===========================================
-- Create users (if they don't exist)
-- ===========================================

-- Ballerine user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ballerine') THEN
        CREATE USER ballerine WITH PASSWORD COALESCE(current_setting('CUSTOM_BALLERINE_PASSWORD', true), 'CHANGE_THIS_IN_PRODUCTION');
    END IF;
END
$$;

-- Dingir user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dingir') THEN
        CREATE USER dingir WITH PASSWORD COALESCE(current_setting('CUSTOM_DINGIR_PASSWORD', true), 'CHANGE_THIS_IN_PRODUCTION');
    END IF;
END
$$;

-- ===========================================
-- Grant privileges
-- ===========================================

-- Grant privileges on keycloak database
GRANT ALL PRIVILEGES ON DATABASE keycloak TO thaliumx;

-- Grant privileges on ballerine database
GRANT ALL PRIVILEGES ON DATABASE ballerine TO ballerine;
GRANT ALL PRIVILEGES ON DATABASE ballerine TO thaliumx;

-- Grant privileges on exchange database
GRANT ALL PRIVILEGES ON DATABASE exchange TO dingir;
GRANT ALL PRIVILEGES ON DATABASE exchange TO thaliumx;

-- ===========================================
-- Enable extensions (on main database)
-- ===========================================

-- TimescaleDB extension (if available)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================
-- Log completion
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE 'ThaliumX database initialization complete';
END
$$;