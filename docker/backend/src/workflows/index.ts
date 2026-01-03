/**
 * Workflow Registry
 * 
 * Central registry for all workflow implementations.
 * Import all workflows here to ensure they are registered.
 */

// Import all workflows to register them
import './user-onboarding';
import './trading-order';
import './payment-processing';
import './order-cancellation';
import './user-suspension';
import './user-reactivation';
import './refund-processing';
import './token-issuance';
import './broker-onboarding';
import './password-reset';
import './account-closure';
import './order-modification';
import './web3-wallet-creation';
import './kyc-verification';
import './account-verification';
import './nft-minting';
import './token-burn';
import './staking';
import './governance-proposal';
// Note: Some workflow files are shared (e.g., FIAT_OPERATIONS handles both deposit and withdrawal)
import './deposit-processing';
import './withdrawal-processing';
import './api-key-rotation';
import './nft-transfer';
import './token-distribution';
import './chargeback-dispute';
import './token-freeze';
import './smart-contract-deployment';
import './order-expiration';
import './token-vesting-release';
import './token-sale';
import './backup-creation';
import './service-health-check';
import './credential-rotation';
import './user-profile-update';
import './stop-loss-take-profit';
import './margin-trading-position';
import './dex-swap';
import './yield-farming';
import './liquidity-mining';
import './liquidity-pool-management';
import './cross-chain-bridge';
import './settlement-batch';
import './reconciliation';
import './compliance-case-review';
import './suspicious-activity-investigation';
import './regulatory-reporting';
import './risk-monitoring';
import './audit-log-generation';
import './data-migration';
import './smart-contract-upgrade';
import './multi-sig-setup';
import './configuration-update';

// Export workflow types for convenience
export * from '../types/workflow';
