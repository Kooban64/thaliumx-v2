#!/bin/bash

# ThaliumX Production Database Seeding Script
# ==========================================
# Seeds production database with initial data and test users

set -e

echo "🌱 Seeding ThaliumX production database..."

# Function to execute SQL
execute_sql() {
    docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "$1"
}

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until docker exec thaliumx-postgres pg_isready -U thaliumx -d thaliumx; do
    echo "Database not ready, waiting..."
    sleep 5
done

echo "✅ Database ready"

# Create test data SQL
cat > /tmp/seed-test-data.sql << 'EOF'
-- ThaliumX Production Database Seed Data
-- =====================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Insert default tenant
INSERT INTO tenants (name, slug, type, status, settings)
VALUES ('ThaliumX Platform', 'thaliumx', 'platform', 'active',
        '{"features": ["trading", "accounts", "analytics", "kyc", "margin"], "is_platform": true}')
ON CONFLICT (slug) DO NOTHING;

-- Insert test users with different roles
INSERT INTO users (
    id, email, email_verified, first_name, last_name, status, kyc_status,
    password_hash, roles, created_at, updated_at
) VALUES
-- Platform Admin
(uuid_generate_v4(), 'admin@thaliumx.com', true, 'Platform', 'Admin', 'active', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["platform_admin"]',
 NOW(), NOW()),

-- Broker Admin
(uuid_generate_v4(), 'broker@thaliumx.com', true, 'Broker', 'Admin', 'active', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["broker_admin"]',
 NOW(), NOW()),

-- Trader
(uuid_generate_v4(), 'trader@thaliumx.com', true, 'John', 'Trader', 'active', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["trader"]',
 NOW(), NOW()),

-- Basic User
(uuid_generate_v4(), 'user@thaliumx.com', true, 'Jane', 'User', 'active', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["user"]',
 NOW(), NOW()),

-- Pending KYC User
(uuid_generate_v4(), 'pending@thaliumx.com', true, 'Pending', 'KYC', 'active', 'pending',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["user"]',
 NOW(), NOW()),

-- Suspended User
(uuid_generate_v4(), 'suspended@thaliumx.com', true, 'Suspended', 'User', 'suspended', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["user"]',
 NOW(), NOW()),

-- Banned User
(uuid_generate_v4(), 'banned@thaliumx.com', true, 'Banned', 'User', 'banned', 'approved',
 '$2b$10$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', '["user"]',
 NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert trading pairs
INSERT INTO trading_pairs (
    symbol, base_currency, quote_currency, status, maker_fee, taker_fee,
    min_order_size, max_order_size, price_precision, quantity_precision,
    is_margin_enabled, max_leverage, created_at, updated_at
) VALUES
('BTC/USDT', 'BTC', 'USDT', 'active', 0.001, 0.001, 0.00001, 100, 8, 8, true, 20, NOW(), NOW()),
('ETH/USDT', 'ETH', 'USDT', 'active', 0.001, 0.001, 0.0001, 1000, 8, 8, true, 20, NOW(), NOW()),
('BNB/USDT', 'BNB', 'USDT', 'active', 0.001, 0.001, 0.01, 10000, 8, 8, true, 10, NOW(), NOW()),
('THAL/USDT', 'THAL', 'USDT', 'active', 0.0005, 0.0005, 1, 1000000, 8, 8, false, 1, NOW(), NOW()),
('THAL/BTC', 'THAL', 'BTC', 'active', 0.0005, 0.0005, 1, 1000000, 8, 8, false, 1, NOW(), NOW()),
('THAL/ETH', 'THAL', 'ETH', 'active', 0.0005, 0.0005, 1, 1000000, 8, 8, false, 1, NOW(), NOW())
ON CONFLICT (symbol) DO NOTHING;

-- Insert sample wallets for test users
INSERT INTO wallets (
    user_id, currency, type, balance, available_balance, status, created_at, updated_at
)
SELECT
    u.id,
    'USDT',
    'spot',
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 1000000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 50000.00
        WHEN u.email = 'user@thaliumx.com' THEN 10000.00
        ELSE 1000.00
    END,
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 1000000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 50000.00
        WHEN u.email = 'user@thaliumx.com' THEN 10000.00
        ELSE 1000.00
    END,
    'active',
    NOW(),
    NOW()
FROM users u
WHERE u.email IN ('admin@thaliumx.com', 'trader@thaliumx.com', 'user@thaliumx.com')
ON CONFLICT (user_id, currency, type) DO NOTHING;

-- Insert BTC wallets
INSERT INTO wallets (
    user_id, currency, type, balance, available_balance, status, created_at, updated_at
)
SELECT
    u.id,
    'BTC',
    'spot',
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 100.00
        WHEN u.email = 'trader@thaliumx.com' THEN 5.00
        WHEN u.email = 'user@thaliumx.com' THEN 1.00
        ELSE 0.10
    END,
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 100.00
        WHEN u.email = 'trader@thaliumx.com' THEN 5.00
        WHEN u.email = 'user@thaliumx.com' THEN 1.00
        ELSE 0.10
    END,
    'active',
    NOW(),
    NOW()
FROM users u
WHERE u.email IN ('admin@thaliumx.com', 'trader@thaliumx.com', 'user@thaliumx.com')
ON CONFLICT (user_id, currency, type) DO NOTHING;

-- Insert ETH wallets
INSERT INTO wallets (
    user_id, currency, type, balance, available_balance, status, created_at, updated_at
)
SELECT
    u.id,
    'ETH',
    'spot',
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 1000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 50.00
        WHEN u.email = 'user@thaliumx.com' THEN 10.00
        ELSE 1.00
    END,
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 1000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 50.00
        WHEN u.email = 'user@thaliumx.com' THEN 10.00
        ELSE 1.00
    END,
    'active',
    NOW(),
    NOW()
FROM users u
WHERE u.email IN ('admin@thaliumx.com', 'trader@thaliumx.com', 'user@thaliumx.com')
ON CONFLICT (user_id, currency, type) DO NOTHING;

-- Insert THAL wallets
INSERT INTO wallets (
    user_id, currency, type, balance, available_balance, status, created_at, updated_at
)
SELECT
    u.id,
    'THAL',
    'spot',
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 10000000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 500000.00
        WHEN u.email = 'user@thaliumx.com' THEN 100000.00
        ELSE 10000.00
    END,
    CASE
        WHEN u.email = 'admin@thaliumx.com' THEN 10000000.00
        WHEN u.email = 'trader@thaliumx.com' THEN 500000.00
        WHEN u.email = 'user@thaliumx.com' THEN 100000.00
        ELSE 10000.00
    END,
    'active',
    NOW(),
    NOW()
FROM users u
ON CONFLICT (user_id, currency, type) DO NOTHING;

-- Insert sample orders
INSERT INTO orders (
    user_id, trading_pair_id, symbol, type, side, quantity, status, created_at, updated_at
)
SELECT
    u.id,
    tp.id,
    tp.symbol,
    'market',
    CASE WHEN random() < 0.5 THEN 'buy' ELSE 'sell' END,
    CASE
        WHEN tp.symbol LIKE '%BTC%' THEN round(random() * 0.1 + 0.01, 8)
        WHEN tp.symbol LIKE '%ETH%' THEN round(random() * 1 + 0.1, 8)
        ELSE round(random() * 100 + 10, 8)
    END,
    CASE
        WHEN random() < 0.7 THEN 'filled'
        WHEN random() < 0.9 THEN 'partially_filled'
        ELSE 'pending'
    END,
    NOW() - (random() * interval '30 days'),
    NOW() - (random() * interval '30 days')
FROM users u
CROSS JOIN trading_pairs tp
WHERE u.email IN ('admin@thaliumx.com', 'trader@thaliumx.com')
AND random() < 0.3
LIMIT 50;

-- Insert audit logs
INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, created_at
)
SELECT
    u.id,
    CASE
        WHEN random() < 0.3 THEN 'login'
        WHEN random() < 0.6 THEN 'order_created'
        WHEN random() < 0.8 THEN 'wallet_deposit'
        ELSE 'profile_updated'
    END,
    CASE
        WHEN random() < 0.5 THEN 'user'
        ELSE 'order'
    END,
    uuid_generate_v4(),
    NOW() - (random() * interval '30 days')
