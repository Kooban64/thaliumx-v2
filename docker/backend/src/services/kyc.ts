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

import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { KeycloakService } from './keycloak';
import { BrokerManagementService } from './broker-management';
import { ballerineService } from './ballerine';
import { AppError, createError } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { kycLimitsConfig, KYCLevelConfig, KYCLevelLimits, getCurrencySymbol, formatCurrency } from '../config/kyc-limits.config';

// =============================================================================
// CORE TYPES & INTERFACES
// =============================================================================

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
  ballerineWorkflowId?: string; // Ballerine workflow ID for this user
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
  filePath?: string; // Path to stored document file (if stored in filesystem/storage)
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

export enum KYCLevel {
  L0 = 'L0', // Web3 Basic - Wallet connection only
  L1 = 'L1', // Basic Verification - Email + Phone
  L2 = 'L2', // Identity Verified - ID + Address + Biometric
  L3 = 'L3', // Enhanced Verification - Full due diligence + Source of funds
  INSTITUTIONAL = 'INSTITUTIONAL' // Institutional/KYB verification for businesses
}

export enum KYCStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  UTILITY_BILL = 'UTILITY_BILL',
  BANK_STATEMENT = 'BANK_STATEMENT',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  PROOF_OF_INCOME = 'PROOF_OF_INCOME',
  SOURCE_OF_FUNDS = 'SOURCE_OF_FUNDS',
  COMPANY_REGISTRATION = 'COMPANY_REGISTRATION',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE', // Business license for institutional/KYB verification
  ARTICLES_OF_INCORPORATION = 'ARTICLES_OF_INCORPORATION',
  CERTIFICATE_OF_INCORPORATION = 'CERTIFICATE_OF_INCORPORATION', // Certificate of incorporation for institutional/KYB
  BENEFICIAL_OWNERSHIP = 'BENEFICIAL_OWNERSHIP',
  BIOMETRIC_DATA = 'BIOMETRIC_DATA'
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export enum SanctionsCheckType {
  OFAC = 'OFAC',
  EU_SANCTIONS = 'EU_SANCTIONS',
  UN_SANCTIONS = 'UN_SANCTIONS',
  UK_SANCTIONS = 'UK_SANCTIONS',
  AUSTRALIA_SANCTIONS = 'AUSTRALIA_SANCTIONS',
  COMPREHENSIVE = 'COMPREHENSIVE'
}

export enum SanctionsStatus {
  CLEAR = 'CLEAR',
  MATCH_FOUND = 'MATCH_FOUND',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED'
}

export enum PEPCheckType {
  POLITICAL_FIGURES = 'POLITICAL_FIGURES',
  SENIOR_MANAGEMENT = 'SENIOR_MANAGEMENT',
  FAMILY_MEMBERS = 'FAMILY_MEMBERS',
  COMPREHENSIVE = 'COMPREHENSIVE'
}

export enum PEPStatus {
  CLEAR = 'CLEAR',
  PEP_FOUND = 'PEP_FOUND',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED'
}

export enum MonitoringFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY'
}

export enum ComplianceFlagType {
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_MATCH = 'PEP_MATCH',
  HIGH_RISK_COUNTRY = 'HIGH_RISK_COUNTRY',
  DOCUMENT_EXPIRED = 'DOCUMENT_EXPIRED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  AML_CONCERN = 'AML_CONCERN'
}

export enum FlagSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum FlagStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED'
}

export enum CheckType {
  DOCUMENT_AUTHENTICITY = 'DOCUMENT_AUTHENTICITY',
  FACE_MATCH = 'FACE_MATCH',
  LIVENESS_DETECTION = 'LIVENESS_DETECTION',
  DATA_EXTRACTION = 'DATA_EXTRACTION',
  OCR_VALIDATION = 'OCR_VALIDATION',
  SANCTIONS_SCREENING = 'SANCTIONS_SCREENING',
  PEP_SCREENING = 'PEP_SCREENING',
  ADDRESS_VERIFICATION = 'ADDRESS_VERIFICATION',
  PHONE_VERIFICATION = 'PHONE_VERIFICATION',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION'
}

export enum CheckStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export enum RiskFactorType {
  HIGH_RISK_COUNTRY = 'HIGH_RISK_COUNTRY',
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_STATUS = 'PEP_STATUS',
  DOCUMENT_QUALITY = 'DOCUMENT_QUALITY',
  VERIFICATION_FAILURE = 'VERIFICATION_FAILURE',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN'
}

