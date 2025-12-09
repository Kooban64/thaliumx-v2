# Thaliumx Vault Server Configuration
# ====================================
# Production-ready configuration for HashiCorp Vault

# Storage backend - using file storage for single-node deployment
# For HA deployment, switch to Raft or Consul
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_disable     = true  # Enable TLS in production with proper certs
  
  # Telemetry
  telemetry {
    unauthenticated_metrics_access = true
  }
}

# API address for client redirects
api_addr     = "http://thaliumx-vault:8200"
cluster_addr = "https://thaliumx-vault:8201"

# Cluster name
cluster_name = "thaliumx-vault-cluster"

# UI configuration
ui = true

# Logging
log_level = "info"
log_format = "json"

# Disable memory lock (for container environments)
disable_mlock = true

# Telemetry for Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# Default lease durations
default_lease_ttl = "768h"   # 32 days
max_lease_ttl     = "8760h"  # 365 days

# Plugin directory
plugin_directory = "/vault/plugins"

# Seal configuration - Auto-unseal options (uncomment for production)
# For AWS KMS:
# seal "awskms" {
#   region     = "us-east-1"
#   kms_key_id = "your-kms-key-id"
# }

# For Azure Key Vault:
# seal "azurekeyvault" {
#   tenant_id      = "your-tenant-id"
#   client_id      = "your-client-id"
#   client_secret  = "your-client-secret"
#   vault_name     = "your-vault-name"
#   key_name       = "your-key-name"
# }

# For GCP Cloud KMS:
# seal "gcpckms" {
#   project     = "your-project"
#   region      = "global"
#   key_ring    = "your-key-ring"
#   crypto_key  = "your-crypto-key"
# }

# For Transit auto-unseal (using another Vault):
# seal "transit" {
#   address         = "https://vault.example.com:8200"
#   token           = "your-token"
#   disable_renewal = "false"
#   key_name        = "autounseal"
#   mount_path      = "transit/"
# }