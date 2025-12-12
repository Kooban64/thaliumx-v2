/**
 * DEX Compliance Types
 * Specialized types for decentralized exchange compliance
 */

// ==================== DEX-SPECIFIC TYPES ====================

/**
 * DEX swap transaction data
 */
export interface DEXSwapData {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  chainId: number;
  protocol: string; // e.g., 'uniswap', 'sushiswap', 'curve'
  poolAddress: string;
  tokenIn: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  amountInUSD: string;
  amountOutUSD: string;
  priceImpact: string;
  slippage: string;
  gasUsed: string;
  gasPrice: string;
  gasCostUSD: string;
  walletAddress: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
}

/**
 * DEX liquidity provision data
 */
export interface DEXLiquidityData {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  chainId: number;
  protocol: string;
  poolAddress: string;
  action: 'add' | 'remove';
  token0: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  lpTokenAmount: string;
  totalValueUSD: string;
  walletAddress: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
}

/**
 * Smart contract interaction data
 */
export interface SmartContractInteraction {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  chainId: number;
  contractAddress: string;
  contractName?: string;
  methodName: string;
  methodSignature: string;
  inputData: string;
  outputData?: string;
  valueETH: string;
  valueUSD: string;
  gasUsed: string;
  status: 'success' | 'failed' | 'pending';
  walletAddress: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Wallet screening result
 */
export interface WalletScreeningResult {
  id: string;
  walletAddress: string;
  chainId: number;
  screeningDate: Date;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: WalletRiskFlag[];
  sanctionsMatch: boolean;
  mixerInteraction: boolean;
  darknetInteraction: boolean;
  scamInteraction: boolean;
  highRiskExchangeInteraction: boolean;
  totalTransactions: number;
  totalVolumeUSD: string;
  firstTransactionDate?: Date;
  lastTransactionDate?: Date;
  associatedAddresses: string[];
  screeningProvider: string;
  rawResponse?: Record<string, unknown>;
}

/**
 * Wallet risk flags
 */
export type WalletRiskFlag =
  | 'sanctions_match'
  | 'mixer_interaction'
  | 'darknet_interaction'
  | 'scam_interaction'
  | 'high_risk_exchange'
  | 'stolen_funds'
  | 'ransomware'
  | 'terrorist_financing'
  | 'child_exploitation'
  | 'fraud'
  | 'gambling'
  | 'high_risk_jurisdiction'
  | 'newly_created'
  | 'unusual_activity'
  | 'contract_interaction_risk';

/**
 * DEX protocol risk assessment
 */
export interface ProtocolRiskAssessment {
  id: string;
  protocol: string;
  chainId: number;
  assessmentDate: Date;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    auditStatus: number;
    tvlRisk: number;
    ageRisk: number;
    governanceRisk: number;
    oracleRisk: number;
    upgradeabilityRisk: number;
    concentrationRisk: number;
    regulatoryRisk: number;
  };
  audits: Array<{
    auditor: string;
    date: Date;
    findings: number;
    criticalFindings: number;
  }>;
  tvlUSD: string;
  launchDate: Date;
  isUpgradeable: boolean;
  hasTimelock: boolean;
  governanceType: 'multisig' | 'dao' | 'centralized' | 'none';
}

/**
 * Cross-chain bridge transaction
 */
export interface BridgeTransaction {
  id: string;
  sourceChainId: number;
  destinationChainId: number;
  bridgeProtocol: string;
  sourceTransactionHash: string;
  destinationTransactionHash?: string;
  timestamp: Date;
  token: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  amountUSD: string;
  sourceWallet: string;
  destinationWallet: string;
  status: 'pending' | 'completed' | 'failed';
  bridgeFeeUSD: string;
  userId?: string;
  tenantId: string;
  riskScore?: number;
  riskFlags?: WalletRiskFlag[];
}

// ==================== COMMON COMPLIANCE TYPES ====================

/**
 * Risk factors for DEX transactions
 */
export interface DEXRiskFactors {
  walletRisk: number;
  protocolRisk: number;
  transactionRisk: number;
  geographyRisk: number;
  patternRisk: number;
  velocityRisk: number;
  concentrationRisk: number;
  counterpartyRisk: number;
}

/**
 * DEX risk flags
 */
export type DEXRiskFlag =
  | WalletRiskFlag
  | 'high_slippage'
  | 'sandwich_attack'
  | 'front_running'
  | 'flash_loan'
  | 'rug_pull_risk'
  | 'unverified_contract'
  | 'proxy_contract'
  | 'honeypot_risk'
  | 'low_liquidity'
  | 'price_manipulation'
  | 'wash_trading';

/**
 * DEX risk recommendations
 */
export type DEXRiskRecommendation =
  | 'block_transaction'
  | 'enhanced_monitoring'
  | 'wallet_screening'
  | 'manual_review'
  | 'report_to_authorities'
  | 'freeze_funds'
  | 'contact_user'
  | 'protocol_review'
  | 'chain_analysis'
  | 'source_of_funds_verification';

/**
 * DEX risk assessment result
 */
export interface DEXRiskAssessmentData {
  id: string;
  transactionId: string;
  transactionHash: string;
  walletAddress: string;
  userId?: string;
  tenantId: string;
  brokerId?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: DEXRiskFactors;
  flags: DEXRiskFlag[];
  recommendations: DEXRiskRecommendation[];
  assessmentDate: Date;
  assessor: string;
  reviewRequired: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  overrideReason?: string;
}

/**
 * DEX Travel Rule data (for cross-chain transfers)
 */
export interface DEXTravelRuleData {
  id: string;
  bridgeTransactionId: string;
  sourceChainId: number;
  destinationChainId: number;
  sourceWallet: string;
  destinationWallet: string;
  amount: string;
  amountUSD: string;
  token: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: {
    name?: string;
    address?: string;
    country?: string;
    accountNumber?: string;
  };
  beneficiaryInfo?: {
    name?: string;
    address?: string;
    country?: string;
    accountNumber?: string;
  };
  vaspInfo?: {
    originatorVASP?: string;
    beneficiaryVASP?: string;
  };
  tenantId: string;
  brokerId?: string;
  userId?: string;
}

/**
 * DEX CARF reporting data
 */
export interface DEXCARFData {
  id: string;
  reportId: string;
  walletAddress: string;
  userId?: string;
  tenantId: string;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
    fiscalYear?: string;
  };
  transactions: Array<{
    type: 'swap' | 'liquidity_add' | 'liquidity_remove' | 'bridge' | 'stake' | 'unstake';
    date: Date;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    valueUSD: string;
    transactionHash: string;
    chainId: number;
    protocol: string;
  }>;
  totalSwapVolumeUSD: string;
  totalLiquidityProvidedUSD: string;
  totalBridgeVolumeUSD: string;
  totalFeesUSD: string;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submissionDate?: Date;
  acknowledgmentDate?: Date;
  rejectionReason?: string;
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
 * DEX Compliance configuration
 */
export interface DEXComplianceConfig {
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

  walletScreening: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    cacheTimeout: number;
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
