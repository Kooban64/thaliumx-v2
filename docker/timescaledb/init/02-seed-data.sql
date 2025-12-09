-- ThaliumX TimescaleDB Seed Data
-- ================================
-- Initial assets and markets for the trading engine

-- ============================================================================
-- SEED ASSETS
-- ============================================================================
INSERT INTO asset (id, symbol, name, chain_id, rollup_token_id, precision_stor, precision_show, logo_uri)
VALUES 
    ('BTC', 'BTC', 'Bitcoin', 1, 1, 8, 8, '/assets/icons/btc.svg'),
    ('ETH', 'ETH', 'Ethereum', 1, 2, 18, 8, '/assets/icons/eth.svg'),
    ('USDT', 'USDT', 'Tether USD', 1, 3, 6, 2, '/assets/icons/usdt.svg'),
    ('USDC', 'USDC', 'USD Coin', 1, 4, 6, 2, '/assets/icons/usdc.svg'),
    ('SOL', 'SOL', 'Solana', 1, 5, 9, 4, '/assets/icons/sol.svg'),
    ('AVAX', 'AVAX', 'Avalanche', 1, 6, 18, 4, '/assets/icons/avax.svg'),
    ('MATIC', 'MATIC', 'Polygon', 1, 7, 18, 4, '/assets/icons/matic.svg'),
    ('DOT', 'DOT', 'Polkadot', 1, 8, 10, 4, '/assets/icons/dot.svg'),
    ('LINK', 'LINK', 'Chainlink', 1, 9, 18, 4, '/assets/icons/link.svg'),
    ('UNI', 'UNI', 'Uniswap', 1, 10, 18, 4, '/assets/icons/uni.svg'),
    ('AAVE', 'AAVE', 'Aave', 1, 11, 18, 4, '/assets/icons/aave.svg'),
    ('XRP', 'XRP', 'Ripple', 1, 12, 6, 4, '/assets/icons/xrp.svg'),
    ('ADA', 'ADA', 'Cardano', 1, 13, 6, 4, '/assets/icons/ada.svg'),
    ('ATOM', 'ATOM', 'Cosmos', 1, 14, 6, 4, '/assets/icons/atom.svg'),
    ('LTC', 'LTC', 'Litecoin', 1, 15, 8, 4, '/assets/icons/ltc.svg')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    precision_stor = EXCLUDED.precision_stor,
    precision_show = EXCLUDED.precision_show,
    logo_uri = EXCLUDED.logo_uri;

-- ============================================================================
-- SEED MARKETS (Trading Pairs)
-- Note: min_amount uses DECIMAL(16,16) which only allows values < 1
-- ============================================================================
INSERT INTO market (base_asset, quote_asset, precision_amount, precision_price, precision_fee, min_amount, market_name, status)
VALUES
    -- Major pairs with USDT
    ('BTC', 'USDT', 6, 2, 4, 0.0000000001, 'BTC_USDT', 'active'),
    ('ETH', 'USDT', 5, 2, 4, 0.0000000010, 'ETH_USDT', 'active'),
    ('SOL', 'USDT', 3, 2, 4, 0.0000001000, 'SOL_USDT', 'active'),
    ('AVAX', 'USDT', 3, 2, 4, 0.0000001000, 'AVAX_USDT', 'active'),
    ('MATIC', 'USDT', 2, 4, 4, 0.0000010000, 'MATIC_USDT', 'active'),
    ('DOT', 'USDT', 3, 3, 4, 0.0000001000, 'DOT_USDT', 'active'),
    ('LINK', 'USDT', 3, 3, 4, 0.0000001000, 'LINK_USDT', 'active'),
    ('UNI', 'USDT', 3, 3, 4, 0.0000001000, 'UNI_USDT', 'active'),
    ('AAVE', 'USDT', 4, 2, 4, 0.0000000100, 'AAVE_USDT', 'active'),
    ('XRP', 'USDT', 2, 4, 4, 0.0000010000, 'XRP_USDT', 'active'),
    ('ADA', 'USDT', 2, 4, 4, 0.0000010000, 'ADA_USDT', 'active'),
    ('ATOM', 'USDT', 3, 3, 4, 0.0000001000, 'ATOM_USDT', 'active'),
    ('LTC', 'USDT', 4, 2, 4, 0.0000000100, 'LTC_USDT', 'active'),
    
    -- Major pairs with USDC
    ('BTC', 'USDC', 6, 2, 4, 0.0000000001, 'BTC_USDC', 'active'),
    ('ETH', 'USDC', 5, 2, 4, 0.0000000010, 'ETH_USDC', 'active'),
    
    -- BTC pairs
    ('ETH', 'BTC', 4, 6, 4, 0.0000000100, 'ETH_BTC', 'active'),
    ('SOL', 'BTC', 3, 8, 4, 0.0000001000, 'SOL_BTC', 'active'),
    ('AVAX', 'BTC', 3, 8, 4, 0.0000001000, 'AVAX_BTC', 'active'),
    ('LINK', 'BTC', 3, 8, 4, 0.0000001000, 'LINK_BTC', 'active'),
    ('LTC', 'BTC', 4, 6, 4, 0.0000000100, 'LTC_BTC', 'active'),
    
    -- ETH pairs
    ('SOL', 'ETH', 3, 6, 4, 0.0000001000, 'SOL_ETH', 'active'),
    ('LINK', 'ETH', 3, 6, 4, 0.0000001000, 'LINK_ETH', 'active'),
    ('UNI', 'ETH', 3, 6, 4, 0.0000001000, 'UNI_ETH', 'active'),
    ('AAVE', 'ETH', 4, 5, 4, 0.0000000100, 'AAVE_ETH', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREATE SAMPLE ACCOUNTS (for testing)
-- ============================================================================
INSERT INTO account (id, l1_address, l2_pubkey)
VALUES 
    (1, '0x0000000000000000000000000000000000000001', ''),
    (2, '0x0000000000000000000000000000000000000002', ''),
    (3, '0x0000000000000000000000000000000000000003', '')
ON CONFLICT (id) DO NOTHING;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully';
    RAISE NOTICE 'Assets: %', (SELECT COUNT(*) FROM asset);
    RAISE NOTICE 'Markets: %', (SELECT COUNT(*) FROM market);
    RAISE NOTICE 'Accounts: %', (SELECT COUNT(*) FROM account);
END $$;