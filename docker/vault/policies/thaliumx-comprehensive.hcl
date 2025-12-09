# Thaliumx Comprehensive Secrets Policy
# =====================================
# This policy provides access to all secrets required by the Thaliumx platform
# Based on analysis of .secrets directory and application requirements

# ============================================
# KV Secrets Engine v2 - Application Secrets
# ============================================

# Database credentials
path "kv/data/thaliumx/database/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/database/*" {
  capabilities = ["read", "list"]
}

# Redis/Cache credentials
path "kv/data/thaliumx/cache/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/cache/*" {
  capabilities = ["read", "list"]
}

# JWT and authentication secrets
path "kv/data/thaliumx/jwt/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/jwt/*" {
  capabilities = ["read", "list"]
}

# Encryption keys
path "kv/data/thaliumx/encryption/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/encryption/*" {
  capabilities = ["read", "list"]
}

# SMTP/Email credentials
path "kv/data/thaliumx/smtp/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/smtp/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Exchange API Credentials
# ============================================

# Binance
path "kv/data/thaliumx/exchanges/binance" {
  capabilities = ["read"]
}

# Bybit
path "kv/data/thaliumx/exchanges/bybit" {
  capabilities = ["read"]
}

# Kucoin
path "kv/data/thaliumx/exchanges/kucoin" {
  capabilities = ["read"]
}

# Kraken
path "kv/data/thaliumx/exchanges/kraken" {
  capabilities = ["read"]
}

# OKX
path "kv/data/thaliumx/exchanges/okx" {
  capabilities = ["read"]
}

# Valr
path "kv/data/thaliumx/exchanges/valr" {
  capabilities = ["read"]
}

# Bitstamp
path "kv/data/thaliumx/exchanges/bitstamp" {
  capabilities = ["read"]
}

# All exchanges (wildcard)
path "kv/data/thaliumx/exchanges/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/exchanges/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Blockchain API Keys
# ============================================

# BscScan
path "kv/data/thaliumx/blockchain/bscscan" {
  capabilities = ["read"]
}

# EtherScan
path "kv/data/thaliumx/blockchain/etherscan" {
  capabilities = ["read"]
}

# Alchemy
path "kv/data/thaliumx/blockchain/alchemy" {
  capabilities = ["read"]
}

# Infura
path "kv/data/thaliumx/blockchain/infura" {
  capabilities = ["read"]
}

# Ankr
path "kv/data/thaliumx/blockchain/ankr" {
  capabilities = ["read"]
}

# All blockchain providers (wildcard)
path "kv/data/thaliumx/blockchain/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/blockchain/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Wallet Credentials
# ============================================

# Testnet admin wallet
path "kv/data/thaliumx/wallets/testnet-admin" {
  capabilities = ["read"]
}

# Mainnet admin wallet
path "kv/data/thaliumx/wallets/mainnet-admin" {
  capabilities = ["read"]
}

# All wallets (wildcard)
path "kv/data/thaliumx/wallets/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/wallets/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Banking/Payment Credentials
# ============================================

# Nedbank Deposit API
path "kv/data/thaliumx/banking/nedbank-deposit" {
  capabilities = ["read"]
}

# Nedbank PayShap API
path "kv/data/thaliumx/banking/nedbank-payshap" {
  capabilities = ["read"]
}

# Stripe
path "kv/data/thaliumx/payments/stripe" {
  capabilities = ["read"]
}

# All banking (wildcard)
path "kv/data/thaliumx/banking/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/banking/*" {
  capabilities = ["read", "list"]
}

# All payments (wildcard)
path "kv/data/thaliumx/payments/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/payments/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Compliance/KYC Credentials
# ============================================

# OFAC screening
path "kv/data/thaliumx/compliance/ofac" {
  capabilities = ["read"]
}

# Secure Citizen (KYC)
path "kv/data/thaliumx/compliance/secure-citizen" {
  capabilities = ["read"]
}

# All compliance (wildcard)
path "kv/data/thaliumx/compliance/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/compliance/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Messaging Credentials
# ============================================

# Kafka
path "kv/data/thaliumx/messaging/kafka" {
  capabilities = ["read"]
}

# Twilio
path "kv/data/thaliumx/messaging/twilio" {
  capabilities = ["read"]
}

# SendGrid
path "kv/data/thaliumx/messaging/sendgrid" {
  capabilities = ["read"]
}

# All messaging (wildcard)
path "kv/data/thaliumx/messaging/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/messaging/*" {
  capabilities = ["read", "list"]
}

# ============================================
# OAuth/Identity Credentials
# ============================================

# Keycloak
path "kv/data/thaliumx/oauth/keycloak" {
  capabilities = ["read"]
}

# All OAuth (wildcard)
path "kv/data/thaliumx/oauth/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/oauth/*" {
  capabilities = ["read", "list"]
}

# ============================================
# External API Keys
# ============================================

# All API keys
path "kv/data/thaliumx/api-keys/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/api-keys/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Shared Configuration
# ============================================

path "kv/data/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Service-Specific Configuration
# ============================================

# Backend service
path "kv/data/thaliumx/backend/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/backend/*" {
  capabilities = ["read", "list"]
}

# Trading service
path "kv/data/thaliumx/trading/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/trading/*" {
  capabilities = ["read", "list"]
}

# Fintech service
path "kv/data/thaliumx/fintech/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/fintech/*" {
  capabilities = ["read", "list"]
}

# ============================================
# Transit Secrets Engine - Encryption
# ============================================

# Encrypt data
path "transit/encrypt/thaliumx-*" {
  capabilities = ["update"]
}

# Decrypt data
path "transit/decrypt/thaliumx-*" {
  capabilities = ["update"]
}

# Generate data keys for envelope encryption
path "transit/datakey/plaintext/thaliumx-*" {
  capabilities = ["update"]
}

path "transit/datakey/wrapped/thaliumx-*" {
  capabilities = ["update"]
}

# Rewrap data (key rotation)
path "transit/rewrap/thaliumx-*" {
  capabilities = ["update"]
}

# Sign data
path "transit/sign/thaliumx-*" {
  capabilities = ["update"]
}

# Verify signatures
path "transit/verify/thaliumx-*" {
  capabilities = ["update"]
}

# HMAC
path "transit/hmac/thaliumx-*" {
  capabilities = ["update"]
}

# ============================================
# Database Secrets Engine - Dynamic Credentials
# ============================================

# Read database credentials
path "database/creds/thaliumx-*" {
  capabilities = ["read"]
}

# ============================================
# Token Self-Management
# ============================================

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}

# ============================================
# Cubbyhole - Temporary Secrets
# ============================================

path "cubbyhole/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# ============================================
# Identity - Entity Management (Read-Only)
# ============================================

path "identity/entity/id/*" {
  capabilities = ["read"]
}

path "identity/entity/name/*" {
  capabilities = ["read"]
}

# ============================================
# System Health (Read-Only)
# ============================================

path "sys/health" {
  capabilities = ["read"]
}

path "sys/capabilities-self" {
  capabilities = ["read", "update"]
}