/**
 * Workflow Types and Interfaces
 * 
 * Defines all workflow types, states, and saga step interfaces
 * for the workflow orchestrator system.
 */

export enum WorkflowType {
  // User Management
  USER_ONBOARDING = 'user_onboarding',
  USER_SUSPENSION = 'user_suspension',
  USER_REACTIVATION = 'user_reactivation',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_CLOSURE = 'account_closure',
  API_KEY_ROTATION = 'api_key_rotation',
  CREDENTIAL_ROTATION = 'credential_rotation',
  USER_PROFILE_UPDATE = 'user_profile_update',

  // Trading Operations
  TRADING_ORDER = 'trading_order',
  ORDER_MODIFICATION = 'order_modification',
  ORDER_CANCELLATION = 'order_cancellation',
  ORDER_EXPIRATION = 'order_expiration',
  STOP_LOSS_TAKE_PROFIT = 'stop_loss_take_profit',
  MARGIN_TRADING_POSITION = 'margin_trading_position',
  DEX_SWAP = 'dex_swap',
  YIELD_FARMING = 'yield_farming',
  STAKING = 'staking',
  LIQUIDITY_MINING = 'liquidity_mining',
  LIQUIDITY_POOL_MANAGEMENT = 'liquidity_pool_management',
  CROSS_CHAIN_BRIDGE = 'cross_chain_bridge',

  // Payment Processing
  PAYMENT_PROCESSING = 'payment_processing',
  REFUND_PROCESSING = 'refund_processing',
  CHARGEBACK_DISPUTE = 'chargeback_dispute',
  SETTLEMENT_BATCH = 'settlement_batch',
  FIAT_OPERATIONS = 'fiat_operations',
  RECONCILIATION = 'reconciliation',

  // Compliance & Risk
  KYC_VERIFICATION = 'kyc_verification',
  KYC_REVERIFICATION = 'kyc_reverification',
  COMPLIANCE_CASE_REVIEW = 'compliance_case_review',
  SUSPICIOUS_ACTIVITY_INVESTIGATION = 'suspicious_activity_investigation',
  REGULATORY_REPORTING = 'regulatory_reporting',
  TOKEN_FREEZE = 'token_freeze',
  RISK_MONITORING = 'risk_monitoring',
  AUDIT_LOG_GENERATION = 'audit_log_generation',
  DATA_MIGRATION = 'data_migration',

  // Web3 Operations
  WEB3_WALLET_CREATION = 'web3_wallet_creation',
  NFT_MINTING = 'nft_minting',
  NFT_TRANSFER = 'nft_transfer',
  TOKEN_ISSUANCE = 'token_issuance',
  TOKEN_DISTRIBUTION = 'token_distribution',
  TOKEN_VESTING_RELEASE = 'token_vesting_release',
  TOKEN_BURN = 'token_burn',
  SMART_CONTRACT_DEPLOYMENT = 'smart_contract_deployment',
  SMART_CONTRACT_UPGRADE = 'smart_contract_upgrade',
  MULTI_SIG_SETUP = 'multi_sig_setup',

  // Infrastructure
  BROKER_ONBOARDING = 'broker_onboarding',
  BACKUP_CREATION = 'backup_creation',
  SERVICE_HEALTH_CHECK = 'service_health_check',
  CONFIGURATION_UPDATE = 'configuration_update',
  GOVERNANCE_PROPOSAL = 'governance_proposal',
  TOKEN_SALE = 'token_sale'
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  COMPENSATING = 'compensating'
}

export interface WorkflowState {
  workflowId: string;
  workflowType: WorkflowType;
  userId?: string;
  tenantId?: string;
  brokerId?: string;
  status: WorkflowStatus;
  currentStep: string;
  stepIndex: number;
  data: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface SagaStep {
  name: string;
  execute: (context: SagaContext) => Promise<any>;
  compensate?: (context: SagaContext) => Promise<void>;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number; // milliseconds
}

export interface SagaContext {
  workflowId: string;
  workflowType: WorkflowType;
  data: Record<string, any>;
  stepResults: Map<string, any>;
  userId?: string;
  tenantId?: string;
  brokerId?: string;
}

export interface SagaResult {
  success: boolean;
  workflowId: string;
  result?: any;
  error?: Error;
  compensated: boolean;
  stepsExecuted: string[];
  stepsCompensated: string[];
}

export interface WorkflowInput {
  workflowType: WorkflowType;
  userId?: string;
  tenantId?: string;
  brokerId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WorkflowResult {
  workflowId: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  result?: any;
  error?: string;
}

export interface WorkflowExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number; // milliseconds
  enableCompensation?: boolean;
}
