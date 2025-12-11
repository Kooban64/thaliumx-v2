# ===========================================
# Vault Persistent Configuration
# ===========================================
# Production-ready configuration with file storage
# For internal network use (TLS optional)
# ===========================================

# Storage backend - file storage for persistence
storage "file" {
  path = "/vault/data"
}

# Listener configuration
listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  
  # TLS disabled for internal network
  # Enable TLS for production with external access
  tls_disable = true
}

# API address for client communication
api_addr = "http://thaliumx-vault:8200"

# Cluster address for HA communication
cluster_addr = "http://thaliumx-vault:8201"

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