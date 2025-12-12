/**
 * Compliance Coordinator Types
 * Types for cross-platform compliance aggregation and reporting
 */

// ==================== SERVICE TYPES ====================

/**
 * Compliance service types
 */
export type ComplianceServiceType = 'cex' | 'dex' | 'nft' | 'token';

/**
 * Service status
 */
export interface ServiceStatus {
  service: ComplianceServiceType;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  latency: number;
  version: string;
  metrics: {
    pendingAssessments: number;
    highRiskAlerts: number;
    pendingTravelRule: number;
    pendingCARF: number;
  };
}

// ==================== AGGREGATED DATA TYPES ====================

/**
 * Aggregated risk assessment
 */
export interface AggregatedRiskAssessment {
  id: string;
  sourceService: ComplianceServiceType;
  sourceAssessmentId: string;
  entityType: 'trade' | 'swap' | 'nft_sale' | 'token_transfer';
  entityId: string;
  transactionHash?: string | undefined;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  reviewRequired: boolean;
  reviewedBy?: string | undefined;
  reviewedAt?: Date | undefined;
  assessmentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregated Travel Rule data
 */
export interface AggregatedTravelRule {
  id: string;
  sourceService: ComplianceServiceType;
  sourceTravelRuleId: string;
  entityType: 'withdrawal' | 'swap' | 'nft_transfer' | 'token_transfer';
  entityId: string;
  transactionHash?: string | undefined;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  asset: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: Record<string, unknown> | undefined;
  beneficiaryInfo?: Record<string, unknown> | undefined;
  vaspInfo?: Record<string, unknown> | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregated CARF report
 */
export interface AggregatedCARFReport {
  id: string;
  reportId: string;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
    fiscalYear?: string | undefined;
  };
  services: ComplianceServiceType[];
  cexData?: {
    totalTradeVolumeUSD: string;
    totalWithdrawalsUSD: string;
    totalDepositsUSD: string;
    netGainLossUSD: string;
    tradeCount: number;
  } | undefined;
  dexData?: {
    totalSwapVolumeUSD: string;
    totalLiquidityProvidedUSD: string;
    totalLiquidityRemovedUSD: string;
    netGainLossUSD: string;
    swapCount: number;
  } | undefined;
  nftData?: {
    totalSalesUSD: string;
    totalPurchasesUSD: string;
    totalRoyaltiesUSD: string;
    netGainLossUSD: string;
    transactionCount: number;
  } | undefined;
  tokenData?: {
    totalTransferInUSD: string;
    totalTransferOutUSD: string;
    totalSwapVolumeUSD: string;
    netGainLossUSD: string;
    transactionCount: number;
  } | undefined;
  totalVolumeUSD: string;
  totalNetGainLossUSD: string;
  totalTransactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate?: Date | undefined;
  acknowledgmentDate?: Date | undefined;
  rejectionReason?: string | undefined;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== REPORT TYPES ====================

/**
 * Platform compliance report
 */
export interface PlatformComplianceReport {
  id: string;
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
  tenantId: string;
  brokerId?: string | undefined;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalTransactions: number;
    totalVolumeUSD: string;
    averageRiskScore: number;
    highRiskTransactions: number;
    criticalRiskTransactions: number;
    travelRuleMessages: number;
    travelRuleCompliance: number; // percentage
    sanctionsMatches: number;
    pendingReviews: number;
  };
  serviceBreakdown: {
    service: ComplianceServiceType;
    transactions: number;
    volumeUSD: string;
    averageRiskScore: number;
    highRiskCount: number;
    travelRuleCount: number;
  }[];
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  topRiskFlags: {
    flag: string;
    count: number;
    percentage: number;
  }[];
  generatedAt: Date;
  generatedBy: string;
  format: 'json' | 'pdf' | 'csv';
  fileUrl?: string | undefined;
}

/**
 * User compliance report
 */
export interface UserComplianceReport {
  id: string;
  reportId: string;
  userId: string;
  tenantId: string;
  brokerId?: string | undefined;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalTransactions: number;
    totalVolumeUSD: string;
    averageRiskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    travelRuleMessages: number;
    carfReports: number;
  };
  activityByService: {
    service: ComplianceServiceType;
    transactions: number;
    volumeUSD: string;
    lastActivity: Date;
  }[];
  riskHistory: {
    date: Date;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }[];
  flags: string[];
  recommendations: string[];
  generatedAt: Date;
  format: 'json' | 'pdf';
  fileUrl?: string | undefined;
}

