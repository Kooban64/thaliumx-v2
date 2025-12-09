# ===========================================
# Vault Unseal Server Configuration
# ===========================================
# This is a secondary Vault instance used ONLY for auto-unsealing
# the primary Vault instance using Transit seal.
#
# This provides auto-unseal WITHOUT cloud provider dependencies.
#
# Architecture:
# 1. vault-unseal: Small Vault instance that holds the transit key
# 2. vault (primary): Main Vault that uses transit seal
#
# Setup Order:
# 1. Start vault-unseal
# 2. Initialize vault-unseal (save keys securely)
# 3. Unseal vault-unseal manually (one-time)
# 4. Configure transit engine on vault-unseal
# 5. Start primary vault (auto-unseals using vault-unseal)
#
# Security Notes:
# - vault-unseal should be on a separate host in production
# - vault-unseal keys should be stored in a secure location
# - Consider using HSM for vault-unseal in high-security environments
# ===========================================

# Storage backend - file storage
storage "file" {
  path = "/vault/data"
}

# Listener configuration with TLS
listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  
  # TLS configuration
  tls_disable   = false
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
  tls_client_ca_file = "/vault/config/tls/ca.crt"
  
  # TLS settings
  tls_min_version = "tls12"
}

# API address
api_addr = "https://thaliumx-vault-unseal:8200"

# Cluster address
cluster_addr = "https://thaliumx-vault-unseal:8201"

# Disable mlock
disable_mlock = true

# UI disabled for unseal server (security)
ui = false

# Telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# Shorter lease TTLs for unseal server
default_lease_ttl = "1h"
max_lease_ttl = "24h"

# Log level
log_level = "info"
log_format = "json"

# Shamir seal (default) - this server is manually unsealed
# The unseal keys for this server should be stored securely
# and distributed among trusted administrators