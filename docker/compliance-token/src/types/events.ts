/**
 * Event Types for Token Compliance Service
 * Kafka event definitions for token compliance events
 */

// ==================== BASE EVENT TYPES ====================

/**
 * Base event structure
 */
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  version: string;
  source: string;
  correlationId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  producedAt: Date;
  producedBy: string;
  retryCount?: number | undefined;
  maxRetries?: number | undefined;
  deadLetterQueue?: boolean | undefined;
}

// ==================== TOKEN CONTRACT EVENTS ====================

/**
 * Token contract registered event
 */
export interface TokenContractRegisteredEvent extends BaseEvent {
  eventType: 'token.contract.registered';
  payload: {
    contractId: string;
    contractAddress: string;
    chainId: number;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    standard: 'ERC20' | 'ERC777' | 'BEP20' | 'TRC20';
    deployerAddress: string;
    verified: boolean;
  };
}

/**
 * Token contract updated event
 */
export interface TokenContractUpdatedEvent extends BaseEvent {
  eventType: 'token.contract.updated';
  payload: {
    contractId: string;
    contractAddress: string;
    chainId: number;
    changes: Record<string, unknown>;
  };
}

/**
 * Token contract flagged event
 */
export interface TokenContractFlaggedEvent extends BaseEvent {
  eventType: 'token.contract.flagged';
  payload: {
    contractId: string;
    contractAddress: string;
    chainId: number;
    flagReason: string;
    flaggedBy: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ==================== TOKEN TRANSFER EVENTS ====================

/**
 * Token transfer detected event
 */
export interface TokenTransferDetectedEvent extends BaseEvent {
  eventType: 'token.transfer.detected';
  payload: {
    transferId: string;
    transactionHash: string;
    blockNumber: number;
    chainId: number;
    contractAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    transferType: 'transfer' | 'mint' | 'burn' | 'approval';
    userId?: string | undefined;
  };
}

/**
 * Token transfer compliance checked event
 */
export interface TokenTransferComplianceCheckedEvent extends BaseEvent {
  eventType: 'token.transfer.compliance_checked';
  payload: {
    transferId: string;
    transactionHash: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    recommendations: string[];
    travelRuleRequired: boolean;
    blocked: boolean;
    blockReason?: string | undefined;
  };
}

/**
 * Large transfer alert event
 */
export interface LargeTransferAlertEvent extends BaseEvent {
  eventType: 'token.transfer.large_transfer_alert';
  payload: {
    transferId: string;
    transactionHash: string;
    contractAddress: string;
    tokenSymbol: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    thresholdUSD: string;
    urgency: 'immediate' | 'high' | 'medium';
  };
}

// ==================== TOKEN HOLDER EVENTS ====================

/**
 * Token holder updated event
 */
export interface TokenHolderUpdatedEvent extends BaseEvent {
  eventType: 'token.holder.updated';
  payload: {
    holderId: string;
    contractAddress: string;
    chainId: number;
    holderAddress: string;
    previousBalance: string;
    newBalance: string;
    percentageOfSupply: number;
    isWhale: boolean;
  };
}

/**
 * Whale movement detected event
 */
export interface WhaleMovementDetectedEvent extends BaseEvent {
  eventType: 'token.holder.whale_movement';
  payload: {
    holderId: string;
    contractAddress: string;
    chainId: number;
    holderAddress: string;
    movementType: 'accumulation' | 'distribution';
    amount: string;
    amountUSD: string;
    percentageOfSupply: number;
    transactionHash: string;
  };
}

// ==================== TOKEN APPROVAL EVENTS ====================

/**
 * Token approval detected event
 */
export interface TokenApprovalDetectedEvent extends BaseEvent {
  eventType: 'token.approval.detected';
  payload: {
    approvalId: string;
    transactionHash: string;
    chainId: number;
    contractAddress: string;
    ownerAddress: string;
    spenderAddress: string;
    amount: string;
    isUnlimited: boolean;
    spenderType: 'dex' | 'bridge' | 'lending' | 'unknown';
    userId?: string | undefined;
  };
}

/**
 * Risky approval alert event
 */
export interface RiskyApprovalAlertEvent extends BaseEvent {
  eventType: 'token.approval.risky_alert';
  payload: {
    approvalId: string;
    transactionHash: string;
    contractAddress: string;
    ownerAddress: string;
    spenderAddress: string;
    riskReason: string;
    riskScore: number;
    recommendedAction: string;
  };
}

// ==================== WALLET SCREENING EVENTS ====================

/**
 * Wallet screened event
 */
export interface WalletScreenedEvent extends BaseEvent {
  eventType: 'token.wallet.screened';
  payload: {
    screeningId: string;
    walletAddress: string;
    chainId: number;
    provider: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    sanctionsMatch: boolean;
    mixerExposure: number;
    darknetExposure: number;
  };
}

/**
 * Sanctions match detected event
 */
export interface SanctionsMatchDetectedEvent extends BaseEvent {
  eventType: 'token.wallet.sanctions_match';
  payload: {
    screeningId: string;
    walletAddress: string;
    chainId: number;
    matchedLists: string[];
    matchScore: number;
    entityName: string;
    urgency: 'immediate';
    recommendedActions: string[];
  };
}

// ==================== RISK ASSESSMENT EVENTS ====================

/**
 * Risk assessment created event
 */
export interface TokenRiskAssessmentCreatedEvent extends BaseEvent {
  eventType: 'token.risk_assessment.created';
  payload: {
    assessmentId: string;
    transferId: string;
    transactionHash: string;
    contractAddress: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    recommendations: string[];
    reviewRequired: boolean;
    userId?: string | undefined;
  };
}

/**
 * Risk assessment reviewed event
 */
export interface TokenRiskAssessmentReviewedEvent extends BaseEvent {
  eventType: 'token.risk_assessment.reviewed';
  payload: {
    assessmentId: string;
    transferId: string;
    reviewedBy: string;
    approved: boolean;
    overrideReason?: string | undefined;
    newRiskLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
    actionTaken?: string | undefined;
  };
}

/**
 * High risk alert event
 */
export interface TokenHighRiskAlertEvent extends BaseEvent {
  eventType: 'token.risk_assessment.high_risk_alert';
  payload: {
    assessmentId: string;
    transferId: string;
    transactionHash: string;
    contractAddress: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    amountUSD: string;
    riskScore: number;
    riskLevel: 'high' | 'critical';
    flags: string[];
    urgency: 'immediate' | 'high' | 'medium';
    recommendedActions: string[];
  };
}

// ==================== TRAVEL RULE EVENTS ====================

/**
 * Travel Rule message created event
 */
export interface TokenTravelRuleCreatedEvent extends BaseEvent {
  eventType: 'token.travel_rule.created';
  payload: {
    travelRuleId: string;
    transferId: string;
    transactionHash: string;
    contractAddress: string;
    tokenSymbol: string;
    chainId: number;
    fromAddress: string;
    toAddress: string;
    amountUSD: string;
    messageId: string;
    originatorVASP?: string | undefined;
    beneficiaryVASP?: string | undefined;
  };
}

/**
 * Travel Rule message sent event
 */
export interface TokenTravelRuleSentEvent extends BaseEvent {
  eventType: 'token.travel_rule.sent';
  payload: {
    travelRuleId: string;
    transferId: string;
    messageId: string;
    sentAt: Date;
    recipientVASP: string;
  };
}

/**
 * Travel Rule message acknowledged event
 */
export interface TokenTravelRuleAcknowledgedEvent extends BaseEvent {
  eventType: 'token.travel_rule.acknowledged';
  payload: {
    travelRuleId: string;
    transferId: string;
    messageId: string;
    acknowledgedAt: Date;
    acknowledgedBy: string;
  };
}

/**
 * Travel Rule message failed event
 */
export interface TokenTravelRuleFailedEvent extends BaseEvent {
  eventType: 'token.travel_rule.failed';
  payload: {
    travelRuleId: string;
    transferId: string;
    messageId: string;
    failedAt: Date;
    errorMessage: string;
    retryCount: number;
    willRetry: boolean;
  };
}

// ==================== CARF EVENTS ====================

/**
 * CARF report generated event
 */
export interface TokenCARFReportGeneratedEvent extends BaseEvent {
  eventType: 'token.carf.report_generated';
  payload: {
    carfId: string;
    reportId: string;
    walletAddress: string;
    userId?: string | undefined;
    reportingPeriodStart: Date;
    reportingPeriodEnd: Date;
    totalTransferInUSD: string;
    totalTransferOutUSD: string;
    netGainLossUSD: string;
    transactionCount: number;
    version: string;
  };
}

/**
 * CARF report submitted event
 */
export interface TokenCARFReportSubmittedEvent extends BaseEvent {
  eventType: 'token.carf.report_submitted';
  payload: {
    carfId: string;
    reportId: string;
    submittedAt: Date;
    submittedTo: string;
    submissionReference?: string | undefined;
  };
}

/**
 * CARF report acknowledged event
 */
export interface TokenCARFReportAcknowledgedEvent extends BaseEvent {
  eventType: 'token.carf.report_acknowledged';
  payload: {
    carfId: string;
    reportId: string;
    acknowledgedAt: Date;
    acknowledgmentReference?: string | undefined;
  };
}

/**
 * CARF report rejected event
 */
export interface TokenCARFReportRejectedEvent extends BaseEvent {
  eventType: 'token.carf.report_rejected';
  payload: {
    carfId: string;
    reportId: string;
    rejectedAt: Date;
    rejectionReason: string;
    correctionRequired: boolean;
  };
}

// ==================== PRESALE EVENTS ====================

/**
 * Presale created event
 */
export interface PresaleCreatedEvent extends BaseEvent {
  eventType: 'token.presale.created';
  payload: {
    presaleId: string;
    contractAddress: string;
    chainId: number;
    presaleAddress: string;
    tokenPrice: string;
    softCap: string;
    hardCap: string;
    startTime: Date;
    endTime: Date;
    kycRequired: boolean;
  };
}

/**
 * Presale contribution event
 */
export interface PresaleContributionEvent extends BaseEvent {
  eventType: 'token.presale.contribution';
  payload: {
    contributionId: string;
    presaleId: string;
    contributorAddress: string;
    amount: string;
    amountUSD: string;
    tokenAmount: string;
    transactionHash: string;
    userId?: string | undefined;
  };
}

/**
 * Presale compliance check event
 */
export interface PresaleComplianceCheckEvent extends BaseEvent {
  eventType: 'token.presale.compliance_check';
  payload: {
    presaleId: string;
    contributorAddress: string;
    kycStatus: 'verified' | 'pending' | 'rejected' | 'not_required';
    amlStatus: 'cleared' | 'pending' | 'flagged';
    eligible: boolean;
    rejectionReason?: string | undefined;
  };
}

// ==================== UNION TYPES ====================

/**
 * All token compliance events
 */
export type TokenComplianceEvent =
  | TokenContractRegisteredEvent
  | TokenContractUpdatedEvent
  | TokenContractFlaggedEvent
  | TokenTransferDetectedEvent
  | TokenTransferComplianceCheckedEvent
  | LargeTransferAlertEvent
  | TokenHolderUpdatedEvent
  | WhaleMovementDetectedEvent
  | TokenApprovalDetectedEvent
  | RiskyApprovalAlertEvent
  | WalletScreenedEvent
  | SanctionsMatchDetectedEvent
  | TokenRiskAssessmentCreatedEvent
  | TokenRiskAssessmentReviewedEvent
  | TokenHighRiskAlertEvent
  | TokenTravelRuleCreatedEvent
  | TokenTravelRuleSentEvent
  | TokenTravelRuleAcknowledgedEvent
  | TokenTravelRuleFailedEvent
  | TokenCARFReportGeneratedEvent
  | TokenCARFReportSubmittedEvent
  | TokenCARFReportAcknowledgedEvent
  | TokenCARFReportRejectedEvent
  | PresaleCreatedEvent
  | PresaleContributionEvent
  | PresaleComplianceCheckEvent;

/**
 * Event type strings
 */
export type TokenComplianceEventType = TokenComplianceEvent['eventType'];

// ==================== KAFKA TOPICS ====================

/**
 * Kafka topic configuration
 */
export const TOKEN_COMPLIANCE_TOPICS = {
  // Inbound topics (from token services)
  TOKEN_CONTRACTS: 'token.contracts',
  TOKEN_TRANSFERS: 'token.transfers',
  TOKEN_APPROVALS: 'token.approvals',
  TOKEN_HOLDERS: 'token.holders',
  TOKEN_PRESALES: 'token.presales',

  // Compliance topics
  TOKEN_COMPLIANCE_EVENTS: 'token.compliance.events',
  TOKEN_WALLET_SCREENINGS: 'token.compliance.wallet_screenings',
  TOKEN_RISK_ASSESSMENTS: 'token.compliance.risk_assessments',
  TOKEN_TRAVEL_RULE: 'token.compliance.travel_rule',
  TOKEN_CARF: 'token.compliance.carf',

  // Alert topics
  TOKEN_HIGH_RISK_ALERTS: 'token.compliance.high_risk_alerts',
  TOKEN_SANCTIONS_ALERTS: 'token.compliance.sanctions_alerts',
  TOKEN_WHALE_ALERTS: 'token.compliance.whale_alerts',
  TOKEN_LARGE_TRANSFER_ALERTS: 'token.compliance.large_transfer_alerts',

  // Dead letter queue
  TOKEN_COMPLIANCE_DLQ: 'token.compliance.dlq',
} as const;

export type TokenComplianceTopic = typeof TOKEN_COMPLIANCE_TOPICS[keyof typeof TOKEN_COMPLIANCE_TOPICS];
