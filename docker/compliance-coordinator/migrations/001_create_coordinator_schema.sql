-- Compliance Coordinator Database Schema
-- Migration: 001_create_coordinator_schema.sql
-- Description: Creates all tables for the Compliance Coordinator

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== AGGREGATED RISK ASSESSMENTS ====================

CREATE TABLE IF NOT EXISTS aggregated_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_service VARCHAR(20) NOT NULL CHECK (source_service IN ('cex', 'dex', 'nft', 'token')),
    source_assessment_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66),
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    flags TEXT[] NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    review_required BOOLEAN NOT NULL DEFAULT false,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_service, source_assessment_id)
);

CREATE INDEX idx_agg_risk_tenant ON aggregated_risk_assessments(tenant_id);
CREATE INDEX idx_agg_risk_user ON aggregated_risk_assessments(user_id);
CREATE INDEX idx_agg_risk_level ON aggregated_risk_assessments(risk_level);
CREATE INDEX idx_agg_risk_review ON aggregated_risk_assessments(review_required, reviewed_at);
CREATE INDEX idx_agg_risk_date ON aggregated_risk_assessments(assessment_date);
CREATE INDEX idx_agg_risk_source ON aggregated_risk_assessments(source_service);

-- ==================== AGGREGATED TRAVEL RULES ====================

CREATE TABLE IF NOT EXISTS aggregated_travel_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_service VARCHAR(20) NOT NULL CHECK (source_service IN ('cex', 'dex', 'nft', 'token')),
    source_travel_rule_id VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66),
    from_address VARCHAR(100) NOT NULL,
    to_address VARCHAR(100) NOT NULL,
    amount VARCHAR(78) NOT NULL,
    amount_usd VARCHAR(50) NOT NULL,
    asset VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'received', 'acknowledged', 'failed')),
    message_id VARCHAR(100) NOT NULL,
    originator_info JSONB,
    beneficiary_info JSONB,
    vasp_info JSONB,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_service, source_travel_rule_id)
);

CREATE INDEX idx_agg_travel_tenant ON aggregated_travel_rules(tenant_id);
CREATE INDEX idx_agg_travel_user ON aggregated_travel_rules(user_id);
CREATE INDEX idx_agg_travel_status ON aggregated_travel_rules(status);
CREATE INDEX idx_agg_travel_source ON aggregated_travel_rules(source_service);
CREATE INDEX idx_agg_travel_created ON aggregated_travel_rules(created_at);

-- ==================== AGGREGATED CARF REPORTS ====================

CREATE TABLE IF NOT EXISTS aggregated_carf_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(50) NOT NULL UNIQUE,
    user_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_fiscal_year VARCHAR(10),
    services TEXT[] NOT NULL DEFAULT '{}',
    cex_data JSONB,
    dex_data JSONB,
    nft_data JSONB,
    token_data JSONB,
    total_volume_usd VARCHAR(50) NOT NULL,
    total_net_gain_loss_usd VARCHAR(50) NOT NULL,
    total_transaction_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending', 'submitted', 'acknowledged', 'rejected')),
    submission_date TIMESTAMP WITH TIME ZONE,
    acknowledgment_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    version VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agg_carf_tenant ON aggregated_carf_reports(tenant_id);
CREATE INDEX idx_agg_carf_user ON aggregated_carf_reports(user_id);
CREATE INDEX idx_agg_carf_status ON aggregated_carf_reports(status);
CREATE INDEX idx_agg_carf_period ON aggregated_carf_reports(reporting_period_start_date, reporting_period_end_date);

-- ==================== PLATFORM COMPLIANCE REPORTS ====================

CREATE TABLE IF NOT EXISTS platform_compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(50) NOT NULL UNIQUE,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')),
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    summary JSONB NOT NULL,
    service_breakdown JSONB NOT NULL,
    risk_distribution JSONB NOT NULL,
    top_risk_flags JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    generated_by VARCHAR(100) NOT NULL,
    format VARCHAR(10) NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_reports_tenant ON platform_compliance_reports(tenant_id);
CREATE INDEX idx_platform_reports_type ON platform_compliance_reports(report_type);
CREATE INDEX idx_platform_reports_period ON platform_compliance_reports(reporting_period_start_date, reporting_period_end_date);
CREATE INDEX idx_platform_reports_generated ON platform_compliance_reports(generated_at);

-- ==================== USER COMPLIANCE REPORTS ====================

CREATE TABLE IF NOT EXISTS user_compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(50) NOT NULL UNIQUE,
    user_id VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reporting_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    summary JSONB NOT NULL,
    activity_by_service JSONB NOT NULL,
    risk_history JSONB NOT NULL,
    flags TEXT[] NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    format VARCHAR(10) NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_reports_tenant ON user_compliance_reports(tenant_id);
CREATE INDEX idx_user_reports_user ON user_compliance_reports(user_id);
CREATE INDEX idx_user_reports_period ON user_compliance_reports(reporting_period_start_date, reporting_period_end_date);
CREATE INDEX idx_user_reports_generated ON user_compliance_reports(generated_at);

-- ==================== REGULATORY SUBMISSIONS ====================