// ==================== REGULATORY SUBMISSION TYPES ====================

/**
 * Regulatory submission
 */
export interface RegulatorySubmission {
  id: string;
  submissionId: string;
  submissionType: 'carf' | 'sar' | 'ctr' | 'str' | 'custom';
  jurisdiction: string;
  authority: string;
  tenantId: string;
  brokerId?: string | undefined;
  reportingPeriod?: {
    startDate: Date;
    endDate: Date;
  } | undefined;
  data: Record<string, unknown>;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected' | 'accepted';
  submissionDate?: Date | undefined;
  responseDate?: Date | undefined;
  responseCode?: string | undefined;
  responseMessage?: string | undefined;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date | undefined;
  submittedBy?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ALERT TYPES ====================

/**
 * Compliance alert
 */
export interface ComplianceAlert {
  id: string;
  alertType: 'high_risk' | 'sanctions_match' | 'travel_rule_failure' | 'threshold_breach' | 'pattern_detected' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceService: ComplianceServiceType;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: string | undefined;
  acknowledgedBy?: string | undefined;
  acknowledgedAt?: Date | undefined;
  resolvedBy?: string | undefined;
  resolvedAt?: Date | undefined;
  resolution?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ADMIN TYPES ====================

/**
 * Admin user
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'compliance_officer' | 'analyst' | 'viewer';
  permissions: string[];
  tenantId: string;
  brokerId?: string | undefined;
  lastLogin?: Date | undefined;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin action log
 */
export interface AdminActionLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  tenantId: string;
  createdAt: Date;
}

// ==================== CONFIGURATION TYPES ====================

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';

  server: {
    host: string;
    port: number;
    corsOrigins: string[];
  };

  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };

  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };

  services: {
    cex: {
      url: string;
      enabled: boolean;
    };
    dex: {
      url: string;
      enabled: boolean;
    };
    nft: {
      url: string;
      enabled: boolean;
    };
    token: {
      url: string;
      enabled: boolean;
    };
  };

  reporting: {
    defaultFormat: 'json' | 'pdf' | 'csv';
    retentionDays: number;
    autoGenerateDaily: boolean;
    autoGenerateWeekly: boolean;
    autoGenerateMonthly: boolean;
  };

  regulatory: {
    jurisdictions: string[];
    autoSubmit: boolean;
    submissionEndpoints: Record<string, string>;
  };

  alerts: {
    enabled: boolean;
    emailNotifications: boolean;
    slackNotifications: boolean;
    webhookUrl?: string | undefined;
  };
}

// ==================== DASHBOARD TYPES ====================

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  timestamp: Date;
  period: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  services: {
    service: ComplianceServiceType;
    status: 'healthy' | 'degraded' | 'unhealthy';
    transactions: number;
    volumeUSD: string;
    averageRiskScore: number;
    highRiskCount: number;
    pendingReviews: number;
  }[];
  totals: {
    transactions: number;
    volumeUSD: string;
    averageRiskScore: number;
    highRiskCount: number;
    criticalRiskCount: number;
    pendingReviews: number;
    travelRuleMessages: number;
    sanctionsMatches: number;
    activeAlerts: number;
  };
  trends: {
    transactionsTrend: number; // percentage change
    volumeTrend: number;
    riskTrend: number;
    alertsTrend: number;
  };
}
