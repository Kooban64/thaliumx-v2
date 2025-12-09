-- ThaliumX TimescaleDB Initialization for Dingir Trading Engine
-- ==============================================================
-- This script initializes the exchange database with TimescaleDB
-- hypertables for efficient time-series data storage

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable other useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ASSET TABLE - Cryptocurrency/Token definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL DEFAULT '',
    name VARCHAR(30) NOT NULL DEFAULT '',
    chain_id SMALLINT CHECK (chain_id >= 0) NOT NULL DEFAULT 1,
    token_address VARCHAR(64) NOT NULL DEFAULT '',
    rollup_token_id INTEGER CHECK (rollup_token_id >= 0) NOT NULL,
    precision_stor SMALLINT CHECK (precision_stor >= 0) NOT NULL,
    precision_show SMALLINT CHECK (precision_show >= 0) NOT NULL,
    logo_uri VARCHAR(256) NOT NULL DEFAULT '',
    create_time TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (chain_id, rollup_token_id)
);

-- ============================================================================
-- MARKET TABLE - Trading pair definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS market (
    id SERIAL PRIMARY KEY,
    create_time TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
    base_asset VARCHAR(30) NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
    quote_asset VARCHAR(30) NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,
    precision_amount SMALLINT CHECK (precision_amount >= 0) NOT NULL,
    precision_price SMALLINT CHECK (precision_price >= 0) NOT NULL,
    precision_fee SMALLINT CHECK (precision_fee >= 0) NOT NULL,
    min_amount DECIMAL(16, 16) NOT NULL,
    market_name VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active'
);

