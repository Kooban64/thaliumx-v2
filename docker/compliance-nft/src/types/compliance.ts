/**
 * NFT Compliance Types
 * Specialized types for NFT marketplace compliance
 */

// ==================== NFT-SPECIFIC TYPES ====================

/**
 * NFT metadata
 */
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  externalUrl?: string;
  attributes?: Array<{
    traitType: string;
    value: string | number;
  }>;
  animationUrl?: string;
  backgroundColor?: string;
}

/**
 * NFT collection data
 */
export interface NFTCollection {
  id: string;
  contractAddress: string;
  chainId: number;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  externalUrl?: string;
  creatorAddress: string;
  creatorFee: number; // Percentage (e.g., 2.5 = 2.5%)
  totalSupply: number;
  floorPrice?: string;
  totalVolume?: string;
  verified: boolean;
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NFT token data
 */
export interface NFTToken {
  id: string;
  tokenId: string;
  contractAddress: string;
  chainId: number;
  collectionId: string;
  ownerAddress: string;
  creatorAddress: string;
  metadata: NFTMetadata;
  tokenUri: string;
  tokenStandard: 'ERC721' | 'ERC1155';
  supply?: number; // For ERC1155
  lastSalePrice?: string;
  lastSaleCurrency?: string;
  lastSaleDate?: Date;
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  flagged: boolean;
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NFT sale/transfer data
 */
export interface NFTSale {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
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
  royaltyAmount?: string;
  royaltyRecipient?: string;
  platformFee?: string;
  gasUsed: string;
  gasPrice: string;
  gasCostUSD: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
}

/**
 * NFT listing data
 */
export interface NFTListing {
  id: string;
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
  endTime?: Date;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  userId?: string;
  tenantId: string;
  brokerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NFT bid/offer data
 */
export interface NFTBid {
  id: string;
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
  expirationTime?: Date;
  status: 'active' | 'accepted' | 'cancelled' | 'expired' | 'outbid';
  userId?: string;
  tenantId: string;
  brokerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * NFT wash trading detection result
 */
export interface WashTradingResult {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  detectionDate: Date;
  isWashTrading: boolean;
  confidence: number; // 0-100
  indicators: WashTradingIndicator[];
  relatedTransactions: string[];
  relatedAddresses: string[];
  volumeInflation?: string | undefined;
  priceManipulation?: boolean | undefined;
  tenantId: string;
}

/**
 * Wash trading indicators
 */
export type WashTradingIndicator =
  | 'self_trading'
  | 'circular_trading'
  | 'rapid_flipping'
  | 'price_manipulation'
  | 'volume_inflation'
  | 'related_wallets'
  | 'funding_pattern'
  | 'timing_pattern'
  | 'gas_funding'
  | 'new_wallet_activity';

/**
 * NFT content screening result
 */
export interface ContentScreeningResult {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  screeningDate: Date;
  contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other';
  contentUrl: string;
  isFlagged: boolean;
  flagReasons: ContentFlag[];
  moderationScore: number; // 0-100
  categories: ContentCategory[];
  manualReviewRequired: boolean;
  reviewedBy?: string | undefined;
  reviewedAt?: Date | undefined;
  reviewNotes?: string | undefined;
  tenantId: string;
}

/**
 * Content flags
 */
export type ContentFlag =
  | 'adult_content'
  | 'violence'
  | 'hate_speech'
  | 'copyright_violation'
  | 'trademark_violation'
  | 'counterfeit'
  | 'stolen_art'
  | 'illegal_content'
  | 'spam'
  | 'scam'
  | 'misleading';

/**
 * Content categories
 */
export type ContentCategory =
  | 'art'
  | 'photography'
  | 'music'
  | 'video'
  | 'gaming'
  | 'collectibles'
  | 'sports'
  | 'utility'
  | 'domain'
  | 'virtual_world'
  | 'other';

/**
 * NFT royalty compliance data
 */
export interface RoyaltyCompliance {
  id: string;
  contractAddress: string;
  chainId: number;
  collectionId: string;
  royaltyPercentage: number;
  royaltyRecipient: string;
  enforcementType: 'on_chain' | 'marketplace' | 'none';
  isCompliant: boolean;
  totalRoyaltiesPaid: string;
  totalRoyaltiesOwed: string;
  unpaidRoyalties: string;
  lastChecked: Date;
  tenantId: string;
}

// ==================== RISK ASSESSMENT TYPES ====================

/**
 * NFT risk factors
 */
export interface NFTRiskFactors {
  sellerRisk: number;
  buyerRisk: number;
  collectionRisk: number;
  priceRisk: number;
  contentRisk: number;
  washTradingRisk: number;
  marketplaceRisk: number;
  geographyRisk: number;
}

/**
 * NFT risk flags
 */
export type NFTRiskFlag =
  | 'sanctions_match'
  | 'high_risk_wallet'
  | 'wash_trading'
  | 'price_manipulation'
  | 'stolen_nft'
  | 'counterfeit'
  | 'copyright_violation'
  | 'adult_content'
  | 'illegal_content'
  | 'unverified_collection'
  | 'suspicious_activity'
  | 'rapid_flipping'
  | 'new_wallet'
  | 'high_value_transaction'
  | 'cross_chain_transfer';

/**
 * NFT risk recommendations
 */
export type NFTRiskRecommendation =
  | 'block_transaction'
  | 'enhanced_monitoring'
  | 'manual_review'
  | 'content_review'
  | 'report_to_authorities'
  | 'freeze_nft'
  | 'contact_user'
  | 'verify_ownership'
  | 'verify_authenticity'
  | 'source_of_funds_verification';

/**
 * NFT risk assessment result
 */
export interface NFTRiskAssessmentData {
  id: string;
  transactionId: string;
  transactionHash: string;
  contractAddress: string;
  tokenId: string;
  sellerAddress: string;
  buyerAddress: string;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: NFTRiskFactors;
  flags: NFTRiskFlag[];
  recommendations: NFTRiskRecommendation[];
  assessmentDate: Date;
  assessor: string;
  reviewRequired: boolean;
  reviewedBy?: string | undefined;
  reviewedAt?: Date | undefined;
  reviewNotes?: string | undefined;
  overrideReason?: string | undefined;
}

// ==================== TRAVEL RULE TYPES ====================

/**
 * NFT Travel Rule data (for high-value NFT transfers)
 */
export interface NFTTravelRuleData {
  id: string;
  saleId: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  sellerAddress: string;
  buyerAddress: string;
  price: string;
  priceUSD: string;
  currency: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: {
    name?: string | undefined;
    address?: string | undefined;
    country?: string | undefined;
    accountNumber?: string | undefined;
  } | undefined;
  beneficiaryInfo?: {
    name?: string | undefined;
    address?: string | undefined;
    country?: string | undefined;
    accountNumber?: string | undefined;
  } | undefined;
  vaspInfo?: {
    originatorVASP?: string | undefined;
    beneficiaryVASP?: string | undefined;
  } | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
}

// ==================== CARF TYPES ====================

/**
 * NFT CARF reporting data
 */
export interface NFTCARFData {
  id: string;
  reportId: string;
  walletAddress: string;
  userId?: string | undefined;
  tenantId: string;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
    fiscalYear?: string | undefined;
  };
  transactions: Array<{
    type: 'sale' | 'purchase' | 'mint' | 'transfer' | 'burn';
    date: Date;
    contractAddress: string;
    tokenId: string;
    collectionName: string;
    price: string;
    currency: string;
    priceUSD: string;
    transactionHash: string;
    chainId: number;
    marketplace: string;
    counterparty: string;
    gainLoss?: string | undefined;
  }>;
  totalSalesVolumeUSD: string;
  totalPurchasesVolumeUSD: string;
  totalRoyaltiesReceivedUSD: string;
  totalRoyaltiesPaidUSD: string;
  netGainLossUSD: string;
  transactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate?: Date | undefined;
  acknowledgmentDate?: Date | undefined;
  rejectionReason?: string | undefined;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SERVICE HEALTH ====================

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    latency: number;
  };
  redis: {
    status: 'connected' | 'degraded' | 'disconnected';
    latency: number;
  };
  kafka: {
    status: 'connected' | 'disconnected';
    topics: string[];
  };
  blockchain: {
    status: 'connected' | 'degraded' | 'disconnected';
    chains: Array<{
      chainId: number;
      name: string;
      blockNumber: number;
      latency: number;
    }>;
  };
  compliance: {
    pendingScreenings: number;
    pendingAssessments: number;
    highRiskAlerts: number;
  };
}

// ==================== CONFIGURATION ====================

/**
 * NFT Compliance configuration
 */
export interface NFTComplianceConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  port: number;

  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };

  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };

  blockchain: {
    providers: Array<{
      chainId: number;
      name: string;
      rpcUrl: string;
      wsUrl?: string;
    }>;
    confirmations: number;
    pollingInterval: number;
  };

  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  contentScreening: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    autoFlag: boolean;
  };

  washTradingDetection: {
    enabled: boolean;
    lookbackDays: number;
    minConfidence: number;
  };

  travelRule: {
    enabled: boolean;
    thresholdAmount: number;
    autoSend: boolean;
    maxRetries: number;
    retryDelayMs: number;
  };

  carf: {
    enabled: boolean;
    autoGenerate: boolean;
    reportingPeriodDays: number;
    retentionYears: number;
  };

  regulatory: {
    jurisdictions: string[];
    autoSubmit: boolean;
    submissionEndpoints: Record<string, string>;
  };
}
