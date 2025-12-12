-- ThaliumX JSONB Migration
-- Migration: 005_jsonb_migration
-- Description: Convert detail and params fields to JSONB for better performance

-- Convert balance_history.detail to JSONB
ALTER TABLE balance_history ADD COLUMN detail_jsonb JSONB;
UPDATE balance_history SET detail_jsonb = detail::jsonb WHERE detail IS NOT NULL AND detail != '';
ALTER TABLE balance_history DROP COLUMN detail;
ALTER TABLE balance_history RENAME COLUMN detail_jsonb TO detail;

-- Convert operation_log.params to JSONB
ALTER TABLE operation_log ADD COLUMN params_jsonb JSONB;
UPDATE operation_log SET params_jsonb = params::jsonb WHERE params IS NOT NULL AND params != '';
ALTER TABLE operation_log DROP COLUMN params;
ALTER TABLE operation_log RENAME COLUMN params_jsonb TO params;

-- Create indexes for better JSONB query performance
CREATE INDEX idx_balance_history_detail ON balance_history USING GIN (detail);
CREATE INDEX idx_operation_log_params ON operation_log USING GIN (params);

-- Add comments
COMMENT ON COLUMN balance_history.detail IS 'Transaction details in JSONB format for better query performance';
COMMENT ON COLUMN operation_log.params IS 'Operation parameters in JSONB format for better query performance';

COMMIT;