-- ============================================================================
-- ACCOUNT TABLE - Trading accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS account (
    id INT CHECK (id >= 1) NOT NULL PRIMARY KEY,
    l1_address VARCHAR(42) NOT NULL DEFAULT '',
    l2_pubkey VARCHAR(66) NOT NULL DEFAULT '',
    created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS account_l1_address ON account (l1_address);
CREATE INDEX IF NOT EXISTS account_l2_pubkey ON account (l2_pubkey);

-- ============================================================================
-- MARKET_TRADE TABLE - Trade history (TimescaleDB Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_trade (
    time TIMESTAMP(0) NOT NULL,
    market VARCHAR(30) NOT NULL,
    trade_id BIGINT CHECK (trade_id >= 0) NOT NULL,
    price DECIMAL(30, 8) NOT NULL,
    amount DECIMAL(30, 8) NOT NULL,
    quote_amount DECIMAL(30, 8) NOT NULL,
    taker_side VARCHAR(30) NOT NULL
);

-- Create hypertable for market_trade (time-series optimization)
SELECT create_hypertable('market_trade', 'time', if_not_exists => TRUE);

-- Create index for efficient market queries
CREATE INDEX IF NOT EXISTS market_trade_idx_market ON market_trade (market, time DESC);

-- ============================================================================
-- KLINE TABLE - Candlestick/OHLCV data (TimescaleDB Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kline (
    time TIMESTAMP(0) NOT NULL,
    market VARCHAR(30) NOT NULL,
    interval VARCHAR(10) NOT NULL,  -- '1m', '5m', '15m', '1h', '4h', '1d', '1w'
    open DECIMAL(30, 8) NOT NULL,
    high DECIMAL(30, 8) NOT NULL,
    low DECIMAL(30, 8) NOT NULL,
    close DECIMAL(30, 8) NOT NULL,
    volume DECIMAL(30, 8) NOT NULL,
    quote_volume DECIMAL(30, 8) NOT NULL,
    trade_count INT DEFAULT 0,
    PRIMARY KEY (time, market, interval)
);

-- Create hypertable for kline data
SELECT create_hypertable('kline', 'time', if_not_exists => TRUE);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS kline_idx_market_interval ON kline (market, interval, time DESC);

-- ============================================================================
-- ORDER_HISTORY TABLE - Historical orders (TimescaleDB Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_history (
    time TIMESTAMP(0) NOT NULL,
    order_id BIGINT NOT NULL,
    market VARCHAR(30) NOT NULL,
    account_id INT NOT NULL,
    side VARCHAR(10) NOT NULL,  -- 'buy' or 'sell'
    type VARCHAR(20) NOT NULL,  -- 'limit', 'market', 'stop_limit'
    price DECIMAL(30, 8),
    amount DECIMAL(30, 8) NOT NULL,
    filled_amount DECIMAL(30, 8) DEFAULT 0,
    status VARCHAR(20) NOT NULL,  -- 'open', 'filled', 'cancelled', 'partial'
    PRIMARY KEY (time, order_id)
);

-- Create hypertable for order history
SELECT create_hypertable('order_history', 'time', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX IF NOT EXISTS order_history_idx_account ON order_history (account_id, time DESC);
CREATE INDEX IF NOT EXISTS order_history_idx_market ON order_history (market, time DESC);

-- ============================================================================
-- BALANCE_HISTORY TABLE - Account balance snapshots (TimescaleDB Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS balance_history (
    time TIMESTAMP(0) NOT NULL,
    account_id INT NOT NULL,
    asset VARCHAR(30) NOT NULL,
    available DECIMAL(30, 8) NOT NULL,
    frozen DECIMAL(30, 8) NOT NULL,
    total DECIMAL(30, 8) NOT NULL,
    PRIMARY KEY (time, account_id, asset)
);

-- Create hypertable for balance history
SELECT create_hypertable('balance_history', 'time', if_not_exists => TRUE);

-- Create index
CREATE INDEX IF NOT EXISTS balance_history_idx_account ON balance_history (account_id, time DESC);

-- ============================================================================
-- CONTINUOUS AGGREGATES - Pre-computed rollups for performance
-- ============================================================================

-- 1-minute kline continuous aggregate from trades
CREATE MATERIALIZED VIEW IF NOT EXISTS kline_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    market,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(amount) AS volume,
    sum(quote_amount) AS quote_volume,
    count(*) AS trade_count
FROM market_trade
GROUP BY bucket, market
WITH NO DATA;

-- Refresh policy for 1-minute klines
SELECT add_continuous_aggregate_policy('kline_1m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

-- 1-hour kline continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS kline_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    market,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(amount) AS volume,
    sum(quote_amount) AS quote_volume,
    count(*) AS trade_count
FROM market_trade
GROUP BY bucket, market
WITH NO DATA;

-- Refresh policy for 1-hour klines
SELECT add_continuous_aggregate_policy('kline_1h',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- 1-day kline continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS kline_1d
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    market,
    first(price, time) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, time) AS close,
    sum(amount) AS volume,
    sum(quote_amount) AS quote_volume,
    count(*) AS trade_count
FROM market_trade
GROUP BY bucket, market
WITH NO DATA;

-- Refresh policy for 1-day klines
SELECT add_continuous_aggregate_policy('kline_1d',
    start_offset => INTERVAL '1 week',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ============================================================================
-- DATA RETENTION POLICIES
-- ============================================================================

-- Keep raw trades for 90 days
SELECT add_retention_policy('market_trade', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep order history for 1 year
SELECT add_retention_policy('order_history', INTERVAL '1 year', if_not_exists => TRUE);

-- Keep balance history for 1 year
SELECT add_retention_policy('balance_history', INTERVAL '1 year', if_not_exists => TRUE);

-- ============================================================================
-- COMPRESSION POLICIES (for older data)
-- ============================================================================

-- Enable compression on market_trade
ALTER TABLE market_trade SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'market'
);

-- Compress data older than 7 days
SELECT add_compression_policy('market_trade', INTERVAL '7 days', if_not_exists => TRUE);

-- Enable compression on order_history
ALTER TABLE order_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'market'
);

SELECT add_compression_policy('order_history', INTERVAL '30 days', if_not_exists => TRUE);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dingir;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dingir;
GRANT USAGE ON SCHEMA public TO dingir;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'TimescaleDB initialization complete for Dingir trading engine';
END $$;