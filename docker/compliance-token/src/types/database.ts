/**
 * Database Types for Token Compliance Service
 * PostgreSQL table definitions for token compliance data
 */

// ==================== TOKEN CONTRACT TABLE ====================

/**
 * Token contracts table
 */
export interface TokenContractTable {
  id: string;
  contract_address: string;
  chain_id: number;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  standard: 'ERC20' | 'ERC777' | 'BEP20' | 'TRC20';
  deployer_address: string;
  deployment_block: number;
  deployment_date: Date;
  verified: boolean;
  is_proxy: boolean;
  implementation_address: string | null;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN HOLDER TABLE ====================

/**
 * Token holders table
 */
export interface TokenHolderTable {
  id: string;
  contract_address: string;
  chain_id: number;
  holder_address: string;
  balance: string;
  balance_usd: string;
  percentage_of_supply: number;
  first_acquisition_date: Date;
  last_transaction_date: Date;
  transaction_count: number;
  is_contract: boolean;
  is_exchange: boolean;
  is_whale: boolean;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  user_id: string | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN TRANSFER TABLE ====================

/**
 * Token transfers table
 */
export interface TokenTransferTable {
  id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  chain_id: number;
  contract_address: string;
  token_symbol: string;
  token_decimals: number;
  from_address: string;
  to_address: string;
  amount: string;
  amount_usd: string;
  transfer_type: 'transfer' | 'mint' | 'burn' | 'approval';
  gas_used: string;
  gas_price: string;
  gas_cost_usd: string;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN APPROVAL TABLE ====================

/**
 * Token approvals table
 */
export interface TokenApprovalTable {
  id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  chain_id: number;
  contract_address: string;
  owner_address: string;
  spender_address: string;
  amount: string;
  is_unlimited: boolean;
  spender_type: 'dex' | 'bridge' | 'lending' | 'unknown';
  risk_score: number | null;
  user_id: string | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN PRESALE TABLE ====================

/**
 * Token presales table
 */
export interface TokenPresaleTable {
  id: string;
  contract_address: string;
  chain_id: number;
  presale_address: string;
  token_price: string;
  token_price_usd: string;
  soft_cap: string;
  hard_cap: string;
  min_contribution: string;
  max_contribution: string;
  start_time: Date;
  end_time: Date;
  cliff_duration: number | null;
  vesting_duration: number | null;
  tge_percentage: number | null;
  vesting_percentage: number | null;
  vesting_interval: number | null;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled' | 'failed';
  total_raised: string;
  participant_count: number;
  kyc_required: boolean;
  whitelist_required: boolean;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== PRESALE CONTRIBUTION TABLE ====================

/**
 * Presale contributions table
 */
export interface PresaleContributionTable {
  id: string;
  presale_id: string;
  contributor_address: string;
  amount: string;
  amount_usd: string;
  token_amount: string;
  transaction_hash: string;
  timestamp: Date;
  claimed_amount: string;
  unclaimed_amount: string;
  next_claim_date: Date | null;
  user_id: string | null;
  tenant_id: string;
  created_at: Date;
}

// ==================== WALLET SCREENING TABLE ====================

/**
 * Wallet screenings table
 */
export interface WalletScreeningTable {
  id: string;
  wallet_address: string;
  chain_id: number;
  screening_date: Date;
  provider: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  sanctions_match: boolean;
  sanctions_details: Record<string, unknown>[] | null;
  mixer_exposure: number;
  darknet_exposure: number;
  gambling_exposure: number;
  scam_exposure: number;
  stolen_funds_exposure: number;
  recommendations: string[];
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN RISK ASSESSMENT TABLE ====================

/**
 * Token risk assessments table
 */
export interface TokenRiskAssessmentTable {
  id: string;
  transfer_id: string;
  transaction_hash: string;
  contract_address: string;
  from_address: string;
  to_address: string;
  amount: string;
  amount_usd: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factor_sender_risk: number;
  factor_recipient_risk: number;
  factor_token_risk: number;
  factor_amount_risk: number;
  factor_velocity_risk: number;
  factor_pattern_risk: number;
  factor_geography_risk: number;
  factor_contract_risk: number;
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

// ==================== TOKEN TRAVEL RULE TABLE ====================

/**
 * Token Travel Rule messages table
 */
export interface TokenTravelRuleTable {
  id: string;
  transfer_id: string;
  transaction_hash: string;
  contract_address: string;
  token_symbol: string;
  chain_id: number;
  from_address: string;
  to_address: string;
  amount: string;
  amount_usd: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  message_id: string;
  originator_name: string | null;
  originator_address: string | null;
  originator_country: string | null;
  originator_account_number: string | null;
  originator_date_of_birth: string | null;
  originator_place_of_birth: string | null;
  originator_national_id: string | null;
  beneficiary_name: string | null;
  beneficiary_address: string | null;
  beneficiary_country: string | null;
  beneficiary_account_number: string | null;
  originator_vasp: string | null;
  beneficiary_vasp: string | null;
  originator_vasp_lei: string | null;
  beneficiary_vasp_lei: string | null;
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

// ==================== TOKEN CARF TABLE ====================

/**
 * Token CARF reports table
 */
export interface TokenCARFTable {
  id: string;
  report_id: string;
  wallet_address: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  reporting_period_fiscal_year: string | null;
  total_transfer_in_usd: string;
  total_transfer_out_usd: string;
  total_swap_volume_usd: string;
  total_staking_rewards_usd: string;
  net_gain_loss_usd: string;
  transaction_count: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  submission_date: Date | null;
  acknowledgment_date: Date | null;
  rejection_reason: string | null;
  version: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== TOKEN CARF HOLDINGS TABLE ====================

/**
 * Token CARF holdings table
 */
export interface TokenCARFHoldingTable {
  id: string;
  carf_report_id: string;
  contract_address: string;
  token_symbol: string;
  chain_id: number;
  balance: string;
  balance_usd: string;
  cost_basis: string;
  unrealized_gain_loss: string;
  created_at: Date;
}

// ==================== TOKEN CARF TRANSACTIONS TABLE ====================

/**
 * Token CARF transactions table
 */
export interface TokenCARFTransactionTable {
  id: string;
  carf_report_id: string;
  transaction_type: 'transfer_in' | 'transfer_out' | 'swap' | 'stake' | 'unstake' | 'claim';
  transaction_date: Date;
  contract_address: string;
  token_symbol: string;
  amount: string;
  amount_usd: string;
  transaction_hash: string;
  chain_id: number;
  counterparty: string;
  gain_loss: string | null;
  cost_basis: string | null;
  created_at: Date;
}

// ==================== COMPLIANCE EVENTS TABLE ====================

/**
 * Compliance events log table
 */
export interface TokenComplianceEventTable {
  id: string;
  event_type: string;
  entity_type: 'contract' | 'holder' | 'transfer' | 'approval' | 'presale' | 'screening' | 'assessment' | 'travel_rule' | 'carf';
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
export interface TokenAuditLogTable {
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
export interface TokenMigrationsTable {
  id: number;
  name: string;
  executed_at: Date;
}
