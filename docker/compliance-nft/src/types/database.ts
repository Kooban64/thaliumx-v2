/**
 * Database Types for NFT Compliance Service
 * PostgreSQL table definitions for NFT compliance data
 */

// ==================== NFT COLLECTION TABLE ====================

/**
 * NFT collections table
 */
export interface NFTCollectionTable {
  id: string;
  contract_address: string;
  chain_id: number;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  banner_url: string | null;
  external_url: string | null;
  creator_address: string;
  creator_fee: number;
  total_supply: number;
  floor_price: string | null;
  total_volume: string | null;
  verified: boolean;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== NFT TOKEN TABLE ====================

/**
 * NFT tokens table
 */
export interface NFTTokenTable {
  id: string;
  token_id: string;
  contract_address: string;
  chain_id: number;
  collection_id: string;
  owner_address: string;
  creator_address: string;
  metadata: Record<string, unknown>;
  token_uri: string;
  token_standard: 'ERC721' | 'ERC1155';
  supply: number | null;
  last_sale_price: string | null;
  last_sale_currency: string | null;
  last_sale_date: Date | null;
  risk_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  flagged: boolean;
  flag_reason: string | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== NFT SALE TABLE ====================

/**
 * NFT sales table
 */
export interface NFTSaleTable {
  id: string;
  transaction_hash: string;
  block_number: number;
  timestamp: Date;
  chain_id: number;
  contract_address: string;
  token_id: string;
  collection_id: string;
  seller_address: string;
  buyer_address: string;
  price: string;
  currency: string;
  price_usd: string;
  marketplace: string;
  sale_type: 'fixed' | 'auction' | 'offer' | 'bundle';
  royalty_amount: string | null;
  royalty_recipient: string | null;
  platform_fee: string | null;
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

// ==================== NFT LISTING TABLE ====================

/**
 * NFT listings table
 */
export interface NFTListingTable {
  id: string;
  contract_address: string;
  token_id: string;
  chain_id: number;
  collection_id: string;
  seller_address: string;
  price: string;
  currency: string;
  price_usd: string;
  marketplace: string;
  listing_type: 'fixed' | 'auction' | 'dutch_auction';
  start_time: Date;
  end_time: Date | null;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== NFT BID TABLE ====================

/**
 * NFT bids table
 */
export interface NFTBidTable {
  id: string;
  contract_address: string;
  token_id: string;
  chain_id: number;
  collection_id: string;
  bidder_address: string;
  amount: string;
  currency: string;
  amount_usd: string;
  marketplace: string;
  bid_type: 'token' | 'collection' | 'trait';
  expiration_time: Date | null;
  status: 'active' | 'accepted' | 'cancelled' | 'expired' | 'outbid';
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ==================== WASH TRADING TABLE ====================

/**
 * Wash trading detection results table
 */
export interface WashTradingTable {
  id: string;
  contract_address: string;
  token_id: string;
  chain_id: number;
  detection_date: Date;
  is_wash_trading: boolean;
  confidence: number;
  indicators: string[];
  related_transactions: string[];
  related_addresses: string[];
  volume_inflation: string | null;
  price_manipulation: boolean | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== CONTENT SCREENING TABLE ====================

/**
 * Content screening results table
 */
export interface ContentScreeningTable {
  id: string;
  contract_address: string;
  token_id: string;
  chain_id: number;
  screening_date: Date;
  content_type: 'image' | 'video' | 'audio' | '3d_model' | 'other';
  content_url: string;
  is_flagged: boolean;
  flag_reasons: string[];
  moderation_score: number;
  categories: string[];
  manual_review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== ROYALTY COMPLIANCE TABLE ====================

/**
 * Royalty compliance table
 */
export interface RoyaltyComplianceTable {
  id: string;
  contract_address: string;
  chain_id: number;
  collection_id: string;
  royalty_percentage: number;
  royalty_recipient: string;
  enforcement_type: 'on_chain' | 'marketplace' | 'none';
  is_compliant: boolean;
  total_royalties_paid: string;
  total_royalties_owed: string;
  unpaid_royalties: string;
  last_checked: Date;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== NFT RISK ASSESSMENT TABLE ====================

/**
 * NFT risk assessments table
 */
export interface NFTRiskAssessmentTable {
  id: string;
  transaction_id: string;
  transaction_hash: string;
  contract_address: string;
  token_id: string;
  seller_address: string;
  buyer_address: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factor_seller_risk: number;
  factor_buyer_risk: number;
  factor_collection_risk: number;
  factor_price_risk: number;
  factor_content_risk: number;
  factor_wash_trading_risk: number;
  factor_marketplace_risk: number;
  factor_geography_risk: number;
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

// ==================== NFT TRAVEL RULE TABLE ====================

/**
 * NFT Travel Rule messages table
 */
export interface NFTTravelRuleTable {
  id: string;
  sale_id: string;
  contract_address: string;
  token_id: string;
  chain_id: number;
  seller_address: string;
  buyer_address: string;
  price: string;
  price_usd: string;
  currency: string;
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

// ==================== NFT CARF TABLE ====================

/**
 * NFT CARF reports table
 */
export interface NFTCARFTable {
  id: string;
  report_id: string;
  wallet_address: string;
  user_id: string | null;
  tenant_id: string;
  broker_id: string | null;
  reporting_period_start_date: Date;
  reporting_period_end_date: Date;
  reporting_period_fiscal_year: string | null;
  total_sales_volume_usd: string;
  total_purchases_volume_usd: string;
  total_royalties_received_usd: string;
  total_royalties_paid_usd: string;
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

// ==================== NFT CARF TRANSACTIONS TABLE ====================

/**
 * NFT CARF report transactions table
 */
export interface NFTCARFTransactionTable {
  id: string;
  carf_report_id: string;
  transaction_type: 'sale' | 'purchase' | 'mint' | 'transfer' | 'burn';
  transaction_date: Date;
  contract_address: string;
  token_id: string;
  collection_name: string;
  price: string;
  currency: string;
  price_usd: string;
  transaction_hash: string;
  chain_id: number;
  marketplace: string;
  counterparty: string;
  gain_loss: string | null;
  created_at: Date;
}

// ==================== COMPLIANCE EVENTS TABLE ====================

/**
 * Compliance events log table
 */
export interface NFTComplianceEventTable {
  id: string;
  event_type: string;
  entity_type: 'collection' | 'token' | 'sale' | 'listing' | 'bid' | 'wash_trading' | 'content' | 'assessment' | 'travel_rule' | 'carf';
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
export interface NFTAuditLogTable {
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
export interface NFTMigrationsTable {
  id: number;
  name: string;
  executed_at: Date;
}
