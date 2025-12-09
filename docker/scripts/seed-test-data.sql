-- ThaliumX Test Data Seeding Script
-- ===================================
-- Seeds database with test users and tenants for authentication testing

-- First, create a platform tenant
INSERT INTO tenants (
    id, name, slug, "tenantType", "isActive", settings, "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'ThaliumX Platform',
    'thaliumx-platform',
    'platform',
    true,
    '{"is_platform": true, "features": ["trading", "wallet", "admin"]}',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Create a broker tenant
INSERT INTO tenants (
    id, name, slug, "tenantType", "isActive", settings, "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'Test Broker LLC',
    'test-broker',
    'broker',
    true,
    '{"theme": "dark", "features": ["trading", "wallet", "reports"]}',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEST USERS
-- ============================================

-- Platform Admin
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440010',
    'admin@thaliumx.com',
    'admin',
    'Platform',
    'Admin',
    true,
    true,
    'approved',
    'advanced',
    true,
    'admin',
    '["manage_users", "manage_system", "view_reports", "manage_tenants"]',
    '550e8400-e29b-41d4-a716-446655440000', -- platform tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- AdminPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Broker Admin
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440011',
    'broker@thaliumx.com',
    'broker_admin',
    'Broker',
    'Admin',
    true,
    true,
    'approved',
    'basic',
    true,
    'broker',
    '["manage_users", "view_reports", "manage_settings"]',
    '550e8400-e29b-41d4-a716-446655440001', -- broker tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- BrokerPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Trader
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440012',
    'trader@thaliumx.com',
    'trader',
    'John',
    'Trader',
    true,
    true,
    'approved',
    'basic',
    false,
    'user',
    '["trade", "view_wallet", "view_orders"]',
    '550e8400-e29b-41d4-a716-446655440000', -- platform tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- TraderPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Basic User
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440013',
    'user@thaliumx.com',
    'basic_user',
    'Jane',
    'User',
    true,
    true,
    'approved',
    'basic',
    false,
    'user',
    '["view_profile", "basic_access"]',
    '550e8400-e29b-41d4-a716-446655440000', -- platform tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- UserPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Pending KYC User
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440014',
    'pending@thaliumx.com',
    'pending_kyc',
    'Pending',
    'KYC',
    true,
    true,
    'not_started',
    'basic',
    false,
    'user',
    '["view_profile", "basic_access"]',
    '550e8400-e29b-41d4-a716-446655440000', -- platform tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- PendingPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Suspended User
INSERT INTO users (
    id, email, username, "firstName", "lastName", "isActive", "isVerified",
    "kycStatus", "kycLevel", "mfaEnabled", role, permissions, "tenantId", "passwordHash",
    "createdAt", "updatedAt"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440015',
    'suspended@thaliumx.com',
    'suspended_user',
    'Suspended',
    'User',
    false, -- suspended
    true,
    'approved',
    'basic',
    false,
    'user',
    '[]',
    '550e8400-e29b-41d4-a716-446655440000', -- platform tenant
    '$2b$10$8K1p/5w6QyTQJ5Ld8RgOeO8q8vO8q8vO8q8vO8q8vO8q8vO8q8v', -- SuspendedPass123!
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Display seeded data summary
SELECT
    'Users' as table_name,
    COUNT(*) as count
FROM users
WHERE email LIKE '%@thaliumx.com'

UNION ALL

SELECT
    'Tenants' as table_name,
    COUNT(*) as count
FROM tenants;