/**
 * Token Compliance Types
 * Specialized types for token (ERC20/ERC777) compliance
 */

// ==================== TOKEN-SPECIFIC TYPES ====================

/**
 * Token metadata
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  contractAddress: string;
  chainId: number;
  standard: 'ERC20' | 'ERC777' | 'BEP20' | 'TRC20';
  logoUrl?: string | undefined;
  website?: string | undefined;
  description?: string | undefined;
}

/**
 * Token contract data
 */
export interface TokenContract {
  id: string;
  contractAddress: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  standard: 'ERC20' | 'ERC777' | 'BEP20' | 'TRC20';
  deployerAddress: string;
  deploymentBlock: number;
  deploymentDate: Date;
  verified: boolean;
  isProxy: boolean;
  implementationAddress?: string | undefined;
  riskScore?: number | undefined;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token holder data
 */
export interface TokenHolder {
  id: string;
  contractAddress: string;
  chainId: number;
  holderAddress: string;
  balance: string;
  balanceUSD: string;
  percentageOfSupply: number;
  firstAcquisitionDate: Date;
  lastTransactionDate: Date;
  transactionCount: number;
  isContract: boolean;
  isExchange: boolean;
  isWhale: boolean;
  riskScore?: number | undefined;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  userId?: string | undefined;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token transfer data
 */
export interface TokenTransfer {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  chainId: number;
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  transferType: 'transfer' | 'mint' | 'burn' | 'approval';
  gasUsed: string;
  gasPrice: string;
  gasCostUSD: string;
  riskScore?: number | undefined;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
}

/**
 * Token approval data
 */
export interface TokenApproval {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  chainId: number;
  contractAddress: string;
  ownerAddress: string;
  spenderAddress: string;
  amount: string;
  isUnlimited: boolean;
  spenderType: 'dex' | 'bridge' | 'lending' | 'unknown';
  riskScore?: number | undefined;
  userId?: string | undefined;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token presale data
 */
export interface TokenPresale {
  id: string;
  contractAddress: string;
  chainId: number;
  presaleAddress: string;
  tokenPrice: string;
  tokenPriceUSD: string;
  softCap: string;
  hardCap: string;
  minContribution: string;
  maxContribution: string;
  startTime: Date;
  endTime: Date;
  vestingSchedule?: VestingSchedule | undefined;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled' | 'failed';
  totalRaised: string;
  participantCount: number;
  kycRequired: boolean;
  whitelistRequired: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vesting schedule
 */
export interface VestingSchedule {
  cliffDuration: number; // seconds
  vestingDuration: number; // seconds
  tgePercentage: number; // percentage released at TGE
  vestingPercentage: number; // percentage vested over time
  vestingInterval: number; // seconds between releases
}

/**
 * Token presale contribution
 */
export interface PresaleContribution {
  id: string;
  presaleId: string;
  contributorAddress: string;
  amount: string;
  amountUSD: string;
  tokenAmount: string;
  transactionHash: string;
  timestamp: Date;
  claimedAmount: string;
  unclaimedAmount: string;
  nextClaimDate?: Date | undefined;
  userId?: string | undefined;
  tenantId: string;
  createdAt: Date;
}

// ==================== RISK ASSESSMENT TYPES ====================

/**
 * Token risk factors
 */
export interface TokenRiskFactors {
  senderRisk: number;
  recipientRisk: number;
  tokenRisk: number;
  amountRisk: number;
  velocityRisk: number;
  patternRisk: number;
  geographyRisk: number;
  contractRisk: number;
}

/**
 * Token risk flags
 */
export type TokenRiskFlag =
  | 'sanctions_match'
  | 'high_risk_wallet'
  | 'mixer_interaction'
  | 'bridge_interaction'
  | 'tornado_cash'
  | 'stolen_funds'
  | 'scam_token'
  | 'honeypot'
  | 'rug_pull_risk'
  | 'whale_movement'
  | 'unusual_volume'
  | 'rapid_transfers'
  | 'new_wallet'
  | 'high_value_transfer'
  | 'cross_chain_transfer'
  | 'unlimited_approval'
  | 'suspicious_contract';

/**
 * Token risk recommendations
 */
export type TokenRiskRecommendation =
  | 'block_transfer'
  | 'enhanced_monitoring'
  | 'manual_review'
  | 'report_to_authorities'
  | 'freeze_account'
  | 'contact_user'
  | 'verify_source_of_funds'
  | 'revoke_approval'
  | 'limit_transaction_size'
  | 'require_additional_kyc';

/**
 * Token risk assessment result
 */
export interface TokenRiskAssessmentData {
  id: string;
  transferId: string;
  transactionHash: string;
  contractAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  userId?: string | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: TokenRiskFactors;
  flags: TokenRiskFlag[];
  recommendations: TokenRiskRecommendation[];
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
 * Token Travel Rule data
 */
export interface TokenTravelRuleData {
  id: string;
  transferId: string;
  transactionHash: string;
  contractAddress: string;
  tokenSymbol: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: {
    name?: string | undefined;
    address?: string | undefined;
    country?: string | undefined;
    accountNumber?: string | undefined;
    dateOfBirth?: string | undefined;
    placeOfBirth?: string | undefined;
    nationalId?: string | undefined;
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
    originatorVASPLEI?: string | undefined;
    beneficiaryVASPLEI?: string | undefined;
  } | undefined;
  tenantId: string;
  brokerId?: string | undefined;
  userId?: string | undefined;
}

// ==================== CARF TYPES ====================

/**
 * Token CARF reporting data
 */
export interface TokenCARFData {
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
  holdings: Array<{
    contractAddress: string;
    tokenSymbol: string;
    chainId: number;
    balance: string;
    balanceUSD: string;
    costBasis: string;
    unrealizedGainLoss: string;
  }>;
  transactions: Array<{
    type: 'transfer_in' | 'transfer_out' | 'swap' | 'stake' | 'unstake' | 'claim';
    date: Date;
    contractAddress: string;
    tokenSymbol: string;
    amount: string;
    amountUSD: string;
    transactionHash: string;
    chainId: number;
    counterparty: string;
    gainLoss?: string | undefined;
    costBasis?: string | undefined;
  }>;
  totalTransferInUSD: string;
  totalTransferOutUSD: string;
  totalSwapVolumeUSD: string;
  totalStakingRewardsUSD: string;
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

// ==================== WALLET SCREENING TYPES ====================

/**
 * Wallet screening result
 */
export interface WalletScreeningResult {
  id: string;
  walletAddress: string;
  chainId: number;
  screeningDate: Date;
  provider: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: WalletFlag[];
  sanctionsMatch: boolean;
  sanctionsDetails?: SanctionsMatch[] | undefined;
  mixerExposure: number;
  darknetExposure: number;
  gamblingExposure: number;
  scamExposure: number;
  stolenFundsExposure: number;
  recommendations: string[];
  tenantId: string;
}

/**
 * Wallet flags
 */
export type WalletFlag =
  | 'ofac_sanctions'
  | 'eu_sanctions'
  | 'un_sanctions'
  | 'mixer_usage'
  | 'tornado_cash'
  | 'darknet_market'
  | 'ransomware'
  | 'scam'
  | 'phishing'
  | 'stolen_funds'
  | 'gambling'
  | 'high_risk_exchange'
  | 'unhosted_wallet'
  | 'smart_contract_risk';

/**
 * Sanctions match details
 */
export interface SanctionsMatch {
  listName: string;
  entityName: string;
  matchScore: number;
  matchType: 'exact' | 'fuzzy' | 'alias';
  listingDate: Date;
  listingReason: string;
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
    status: 'connected' | 'disconnected';
    latency: number;
  };
  kafka: {
    status: 'connected' | 'disconnected';
    topics: string[];
  };
  blockchain: {
    status: 'connected' | 'disconnected';
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
 * Token Compliance configuration
 */
export interface TokenComplianceConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  port: number;

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

  walletScreening: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    cacheExpiry: number;
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
