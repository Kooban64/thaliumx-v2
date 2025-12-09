-- ThaliumX Citus Table Distribution Script
-- ========================================
-- This script distributes tables across worker nodes
-- Run after workers are registered

-- Make tenants a reference table (replicated to all nodes)
-- Reference tables are small lookup tables that need to be available on all nodes
SELECT create_reference_table('tenants');

-- Distribute tables by tenant_id for multi-tenant isolation
-- All queries will be routed to the correct shard based on tenant_id
SELECT create_distributed_table('users', 'tenant_id');
SELECT create_distributed_table('accounts', 'tenant_id');
SELECT create_distributed_table('transactions', 'tenant_id');
SELECT create_distributed_table('orders', 'tenant_id');
SELECT create_distributed_table('audit_logs', 'tenant_id');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(tenant_id, account_type);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(tenant_id, symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(tenant_id, created_at);

-- Insert default tenant for development
INSERT INTO tenants (id, name, slug, status, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'ThaliumX Default',
    'default',
    'active',
    '{"features": ["trading", "accounts", "analytics"]}'
) ON CONFLICT (slug) DO NOTHING;

-- Verify distribution
SELECT * FROM citus_tables;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'ThaliumX Citus table distribution complete';
    RAISE NOTICE 'Tables distributed by tenant_id for multi-tenant isolation';
END $$;