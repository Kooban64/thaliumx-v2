/**
 * Database Types for Compliance Coordinator
 */

export interface AggregatedRiskAssessmentRow {
  id: string;
  sourceService: string;
  sourceAssessmentId: string;
  entityType: string;
  entityId: string;
  transactionHash: string | null;
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  reviewRequired: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  assessmentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedTravelRuleRow {
  id: string;
  sourceService: string;
  sourceTravelRuleId: string;
  entityType: string;
  entityId: string;
  transactionHash: string | null;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUsd: string;
  asset: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo: Record<string, unknown> | null;
  beneficiaryInfo: Record<string, unknown> | null;
  vaspInfo: Record<string, unknown> | null;
  tenantId: string;
  brokerId: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedCarfReportRow {
  id: string;
  reportId: string;
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  reportingPeriodStartDate: Date;
  reportingPeriodEndDate: Date;
  reportingPeriodFiscalYear: string | null;
  services: string[];
  cexData: Record<string, unknown> | null;
  dexData: Record<string, unknown> | null;
  nftData: Record<string, unknown> | null;
  tokenData: Record<string, unknown> | null;
  totalVolumeUsd: string;
  totalNetGainLossUsd: string;
  totalTransactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate: Date | null;
  acknowledgmentDate: Date | null;
  rejectionReason: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformComplianceReportRow {
  id: string;
  reportId: string;
  reportType: string;
  tenantId: string;
  brokerId: string | null;
  reportingPeriodStartDate: Date;
  reportingPeriodEndDate: Date;
  summary: Record<string, unknown>;
  serviceBreakdown: Record<string, unknown>[];
  riskDistribution: Record<string, unknown>;
  topRiskFlags: Record<string, unknown>[];
  generatedAt: Date;
  generatedBy: string;
  format: string;
  fileUrl: string | null;
  createdAt: Date;
}

export interface UserComplianceReportRow {
  id: string;
  reportId: string;
  userId: string;
  tenantId: string;
  brokerId: string | null;
  reportingPeriodStartDate: Date;
  reportingPeriodEndDate: Date;
  summary: Record<string, unknown>;
  activityByService: Record<string, unknown>[];
  riskHistory: Record<string, unknown>[];
  flags: string[];
  recommendations: string[];
  generatedAt: Date;
  format: string;
  fileUrl: string | null;
  createdAt: Date;
}

export interface RegulatorySubmissionRow {
  id: string;
  submissionId: string;
  submissionType: string;
  jurisdiction: string;
  authority: string;
  tenantId: string;
  brokerId: string | null;
  reportingPeriodStartDate: Date | null;
  reportingPeriodEndDate: Date | null;
  data: Record<string, unknown>;
  status: string;
  submissionDate: Date | null;
  responseDate: Date | null;
  responseCode: string | null;
  responseMessage: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  submittedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceAlertRow {
  id: string;
  alertType: string;
  severity: string;
  sourceService: string;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  tenantId: string;
  brokerId: string | null;
  userId: string | null;
  status: string;
  assignedTo: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  tenantId: string;
  brokerId: string | null;
  lastLogin: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminActionLogRow {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  tenantId: string;
  createdAt: Date;
}

export interface ServiceStatusRow {
  id: string;
  service: string;
  status: string;
  lastCheck: Date;
  latency: number;
  version: string;
  pendingAssessments: number;
  highRiskAlerts: number;
  pendingTravelRule: number;
  pendingCarf: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardMetricsRow {
  id: string;
  timestamp: Date;
  period: string;
  servicesData: Record<string, unknown>[];
  totals: Record<string, unknown>;
  trends: Record<string, unknown>;
  tenantId: string;
  createdAt: Date;
}

export type AggregatedRiskAssessmentTable = AggregatedRiskAssessmentRow;
export type AggregatedTravelRuleTable = AggregatedTravelRuleRow;
export type AggregatedCARFReportTable = AggregatedCarfReportRow;
export type PlatformComplianceReportTable = PlatformComplianceReportRow;
export type UserComplianceReportTable = UserComplianceReportRow;
export type RegulatorySubmissionTable = RegulatorySubmissionRow;
export type ComplianceAlertTable = ComplianceAlertRow;
export type AdminUserTable = AdminUserRow;
export type AdminActionLogTable = AdminActionLogRow;
export type ServiceStatusTable = ServiceStatusRow;
export type DashboardMetricsTable = DashboardMetricsRow;
