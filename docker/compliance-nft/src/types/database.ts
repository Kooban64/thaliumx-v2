/**
 * Database Types for NFT Compliance Service
 * PostgreSQL table definitions for NFT compliance data
 */

export interface NftCollectionRow {
  id: string;
  contractAddress: string;
  chainId: number;
  name: string;
  symbol: string;
  description: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  externalUrl: string | null;
  creatorAddress: string;
  creatorFee: number;
  totalSupply: number;
  floorPrice: string | null;
  totalVolume: string | null;
  verified: boolean;
  riskScore: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftTokenRow {
  id: string;
  tokenId: string;
  contractAddress: string;
  chainId: number;
  collectionId: string;
  ownerAddress: string;
  creatorAddress: string;
  metadata: Record<string, unknown>;
  tokenUri: string;
  tokenStandard: 'ERC721' | 'ERC1155';
  supply: number | null;
  lastSalePrice: string | null;
  lastSaleCurrency: string | null;
  lastSaleDate: Date | null;
  riskScore: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
  flagged: boolean;
  flagReason: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftSaleRow {
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
  priceUsd: string;
  marketplace: string;
  saleType: 'fixed' | 'auction' | 'offer' | 'bundle';
  royaltyAmount: string | null;
  royaltyRecipient: string | null;
  platformFee: string | null;
  gasUsed: string;
  gasPrice: string;
  gasCostUsd: string;
  riskScore: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftListingRow {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  collectionId: string;
  sellerAddress: string;
  price: string;
  currency: string;
  priceUsd: string;
  marketplace: string;
  listingType: 'fixed' | 'auction' | 'dutch_auction';
  startTime: Date;
  endTime: Date | null;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftBidRow {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  collectionId: string;
  bidderAddress: string;
  amount: string;
  currency: string;
  amountUsd: string;
  marketplace: string;
  bidType: 'token' | 'collection' | 'trait';
  expirationTime: Date | null;
  status: 'active' | 'accepted' | 'cancelled' | 'expired' | 'outbid';
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WashTradingRow {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  detectionDate: Date;
  isWashTrading: boolean;
  confidence: number;
  indicators: string[];
  relatedTransactions: string[];
  relatedAddresses: string[];
  volumeInflation: string | null;
  priceManipulation: boolean | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentScreeningRow {
  id: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  screeningDate: Date;
  contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other';
  contentUrl: string;
  isFlagged: boolean;
  flagReasons: string[];
  moderationScore: number;
  categories: string[];
  manualReviewRequired: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoyaltyComplianceRow {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface NftRiskAssessmentRow {
  id: string;
  transactionId: string;
  transactionHash: string;
  contractAddress: string;
  tokenId: string;
  sellerAddress: string;
  buyerAddress: string;
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factorSellerRisk: number;
  factorBuyerRisk: number;
  factorCollectionRisk: number;
  factorPriceRisk: number;
  factorContentRisk: number;
  factorWashTradingRisk: number;
  factorMarketplaceRisk: number;
  factorGeographyRisk: number;
  flags: string[];
  recommendations: string[];
  assessmentDate: Date;
  assessor: string;
  reviewRequired: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  overrideReason: string | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftTravelRuleRow {
  id: string;
  saleId: string;
  contractAddress: string;
  tokenId: string;
  chainId: number;
  sellerAddress: string;
  buyerAddress: string;
  price: string;
  priceUsd: string;
  currency: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorName: string | null;
  originatorAddress: string | null;
  originatorCountry: string | null;
  originatorAccountNumber: string | null;
  beneficiaryName: string | null;
  beneficiaryAddress: string | null;
  beneficiaryCountry: string | null;
  beneficiaryAccountNumber: string | null;
  originatorVasp: string | null;
  beneficiaryVasp: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  tenantId: string;
  brokerId: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftCarfRow {
  id: string;
  reportId: string;
  walletAddress: string;
  userId: string | null;
  tenantId: string;
  brokerId: string | null;
  reportingPeriodStartDate: Date;
  reportingPeriodEndDate: Date;
  reportingPeriodFiscalYear: string | null;
  totalSalesVolumeUsd: string;
  totalPurchasesVolumeUsd: string;
  totalRoyaltiesReceivedUsd: string;
  totalRoyaltiesPaidUsd: string;
  netGainLossUsd: string;
  transactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate: Date | null;
  acknowledgmentDate: Date | null;
  rejectionReason: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NftCarfTransactionRow {
  id: string;
  carfReportId: string;
  transactionType: 'sale' | 'purchase' | 'mint' | 'transfer' | 'burn';
  transactionDate: Date;
  contractAddress: string;
  tokenId: string;
  collectionName: string;
  price: string;
  currency: string;
  priceUsd: string;
  transactionHash: string;
  chainId: number;
  marketplace: string;
  counterparty: string;
  gainLoss: string | null;
  createdAt: Date;
}

export interface NftComplianceEventRow {
  id: string;
  eventType: string;
  entityType: 'collection' | 'token' | 'sale' | 'listing' | 'bid' | 'wash_trading' | 'content' | 'assessment' | 'travel_rule' | 'carf';
  entityId: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  tenantId: string;
  brokerId: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface NftAuditLogRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorType: 'user' | 'system' | 'admin';
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  tenantId: string;
  createdAt: Date;
}

export interface NftMigrationRow {
  id: number;
  name: string;
  executedAt: Date;
}

export type NFTCollectionTable = NftCollectionRow;
export type NFTTokenTable = NftTokenRow;
export type NFTSaleTable = NftSaleRow;
export type NFTListingTable = NftListingRow;
export type NFTBidTable = NftBidRow;
export type WashTradingTable = WashTradingRow;
export type ContentScreeningTable = ContentScreeningRow;
export type RoyaltyComplianceTable = RoyaltyComplianceRow;
export type NFTRiskAssessmentTable = NftRiskAssessmentRow;
export type NFTTravelRuleTable = NftTravelRuleRow;
export type NFTCARFTable = NftCarfRow;
export type NFTCARFTransactionTable = NftCarfTransactionRow;
export type NFTComplianceEventTable = NftComplianceEventRow;
export type NFTAuditLogTable = NftAuditLogRow;
export type NFTMigrationsTable = NftMigrationRow;
