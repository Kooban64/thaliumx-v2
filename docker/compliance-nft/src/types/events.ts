/**
 * Event Types for NFT Compliance Service
 * Kafka event definitions for NFT compliance events
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

// ==================== NFT COLLECTION EVENTS ====================

/**
 * Collection created event
 */
export interface CollectionCreatedEvent extends BaseEvent {
  eventType: 'nft.collection.created';
  payload: {
    collectionId: string;
    contractAddress: string;
    chainId: number;
    name: string;
    symbol: string;
    creatorAddress: string;
    creatorFee: number;
    totalSupply: number;
    verified: boolean;
  };
}

/**
 * Collection updated event
 */
export interface CollectionUpdatedEvent extends BaseEvent {
  eventType: 'nft.collection.updated';
  payload: {
    collectionId: string;
    contractAddress: string;
    chainId: number;
    changes: Record<string, unknown>;
  };
}

/**
 * Collection verified event
 */
export interface CollectionVerifiedEvent extends BaseEvent {
  eventType: 'nft.collection.verified';
  payload: {
    collectionId: string;
    contractAddress: string;
    chainId: number;
    verifiedBy: string;
    verificationDate: Date;
  };
}

/**
 * Collection flagged event
 */
export interface CollectionFlaggedEvent extends BaseEvent {
  eventType: 'nft.collection.flagged';
  payload: {
    collectionId: string;
    contractAddress: string;
    chainId: number;
    flagReason: string;
    flaggedBy: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ==================== NFT TOKEN EVENTS ====================

/**
 * Token minted event
 */
export interface TokenMintedEvent extends BaseEvent {
  eventType: 'nft.token.minted';
  payload: {
    tokenId: string;
    contractAddress: string;
    chainId: number;
    collectionId: string;
    minterAddress: string;
    ownerAddress: string;
    tokenUri: string;
    tokenStandard: 'ERC721' | 'ERC1155';
    supply?: number | undefined;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Token transferred event
 */
export interface TokenTransferredEvent extends BaseEvent {
  eventType: 'nft.token.transferred';
  payload: {
    tokenId: string;
    contractAddress: string;
    chainId: number;
    collectionId: string;
    fromAddress: string;
    toAddress: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Token burned event
 */
export interface TokenBurnedEvent extends BaseEvent {
  eventType: 'nft.token.burned';
  payload: {
    tokenId: string;
    contractAddress: string;
    chainId: number;
    collectionId: string;
    ownerAddress: string;
    transactionHash: string;
    blockNumber: number;
  };
}

/**
 * Token flagged event
 */
export interface TokenFlaggedEvent extends BaseEvent {
  eventType: 'nft.token.flagged';
  payload: {
    tokenId: string;
    contractAddress: string;
    chainId: number;
    collectionId: string;
    flagReason: string;
    flaggedBy: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ==================== NFT SALE EVENTS ====================

/**
 * Sale created event
 */
export interface SaleCreatedEvent extends BaseEvent {
  eventType: 'nft.sale.created';
  payload: {
    saleId: string;
    transactionHash: string;
    blockNumber: number;
    chainId: number;
    contractAddress: string;
    tokenId: string;
    collectionId: string;
    sellerAddress: string;
    buyerAddress: string;
    price: string;
    currency: string;
    priceUSD: string;
    marketplace: string;
    saleType: 'fixed' | 'auction' | 'offer' | 'bundle';
    royaltyAmount?: string | undefined;
    royaltyRecipient?: string | undefined;
    platformFee?: string | undefined;
    userId?: string | undefined;
  };
}

/**
 * Sale compliance checked event
 */
export interface SaleComplianceCheckedEvent extends BaseEvent {
  eventType: 'nft.sale.compliance_checked';
  payload: {
    saleId: string;
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

// ==================== NFT LISTING EVENTS ====================

/**
 * Listing created event
 */
export interface ListingCreatedEvent extends BaseEvent {
  eventType: 'nft.listing.created';
  payload: {
    listingId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    collectionId: string;
    sellerAddress: string;
    price: string;
    currency: string;
    priceUSD: string;
    marketplace: string;
    listingType: 'fixed' | 'auction' | 'dutch_auction';
    startTime: Date;
    endTime?: Date | undefined;
    userId?: string | undefined;
  };
}

/**
 * Listing cancelled event
 */
export interface ListingCancelledEvent extends BaseEvent {
  eventType: 'nft.listing.cancelled';
  payload: {
    listingId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    reason?: string | undefined;
  };
}

/**
 * Listing expired event
 */
export interface ListingExpiredEvent extends BaseEvent {
  eventType: 'nft.listing.expired';
  payload: {
    listingId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    expiredAt: Date;
  };
}

// ==================== NFT BID EVENTS ====================

/**
 * Bid placed event
 */
export interface BidPlacedEvent extends BaseEvent {
  eventType: 'nft.bid.placed';
  payload: {
    bidId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    collectionId: string;
    bidderAddress: string;
    amount: string;
    currency: string;
    amountUSD: string;
    marketplace: string;
    bidType: 'token' | 'collection' | 'trait';
    expirationTime?: Date | undefined;
    userId?: string | undefined;
  };
}

/**
 * Bid accepted event
 */
export interface BidAcceptedEvent extends BaseEvent {
  eventType: 'nft.bid.accepted';
  payload: {
    bidId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    bidderAddress: string;
    sellerAddress: string;
    amount: string;
    transactionHash: string;
  };
}

/**
 * Bid cancelled event
 */
export interface BidCancelledEvent extends BaseEvent {
  eventType: 'nft.bid.cancelled';
  payload: {
    bidId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    reason?: string | undefined;
  };
}

// ==================== WASH TRADING EVENTS ====================

/**
 * Wash trading detected event
 */
export interface WashTradingDetectedEvent extends BaseEvent {
  eventType: 'nft.wash_trading.detected';
  payload: {
    detectionId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    confidence: number;
    indicators: string[];
    relatedTransactions: string[];
    relatedAddresses: string[];
    volumeInflation?: string | undefined;
    priceManipulation: boolean;
  };
}

/**
 * Wash trading cleared event
 */
export interface WashTradingClearedEvent extends BaseEvent {
  eventType: 'nft.wash_trading.cleared';
  payload: {
    detectionId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    clearedBy: string;
    clearReason: string;
  };
}

// ==================== CONTENT SCREENING EVENTS ====================

/**
 * Content screened event
 */
export interface ContentScreenedEvent extends BaseEvent {
  eventType: 'nft.content.screened';
  payload: {
    screeningId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other';
    contentUrl: string;
    isFlagged: boolean;
    flagReasons: string[];
    moderationScore: number;
    categories: string[];
    manualReviewRequired: boolean;
  };
}

/**
 * Content reviewed event
 */
export interface ContentReviewedEvent extends BaseEvent {
  eventType: 'nft.content.reviewed';
  payload: {
    screeningId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    reviewedBy: string;
    approved: boolean;
    reviewNotes?: string | undefined;
    actionTaken?: string | undefined;
  };
}

// ==================== RISK ASSESSMENT EVENTS ====================

/**
 * Risk assessment created event
 */
export interface NFTRiskAssessmentCreatedEvent extends BaseEvent {
  eventType: 'nft.risk_assessment.created';
  payload: {
    assessmentId: string;
    transactionId: string;
    transactionHash: string;
    contractAddress: string;
    tokenId: string;
    sellerAddress: string;
    buyerAddress: string;
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
export interface NFTRiskAssessmentReviewedEvent extends BaseEvent {
  eventType: 'nft.risk_assessment.reviewed';
  payload: {
    assessmentId: string;
    transactionId: string;
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
export interface NFTHighRiskAlertEvent extends BaseEvent {
  eventType: 'nft.risk_assessment.high_risk_alert';
  payload: {
    assessmentId: string;
    transactionId: string;
    transactionHash: string;
    contractAddress: string;
    tokenId: string;
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
export interface NFTTravelRuleCreatedEvent extends BaseEvent {
  eventType: 'nft.travel_rule.created';
  payload: {
    travelRuleId: string;
    saleId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    sellerAddress: string;
    buyerAddress: string;
    priceUSD: string;
    messageId: string;
    originatorVASP?: string | undefined;
    beneficiaryVASP?: string | undefined;
  };
}

/**
 * Travel Rule message sent event
 */
export interface NFTTravelRuleSentEvent extends BaseEvent {
  eventType: 'nft.travel_rule.sent';
  payload: {
    travelRuleId: string;
    saleId: string;
    messageId: string;
    sentAt: Date;
    recipientVASP: string;
  };
}

/**
 * Travel Rule message acknowledged event
 */
export interface NFTTravelRuleAcknowledgedEvent extends BaseEvent {
  eventType: 'nft.travel_rule.acknowledged';
  payload: {
    travelRuleId: string;
    saleId: string;
    messageId: string;
    acknowledgedAt: Date;
    acknowledgedBy: string;
  };
}

/**
 * Travel Rule message failed event
 */
export interface NFTTravelRuleFailedEvent extends BaseEvent {
  eventType: 'nft.travel_rule.failed';
  payload: {
    travelRuleId: string;
    saleId: string;
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
export interface NFTCARFReportGeneratedEvent extends BaseEvent {
  eventType: 'nft.carf.report_generated';
  payload: {
    carfId: string;
    reportId: string;
    walletAddress: string;
    userId?: string | undefined;
    reportingPeriodStart: Date;
    reportingPeriodEnd: Date;
    totalSalesVolumeUSD: string;
    totalPurchasesVolumeUSD: string;
    netGainLossUSD: string;
    transactionCount: number;
    version: string;
  };
}

/**
 * CARF report submitted event
 */
export interface NFTCARFReportSubmittedEvent extends BaseEvent {
  eventType: 'nft.carf.report_submitted';
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
export interface NFTCARFReportAcknowledgedEvent extends BaseEvent {
  eventType: 'nft.carf.report_acknowledged';
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
export interface NFTCARFReportRejectedEvent extends BaseEvent {
  eventType: 'nft.carf.report_rejected';
  payload: {
    carfId: string;
    reportId: string;
    rejectedAt: Date;
    rejectionReason: string;
    correctionRequired: boolean;
  };
}

// ==================== ROYALTY EVENTS ====================

/**
 * Royalty paid event
 */
export interface RoyaltyPaidEvent extends BaseEvent {
  eventType: 'nft.royalty.paid';
  payload: {
    saleId: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
    collectionId: string;
    royaltyAmount: string;
    royaltyRecipient: string;
    transactionHash: string;
  };
}

/**
 * Royalty compliance check event
 */
export interface RoyaltyComplianceCheckEvent extends BaseEvent {
  eventType: 'nft.royalty.compliance_check';
  payload: {
    collectionId: string;
    contractAddress: string;
    chainId: number;
    isCompliant: boolean;
    totalRoyaltiesPaid: string;
    totalRoyaltiesOwed: string;
    unpaidRoyalties: string;
    enforcementType: 'on_chain' | 'marketplace' | 'none';
  };
}

// ==================== UNION TYPES ====================

/**
 * All NFT compliance events
 */
export type NFTComplianceEvent =
  | CollectionCreatedEvent
  | CollectionUpdatedEvent
  | CollectionVerifiedEvent
  | CollectionFlaggedEvent
  | TokenMintedEvent
  | TokenTransferredEvent
  | TokenBurnedEvent
  | TokenFlaggedEvent
  | SaleCreatedEvent
  | SaleComplianceCheckedEvent
  | ListingCreatedEvent
  | ListingCancelledEvent
  | ListingExpiredEvent
  | BidPlacedEvent
  | BidAcceptedEvent
  | BidCancelledEvent
  | WashTradingDetectedEvent
  | WashTradingClearedEvent
  | ContentScreenedEvent
  | ContentReviewedEvent
  | NFTRiskAssessmentCreatedEvent
  | NFTRiskAssessmentReviewedEvent
  | NFTHighRiskAlertEvent
  | NFTTravelRuleCreatedEvent
  | NFTTravelRuleSentEvent
  | NFTTravelRuleAcknowledgedEvent
  | NFTTravelRuleFailedEvent
  | NFTCARFReportGeneratedEvent
  | NFTCARFReportSubmittedEvent
  | NFTCARFReportAcknowledgedEvent
  | NFTCARFReportRejectedEvent
  | RoyaltyPaidEvent
  | RoyaltyComplianceCheckEvent;

/**
 * Event type strings
 */
export type NFTComplianceEventType = NFTComplianceEvent['eventType'];

// ==================== KAFKA TOPICS ====================

/**
 * Kafka topic configuration
 */
export const NFT_COMPLIANCE_TOPICS = {
  // Inbound topics (from NFT marketplace)
  NFT_COLLECTIONS: 'nft.collections',
  NFT_TOKENS: 'nft.tokens',
  NFT_SALES: 'nft.sales',
  NFT_LISTINGS: 'nft.listings',
  NFT_BIDS: 'nft.bids',
  NFT_TRANSFERS: 'nft.transfers',

  // Compliance topics
  NFT_COMPLIANCE_EVENTS: 'nft.compliance.events',
  NFT_WASH_TRADING: 'nft.compliance.wash_trading',
  NFT_CONTENT_SCREENING: 'nft.compliance.content_screening',
  NFT_RISK_ASSESSMENTS: 'nft.compliance.risk_assessments',
  NFT_TRAVEL_RULE: 'nft.compliance.travel_rule',
  NFT_CARF: 'nft.compliance.carf',
  NFT_ROYALTIES: 'nft.compliance.royalties',

  // Alert topics
  NFT_HIGH_RISK_ALERTS: 'nft.compliance.high_risk_alerts',
  NFT_WASH_TRADING_ALERTS: 'nft.compliance.wash_trading_alerts',
  NFT_CONTENT_ALERTS: 'nft.compliance.content_alerts',

  // Dead letter queue
  NFT_COMPLIANCE_DLQ: 'nft.compliance.dlq',
} as const;

export type NFTComplianceTopic = typeof NFT_COMPLIANCE_TOPICS[keyof typeof NFT_COMPLIANCE_TOPICS];
