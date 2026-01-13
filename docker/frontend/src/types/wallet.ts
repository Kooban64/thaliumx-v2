/**
 * Wallet Types
 * Type definitions for wallet system
 */

export type WalletType = 'fiat' | 'crypto_hot' | 'crypto_cold' | 'thal_token' | 'trading' | 'web3';
export type WalletStatus = 'active' | 'suspended' | 'pending' | 'closed' | 'recovery' | 'inactive' | 'frozen';
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'swap' | 'trade';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Wallet {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  walletType: WalletType;
  currency: string;
  address?: string; // For crypto wallets
  accountId?: string; // For FIAT wallets
  status: WalletStatus;
  balance: string;
  availableBalance?: string;
  lockedBalance?: string;
  metadata: {
    provider?: string;
    network?: string;
    derivationPath?: string;
    publicKey?: string;
    encryptedPrivateKey?: string;
    recoveryPhrase?: string;
    mfaEnabled: boolean;
    lastBackup?: string;
    createdAt: string;
    updatedAt: string;
    version: string;
  };
  security: {
    accessCount: number;
    lastAccessed?: string;
    accessLog: Array<{
      accessedAt: string;
      ipAddress: string;
      userAgent: string;
      action: string;
    }>;
    fraudIndicators: string[];
  };
}

export interface WalletBalance {
  walletId: string;
  currency: string;
  balance: number;
  available: number;
  locked: number;
  usdValue: number;
  change24h?: number;
}

export interface Transaction {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: string;
  amount: number;
  fee: number;
  feeCurrency: string;
  fromAddress?: string;
  toAddress?: string;
  fromWalletId?: string;
  toWalletId?: string;
  txHash?: string;
  blockNumber?: number;
  confirmations?: number;
  exchangeRate?: number;
  metadata?: {
    description?: string;
    reference?: string;
    bankAccountId?: string;
    paymentMethod?: string;
    network?: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DepositRequest {
  walletId: string;
  currency: string;
  amount: number;
  method?: string; // 'bank', 'card', 'crypto', etc.
  bankAccountId?: string;
  reference?: string;
}

export interface WithdrawalRequest {
  walletId: string;
  currency: string;
  amount: number;
  toAddress: string; // For crypto
  toAccountId?: string; // For FIAT
  network?: string; // For crypto
  fee?: number;
}

export interface BankAccount {
  id: string;
  userId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountType: 'checking' | 'savings';
  currency: string;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface Web3Wallet {
  id: string;
  userId: string;
  address: string;
  chainId: number;
  walletType: string; // 'metamask', 'walletconnect', etc.
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  balance: string;
  network: string;
  connectedAt: string;
  lastUsedAt?: string;
}
