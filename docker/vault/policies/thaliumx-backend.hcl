# Thaliumx Backend Service Policy
# ================================
# Policy for backend application to access secrets

# Read database credentials
path "database/creds/thaliumx-backend" {
  capabilities = ["read"]
}

# Read KV secrets for backend
path "kv/data/thaliumx/backend/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/backend/*" {
  capabilities = ["read", "list"]
}

# Read shared secrets
path "kv/data/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

# Transit encryption/decryption for backend
path "transit/encrypt/thaliumx-backend" {
  capabilities = ["update"]
}

path "transit/decrypt/thaliumx-backend" {
  capabilities = ["update"]
}

# Generate data keys for envelope encryption
path "transit/datakey/plaintext/thaliumx-backend" {
  capabilities = ["update"]
}

# Read API keys
path "kv/data/thaliumx/api-keys/*" {
  capabilities = ["read"]
}

# Read JWT signing keys
path "kv/data/thaliumx/jwt/*" {
  capabilities = ["read"]
}

# Read OAuth/OIDC configuration
path "kv/data/thaliumx/oauth/*" {
  capabilities = ["read"]
}

# Read messaging credentials (Kafka)
path "kv/data/thaliumx/messaging/*" {
  capabilities = ["read"]
}

# Read cache credentials (Redis)
path "kv/data/thaliumx/cache/*" {
  capabilities = ["read"]
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