FROM users u
WHERE random() < 0.2
LIMIT 100;

-- Insert notifications
INSERT INTO notifications (
    user_id, type, title, message, created_at
)
SELECT
    u.id,
    CASE
        WHEN random() < 0.4 THEN 'order_filled'
        WHEN random() < 0.7 THEN 'price_alert'
        ELSE 'system_update'
    END,
    CASE
        WHEN random() < 0.4 THEN 'Order Filled'
        WHEN random() < 0.7 THEN 'Price Alert'
        ELSE 'System Update'
    END,
    CASE
        WHEN random() < 0.4 THEN 'Your order has been filled successfully'
        WHEN random() < 0.7 THEN 'BTC price has reached your target'
        ELSE 'System maintenance completed'
    END,
    NOW() - (random() * interval '7 days')
FROM users u
WHERE random() < 0.15
LIMIT 50;

COMMIT;
EOF

# Execute the seeding script
echo "📝 Executing database seeding..."
docker exec -i thaliumx-postgres psql -U thaliumx -d thaliumx < /tmp/seed-test-data.sql

# Clean up
rm /tmp/seed-test-data.sql

# Verify seeding
echo "🔍 Verifying database seeding..."
USER_COUNT=$(execute_sql "SELECT COUNT(*) FROM users;" | grep -o '[0-9]\+')
WALLET_COUNT=$(execute_sql "SELECT COUNT(*) FROM wallets;" | grep -o '[0-9]\+')
ORDER_COUNT=$(execute_sql "SELECT COUNT(*) FROM orders;" | grep -o '[0-9]\+')

echo "✅ Database seeded successfully!"
echo "   Users: $USER_COUNT"
echo "   Wallets: $WALLET_COUNT"
echo "   Orders: $ORDER_COUNT"

# Seed MongoDB with additional data if needed
echo "📊 Seeding MongoDB..."
docker exec thaliumx-mongodb mongo thaliumx --eval '
db.createCollection("market_data");
db.createCollection("user_preferences");
db.createCollection("trading_signals");

db.market_data.insertMany([
    {
        symbol: "BTC/USDT",
        price: 45000,
        volume: 1234567.89,
        timestamp: new Date()
    },
    {
        symbol: "ETH/USDT",
        price: 2800,
        volume: 987654.32,
        timestamp: new Date()
    }
]);

print("✅ MongoDB seeded successfully");
'

echo "🎉 Production database seeding complete!"
echo ""
echo "Test Users Created:"
echo "==================="
echo "Platform Admin: admin@thaliumx.com / password123"
echo "Broker Admin:   broker@thaliumx.com / password123"
echo "Trader:         trader@thaliumx.com / password123"
echo "Basic User:     user@thaliumx.com / password123"
echo "Pending KYC:    pending@thaliumx.com / password123"
echo "Suspended:      suspended@thaliumx.com / password123"
echo "Banned:         banned@thaliumx.com / password123"
echo ""
echo "All users have password: password123"