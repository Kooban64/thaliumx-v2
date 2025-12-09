# ===========================================
# Vault Production Configuration
# ===========================================
# This configuration uses file storage backend for single-node deployment
# with Shamir seal (no external cloud dependencies)
#
# For auto-unseal without cloud providers, we use:
# 1. Shamir seal with secure key management
# 2. Optional: Transit seal using a secondary Vault instance
#
# Storage: File-based (persistent across restarts)
# TLS: Required for production
# ===========================================

# Storage backend - file storage for single-node deployment
# Data persists in Docker volume
storage "file" {
  path = "/vault/data"
}

# For HA deployment with Raft integrated storage (alternative):
# storage "raft" {
#   path    = "/vault/data"
#   node_id = "vault-node-1"
#   
#   retry_join {
#     leader_api_addr = "https://vault-node-2:8200"
#   }
# }

# Primary listener with TLS
listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  
  # TLS configuration - REQUIRED for production
  tls_disable   = false
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
  tls_client_ca_file = "/vault/config/tls/ca.crt"
  
  # TLS settings
  tls_min_version = "tls12"
  tls_prefer_server_cipher_suites = true
  
  # Allowed cipher suites (strong ciphers only)
  tls_cipher_suites = "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
}

# API address for client communication
api_addr = "https://thaliumx-vault:8200"

# Cluster address for HA communication
cluster_addr = "https://thaliumx-vault:8201"

# Disable mlock - use IPC_LOCK capability in Docker instead
disable_mlock = true

# UI configuration
ui = true

# Telemetry configuration for Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
  unauthenticated_metrics_access = true
}

# Default lease TTL (32 days)
default_lease_ttl = "768h"

# Max lease TTL (1 year)
max_lease_ttl = "8760h"

# Log level
log_level = "info"

# Log format for structured logging
log_format = "json"

# ===========================================
# Seal Configuration
# ===========================================
# Using Shamir seal (default) - no external dependencies
# 
# For auto-unseal WITHOUT cloud providers, you have these options:
#
# Option 1: Shamir Seal (Default - Manual Unseal)
# - Requires 3 of 5 keys to unseal after restart
# - Keys should be distributed to different administrators
# - Most secure but requires manual intervention
#
# Option 2: Transit Seal (Self-hosted Auto-Unseal)
# - Uses a secondary Vault instance for auto-unseal
# - No cloud dependency
# - Requires managing two Vault instances
#
# Option 3: HSM Seal (Hardware Security Module)
# - Uses PKCS#11 compatible HSM
# - Highest security, no cloud dependency
# - Requires HSM hardware
# ===========================================

# Default: Shamir seal (no configuration needed)
# The seal stanza is omitted to use Shamir seal

# ===========================================
# Transit Seal Configuration (Optional)
# ===========================================
# Uncomment to use a secondary Vault for auto-unseal
# This requires setting up vault-unseal service first
#
# seal "transit" {
#   address         = "https://thaliumx-vault-unseal:8200"
#   token           = "TRANSIT_VAULT_TOKEN"
#   disable_renewal = "false"
#   
#   # Key configuration
#   key_name        = "autounseal"
#   mount_path      = "transit/"
#   
#   # TLS configuration
#   tls_ca_cert     = "/vault/config/tls/ca.crt"
#   tls_client_cert = "/vault/config/tls/vault.crt"
#   tls_client_key  = "/vault/config/tls/vault.key"
# }

# ===========================================
# HSM Seal Configuration (Optional)
# ===========================================
# Uncomment to use PKCS#11 HSM for auto-unseal
#
# seal "pkcs11" {
#   lib            = "/usr/lib/softhsm/libsofthsm2.so"
#   slot           = "0"
#   pin            = "PKCS11_PIN"
#   key_label      = "vault-hsm-key"
#   hmac_key_label = "vault-hsm-hmac-key"
# }