CREATE TABLE IF NOT EXISTS regulatory_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id VARCHAR(50) NOT NULL UNIQUE,
    submission_type VARCHAR(20) NOT NULL,
    jurisdiction VARCHAR(10) NOT NULL,
    authority VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    reporting_period_start_date TIMESTAMP WITH TIME ZONE,
    reporting_period_end_date TIMESTAMP WITH TIME ZONE,
    data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending', 'submitted', 'acknowledged', 'rejected', 'accepted')),
    submission_date TIMESTAMP WITH TIME ZONE,
    response_date TIMESTAMP WITH TIME ZONE,
    response_code VARCHAR(50),
    response_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    submitted_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reg_submissions_tenant ON regulatory_submissions(tenant_id);
CREATE INDEX idx_reg_submissions_type ON regulatory_submissions(submission_type);
CREATE INDEX idx_reg_submissions_jurisdiction ON regulatory_submissions(jurisdiction);
CREATE INDEX idx_reg_submissions_status ON regulatory_submissions(status);
CREATE INDEX idx_reg_submissions_retry ON regulatory_submissions(next_retry_at) WHERE status = 'pending';

-- ==================== COMPLIANCE ALERTS ====================

CREATE TABLE IF NOT EXISTS compliance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source_service VARCHAR(20) NOT NULL CHECK (source_service IN ('cex', 'dex', 'nft', 'token', 'coordinator')),
    source_entity_type VARCHAR(50) NOT NULL,
    source_entity_id VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    user_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('new', 'acknowledged', 'investigating', 'resolved', 'dismissed')),
    assigned_to VARCHAR(100),
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_tenant ON compliance_alerts(tenant_id);
CREATE INDEX idx_alerts_severity ON compliance_alerts(severity);
CREATE INDEX idx_alerts_status ON compliance_alerts(status);
CREATE INDEX idx_alerts_source ON compliance_alerts(source_service);
CREATE INDEX idx_alerts_user ON compliance_alerts(user_id);
CREATE INDEX idx_alerts_created ON compliance_alerts(created_at);

-- ==================== SERVICE STATUS ====================

CREATE TABLE IF NOT EXISTS service_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(20) NOT NULL CHECK (service IN ('cex', 'dex', 'nft', 'token')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    last_check TIMESTAMP WITH TIME ZONE NOT NULL,
    latency INTEGER NOT NULL,
    version VARCHAR(50) NOT NULL,
    pending_assessments INTEGER NOT NULL DEFAULT 0,
    high_risk_alerts INTEGER NOT NULL DEFAULT 0,
    pending_travel_rule INTEGER NOT NULL DEFAULT 0,
    pending_carf INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service)
);

CREATE INDEX idx_service_status_service ON service_status(service);
CREATE INDEX idx_service_status_status ON service_status(status);

-- ==================== ADMIN USERS ====================

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'compliance_officer', 'analyst', 'viewer')),
    permissions TEXT[] NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(100) NOT NULL,
    broker_id VARCHAR(100),
    last_login TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_tenant ON admin_users(tenant_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_active ON admin_users(active);

-- ==================== ADMIN ACTION LOG ====================

CREATE TABLE IF NOT EXISTS admin_action_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_log_admin ON admin_action_log(admin_id);
CREATE INDEX idx_admin_log_tenant ON admin_action_log(tenant_id);
CREATE INDEX idx_admin_log_action ON admin_action_log(action);
CREATE INDEX idx_admin_log_created ON admin_action_log(created_at);

-- ==================== DASHBOARD METRICS ====================

CREATE TABLE IF NOT EXISTS dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    period VARCHAR(20) NOT NULL CHECK (period IN ('realtime', 'hourly', 'daily', 'weekly', 'monthly')),
    services_data JSONB NOT NULL,
    totals JSONB NOT NULL,
    trends JSONB NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dashboard_metrics_tenant ON dashboard_metrics(tenant_id);
CREATE INDEX idx_dashboard_metrics_period ON dashboard_metrics(period);
CREATE INDEX idx_dashboard_metrics_timestamp ON dashboard_metrics(timestamp);

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_coordinator_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_agg_risk_updated_at
    BEFORE UPDATE ON aggregated_risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_agg_travel_updated_at
    BEFORE UPDATE ON aggregated_travel_rules
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_agg_carf_updated_at
    BEFORE UPDATE ON aggregated_carf_reports
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_reg_submissions_updated_at
    BEFORE UPDATE ON regulatory_submissions
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON compliance_alerts
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_service_status_updated_at
    BEFORE UPDATE ON service_status
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_coordinator_updated_at();

-- ==================== COMMENTS ====================

COMMENT ON TABLE aggregated_risk_assessments IS 'Aggregated risk assessments from all compliance services';
COMMENT ON TABLE aggregated_travel_rules IS 'Aggregated travel rule messages from all services';
COMMENT ON TABLE aggregated_carf_reports IS 'Aggregated CARF reports combining data from all services';
COMMENT ON TABLE platform_compliance_reports IS 'Platform-wide compliance reports';
COMMENT ON TABLE user_compliance_reports IS 'Individual user compliance reports';
COMMENT ON TABLE regulatory_submissions IS 'Regulatory submission tracking';
COMMENT ON TABLE compliance_alerts IS 'Cross-platform compliance alerts';
COMMENT ON TABLE service_status IS 'Health status of compliance services';
COMMENT ON TABLE admin_users IS 'Admin users for compliance management';
COMMENT ON TABLE admin_action_log IS 'Audit log for admin actions';
COMMENT ON TABLE dashboard_metrics IS 'Cached dashboard metrics';
