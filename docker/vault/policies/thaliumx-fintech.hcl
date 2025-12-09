# Thaliumx Fintech Services Policy
# =================================
# Policy for fintech services (ballerine, blinkfinance)

# Read database credentials for fintech
path "database/creds/thaliumx-fintech" {
  capabilities = ["read"]
}

# Read KV secrets for fintech services
path "kv/data/thaliumx/fintech/*" {
  capabilities = ["read", "list"]
}

path "kv/metadata/thaliumx/fintech/*" {
  capabilities = ["read", "list"]
}

# Read shared secrets
path "kv/data/thaliumx/shared/*" {
  capabilities = ["read", "list"]
}

# Transit encryption for sensitive financial data
path "transit/encrypt/thaliumx-fintech" {
  capabilities = ["update"]
}

path "transit/decrypt/thaliumx-fintech" {
  capabilities = ["update"]
}

# Read KYC/AML provider credentials
path "kv/data/thaliumx/kyc/*" {
  capabilities = ["read"]
}

# Read payment provider credentials
path "kv/data/thaliumx/payments/*" {
  capabilities = ["read"]
}

# Read banking API credentials
path "kv/data/thaliumx/banking/*" {
  capabilities = ["read"]
}

# Read compliance service credentials
path "kv/data/thaliumx/compliance/*" {
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