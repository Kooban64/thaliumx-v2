/**
 * Security & Oversight Service
 *
 * Comprehensive security monitoring and compliance system:
 * - Security Monitoring & Threat Detection
 * - Compliance Monitoring & Reporting
 * - Audit Trail Management
 * - Risk Assessment & Management
 * - Security Incident Response
 * - Regulatory Compliance
 * - Security Analytics & Reporting
 *
 * Production-ready with full integration
 */
import { OPADecision } from './opa';
export declare enum SecurityEventType {
    LOGIN_ATTEMPT = "login_attempt",
    LOGIN_SUCCESS = "login_success",
    LOGIN_FAILURE = "login_failure",
    SUSPICIOUS_ACTIVITY = "suspicious_activity",
    UNAUTHORIZED_ACCESS = "unauthorized_access",
    DATA_BREACH = "data_breach",
    MALWARE_DETECTED = "malware_detected",
    PHISHING_ATTEMPT = "phishing_attempt",
    INSIDER_THREAT = "insider_threat",
    SYSTEM_COMPROMISE = "system_compromise",
    COMPLIANCE_VIOLATION = "compliance_violation",
    REGULATORY_BREACH = "regulatory_breach",
    FINANCIAL_ANOMALY = "financial_anomaly",
    TRADING_ANOMALY = "trading_anomaly",
    AML_FLAG = "aml_flag",
    SANCTIONS_MATCH = "sanctions_match",
    PEP_MATCH = "pep_match",
    HIGH_RISK_TRANSACTION = "high_risk_transaction",
    ACCOUNT_TAKEOVER = "account_takeover",
    IDENTITY_THEFT = "identity_theft"
}
export declare enum SecuritySeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum ComplianceFramework {
    PCI_DSS = "pci_dss",
    SOX = "sox",
    GDPR = "gdpr",
    CCPA = "ccpa",
    HIPAA = "hipaa",
    ISO27001 = "iso27001",
    NIST = "nist",
    COSO = "coso",
    BASEL_III = "basel_iii",
    MIFID_II = "mifid_ii",
    AML_KYC = "aml_kyc",
    FATCA = "fatca",
    CRS = "crs"
}
export declare enum IncidentStatus {
    OPEN = "open",
    INVESTIGATING = "investigating",
    CONTAINED = "contained",
    RESOLVED = "resolved",
    CLOSED = "closed"
}
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface SecurityEvent {
    id: string;
    type: SecurityEventType;
    severity: SecuritySeverity;
    title: string;
    description: string;
    source: string;
    userId?: string;
    brokerId?: string;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    timestamp: Date;
    metadata: SecurityEventMetadata;
    status: IncidentStatus;
    assignedTo?: string;
    resolution?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SecurityEventMetadata {
    requestId?: string;
    sessionId?: string;
    transactionId?: string;
    amount?: number;
    currency?: string;
    accountId?: string;
    walletAddress?: string;
    deviceFingerprint?: string;
    riskScore?: number;
    complianceFlags?: string[];
    additionalData?: any;
    ruleId?: string;
    framework?: string;
    category?: string;
    confidence?: number;
    decision?: any;
    detectionMethod?: string;
    keyId?: string;
    operationType?: string;
    actor?: string;
    action?: string;
    details?: any;
    alertId?: string;
    alertType?: string;
    entityId?: string;
    entityType?: string;
}
export interface ComplianceRule {
    id: string;
    framework: ComplianceFramework;
    name: string;
    description: string;
    category: string;
    severity: SecuritySeverity;
    enabled: boolean;
    conditions: ComplianceCondition[];
    actions: ComplianceAction[];
    createdAt: Date;
    updatedAt: Date;
}
export interface ComplianceCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: any;
    description: string;
}
export interface ComplianceAction {
    type: 'alert' | 'block' | 'flag' | 'log' | 'notify' | 'escalate';
    target: string;
    parameters: any;
    description: string;
}
export interface SecurityIncident {
    id: string;
    eventId: string;
    title: string;
    description: string;
    severity: SecuritySeverity;
    status: IncidentStatus;
    assignedTo?: string;
    priority: number;
    category: string;
    affectedUsers: string[];
    affectedSystems: string[];
    timeline: IncidentTimeline[];
    evidence: IncidentEvidence[];
    resolution?: string;
    lessonsLearned?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IncidentTimeline {
    timestamp: Date;
    action: string;
    actor: string;
    description: string;
    metadata?: any;
}
export interface IncidentEvidence {
    id: string;
    type: 'log' | 'screenshot' | 'file' | 'network' | 'database' | 'other';
    name: string;
    description: string;
    path: string;
    hash: string;
    size: number;
    createdAt: Date;
}
export interface RiskAssessment {
    id: string;
    entityId: string;
    entityType: 'user' | 'broker' | 'transaction' | 'system';
    riskLevel: RiskLevel;
    riskScore: number;
    factors: RiskFactor[];
    mitigation: RiskMitigation[];
    lastAssessed: Date;
    nextAssessment: Date;
    status: 'active' | 'mitigated' | 'accepted' | 'transferred';
    createdAt: Date;
    updatedAt: Date;
}
export interface RiskFactor {
    category: string;
    factor: string;
    weight: number;
    score: number;
    description: string;
    evidence?: string;
}
export interface RiskMitigation {
    type: 'control' | 'monitoring' | 'training' | 'process' | 'technology';
    name: string;
    description: string;
    effectiveness: number;
    cost: number;
    implementation: string;
    status: 'planned' | 'implemented' | 'testing' | 'operational';
}
export interface SecurityReport {
    id: string;
    type: 'security' | 'compliance' | 'risk' | 'incident' | 'audit';
    title: string;
    description: string;
    period: {
        start: Date;
        end: Date;
    };
    data: SecurityReportData;
    generatedBy: string;
    generatedAt: Date;
    status: 'draft' | 'review' | 'approved' | 'published';
    recipients: string[];
}
export interface SecurityReportData {
    summary: {
        totalEvents: number;
        criticalEvents: number;
        resolvedIncidents: number;
        openIncidents: number;
        complianceScore: number;
        riskScore: number;
    };
    events: SecurityEvent[];
    incidents: SecurityIncident[];
    risks: RiskAssessment[];
    compliance: ComplianceMetrics;
    trends: SecurityTrend[];
    recommendations: SecurityRecommendation[];
}
export interface ComplianceMetrics {
    framework: ComplianceFramework;
    score: number;
    violations: number;
    controls: number;
    implemented: number;
    gaps: ComplianceGap[];
}
export interface ComplianceGap {
    control: string;
    description: string;
    severity: SecuritySeverity;
    remediation: string;
    timeline: string;
    owner: string;
}
export interface SecurityTrend {
    metric: string;
    period: string;
    value: number;
    change: number;
    direction: 'up' | 'down' | 'stable';
}
export interface SecurityRecommendation {
    id: string;
    category: 'security' | 'compliance' | 'risk' | 'process';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    rationale: string;
    implementation: string;
    cost: number;
    benefit: number;
    timeline: string;
    owner: string;
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
}
export declare class SecurityOversightService {
    private static isInitialized;
    private static events;
    private static incidents;
    private static risks;
    private static reports;
    private static rules;
    private static readonly SECURITY_CONFIG;
    /**
     * Initialize Security & Oversight Service
     */
    static initialize(): Promise<void>;
    /**
     * Load existing data from storage
     */
    private static loadExistingData;
    /**
     * OPA has replaced hardcoded rules - policies are now in Rego files
     * This method kept for backward compatibility but no longer initializes rules
     */
    private static initializeDefaultRules;
    /**
     * Start monitoring services
     */
    private static startMonitoringServices;
    /**
     * Monitor compliance using OPA
     */
    private static monitorCompliance;
    /**
     * Evaluate transaction compliance using OPA
     */
    static evaluateTransactionCompliance(transaction: {
        id: string;
        amount: number;
        currency: string;
        senderId: string;
        recipientId: string;
        recipientCountry?: string;
        recipientName?: string;
        velocity?: number;
        averageVelocity?: number;
        [key: string]: any;
    }): Promise<OPADecision[]>;
    /**
     * Evaluate login attempt using OPA
     */
    static evaluateLoginAttempt(loginData: {
        userId: string;
        ipAddress: string;
        loginAttempts: number;
        lastKnownIp?: string;
        geolocationRisk?: number;
        [key: string]: any;
    }): Promise<OPADecision[]>;
    /**
     * Execute actions from OPA decisions
     */
    private static executeOPAActions;
    /**
     * Map OPA severity to SecuritySeverity enum
     */
    private static mapOPASeverityToSecuritySeverity;
    /**
     * Detect threats
     */
    private static detectThreats;
    /**
     * Assess risks
     */
    private static assessRisks;
    /**
     * Create security event
     */
    static createSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityEvent>;
    /**
     * Get security events
     */
    static getSecurityEvents(filters?: {
        type?: SecurityEventType;
        severity?: SecuritySeverity;
        status?: IncidentStatus;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): Promise<SecurityEvent[]>;
    /**
     * Create security incident
     */
    static createSecurityIncident(incidentData: Omit<SecurityIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityIncident>;
    /**
     * Get security incidents
     */
    static getSecurityIncidents(filters?: {
        status?: IncidentStatus;
        severity?: SecuritySeverity;
        assignedTo?: string;
        limit?: number;
    }): Promise<SecurityIncident[]>;
    /**
     * Create risk assessment
     */
    static createRiskAssessment(riskData: Omit<RiskAssessment, 'id' | 'createdAt' | 'updatedAt'>): Promise<RiskAssessment>;
    /**
     * Get risk assessments
     */
    static getRiskAssessments(filters?: {
        entityType?: string;
        riskLevel?: RiskLevel;
        status?: string;
        limit?: number;
    }): Promise<RiskAssessment[]>;
    /**
     * Generate security report
     */
    static generateSecurityReport(reportData: Omit<SecurityReport, 'id' | 'generatedAt'>): Promise<SecurityReport>;
    /**
     * Get security reports
     */
    static getSecurityReports(filters?: {
        type?: string;
        status?: string;
        limit?: number;
    }): Promise<SecurityReport[]>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=security-oversight.d.ts.map