/**
 * KYC/KYB Service (Ballerine Integration)
 *
 * Production-ready KYC/KYB system with comprehensive compliance features:
 * - Multi-tier KYC levels (Basic, Enhanced, Premium)
 * - Document verification and identity validation
 * - Risk assessment and scoring
 * - Sanctions screening and PEP checks
 * - Ongoing monitoring and re-verification
 * - Compliance reporting and audit trails
 * - Integration with Keycloak and broker management
 *
 * Built on Ballerine's advanced identity verification platform
 */
export interface KYCUser {
    id: string;
    tenantId: string;
    keycloakUserId: string;
    brokerId: string;
    email: string;
    phoneNumber?: string;
    walletAddress?: string;
    kycLevel: KYCLevel;
    status: KYCStatus;
    riskScore: number;
    riskLevel: RiskLevel;
    documents: KYCDocument[];
    verificationResults: VerificationResult[];
    sanctionsChecks: SanctionsCheck[];
    pepChecks: PEPCheck[];
    ongoingMonitoring: OngoingMonitoring;
    complianceFlags: ComplianceFlag[];
    createdAt: Date;
    updatedAt: Date;
    lastVerifiedAt?: Date;
    expiresAt?: Date;
    ballerineWorkflowId?: string;
}
export interface KYCDocument {
    id: string;
    userId: string;
    type: DocumentType;
    subtype?: string;
    country: string;
    documentNumber: string;
    issuedDate: Date;
    expiryDate?: Date;
    status: DocumentStatus;
    verificationResult: DocumentVerificationResult;
    ballerineWorkflowId?: string;
    ballerineCaseId?: string;
    uploadedAt: Date;
    verifiedAt?: Date;
    metadata: DocumentMetadata;
    filePath?: string;
}
export interface VerificationResult {
    id: string;
    userId: string;
    workflowId: string;
    caseId: string;
    status: VerificationStatus;
    score: number;
    confidence: number;
    checks: VerificationCheck[];
    riskFactors: RiskFactor[];
    recommendations: string[];
    completedAt: Date;
    expiresAt?: Date;
}
export interface SanctionsCheck {
    id: string;
    userId: string;
    checkType: SanctionsCheckType;
    status: SanctionsStatus;
    matches: SanctionsMatch[];
    checkedAt: Date;
    expiresAt: Date;
}
export interface PEPCheck {
    id: string;
    userId: string;
    checkType: PEPCheckType;
    status: PEPStatus;
    matches: PEPMatch[];
    checkedAt: Date;
    expiresAt: Date;
}
export interface OngoingMonitoring {
    id: string;
    userId: string;
    enabled: boolean;
    frequency: MonitoringFrequency;
    lastCheck: Date;
    nextCheck: Date;
    alerts: MonitoringAlert[];
    riskChanges: RiskChange[];
}
export interface ComplianceFlag {
    id: string;
    userId: string;
    type: ComplianceFlagType;
    severity: FlagSeverity;
    description: string;
    resolution: string;
    status: FlagStatus;
    raisedAt: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
}
export interface DocumentVerificationResult {
    isValid: boolean;
    confidence: number;
    checks: {
        documentAuthenticity: boolean;
        faceMatch: boolean;
        livenessDetection: boolean;
        dataExtraction: boolean;
        ocrValidation: boolean;
    };
    extractedData: ExtractedData;
    errors: string[];
    warnings: string[];
}
export interface ExtractedData {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    nationality: string;
    gender: string;
    address: Address;
    documentNumber: string;
    issuedBy: string;
    issuedDate: Date;
    expiryDate?: Date;
}
export interface Address {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}
export interface VerificationCheck {
    type: CheckType;
    status: CheckStatus;
    score: number;
    details: string;
    timestamp: Date;
}
export interface RiskFactor {
    type: RiskFactorType;
    severity: RiskSeverity;
    description: string;
    impact: number;
    mitigation: string;
}
export interface SanctionsMatch {
    list: string;
    entity: string;
    matchType: string;
    confidence: number;
    details: string;
}
export interface PEPMatch {
    name: string;
    position: string;
    country: string;
    confidence: number;
    details: string;
}
export interface MonitoringAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
}
export interface RiskChange {
    id: string;
    previousScore: number;
    newScore: number;
    changeReason: string;
    changedAt: Date;
}
export declare enum KYCLevel {
    L0 = "L0",// Web3 Basic - Wallet connection only
    L1 = "L1",// Basic Verification - Email + Phone
    L2 = "L2",// Identity Verified - ID + Address + Biometric
    L3 = "L3",// Enhanced Verification - Full due diligence + Source of funds
    INSTITUTIONAL = "INSTITUTIONAL"
}
export declare enum KYCStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    EXPIRED = "EXPIRED",
    SUSPENDED = "SUSPENDED",
    REQUIRES_REVIEW = "REQUIRES_REVIEW"
}
export declare enum RiskLevel {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum DocumentType {
    PASSPORT = "PASSPORT",
    NATIONAL_ID = "NATIONAL_ID",
    DRIVERS_LICENSE = "DRIVERS_LICENSE",
    UTILITY_BILL = "UTILITY_BILL",
    BANK_STATEMENT = "BANK_STATEMENT",
    PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS",
    PROOF_OF_INCOME = "PROOF_OF_INCOME",
    SOURCE_OF_FUNDS = "SOURCE_OF_FUNDS",
    COMPANY_REGISTRATION = "COMPANY_REGISTRATION",
    BUSINESS_LICENSE = "BUSINESS_LICENSE",// Business license for institutional/KYB verification
    ARTICLES_OF_INCORPORATION = "ARTICLES_OF_INCORPORATION",
    CERTIFICATE_OF_INCORPORATION = "CERTIFICATE_OF_INCORPORATION",// Certificate of incorporation for institutional/KYB
    BENEFICIAL_OWNERSHIP = "BENEFICIAL_OWNERSHIP",
    BIOMETRIC_DATA = "BIOMETRIC_DATA"
}
export declare enum DocumentStatus {
    PENDING = "PENDING",
    UPLOADED = "UPLOADED",
    PROCESSING = "PROCESSING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
    EXPIRED = "EXPIRED"
}
export declare enum VerificationStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    EXPIRED = "EXPIRED"
}
export declare enum SanctionsCheckType {
    OFAC = "OFAC",
    EU_SANCTIONS = "EU_SANCTIONS",
    UN_SANCTIONS = "UN_SANCTIONS",
    UK_SANCTIONS = "UK_SANCTIONS",
    AUSTRALIA_SANCTIONS = "AUSTRALIA_SANCTIONS",
    COMPREHENSIVE = "COMPREHENSIVE"
}
export declare enum SanctionsStatus {
    CLEAR = "CLEAR",
    MATCH_FOUND = "MATCH_FOUND",
    ERROR = "ERROR",
    EXPIRED = "EXPIRED"
}
export declare enum PEPCheckType {
    POLITICAL_FIGURES = "POLITICAL_FIGURES",
    SENIOR_MANAGEMENT = "SENIOR_MANAGEMENT",
    FAMILY_MEMBERS = "FAMILY_MEMBERS",
    COMPREHENSIVE = "COMPREHENSIVE"
}
export declare enum PEPStatus {
    CLEAR = "CLEAR",
    PEP_FOUND = "PEP_FOUND",
    ERROR = "ERROR",
    EXPIRED = "EXPIRED"
}
export declare enum MonitoringFrequency {
    DAILY = "DAILY",
    WEEKLY = "WEEKLY",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    ANNUALLY = "ANNUALLY"
}
export declare enum ComplianceFlagType {
    SANCTIONS_MATCH = "SANCTIONS_MATCH",
    PEP_MATCH = "PEP_MATCH",
    HIGH_RISK_COUNTRY = "HIGH_RISK_COUNTRY",
    DOCUMENT_EXPIRED = "DOCUMENT_EXPIRED",
    VERIFICATION_FAILED = "VERIFICATION_FAILED",
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
    AML_CONCERN = "AML_CONCERN"
}
export declare enum FlagSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum FlagStatus {
    ACTIVE = "ACTIVE",
    ACKNOWLEDGED = "ACKNOWLEDGED",
    RESOLVED = "RESOLVED",
    DISMISSED = "DISMISSED"
}
export declare enum CheckType {
    DOCUMENT_AUTHENTICITY = "DOCUMENT_AUTHENTICITY",
    FACE_MATCH = "FACE_MATCH",
    LIVENESS_DETECTION = "LIVENESS_DETECTION",
    DATA_EXTRACTION = "DATA_EXTRACTION",
    OCR_VALIDATION = "OCR_VALIDATION",
    SANCTIONS_SCREENING = "SANCTIONS_SCREENING",
    PEP_SCREENING = "PEP_SCREENING",
    ADDRESS_VERIFICATION = "ADDRESS_VERIFICATION",
    PHONE_VERIFICATION = "PHONE_VERIFICATION",
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
}
export declare enum CheckStatus {
    PASSED = "PASSED",
    FAILED = "FAILED",
    WARNING = "WARNING",
    ERROR = "ERROR"
}
export declare enum RiskFactorType {
    HIGH_RISK_COUNTRY = "HIGH_RISK_COUNTRY",
    SANCTIONS_MATCH = "SANCTIONS_MATCH",
    PEP_STATUS = "PEP_STATUS",
    DOCUMENT_QUALITY = "DOCUMENT_QUALITY",
    VERIFICATION_FAILURE = "VERIFICATION_FAILURE",
    SUSPICIOUS_PATTERN = "SUSPICIOUS_PATTERN"
}
export declare enum RiskSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum AlertType {
    RISK_SCORE_CHANGE = "RISK_SCORE_CHANGE",
    SANCTIONS_MATCH = "SANCTIONS_MATCH",
    PEP_MATCH = "PEP_MATCH",
    DOCUMENT_EXPIRY = "DOCUMENT_EXPIRY",
    VERIFICATION_FAILURE = "VERIFICATION_FAILURE",
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
}
export declare enum AlertSeverity {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL"
}
export declare class KYCService {
    private static isInitialized;
    private static users;
    private static documents;
    private static verificationResults;
    private static sanctionsChecks;
    private static pepChecks;
    private static ongoingMonitoring;
    private static complianceFlags;
    private static readonly BALLERINE_WORKFLOWS;
    private static workflowDefinitionsCache;
    private static workflowDefinitionsCacheTime;
    private static readonly WORKFLOW_CACHE_TTL;
    private static readonly KYC_REQUIREMENTS;
    /**
     * Initialize KYC Service
     */
    static initialize(): Promise<void>;
    /**
     * Start KYC verification process
     */
    static startKYCVerification(tenantId: string, keycloakUserId: string, brokerId: string, email: string, phoneNumber?: string, walletAddress?: string, requestedLevel?: KYCLevel): Promise<KYCUser>;
    /**
     * Upload document for verification
     */
    static uploadDocument(userId: string, documentType: DocumentType, documentData: Buffer, metadata: DocumentMetadata, country?: string): Promise<KYCDocument>;
    /**
     * Process Ballerine webhook
     */
    static processBallerineWebhook(payload: any, signature: string): Promise<void>;
    /**
     * Get KYC status for user
     */
    static getKYCStatus(userId: string): Promise<KYCUser>;
    /**
     * Get user by ID (alias for getKYCStatus for backward compatibility)
     */
    static getUserById(userId: string, tenantId?: string): Promise<KYCUser | null>;
    /**
     * Update KYC level
     */
    static updateKYCLevel(userId: string, newLevel: KYCLevel, reason: string): Promise<KYCUser>;
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static loadExistingData;
    /**
     * Load workflow definitions from Ballerine (with caching)
     */
    private static loadWorkflowDefinitions;
    /**
     * Get workflow definition ID for a KYC level (try dynamic first, fallback to hardcoded)
     */
    private static getWorkflowDefinitionId;
    private static startMonitoringWorkers;
    private static startBallerineWorkflow;
    private static verifyWebhookSignature;
    private static handleWorkflowCompleted;
    private static handleWorkflowFailed;
    private static handleDocumentVerified;
    private static handleSanctionsCheckCompleted;
    private static handlePEPCheckCompleted;
    private static initializeOngoingMonitoring;
    private static updateUserRiskScore;
    private static calculateRiskLevel;
}
export interface DocumentMetadata {
    documentNumber?: string;
    issuedDate?: Date;
    expiryDate?: Date;
    issuedBy?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    nationality?: string;
    gender?: string;
    address?: Address;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
}
//# sourceMappingURL=kyc.d.ts.map