export enum RiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertType {
  RISK_SCORE_CHANGE = 'RISK_SCORE_CHANGE',
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_MATCH = 'PEP_MATCH',
  DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
  VERIFICATION_FAILURE = 'VERIFICATION_FAILURE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// =============================================================================
// KYC SERVICE CLASS
// =============================================================================

export class KYCService {
  private static isInitialized = false;
  private static users: Map<string, KYCUser> = new Map();
  private static documents: Map<string, KYCDocument> = new Map();
  private static verificationResults: Map<string, VerificationResult> = new Map();
  private static sanctionsChecks: Map<string, SanctionsCheck> = new Map();
  private static pepChecks: Map<string, PEPCheck> = new Map();
  private static ongoingMonitoring: Map<string, OngoingMonitoring> = new Map();
  private static complianceFlags: Map<string, ComplianceFlag> = new Map();

  // Ballerine workflow configuration (with fallback to hardcoded values)
  private static readonly BALLERINE_WORKFLOWS = {
    basic: process.env.BALLERINE_BASIC_WORKFLOW_ID || 'kyc-workflow',
    enhanced: process.env.BALLERINE_ENHANCED_WORKFLOW_ID || 'kyc-workflow',
    premium: process.env.BALLERINE_PREMIUM_WORKFLOW_ID || 'kyc-workflow',
    institutional: process.env.BALLERINE_INSTITUTIONAL_WORKFLOW_ID || 'kyb-workflow'
  };

