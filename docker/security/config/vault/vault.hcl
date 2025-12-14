# ===========================================
# Vault Production Configuration
# ===========================================
# File-based storage for single-node deployment
# Production-ready with proper security settings

# Storage backend - file storage for single-node deployment
storage "file" {
  path = "/vault/data"
}

# Primary listener - HTTP for internal Docker network
# TLS termination handled by APISIX gateway
# Only one listener block - no double definition
listener "tcp" {
  address         = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable     = true
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