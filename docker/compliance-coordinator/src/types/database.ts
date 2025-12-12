/**
 * Database Types for Compliance Coordinator
 */

// ==================== AGGREGATED RISK ASSESSMENTS ====================

export interface AggregatedRiskAssessmentTable {
  id: string;
  source_service: string;
  source_assessment_id: string;
  entity_type: string;
  entity_id: string;
  transaction_hash: string | null;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  assessment_date: Date;
  created_at: Date;
  updated_at: Date;
}

// ==================== AGGREGATED TRAVEL RULE ====================

export interface AggregatedTravelRuleTable {
  id: string;
  source_service: string;
  source_travel_rule_id: string;
  entity_type: string;
  entity_id: string;
  transaction_hash: string | null;
  from_address: string;
  to_address: string;
  amount: string;
  amount_usd: string;
  asset: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  message_id: string;
  originator_info: Record<string, unknown> | null;
  beneficiary_info: Record<string, unknown> | null;
  vasp_info: Record<string, unknown> | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== AGGREGATED CARF REPORTS ====================

export interface AggregatedCARFReportTable {
  id: string;
  report_id: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  reporting_period_fiscal_year: string | null;
  services: string[];
  cex_data: Record<string, unknown> | null;
  dex_data: Record<string, unknown> | null;
  nft_data: Record<string, unknown> | null;
  token_data: Record<string, unknown> | null;
  total_volume_usd: string;
  total_net_gain_loss_usd: string;
  total_transaction_count: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submission_date: Date | null;
  acknowledgment_date: Date | null;
  rejection_reason: string | null;
  version: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== PLATFORM COMPLIANCE REPORTS ====================

export interface PlatformComplianceReportTable {
  id: string;
  report_id: string;
  report_type: string;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  summary: Record<string, unknown>;
  service_breakdown: Record<string, unknown>[];
  risk_distribution: Record<string, unknown>;
  top_risk_flags: Record<string, unknown>[];
  generated_at: Date;
  generated_by: string;
  format: string;
  file_url: string | null;
  created_at: Date;
}

// ==================== USER COMPLIANCE REPORTS ====================

export interface UserComplianceReportTable {
  id: string;
  report_id: string;
  user_id: string;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  summary: Record<string, unknown>;
  activity_by_service: Record<string, unknown>[];
  risk_history: Record<string, unknown>[];
  flags: string[];
  recommendations: string[];
  generated_at: Date;
  format: string;
  file_url: string | null;
  created_at: Date;
}

// ==================== REGULATORY SUBMISSIONS ====================

export interface RegulatorySubmissionTable {
  id: string;
  submission_id: string;
  submission_type: string;
  jurisdiction: string;
  authority: string;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date | null;
  reporting_period_end_date: Date | null;
  data: Record<string, unknown>;
  status: string;
  submission_date: Date | null;
  response_date: Date | null;
  response_code: string | null;
  response_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  submitted_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== COMPLIANCE ALERTS ====================

export interface ComplianceAlertTable {
  id: string;
  alert_type: string;
  severity: string;
  source_service: string;
  source_entity_type: string;
  source_entity_id: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  status: string;
  assigned_to: string | null;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  resolved_by: string | null;
  resolved_at: Date | null;
  resolution: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== ADMIN USERS ====================

export interface AdminUserTable {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  tenant_id: string;
  broker_id: string | null;
  last_login: Date | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== ADMIN ACTION LOG ====================

export interface AdminActionLogTable {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  tenant_id: string;
  created_at: Date;
}

// ==================== SERVICE STATUS ====================

export interface ServiceStatusTable {
  id: string;
  service: string;
  status: string;
  last_check: Date;
  latency: number;
  version: string;
  pending_assessments: number;
  high_risk_alerts: number;
  pending_travel_rule: number;
  pending_carf: number;
  created_at: Date;
  updated_at: Date;
}

// ==================== DASHBOARD METRICS ====================

export interface DashboardMetricsTable {
  id: string;
  timestamp: Date;
  period: string;
  services_data: Record<string, unknown>[];
  totals: Record<string, unknown>;
  trends: Record<string, unknown>;
  tenant_id: string;
  created_at: Date;
}
