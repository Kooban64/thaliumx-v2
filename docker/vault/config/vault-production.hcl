# Thaliumx Vault Server Configuration - Production
# =================================================
# Production-ready configuration with TLS enabled

# Storage backend - using file storage for single-node deployment
storage "file" {
  path = "/vault/file"
}

# Listener configuration with TLS
listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_disable     = false
  tls_cert_file   = "/vault/certs/vault.crt"
  tls_key_file    = "/vault/certs/vault.key"
  tls_client_ca_file = "/vault/certs/ca.crt"
  
  # Telemetry
  telemetry {
    unauthenticated_metrics_access = true
  }
}

# Cluster listener with TLS
listener "tcp" {
  address         = "0.0.0.0:8201"
  tls_disable     = false
  tls_cert_file   = "/vault/certs/vault.crt"
  tls_key_file    = "/vault/certs/vault.key"
  cluster_address = "thaliumx-vault:8201"
}

# API address for client redirects
api_addr     = "https://thaliumx-vault:8200"
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

# Audit logging
# Enable after initialization with:
# vault audit enable file file_path=/vault/logs/audit.log