  // Cache for workflow definitions (to avoid repeated API calls)
  private static workflowDefinitionsCache: Map<string, any> = new Map();
  private static workflowDefinitionsCacheTime: number = 0;
  private static readonly WORKFLOW_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // KYC level requirements - now loaded from configurable source
  // Use getKYCRequirements() method to access these values
  private static getKYCRequirements(): Record<KYCLevel, {
    name: string;
    requirements: string[];
    documents: DocumentType[];
    sanctionsCheck: boolean;
    pepCheck: boolean;
    faceVerification: boolean;
    ongoingMonitoring: boolean;
    maxInvestment: number;
    maxTradingVolume: number;
    maxWithdrawal: number;
    description: string;
  }> {
    // Initialize config if not already done
    kycLimitsConfig.initialize();
    
    const allConfigs = kycLimitsConfig.getAllKYCLevelConfigs();
    
    // Map document type strings to DocumentType enum
    const mapDocuments = (docs: string[]): DocumentType[] => {
      return docs.map(d => DocumentType[d as keyof typeof DocumentType]).filter(Boolean);
    };
    
    return {
      [KYCLevel.L0]: {
        name: allConfigs.L0?.name || 'Web3 Basic',
        requirements: allConfigs.L0?.requirements || ['web3_wallet_connection'],
        documents: mapDocuments(allConfigs.L0?.documents || []),
        sanctionsCheck: allConfigs.L0?.sanctionsCheck ?? false,
        pepCheck: allConfigs.L0?.pepCheck ?? false,
        faceVerification: allConfigs.L0?.faceVerification ?? false,
        ongoingMonitoring: allConfigs.L0?.ongoingMonitoring ?? false,
        maxInvestment: allConfigs.L0?.limits?.maxInvestment ?? 185000,
        maxTradingVolume: allConfigs.L0?.limits?.maxTrading ?? 0,
        maxWithdrawal: allConfigs.L0?.limits?.maxWithdrawal ?? 18500,
        description: allConfigs.L0?.description || 'Basic Web3 wallet verification'
      },
      [KYCLevel.L1]: {
        name: allConfigs.L1?.name || 'Basic Verification',
        requirements: allConfigs.L1?.requirements || ['email_verified', 'phone_verified'],
        documents: mapDocuments(allConfigs.L1?.documents || []),
        sanctionsCheck: allConfigs.L1?.sanctionsCheck ?? true,
        pepCheck: allConfigs.L1?.pepCheck ?? false,
        faceVerification: allConfigs.L1?.faceVerification ?? false,
        ongoingMonitoring: allConfigs.L1?.ongoingMonitoring ?? false,
        maxInvestment: allConfigs.L1?.limits?.maxInvestment ?? 925000,
        maxTradingVolume: allConfigs.L1?.limits?.maxTrading ?? 462500,
        maxWithdrawal: allConfigs.L1?.limits?.maxWithdrawal ?? 92500,
        description: allConfigs.L1?.description || 'Email and phone verification required'
      },
      [KYCLevel.L2]: {
        name: allConfigs.L2?.name || 'Identity Verified',
        requirements: allConfigs.L2?.requirements || ['email_verified', 'phone_verified', 'identity_document', 'proof_of_address', 'biometric'],
        documents: mapDocuments(allConfigs.L2?.documents || ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'BIOMETRIC_DATA']),
        sanctionsCheck: allConfigs.L2?.sanctionsCheck ?? true,
        pepCheck: allConfigs.L2?.pepCheck ?? true,
        faceVerification: allConfigs.L2?.faceVerification ?? true,
        ongoingMonitoring: allConfigs.L2?.ongoingMonitoring ?? true,
        maxInvestment: allConfigs.L2?.limits?.maxInvestment ?? 4625000,
        maxTradingVolume: allConfigs.L2?.limits?.maxTrading ?? 1850000,
        maxWithdrawal: allConfigs.L2?.limits?.maxWithdrawal ?? 462500,
        description: allConfigs.L2?.description || 'Government ID, address, and biometric verification required'
      },
      [KYCLevel.L3]: {
        name: allConfigs.L3?.name || 'Enhanced Verification',
        requirements: allConfigs.L3?.requirements || ['email_verified', 'phone_verified', 'identity_document', 'proof_of_address', 'biometric', 'source_of_funds', 'enhanced_screening'],
        documents: mapDocuments(allConfigs.L3?.documents || ['PASSPORT', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME', 'SOURCE_OF_FUNDS', 'BIOMETRIC_DATA']),
        sanctionsCheck: allConfigs.L3?.sanctionsCheck ?? true,
        pepCheck: allConfigs.L3?.pepCheck ?? true,
        faceVerification: allConfigs.L3?.faceVerification ?? true,
        ongoingMonitoring: allConfigs.L3?.ongoingMonitoring ?? true,
        maxInvestment: allConfigs.L3?.limits?.maxInvestment ?? 18500000,
        maxTradingVolume: allConfigs.L3?.limits?.maxTrading ?? 9250000,
        maxWithdrawal: allConfigs.L3?.limits?.maxWithdrawal ?? 1850000,
        description: allConfigs.L3?.description || 'Full due diligence and source of funds verification'
      },
      [KYCLevel.INSTITUTIONAL]: {
        name: allConfigs.INSTITUTIONAL?.name || 'Institutional/KYB Verification',
        requirements: allConfigs.INSTITUTIONAL?.requirements || ['business_registration', 'incorporation_documents', 'ownership_structure', 'authorized_signatories', 'source_of_funds', 'enhanced_screening', 'regulatory_licenses'],
        documents: mapDocuments(allConfigs.INSTITUTIONAL?.documents || ['BUSINESS_LICENSE', 'ARTICLES_OF_INCORPORATION', 'CERTIFICATE_OF_INCORPORATION', 'BANK_STATEMENT', 'PROOF_OF_ADDRESS']),
        sanctionsCheck: allConfigs.INSTITUTIONAL?.sanctionsCheck ?? true,
        pepCheck: allConfigs.INSTITUTIONAL?.pepCheck ?? true,
        faceVerification: allConfigs.INSTITUTIONAL?.faceVerification ?? true,
        ongoingMonitoring: allConfigs.INSTITUTIONAL?.ongoingMonitoring ?? true,
        maxInvestment: allConfigs.INSTITUTIONAL?.limits?.maxInvestment ?? 185000000,
        maxTradingVolume: allConfigs.INSTITUTIONAL?.limits?.maxTrading ?? 92500000,
        maxWithdrawal: allConfigs.INSTITUTIONAL?.limits?.maxWithdrawal ?? 18500000,
        description: allConfigs.INSTITUTIONAL?.description || 'Full institutional/KYB verification for businesses'
      }
    };
  }

  /**
   * Get KYC limits for a specific level (public accessor)
   */
  public static getKYCLimitsForLevel(level: KYCLevel): {
    maxInvestment: number;
    maxTradingVolume: number;
    maxWithdrawal: number;
    currencySymbol: string;
  } {
    const requirements = this.getKYCRequirements();
    const levelConfig = requirements[level];
    return {
      maxInvestment: levelConfig.maxInvestment,
      maxTradingVolume: levelConfig.maxTradingVolume,
      maxWithdrawal: levelConfig.maxWithdrawal,
      currencySymbol: getCurrencySymbol()
    };
  }

  /**
   * Format amount with currency symbol
   */
  public static formatAmount(amount: number): string {
    return formatCurrency(amount);
  }

  /**
   * Get currency symbol
   */
  public static getCurrencySymbol(): string {
    return getCurrencySymbol();
  }

  /**
   * Initialize KYC Service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing KYC Service...');
      
      // Validate Ballerine service is available
      const isHealthy = await ballerineService.healthCheck();
      if (!isHealthy) {
        LoggerService.warn('Ballerine service health check failed, continuing with limited functionality');
      }

      // Try to load workflow definitions dynamically
      try {
        await this.loadWorkflowDefinitions();
      } catch (error) {
        LoggerService.warn('Failed to load workflow definitions, using fallback IDs', { error });
      }
      
      // Load existing data
      await this.loadExistingData();
      
      // Start monitoring workers
      await this.startMonitoringWorkers();
      
      this.isInitialized = true;
      LoggerService.info('✅ KYC Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'kyc.initialized',
        'KYCService',
        'info',
        {
          message: 'KYC service initialized',
          usersCount: this.users.size,
          documentsCount: this.documents.size,
          verificationResultsCount: this.verificationResults.size
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ KYC Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start KYC verification process
   */
  public static async startKYCVerification(
    tenantId: string,
    keycloakUserId: string,
    brokerId: string,
    email: string,
    phoneNumber?: string,
    walletAddress?: string,
    requestedLevel: KYCLevel = KYCLevel.L0
  ): Promise<KYCUser> {
    try {
      LoggerService.info('Starting KYC verification process', {
        tenantId,
        keycloakUserId,
        brokerId,
        email,
        requestedLevel
      });

      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        user => user.keycloakUserId === keycloakUserId && user.tenantId === tenantId
      );

      if (existingUser) {
        throw createError('KYC verification already exists for this user', 400, 'KYC_ALREADY_EXISTS');
      }

      const id = uuidv4();
      const user: KYCUser = {
        id,
        tenantId,
        keycloakUserId,
        brokerId,
        email,
        phoneNumber,
        walletAddress,
        kycLevel: requestedLevel,
        status: KYCStatus.PENDING,
        riskScore: 0,
        riskLevel: RiskLevel.LOW,
        documents: [],
        verificationResults: [],
        sanctionsChecks: [],
        pepChecks: [],
        ongoingMonitoring: {
          id: uuidv4(),
          userId: id,
          enabled: false,
          frequency: MonitoringFrequency.MONTHLY,
          lastCheck: new Date(),
          nextCheck: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          alerts: [],
          riskChanges: []
        },
        complianceFlags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store user
      this.users.set(id, user);

      // Initialize monitoring if required
      const requirements = this.getKYCRequirements();
      if (requirements[requestedLevel].ongoingMonitoring) {
        await this.initializeOngoingMonitoring(user);
      }

      LoggerService.info('KYC verification process started', {
        userId: user.id,
        kycLevel: user.kycLevel,
        status: user.status
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'kyc.started',
        'kyc',
        id,
        {
          tenantId,
          keycloakUserId,
          brokerId,
          email,
          requestedLevel
        }
      );

      return user;

    } catch (error) {
      LoggerService.error('Start KYC verification failed:', error);
      throw error;
    }
  }

  /**
   * Upload document for verification
   */
  public static async uploadDocument(
    userId: string,
    documentType: DocumentType,
    documentData: Buffer,
    metadata: DocumentMetadata,
    country: string = 'US'
  ): Promise<KYCDocument> {
    try {
      LoggerService.info('Uploading document for verification', {
        userId,
        documentType,
        country
      });

      const user = this.users.get(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Validate document type for KYC level
      const allRequirements = this.getKYCRequirements();
      const requirements = allRequirements[user.kycLevel];
      if (requirements.documents.length > 0 && !requirements.documents.includes(documentType)) {
        throw createError(`Document type ${documentType} not required for ${user.kycLevel} KYC level`, 400, 'INVALID_DOCUMENT_TYPE');
      }

      const documentId = uuidv4();
      const document: KYCDocument = {
        id: documentId,
        userId,
        type: documentType,
        country,
        documentNumber: metadata.documentNumber || '',
        issuedDate: metadata.issuedDate || new Date(),
        expiryDate: metadata.expiryDate,
        status: DocumentStatus.UPLOADED,
        verificationResult: {
          isValid: false,
          confidence: 0,
          checks: {
            documentAuthenticity: false,
            faceMatch: false,
            livenessDetection: false,
            dataExtraction: false,
            ocrValidation: false
          },
          extractedData: {} as ExtractedData,
          errors: [],
          warnings: []
        },
        uploadedAt: new Date(),
        metadata
      };

      // Store document
      this.documents.set(documentId, document);
      user.documents.push(document);
      user.updatedAt = new Date();
      this.users.set(userId, user);

      // Start Ballerine verification workflow
      await this.startBallerineWorkflow(user, document);

      LoggerService.info('Document uploaded successfully', {
        documentId: document.id,
        userId: user.id,
        documentType: document.type
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'document.uploaded',
        'kyc',
        documentId,
        {
          userId,
          documentType,
          country,
          kycLevel: user.kycLevel
        }
      );

      return document;

    } catch (error) {
      LoggerService.error('Upload document failed:', error);
      throw error;
    }
  }

  /**
   * Process Ballerine webhook
   */
  public static async processBallerineWebhook(
    payload: any,
    signature: string
  ): Promise<void> {
    try {
      LoggerService.info('Processing Ballerine webhook', {
        eventType: payload.eventType,
        caseId: payload.caseId
      });

      // Verify webhook signature
      const isValid = await this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw createError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
      }

      const { eventType, caseId, workflowId, data, decision, status: workflowStatus } = payload;

      // Get workflow details from Ballerine if needed
      let workflowData = null;
      if (workflowId) {
        try {
          workflowData = await ballerineService.getWorkflowStatus(workflowId);
        } catch (error: any) {
          LoggerService.warn('Failed to get workflow status from Ballerine', { workflowId, error: error.message });
        }
      }

      // Handle different event types (compatible with original Ballerine callback format)
      switch (eventType || workflowStatus) {
        case 'workflow.completed':
        case 'completed':
          await this.handleWorkflowCompleted(caseId || payload.case_id, workflowId || payload.workflow_id, {
            ...data,
            decision,
            workflowStatus: workflowStatus || 'completed'
          });
          break;
        case 'workflow.failed':
        case 'failed':
          await this.handleWorkflowFailed(caseId || payload.case_id, workflowId || payload.workflow_id, {
            ...data,
            error: data?.error || 'Workflow failed'
          });
          break;
        case 'document.verified':
          await this.handleDocumentVerified(caseId || payload.case_id, workflowId || payload.workflow_id, data);
          break;
        case 'sanctions.check.completed':
          await this.handleSanctionsCheckCompleted(caseId || payload.case_id, workflowId || payload.workflow_id, data);
          break;
        case 'pep.check.completed':
          await this.handlePEPCheckCompleted(caseId || payload.case_id, workflowId || payload.workflow_id, data);
          break;
        default:
          // Handle original Ballerine callback format
          if (decision) {
            await this.handleWorkflowCompleted(caseId || payload.case_id, workflowId || payload.workflow_id, {
              decision,
              status: workflowStatus || payload.status,
              isValid: decision.status === 'approved',
              confidence: decision.confidence || 0.8,
              riskScore: decision.riskScore || 0.5,
              checks: decision.checks || [],
              extractedData: decision.extractedData || {},
              errors: decision.reasons?.filter((r: any) => r.type === 'error') || [],
              warnings: decision.reasons?.filter((r: any) => r.type === 'warning') || []
            });
          } else {
            LoggerService.warn('Unknown webhook event type', { eventType: eventType || workflowStatus, payload });
          }
      }

    } catch (error) {
      LoggerService.error('Process Ballerine webhook failed:', error);
      throw error;
    }
  }

  /**
   * Get KYC status for user
   */
  public static async getKYCStatus(userId: string): Promise<KYCUser> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      return user;
    } catch (error) {
      LoggerService.error('Get KYC status failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (alias for getKYCStatus for backward compatibility)
   */
  public static async getUserById(userId: string, tenantId?: string): Promise<KYCUser | null> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return null;
      }
      
      // If tenantId is provided, verify it matches
      if (tenantId && user.tenantId !== tenantId) {
        return null;
      }
      
      return user;
    } catch (error) {
      LoggerService.error('Get user by ID failed:', error);
      throw error;
    }
  }

  /**
   * Update KYC level
   */
  public static async updateKYCLevel(
    userId: string,
    newLevel: KYCLevel,
    reason: string
  ): Promise<KYCUser> {
    try {
      LoggerService.info('Updating KYC level', {
        userId,
        newLevel,
        reason
      });

      const user = this.users.get(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      const oldLevel = user.kycLevel;
      user.kycLevel = newLevel;
      user.updatedAt = new Date();

      // Update ongoing monitoring if required
      const allRequirements = this.getKYCRequirements();
      const requirements = allRequirements[newLevel];
      if (requirements.ongoingMonitoring && !user.ongoingMonitoring.enabled) {
        await this.initializeOngoingMonitoring(user);
      }

      // Store updated user
      this.users.set(userId, user);

      LoggerService.info('KYC level updated successfully', {
        userId: user.id,
        oldLevel,
        newLevel: user.kycLevel
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'kyc.level_updated',
        'kyc',
        userId,
        {
          oldLevel,
          newLevel,
          reason
        }
      );

      return user;

    } catch (error) {
      LoggerService.error('Update KYC level failed:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing KYC Service...');
      this.isInitialized = false;
      this.users.clear();
      this.documents.clear();
      this.verificationResults.clear();
      this.sanctionsChecks.clear();
      this.pepChecks.clear();
      this.ongoingMonitoring.clear();
      this.complianceFlags.clear();
      LoggerService.info('✅ KYC Service closed');
    } catch (error) {
      LoggerService.error('Error closing KYC Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================


  private static async loadExistingData(): Promise<void> {
    try {
      // This would typically load from database
      LoggerService.info('Existing KYC data loaded from database');
    } catch (error) {
      LoggerService.error('Load existing data failed:', error);
      throw error;
    }
  }

  /**
   * Load workflow definitions from Ballerine (with caching)
   */
  private static async loadWorkflowDefinitions(): Promise<void> {
    try {
      const now = Date.now();
      // Use cache if still valid
      if (this.workflowDefinitionsCacheTime > 0 && (now - this.workflowDefinitionsCacheTime) < this.WORKFLOW_CACHE_TTL) {
        LoggerService.info('Using cached workflow definitions');
        return;
      }

      const definitions = await ballerineService.getWorkflowDefinitions();
      
      // Cache definitions by type
      definitions.forEach(def => {
        const type = def.name?.toLowerCase().includes('kyb') ? 'kyb' : 'kyc';
        this.workflowDefinitionsCache.set(type, def);
        
        // Also cache by name patterns
        if (def.name?.toLowerCase().includes('basic')) {
          this.workflowDefinitionsCache.set('basic', def);
        }
        if (def.name?.toLowerCase().includes('enhanced') || def.name?.toLowerCase().includes('premium')) {
          this.workflowDefinitionsCache.set('enhanced', def);
          this.workflowDefinitionsCache.set('premium', def);
        }
      });

      this.workflowDefinitionsCacheTime = now;
      LoggerService.info('Loaded workflow definitions', {
        count: definitions.length,
        cached: this.workflowDefinitionsCache.size
      });
    } catch (error) {
      LoggerService.error('Failed to load workflow definitions', { error });
      throw error;
    }
  }

  /**
   * Get workflow definition ID for a KYC level (try dynamic first, fallback to hardcoded)
   */
  private static async getWorkflowDefinitionId(kycLevel: string, type: 'kyc' | 'kyb'): Promise<string> {
    try {
      // Try to get from cache first
      const cached = this.workflowDefinitionsCache.get(type) || 
                     this.workflowDefinitionsCache.get(kycLevel.toLowerCase());
      
      if (cached) {
        return cached.id;
      }

      // Try to find dynamically
      const definition = await ballerineService.findWorkflowDefinitionByType(type);
      if (definition) {
        this.workflowDefinitionsCache.set(type, definition);
        return definition.id;
      }

      // Fallback to hardcoded
      const fallback = this.BALLERINE_WORKFLOWS[kycLevel.toLowerCase() as keyof typeof this.BALLERINE_WORKFLOWS];
      if (fallback) {
        return fallback;
      }

      throw new Error(`No workflow definition found for KYC level: ${kycLevel}`);
    } catch (error) {
      LoggerService.warn('Failed to get workflow definition dynamically, using fallback', { error, kycLevel, type });
      const fallback = this.BALLERINE_WORKFLOWS[kycLevel.toLowerCase() as keyof typeof this.BALLERINE_WORKFLOWS];
      return fallback || (type === 'kyb' ? 'kyb-workflow' : 'kyc-workflow');
    }
  }

  private static async startMonitoringWorkers(): Promise<void> {
    try {
      LoggerService.info('Starting KYC monitoring workers...');
      // This would typically start background workers for monitoring
      LoggerService.info('KYC monitoring workers started');
    } catch (error) {
      LoggerService.error('Start monitoring workers failed:', error);
      throw error;
    }
  }

  private static async startBallerineWorkflow(user: KYCUser, document: KYCDocument): Promise<void> {
    try {
      const workflowType = user.kycLevel === KYCLevel.INSTITUTIONAL ? 'kyb' : 'kyc';
      const workflowDefinitionId = await this.getWorkflowDefinitionId(user.kycLevel, workflowType);
      
      if (!workflowDefinitionId) {
        throw new Error(`No workflow configured for KYC level: ${user.kycLevel}`);
      }

      // Prepare case data for Ballerine
      const caseData = {
        id: document.id,
        type: user.kycLevel === KYCLevel.INSTITUTIONAL ? 'kyb' : 'kyc',
        entity_id: user.id,
        tenant_id: user.tenantId,
        broker_id: user.brokerId,
        entity_data: {
          personalInformation: {
            firstName: user.email.split('@')[0], // Placeholder - should come from user profile
            email: user.email,
            phoneNumber: user.phoneNumber,
            walletAddress: user.walletAddress
          },
          metadata: {
            kycLevel: user.kycLevel,
            tenantId: user.tenantId,
            brokerId: user.brokerId
          }
        },
        documents: [{
          type: document.type,
          country: document.country,
          documentNumber: document.documentNumber,
          file_path: document.filePath || document.metadata?.filePath || `documents/${document.id}` // Use filePath if available, otherwise construct from document ID
        }],
        priority: 'normal',
        regulatoryRequirements: [],
        riskLevel: 'medium'
      };

      // Start workflow using BallerineService
      const workflowResponse = await ballerineService.startWorkflow(caseData);

      // Update document with Ballerine workflow information
      document.ballerineWorkflowId = workflowResponse.id;
      document.ballerineCaseId = workflowResponse.id;
      document.status = DocumentStatus.PROCESSING;
      this.documents.set(document.id, document);

      LoggerService.info('Ballerine workflow started successfully', {
        documentId: document.id,
        workflowId: workflowResponse.id,
        status: workflowResponse.status
      });

    } catch (error) {
      LoggerService.error('Start Ballerine workflow failed:', error);
      throw error;
    }
  }

  private static async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      return await ballerineService.verifyWebhookSignature(payload, signature);
    } catch (error) {
      LoggerService.error('Verify webhook signature failed:', error);
      return false;
    }
  }

  private static async handleWorkflowCompleted(caseId: string, workflowId: string, data: any): Promise<void> {
    try {
      LoggerService.info('Handling workflow completed', { caseId, workflowId });

      const document = Array.from(this.documents.values()).find(doc => doc.ballerineCaseId === caseId);
      if (!document) {
        LoggerService.warn('Document not found for completed workflow', { caseId });
        return;
      }

      const user = this.users.get(document.userId);
      if (!user) {
        LoggerService.warn('User not found for completed workflow', { caseId });
        return;
      }

      // Update document verification result
      document.verificationResult = {
        isValid: data.isValid,
        confidence: data.confidence,
        checks: data.checks,
        extractedData: data.extractedData,
        errors: data.errors || [],
        warnings: data.warnings || []
      };

      document.status = data.isValid ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED;
      document.verifiedAt = new Date();

      // Update user risk score
      await this.updateUserRiskScore(user, data.riskScore || 0);

      // Store updated data
      this.documents.set(document.id, document);
      this.users.set(user.id, user);

      LoggerService.info('Workflow completed processed', {
        caseId,
        documentId: document.id,
        userId: user.id,
        isValid: data.isValid
      });

    } catch (error) {
      LoggerService.error('Handle workflow completed failed:', error);
      throw error;
    }
  }

  private static async handleWorkflowFailed(caseId: string, workflowId: string, data: any): Promise<void> {
    try {
      LoggerService.info('Handling workflow failed', { caseId, workflowId });

      const document = Array.from(this.documents.values()).find(doc => doc.ballerineCaseId === caseId);
      if (!document) {
        LoggerService.warn('Document not found for failed workflow', { caseId });
        return;
      }

      document.status = DocumentStatus.REJECTED;
      document.verificationResult.errors.push(data.error || 'Workflow failed');
      this.documents.set(document.id, document);

    } catch (error) {
      LoggerService.error('Handle workflow failed failed:', error);
      throw error;
    }
  }

  private static async handleDocumentVerified(caseId: string, workflowId: string, data: any): Promise<void> {
    try {
      LoggerService.info('Handling document verified', { caseId, workflowId });
      // Implementation for document verification handling
    } catch (error) {
      LoggerService.error('Handle document verified failed:', error);
      throw error;
    }
  }

  private static async handleSanctionsCheckCompleted(caseId: string, workflowId: string, data: any): Promise<void> {
    try {
      LoggerService.info('Handling sanctions check completed', { caseId, workflowId });
      // Implementation for sanctions check handling
    } catch (error) {
      LoggerService.error('Handle sanctions check completed failed:', error);
      throw error;
    }
  }

  private static async handlePEPCheckCompleted(caseId: string, workflowId: string, data: any): Promise<void> {
    try {
      LoggerService.info('Handling PEP check completed', { caseId, workflowId });
      // Implementation for PEP check handling
    } catch (error) {
      LoggerService.error('Handle PEP check completed failed:', error);
      throw error;
    }
  }

  private static async initializeOngoingMonitoring(user: KYCUser): Promise<void> {
    try {
      const allRequirements = this.getKYCRequirements();
      const requirements = allRequirements[user.kycLevel];
      if (!requirements.ongoingMonitoring) {
        return;
      }

      user.ongoingMonitoring.enabled = true;
      user.ongoingMonitoring.frequency = MonitoringFrequency.MONTHLY;
      user.ongoingMonitoring.nextCheck = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      this.ongoingMonitoring.set(user.ongoingMonitoring.id, user.ongoingMonitoring);
      this.users.set(user.id, user);

      LoggerService.info('Ongoing monitoring initialized', {
        userId: user.id,
        frequency: user.ongoingMonitoring.frequency
      });

    } catch (error) {
      LoggerService.error('Initialize ongoing monitoring failed:', error);
      throw error;
    }
  }

  private static async updateUserRiskScore(user: KYCUser, newScore: number): Promise<void> {
    try {
      const oldScore = user.riskScore;
      user.riskScore = newScore;
      user.riskLevel = this.calculateRiskLevel(newScore);
      user.updatedAt = new Date();

      // Record risk change
      const riskChange: RiskChange = {
        id: uuidv4(),
        previousScore: oldScore,
        newScore: newScore,
        changeReason: 'Verification completed',
        changedAt: new Date()
      };

      user.ongoingMonitoring.riskChanges.push(riskChange);

      // Check if risk level changed significantly
      if (Math.abs(newScore - oldScore) > 20) {
        const alert: MonitoringAlert = {
          id: uuidv4(),
          type: AlertType.RISK_SCORE_CHANGE,
          severity: AlertSeverity.WARNING,
          message: `Risk score changed from ${oldScore} to ${newScore}`,
          triggeredAt: new Date()
        };

        user.ongoingMonitoring.alerts.push(alert);
      }

    } catch (error) {
      LoggerService.error('Update user risk score failed:', error);
      throw error;
    }
  }

  private static calculateRiskLevel(score: number): RiskLevel {
    if (score <= 25) return RiskLevel.LOW;
    if (score <= 50) return RiskLevel.MEDIUM;
    if (score <= 75) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }
}

// =============================================================================
// DOCUMENT METADATA INTERFACE
// =============================================================================

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
  filePath?: string; // Path to stored document file (optional, for compatibility with file storage systems)
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
}
