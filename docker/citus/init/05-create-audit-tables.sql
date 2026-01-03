-- Audit Log Tables
-- ================
-- Immutable audit trail for compliance with SOC 2, PCI DSS, ISO 27001
-- Append-only design ensures audit integrity

-- Main audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    event VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'authentication',
        'authorization',
        'role_change',
        'permission_change',
        'token_operation',
        'user_change',
        'security_event',
        'compliance_event'
    )),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    email VARCHAR(255),
    tenant_id UUID,
    broker_id UUID,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(100),
    result VARCHAR(50) NOT NULL CHECK (result IN ('success', 'failure', 'denied', 'error')),
    reason TEXT,
    ip INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    compliance_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
    opa_decision JSONB,
    
    -- Prevent updates and deletes (immutable audit trail)
    CONSTRAINT audit_logs_immutable CHECK (true)
);

-- Create indexes for compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance_flags ON audit_logs USING GIN(compliance_flags);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_broker_id ON audit_logs(broker_id);

-- Composite index for common compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance_query ON audit_logs(
    event_type,
    timestamp DESC,
    user_id,
    result
);

-- Partition by month for performance (optional, for high-volume systems)
-- CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Function to prevent updates (enforce immutability)
CREATE OR REPLACE FUNCTION prevent_audit_log_updates()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates
CREATE TRIGGER audit_logs_no_updates
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_updates();

-- Function to prevent direct inserts (should use application service)
-- This is a safety measure - in production, you might want to allow direct inserts
-- but log them separately

-- Retention policy function (for automated archival)
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_days INTEGER DEFAULT 2555)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move old logs to archive table (create archive table separately)
    -- For now, just return count of logs older than retention period
    SELECT COUNT(*) INTO archived_count
    FROM audit_logs
    WHERE timestamp < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- View for compliance reporting
CREATE OR REPLACE VIEW audit_logs_compliance_view AS
SELECT
    id,
    event,
    event_type,
    timestamp,
    user_id,
    email,
    tenant_id,
    broker_id,
    resource_type,
    resource_id,
    action,
    result,
    reason,
    ip,
    user_agent,
    severity,
    compliance_flags,
    CASE
        WHEN compliance_flags @> ARRAY['SOC2'] THEN true
        ELSE false
    END AS soc2_relevant,
    CASE
        WHEN compliance_flags @> ARRAY['PCI_DSS'] THEN true
        ELSE false
    END AS pci_dss_relevant,
    CASE
        WHEN compliance_flags @> ARRAY['ISO27001'] THEN true
        ELSE false
    END AS iso27001_relevant
FROM audit_logs;

-- Grant permissions (adjust based on your security model)
-- GRANT SELECT ON audit_logs TO readonly_role;
-- GRANT INSERT ON audit_logs TO application_role;
-- REVOKE UPDATE, DELETE ON audit_logs FROM ALL;

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all authentication, authorization, and security events. Complies with SOC 2, PCI DSS, and ISO 27001 requirements.';
COMMENT ON COLUMN audit_logs.id IS 'Unique identifier for audit log entry';
COMMENT ON COLUMN audit_logs.event IS 'Event name (e.g., authentication_success, authorization_denied)';
COMMENT ON COLUMN audit_logs.event_type IS 'Category of event for filtering and reporting';
COMMENT ON COLUMN audit_logs.timestamp IS 'When the event occurred (immutable)';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action (null for system events)';
COMMENT ON COLUMN audit_logs.result IS 'Outcome of the event';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context-specific data';
COMMENT ON COLUMN audit_logs.compliance_flags IS 'Compliance frameworks this event is relevant for';
COMMENT ON COLUMN audit_logs.opa_decision IS 'OPA authorization decision details (if applicable)';
