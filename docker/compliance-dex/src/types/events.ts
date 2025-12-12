/**
 * Event Types for DEX Compliance Service
 * Kafka event definitions for DEX compliance processing
 */

// ==================== BASE EVENT ====================

/**
 * Base event structure
 */
export interface BaseEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  tenantId: string;
  timestamp: Date;
  correlationId?: string;
  data: T;
}

// ==================== DEX TRANSACTION EVENTS ====================

/**
 * DEX swap event
 */
export interface DEXSwapEvent extends BaseEvent<{
  swapId: string;
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  protocol: string;
  poolAddress: string;
  tokenIn: {
    address: string;
    symbol: string;
    amount: string;
  };
  tokenOut: {
    address: string;
    symbol: string;
    amount: string;
  };
  amountInUSD: string;
  amountOutUSD: string;
  walletAddress: string;
  userId?: string;
  brokerId?: string;
}> {
  type: 'dex.swap';
}

/**
 * DEX liquidity event
 */
export interface DEXLiquidityEvent extends BaseEvent<{
  liquidityId: string;
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  protocol: string;
  poolAddress: string;
  action: 'add' | 'remove';
  token0: {
    address: string;
    symbol: string;
    amount: string;
  };
  token1: {
    address: string;
    symbol: string;
    amount: string;
  };
  lpTokenAmount: string;
  totalValueUSD: string;
  walletAddress: string;
  userId?: string;
  brokerId?: string;
}> {
  type: 'dex.liquidity';
}

/**
 * Bridge transaction event
 */
export interface BridgeTransactionEvent extends BaseEvent<{
  bridgeId: string;
  sourceChainId: number;
  destinationChainId: number;
  bridgeProtocol: string;
  sourceTransactionHash: string;
  token: {
    address: string;
    symbol: string;
    amount: string;
  };
  amountUSD: string;
  sourceWallet: string;
  destinationWallet: string;
  userId?: string;
  brokerId?: string;
}> {
  type: 'dex.bridge';
}

/**
 * Bridge completion event
 */
export interface BridgeCompletedEvent extends BaseEvent<{
  bridgeId: string;
  destinationTransactionHash: string;
  status: 'completed' | 'failed';
  errorMessage?: string;
}> {
  type: 'dex.bridge.completed';
}

// ==================== WALLET EVENTS ====================

/**
 * Wallet connected event
 */
export interface WalletConnectedEvent extends BaseEvent<{
  walletAddress: string;
  chainId: number;
  userId?: string;
  brokerId?: string;
  connectionMethod: 'metamask' | 'walletconnect' | 'coinbase' | 'other';
  ipAddress?: string;
  userAgent?: string;
}> {
  type: 'wallet.connected';
}

/**
 * Wallet screening requested event
 */
export interface WalletScreeningRequestedEvent extends BaseEvent<{
  walletAddress: string;
  chainId: number;
  userId?: string;
  brokerId?: string;
  reason: 'connection' | 'transaction' | 'periodic' | 'manual';
}> {
  type: 'wallet.screening.requested';
}

/**
 * Wallet screening completed event
 */
export interface WalletScreeningCompletedEvent extends BaseEvent<{
  screeningId: string;
  walletAddress: string;
  chainId: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  sanctionsMatch: boolean;
  screeningProvider: string;
  userId?: string;
  brokerId?: string;
}> {
  type: 'wallet.screening.completed';
}

// ==================== COMPLIANCE EVENTS ====================

/**
 * DEX risk assessment completed event
 */
export interface DEXRiskAssessmentCompletedEvent extends BaseEvent<{
  assessmentId: string;
  transactionId: string;
  transactionHash: string;
  walletAddress: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  assessmentDate: string;
  assessor: string;
  userId?: string;
  brokerId?: string;
}> {
  type: 'compliance.dex.risk_assessment.completed';
}

/**
 * DEX Travel Rule generated event
 */
export interface DEXTravelRuleGeneratedEvent extends BaseEvent<{
  travelRuleId: string;
  bridgeTransactionId: string;
  sourceChainId: number;
  destinationChainId: number;
  messageId: string;
  sourceWallet: string;
  destinationWallet: string;
  amount: string;
  amountUSD: string;
  token: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  userId?: string;
  brokerId?: string;
}> {
  type: 'compliance.dex.travel_rule.generated';
}

/**
 * DEX Travel Rule sent event
 */
export interface DEXTravelRuleSentEvent extends BaseEvent<{
  travelRuleId: string;
  messageId: string;
  status: 'sent' | 'acknowledged' | 'failed';
  responseTime?: number;
  errorMessage?: string;
}> {
  type: 'compliance.dex.travel_rule.sent';
}

/**
 * DEX CARF report generated event
 */
export interface DEXCARFReportGeneratedEvent extends BaseEvent<{
  reportId: string;
  walletAddress: string;
  reportIdExternal: string;
  totalSwapVolumeUSD: string;
  totalLiquidityProvidedUSD: string;
  totalBridgeVolumeUSD: string;
  transactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  userId?: string;
  brokerId?: string;
}> {
  type: 'compliance.dex.carf.generated';
}

/**
 * DEX CARF report submitted event
 */
export interface DEXCARFReportSubmittedEvent extends BaseEvent<{
  reportId: string;
  reportIdExternal: string;
  jurisdiction: string;
  submissionEndpoint: string;
  status: 'submitted' | 'acknowledged' | 'rejected';
  submissionDate: string;
  responseTime?: number;
  errorMessage?: string;
}> {
  type: 'compliance.dex.carf.submitted';
}

// ==================== PROTOCOL EVENTS ====================

/**
 * Protocol risk assessment event
 */
export interface ProtocolRiskAssessmentEvent extends BaseEvent<{
  assessmentId: string;
  protocol: string;
  chainId: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tvlUSD: string;
  isUpgradeable: boolean;
  hasTimelock: boolean;
  governanceType: string;
}> {
  type: 'compliance.dex.protocol.assessed';
}

// ==================== ALERT EVENTS ====================

/**
 * High risk alert event
 */
export interface HighRiskAlertEvent extends BaseEvent<{
  alertId: string;
  alertType: 'wallet' | 'transaction' | 'protocol' | 'bridge';
  entityId: string;
  entityType: string;
  riskScore: number;
  riskLevel: 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  requiresAction: boolean;
  userId?: string;
  brokerId?: string;
}> {
  type: 'compliance.dex.alert.high_risk';
}

/**
 * Sanctions match alert event
 */
export interface SanctionsMatchAlertEvent extends BaseEvent<{
  alertId: string;
  walletAddress: string;
  chainId: number;
  matchType: 'exact' | 'fuzzy' | 'associated';
  sanctionsList: string;
  matchDetails: Record<string, unknown>;
  userId?: string;
  brokerId?: string;
}> {
  type: 'compliance.dex.alert.sanctions_match';
}

// ==================== EVENT UNION TYPE ====================

/**
 * All DEX compliance events
 */
export type DEXComplianceEvent =
  | DEXSwapEvent
  | DEXLiquidityEvent
  | BridgeTransactionEvent
  | BridgeCompletedEvent
  | WalletConnectedEvent
  | WalletScreeningRequestedEvent
  | WalletScreeningCompletedEvent
  | DEXRiskAssessmentCompletedEvent
  | DEXTravelRuleGeneratedEvent
  | DEXTravelRuleSentEvent
  | DEXCARFReportGeneratedEvent
  | DEXCARFReportSubmittedEvent
  | ProtocolRiskAssessmentEvent
  | HighRiskAlertEvent
  | SanctionsMatchAlertEvent;
