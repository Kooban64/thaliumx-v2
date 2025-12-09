# Thaliumx Vault Admin Policy
# ===========================
# Full administrative access to Vault

# Manage auth methods
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Create, update, and delete auth methods
path "sys/auth/*" {
  capabilities = ["create", "update", "delete", "sudo"]
}

# List auth methods
path "sys/auth" {
  capabilities = ["read"]
}

# Manage secrets engines
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# List secrets engines
path "sys/mounts" {
  capabilities = ["read"]
}

# Manage policies
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# List policies
path "sys/policies/acl" {
  capabilities = ["list"]
}

# Read system health check
path "sys/health" {
  capabilities = ["read", "sudo"]
}

# Manage audit devices
path "sys/audit/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# List audit devices
path "sys/audit" {
  capabilities = ["read"]
}

# Manage capabilities
path "sys/capabilities" {
  capabilities = ["create", "update"]
}

path "sys/capabilities-self" {
  capabilities = ["create", "update"]
}

# Manage leases
path "sys/leases/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Manage tokens
path "auth/token/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# Manage identity
path "identity/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Read all secrets (admin access)
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Database secrets engine
path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Transit secrets engine
path "transit/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# PKI secrets engine
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

# KV secrets engine v2
path "kv/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Seal/Unseal
path "sys/seal" {
  capabilities = ["update", "sudo"]
}

path "sys/unseal" {
  capabilities = ["update", "sudo"]
}

# Step down
path "sys/step-down" {
  capabilities = ["update", "sudo"]
}

# Replication (Enterprise)
path "sys/replication/*" {
  capabilities = ["read", "list"]
}

# License (Enterprise)
path "sys/license/*" {
  capabilities = ["read"]
}

# Metrics
path "sys/metrics" {
  capabilities = ["read"]
}

# Internal counters
path "sys/internal/counters/*" {
  capabilities = ["read"]
}