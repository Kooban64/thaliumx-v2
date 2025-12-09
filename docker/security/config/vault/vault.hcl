# Vault Production Configuration
# ================================
# This configuration is for production deployment with file storage backend.
# For high-availability, consider using Consul, etcd, or integrated storage (Raft).

# Storage backend - file storage for single-node deployment
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = false

  # TLS configuration for production
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
}

# API address for client communication
api_addr = "https://thaliumx-vault:8200"

# Cluster address for HA communication (if using HA storage backend)
cluster_addr = "https://thaliumx-vault:8201"

# Disable mlock - use IPC_LOCK capability in Docker instead
disable_mlock = true

# UI configuration
ui = true

# Telemetry configuration for Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# Audit logging
# Uncomment to enable file-based audit logging
# audit {
#   type = "file"
#   path = "file"
#   options = {
#     file_path = "/vault/logs/audit.log"
#   }
# }

# Default lease TTL
default_lease_ttl = "768h"

# Max lease TTL
max_lease_ttl = "8760h"

# Log level
log_level = "info"