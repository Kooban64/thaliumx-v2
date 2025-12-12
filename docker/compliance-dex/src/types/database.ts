/**
 * Database Types for DEX Compliance Service
 * PostgreSQL table definitions for DEX compliance data
 */

// ==================== WALLET SCREENING TABLE ====================

/**
 * Wallet screening results table
 */
export interface WalletScreeningTable {
  id: string;
  wallet_address: string;
  chain_id: number;
  screening_date: Date;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  sanctions_match: boolean;
  mixer_interaction: boolean;
  darknet_interaction: boolean;
  scam_interaction: boolean;
  high_risk_exchange_interaction: boolean;
  total_transactions: number;
  total_volume_usd: string;
  first_transaction_date: Date | null;
  last_transaction_date: Date | null;
  associated_addresses: string[];
  screening_provider: string;
  raw_response: Record<string, unknown> | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX SWAP TABLE ====================

/**
 * DEX swap transactions table
 */
export interface DEXSwapTable {
  id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  chain_id: number;
  protocol: string;
  pool_address: string;
  token_in_address: string;
  token_in_symbol: string;
  token_in_amount: string;
  token_in_decimals: number;
  token_out_address: string;
  token_out_symbol: string;
  token_out_amount: string;
  token_out_decimals: number;
  amount_in_usd: string;
  amount_out_usd: string;
  price_impact: string;
  slippage: string;
  gas_used: string;
  gas_price: string;
  gas_cost_usd: string;
  wallet_address: string;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX LIQUIDITY TABLE ====================

/**
 * DEX liquidity provision table
 */
export interface DEXLiquidityTable {
  id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  chain_id: number;
  protocol: string;
  pool_address: string;
  action: 'add' | 'remove';
  token0_address: string;
  token0_symbol: string;
  token0_amount: string;
  token0_decimals: number;
  token1_address: string;
  token1_symbol: string;
  token1_amount: string;
  token1_decimals: number;
  lp_token_amount: string;
  total_value_usd: string;
  wallet_address: string;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== BRIDGE TRANSACTION TABLE ====================

/**
 * Cross-chain bridge transactions table
 */
export interface BridgeTransactionTable {
  id: string;
  source_chain_id: number;
  destination_chain_id: number;
  bridge_protocol: string;
  source_transaction_hash: string;
  destination_transaction_hash: string | null;
  timestamp: Date;
  token_address: string;
  token_symbol: string;
  token_amount: string;
  token_decimals: number;
  amount_usd: string;
  source_wallet: string;
  destination_wallet: string;
  status: 'pending' | 'completed' | 'failed';
  bridge_fee_usd: string;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  risk_flags: string[] | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== PROTOCOL RISK TABLE ====================

/**
 * Protocol risk assessments table
 */
export interface ProtocolRiskTable {
  id: string;
  protocol: string;
  chain_id: number;
  assessment_date: Date;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factor_audit_status: number;
  factor_tvl_risk: number;
  factor_age_risk: number;
  factor_governance_risk: number;
  factor_oracle_risk: number;
  factor_upgradeability_risk: number;
  factor_concentration_risk: number;
  factor_regulatory_risk: number;
  audits: Array<{
    auditor: string;
    date: string;
    findings: number;
    criticalFindings: number;
  }>;
  tvl_usd: string;
  launch_date: Date;
  is_upgradeable: boolean;
  has_timelock: boolean;
  governance_type: 'multisig' | 'dao' | 'centralized' | 'none';
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX RISK ASSESSMENT TABLE ====================

/**
 * DEX risk assessments table
 */
export interface DEXRiskAssessmentTable {
  id: string;
  transaction_id: string;
  transaction_hash: string;
  wallet_address: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factor_wallet_risk: number;
  factor_protocol_risk: number;
  factor_transaction_risk: number;
  factor_geography_risk: number;
  factor_pattern_risk: number;
  factor_velocity_risk: number;
  factor_concentration_risk: number;
  factor_counterparty_risk: number;
  flags: string[];
  recommendations: string[];
  assessment_date: Date;
  assessor: string;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  override_reason: string | null;
  valid_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX TRAVEL RULE TABLE ====================

/**
 * DEX Travel Rule messages table (for cross-chain transfers)
 */
export interface DEXTravelRuleTable {
  id: string;
  bridge_transaction_id: string;
  source_chain_id: number;
  destination_chain_id: number;
  source_wallet: string;
  destination_wallet: string;
  amount: string;
  amount_usd: string;
  token: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  message_id: string;
  originator_name: string | null;
  originator_address: string | null;
  originator_country: string | null;
  originator_account_number: string | null;
  beneficiary_name: string | null;
  beneficiary_address: string | null;
  beneficiary_country: string | null;
  beneficiary_account_number: string | null;
  originator_vasp: string | null;
  beneficiary_vasp: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX CARF TABLE ====================

/**
 * DEX CARF reports table
 */
export interface DEXCARFTable {
  id: string;
  report_id: string;
  wallet_address: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  reporting_period_fiscal_year: string | null;
  total_swap_volume_usd: string;
  total_liquidity_provided_usd: string;
  total_bridge_volume_usd: string;
  total_fees_usd: string;
  transaction_count: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submission_date: Date | null;
  acknowledgment_date: Date | null;
  rejection_reason: string | null;
  version: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== DEX CARF TRANSACTIONS TABLE ====================

/**
 * DEX CARF report transactions table
 */
export interface DEXCARFTransactionTable {
  id: string;
  carf_report_id: string;
  transaction_type: 'swap' | 'liquidity_add' | 'liquidity_remove' | 'bridge' | 'stake' | 'unstake';
  transaction_date: Date;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  value_usd: string;
  transaction_hash: string;
  chain_id: number;
  protocol: string;
  created_at: Date;
}

// ==================== COMPLIANCE EVENTS TABLE ====================

/**
 * Compliance events log table
 */
export interface DEXComplianceEventTable {
  id: string;
  event_type: string;
  entity_type: 'wallet' | 'swap' | 'liquidity' | 'bridge' | 'protocol' | 'assessment' | 'travel_rule' | 'carf';
  entity_id: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  tenant_id: string;
  broker_id: string | null;
  user_id: string | null;
  created_at: Date;
}

// ==================== AUDIT LOG TABLE ====================

/**
 * Audit log table
 */
export interface DEXAuditLogTable {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_id: string;
  actor_type: 'user' | 'system' | 'admin';
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  tenant_id: string;
  created_at: Date;
}

// ==================== MIGRATIONS TABLE ====================

/**
 * Migrations tracking table
 */
export interface DEXMigrationsTable {
  id: number;
  name: string;
  executed_at: Date;
}
