# Thaliumx Keycloak Service Policy
# =================================
# Policy for Keycloak to access its secrets and database credentials
# Updated: 2025-12-17T12:25:00.000Z

# Read Keycloak-specific secrets
path "kv/data/thaliumx/keycloak/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/keycloak/*" {
  capabilities = ["read", "list"]
}

# Read shared secrets (for cross-service communication)
path "kv/data/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

# Database credentials (if using dynamic credentials)
path "database/creds/keycloak" {
  capabilities = ["read"]
}

# Transit encryption for sensitive data
path "transit/encrypt/keycloak" {
  capabilities = ["update"]
}

path "transit/decrypt/keycloak" {
  capabilities = ["update"]
}

# Token self-management
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/revoke-self" {
  capabilities = ["update"]
}

# Cubbyhole for temporary secrets
path "cubbyhole/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}