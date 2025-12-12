/**
 * Services Index
 */

// Database
export { DatabaseService, getDatabaseService } from './database';

// Aggregation
export { AggregationService, getAggregationService } from './aggregation';
export type { RiskAssessmentInput, TravelRuleInput, CARFInput } from './aggregation';

// Reporting
export { ReportingService, getReportingService } from './reporting';
export type { ReportOptions, UserReportOptions } from './reporting';

// Events
export { EventConsumer, getEventConsumer } from './events';
export type {
  ComplianceEvent,
  ComplianceEventType,
  RiskAssessmentEventPayload,
  TravelRuleEventPayload,
  CARFEventPayload,
  AlertEventPayload,
  ServiceHealthEventPayload,
} from './events';

// Alerts
export { AlertsService, getAlertsService } from './alerts';
export type {
  CreateAlertInput,
  AlertQueryOptions,
  UpdateAlertInput,
} from './alerts';

// Regulatory
export { RegulatoryService, getRegulatoryService } from './regulatory';
export type {
  CreateSubmissionInput,
  SubmissionQueryOptions,
  SubmissionResponse,
} from './regulatory';

// Admin
export { AdminService, getAdminService } from './admin';
export type {
  CreateAdminInput,
  UpdateAdminInput,
  AdminQueryOptions,
  ActionLogQueryOptions,
} from './admin';
