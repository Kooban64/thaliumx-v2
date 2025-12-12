/**
 * Event Types for Compliance Coordinator
 */

import type { ComplianceServiceType } from './coordinator';

// ==================== BASE EVENT ====================

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  version: string;
  correlationId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
}

// ==================== RISK ASSESSMENT EVENTS ====================

export interface RiskAssessmentAggregatedEvent extends BaseEvent {
  eventType: 'risk_assessment.aggregated';
  payload: {
    aggregatedId: string;
    sourceService: ComplianceServiceType;
    sourceAssessmentId: string;
    entityType: string;
    entityId: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    reviewRequired: boolean;
  };
}

export interface HighRiskAlertCreatedEvent extends BaseEvent {
  eventType: 'high_risk_alert.created';
  payload: {
    alertId: string;
    sourceService: ComplianceServiceType;
    entityType: string;
    entityId: string;
    riskScore: number;
    riskLevel: 'high' | 'critical';
    flags: string[];
    severity: 'high' | 'critical';
    userId?: string | undefined;
  };
}

// ==================== TRAVEL RULE EVENTS ====================

export interface TravelRuleAggregatedEvent extends BaseEvent {
  eventType: 'travel_rule.aggregated';
  payload: {
    aggregatedId: string;
    sourceService: ComplianceServiceType;
    sourceTravelRuleId: string;
    entityType: string;
    entityId: string;
    amountUSD: string;
    status: string;
    messageId: string;
  };
}

export interface TravelRuleStatusChangedEvent extends BaseEvent {
  eventType: 'travel_rule.status_changed';
  payload: {
    aggregatedId: string;
    sourceService: ComplianceServiceType;
    sourceTravelRuleId: string;
    previousStatus: string;
    newStatus: string;
    messageId: string;
  };
}

// ==================== CARF EVENTS ====================

export interface CARFReportAggregatedEvent extends BaseEvent {
  eventType: 'carf_report.aggregated';
  payload: {
    aggregatedId: string;
    reportId: string;
    services: ComplianceServiceType[];
    totalVolumeUSD: string;
    totalNetGainLossUSD: string;
    totalTransactionCount: number;
    status: string;
    userId?: string | undefined;
  };
}

export interface CARFReportSubmittedEvent extends BaseEvent {
  eventType: 'carf_report.submitted';
  payload: {
    aggregatedId: string;
    reportId: string;
    submissionDate: Date;
    jurisdiction: string;
    authority: string;
  };
}

// ==================== PLATFORM REPORT EVENTS ====================

export interface PlatformReportGeneratedEvent extends BaseEvent {
  eventType: 'platform_report.generated';
  payload: {
    reportId: string;
    reportType: string;
    periodStart: Date;
    periodEnd: Date;
    totalTransactions: number;
    totalVolumeUSD: string;
    format: string;
    fileUrl?: string | undefined;
  };
}

// ==================== USER REPORT EVENTS ====================

export interface UserReportGeneratedEvent extends BaseEvent {
  eventType: 'user_report.generated';
  payload: {
    reportId: string;
    userId: string;
    periodStart: Date;
    periodEnd: Date;
    totalTransactions: number;
    totalVolumeUSD: string;
    riskLevel: string;
    format: string;
    fileUrl?: string | undefined;
  };
}

// ==================== REGULATORY SUBMISSION EVENTS ====================

export interface RegulatorySubmissionCreatedEvent extends BaseEvent {
  eventType: 'regulatory_submission.created';
  payload: {
    submissionId: string;
    submissionType: string;
    jurisdiction: string;
    authority: string;
    status: string;
  };
}

export interface RegulatorySubmissionStatusChangedEvent extends BaseEvent {
  eventType: 'regulatory_submission.status_changed';
  payload: {
    submissionId: string;
    previousStatus: string;
    newStatus: string;
    responseCode?: string | undefined;
    responseMessage?: string | undefined;
  };
}

// ==================== ALERT EVENTS ====================

export interface AlertCreatedEvent extends BaseEvent {
  eventType: 'alert.created';
  payload: {
    alertId: string;
    alertType: string;
    severity: string;
    sourceService: ComplianceServiceType;
    sourceEntityType: string;
    sourceEntityId: string;
    title: string;
    userId?: string | undefined;
  };
}

export interface AlertStatusChangedEvent extends BaseEvent {
  eventType: 'alert.status_changed';
  payload: {
    alertId: string;
    previousStatus: string;
    newStatus: string;
    changedBy?: string | undefined;
    resolution?: string | undefined;
  };
}

// ==================== SERVICE STATUS EVENTS ====================

export interface ServiceStatusChangedEvent extends BaseEvent {
  eventType: 'service_status.changed';
  payload: {
    service: ComplianceServiceType;
    previousStatus: string;
    newStatus: string;
    latency: number;
    version: string;
  };
}

// ==================== ADMIN EVENTS ====================

export interface AdminActionEvent extends BaseEvent {
  eventType: 'admin.action';
  payload: {
    adminId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown>;
    ipAddress?: string | undefined;
  };
}

// ==================== INCOMING EVENTS FROM SERVICES ====================

export interface IncomingRiskAssessmentEvent extends BaseEvent {
  eventType: 'compliance.risk_assessment.created' | 'compliance.risk_assessment.updated';
  payload: {
    assessmentId: string;
    entityType: string;
    entityId: string;
    transactionHash?: string | undefined;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    recommendations: string[];
    reviewRequired: boolean;
    userId?: string | undefined;
  };
}

export interface IncomingTravelRuleEvent extends BaseEvent {
  eventType: 'compliance.travel_rule.created' | 'compliance.travel_rule.status_changed';
  payload: {
    travelRuleId: string;
    entityType: string;
    entityId: string;
    transactionHash?: string | undefined;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    asset: string;
    status: string;
    messageId: string;
    userId?: string | undefined;
  };
}

export interface IncomingCARFEvent extends BaseEvent {
  eventType: 'compliance.carf.generated' | 'compliance.carf.submitted';
  payload: {
    carfId: string;
    reportId: string;
    periodStart: Date;
    periodEnd: Date;
    totalVolumeUSD: string;
    netGainLossUSD: string;
    transactionCount: number;
    status: string;
    userId?: string | undefined;
  };
}

export interface IncomingHighRiskAlertEvent extends BaseEvent {
  eventType: 'compliance.high_risk_alert';
  payload: {
    alertId: string;
    entityType: string;
    entityId: string;
    transactionHash?: string | undefined;
    riskScore: number;
    riskLevel: 'high' | 'critical';
    flags: string[];
    severity: 'high' | 'critical' | 'immediate';
    recommendations: string[];
    userId?: string | undefined;
  };
}

// ==================== EVENT UNION TYPE ====================

export type CoordinatorEvent =
  | RiskAssessmentAggregatedEvent
  | HighRiskAlertCreatedEvent
  | TravelRuleAggregatedEvent
  | TravelRuleStatusChangedEvent
  | CARFReportAggregatedEvent
  | CARFReportSubmittedEvent
  | PlatformReportGeneratedEvent
  | UserReportGeneratedEvent
  | RegulatorySubmissionCreatedEvent
  | RegulatorySubmissionStatusChangedEvent
  | AlertCreatedEvent
  | AlertStatusChangedEvent
  | ServiceStatusChangedEvent
  | AdminActionEvent;

export type IncomingEvent =
  | IncomingRiskAssessmentEvent
  | IncomingTravelRuleEvent
  | IncomingCARFEvent
  | IncomingHighRiskAlertEvent;
